"""Local HTTP API, live change notifications, and the shared web interface."""

import asyncio
import hmac
import json
import os
import sqlite3
import tempfile
import zipfile
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool

from . import __version__
from .documents import (clean_note, note_html_to_markdown, prepare_document,
                        render_comment_markdown, render_note_markdown)
from .storage import Store, identifier, timestamp


STATIC = Path(__file__).parent / "static"
MAX_UPLOAD = 100 * 1024 * 1024
COLORS = Literal["yellow", "green", "blue", "pink"]


class FolderInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    parent_id: str | None = None
    color: Literal["sage", "sand", "blue", "rose"] = "sage"

    @field_validator("name")
    @classmethod
    def trim(cls, value):
        if not value.strip():
            raise ValueError("A folder needs a name.")
        return value.strip()


class NoteInput(BaseModel):
    title: str = Field(default="Untitled note", min_length=1, max_length=250)
    folder_id: str | None = None
    content: str = Field(default="<p><br></p>", max_length=5_000_000)
    markdown: str | None = Field(default=None, max_length=5_000_000)


class ItemUpdate(BaseModel):
    revision: int = Field(ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=250)
    folder_id: str | None = None
    content: str | None = Field(default=None, max_length=5_000_000)
    markdown: str | None = Field(default=None, max_length=5_000_000)


class AnnotationInput(BaseModel):
    kind: Literal["highlight", "underline", "strike", "comment"]
    color: COLORS = "yellow"
    quote: str = Field(min_length=1, max_length=100_000)
    anchor: dict
    comment: str | None = Field(default=None, max_length=20_000)
    comment_kind: Literal['reply', 'answer'] = 'reply'


class AnnotationUpdate(BaseModel):
    resolved: bool | None = None
    color: COLORS | None = None


class CommentInput(BaseModel):
    body: str = Field(min_length=1, max_length=20_000)
    kind: Literal['reply', 'answer'] = 'reply'

    @field_validator("body")
    @classmethod
    def trim(cls, value):
        if not value.strip():
            raise ValueError("Write something before posting.")
        return value.strip('\r\n')


class CommentTypeInput(BaseModel):
    kind: Literal['reply', 'answer']


class MarkdownPreviewInput(BaseModel):
    body: str = Field(default='', max_length=20_000)


class LegacyNoteInput(BaseModel):
    content: str = Field(max_length=5_000_000)


class SessionInput(BaseModel):
    token: str = Field(max_length=500)


class ChangeHub:
    def __init__(self):
        self.clients: set[WebSocket] = set()
        self.sequence = 0

    async def publish(self, request, scope, entity_id=None):
        self.sequence += 1
        payload = {"type": "change", "scope": scope, "id": entity_id,
                   "client": request.headers.get("x-notate-client"), "sequence": self.sequence}
        # Slow/disconnected clients cannot hold up a successful local save.
        async def deliver(client):
            try:
                await asyncio.wait_for(client.send_json(payload), 2)
            except Exception:
                self.clients.discard(client)
        await asyncio.gather(*(deliver(client) for client in tuple(self.clients)))


def create_app(data_dir: str | Path, token: str | None = None):
    store = Store(Path(data_dir))
    hub = ChangeHub()
    app = FastAPI(title="Notate", version=__version__)
    app.state.store = store
    app.state.hub = hub
    instance = identifier()

    def authorized(value):
        return not token or (value is not None and hmac.compare_digest(value.encode(), token.encode()))

    @app.middleware("http")
    async def protect_api(request: Request, call_next):
        if request.url.path.startswith("/api/"):
            if request.method not in {"GET", "HEAD", "OPTIONS"}:
                origin = request.headers.get("origin")
                expected = f"{request.url.scheme}://{request.headers.get('host')}"
                if origin and origin != expected:
                    return JSONResponse({"detail": "Requests must come from this Notate server."}, status_code=403)
            public = {"/api/health", "/api/session"}
            if request.url.path not in public and not authorized(request.cookies.get("notate_session")):
                return JSONResponse({"detail": "Unlock this workspace to continue."}, status_code=401)
        return await call_next(request)

    def item_or_404(item_id):
        item = store.item(item_id)
        if not item:
            raise HTTPException(404, "This document no longer exists.")
        return item

    def folder_exists(db, folder_id):
        if folder_id and not db.execute("SELECT id FROM folders WHERE id=?", (folder_id,)).fetchone():
            raise HTTPException(404, "This folder no longer exists.")

    def public_item(item):
        return {key: value for key, value in item.items() if key not in {"file_path", "pdf_path"}}

    @app.get("/api/health")
    def health():
        return {"app": "notate", "version": __version__, "instance": instance, "locked": bool(token)}

    @app.post("/api/session")
    def session(body: SessionInput):
        if not authorized(body.token):
            raise HTTPException(401, "That workspace password is incorrect.")
        response = JSONResponse({"ok": True})
        response.set_cookie("notate_session", body.token, httponly=True, samesite="strict")
        return response

    @app.get("/api/workspace")
    def workspace():
        return {"folders": store.folders(), "items": store.items()}

    @app.post('/api/markdown/preview')
    def markdown_preview(body: MarkdownPreviewInput):
        return {'html': render_comment_markdown(body.body)}

    @app.post("/api/folders", status_code=201)
    async def create_folder(body: FolderInput, request: Request):
        record = {"id": identifier(), **body.model_dump(), "created_at": timestamp()}
        with store.connect() as db:
            folder_exists(db, body.parent_id)
            db.execute("INSERT INTO folders (id,name,parent_id,color,created_at) VALUES (:id,:name,:parent_id,:color,:created_at)", record)
        await hub.publish(request, "workspace")
        return record

    @app.patch("/api/folders/{folder_id}")
    async def update_folder(folder_id: str, body: FolderInput, request: Request):
        with store.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            folder_exists(db, folder_id)
            folder_exists(db, body.parent_id)
            ancestor = body.parent_id
            while ancestor:
                if ancestor == folder_id:
                    raise HTTPException(409, "A folder cannot be moved into itself or one of its children.")
                ancestor = db.execute("SELECT parent_id FROM folders WHERE id=?", (ancestor,)).fetchone()[0]
            db.execute("UPDATE folders SET name=?,parent_id=?,color=? WHERE id=?", (body.name, body.parent_id, body.color, folder_id))
        await hub.publish(request, "workspace")
        return {"ok": True}

    @app.delete("/api/folders/{folder_id}")
    async def delete_folder(folder_id: str, request: Request):
        with store.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            folder_exists(db, folder_id)
            occupied = db.execute("SELECT id FROM items WHERE folder_id=? UNION ALL SELECT id FROM folders WHERE parent_id=? LIMIT 1",
                                  (folder_id, folder_id)).fetchone()
            if occupied:
                raise HTTPException(409, "Move the documents and subfolders out before deleting this folder.")
            db.execute("DELETE FROM folders WHERE id=?", (folder_id,))
        await hub.publish(request, "workspace")
        return {"ok": True}

    @app.post("/api/notes", status_code=201)
    async def create_note(body: NoteInput, request: Request):
        now = timestamp()
        item_id = identifier()
        title = body.title.strip()
        if not title:
            raise HTTPException(422, "A note needs a title.")
        if 'markdown' in body.model_fields_set and (body.markdown is None or 'content' in body.model_fields_set):
            raise HTTPException(422, 'Send Markdown text or legacy HTML content, not both.')
        source = body.markdown if body.markdown is not None else note_html_to_markdown(body.content)
        content = render_note_markdown(source) if body.markdown is not None else clean_note(body.content)
        with store.connect() as db:
            folder_exists(db, body.folder_id)
            db.execute("INSERT INTO items (id,title,kind,folder_id,content,markdown,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
                       (item_id, title, "note", body.folder_id, content, source, now, now))
        await hub.publish(request, "workspace")
        return public_item(item_or_404(item_id))

    @app.post('/api/notes/convert')
    def convert_note_draft(body: LegacyNoteInput):
        # Recover browser drafts from the old HTML editor without writing them
        # over a saved note or bypassing its revision check.
        return {'markdown': note_html_to_markdown(body.content)}

    @app.post("/api/import", status_code=201)
    async def import_file(request: Request, file: UploadFile, folder_id: str | None = None):
        with store.connect() as db:
            folder_exists(db, folder_id)
        name = Path((file.filename or "document").replace("\\", "/")).name
        extension = Path(name).suffix.lower()
        if extension not in {".pdf", ".docx", ".doc", ".odt", ".rtf", ".txt", ".md", ".markdown"}:
            raise HTTPException(422, "Import a PDF, DOCX, TXT, MD, DOC, ODT, or RTF file.")
        item_id = identifier()
        path = store.files / f"{item_id}{extension}"
        size = 0
        success = False
        try:
            with path.open("wb") as output:
                while chunk := await file.read(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_UPLOAD:
                        raise HTTPException(413, "This file exceeds the 100 MB import limit.")
                    output.write(chunk)
            if not size:
                raise HTTPException(422, "This file is empty.")
            try:
                prepared = await run_in_threadpool(prepare_document, path, name)
            except ValueError as exc:
                raise HTTPException(422, str(exc)) from exc
            now = timestamp()
            with store.connect() as db:
                folder_exists(db, folder_id)
                db.execute("""INSERT INTO items
                    (id,title,kind,folder_id,content,filename,file_path,pdf_path,page_count,size,created_at,updated_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""", (item_id, Path(name).stem, prepared["kind"], folder_id,
                    prepared["content"], name, path.name, prepared["pdf_path"], prepared["page_count"], size, now, now))
            success = True
        finally:
            await file.close()
            if not success:
                path.unlink(missing_ok=True)
                if extension != ".pdf":
                    path.with_suffix(".pdf").unlink(missing_ok=True)
        await hub.publish(request, "workspace")
        return public_item(item_or_404(item_id))

    @app.get("/api/items/{item_id}")
    def get_item(item_id: str):
        return public_item(item_or_404(item_id))

    @app.patch("/api/items/{item_id}")
    async def update_item(item_id: str, body: ItemUpdate, request: Request):
        fields = body.model_fields_set - {"revision"}
        with store.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            item = db.execute("SELECT * FROM items WHERE id=?", (item_id,)).fetchone()
            if not item:
                raise HTTPException(404, "This document no longer exists.")
            if item["revision"] != body.revision:
                raise HTTPException(409, "This note changed in another window. Your draft is preserved; choose which version to keep.")
            updates = {"updated_at": timestamp(), "revision": body.revision + 1}
            if "title" in fields:
                if not body.title or not body.title.strip():
                    raise HTTPException(422, "A document needs a title.")
                updates["title"] = body.title.strip()
            if "folder_id" in fields:
                folder_exists(db, body.folder_id)
                updates["folder_id"] = body.folder_id
            if 'markdown' in fields and 'content' in fields:
                raise HTTPException(422, 'Send Markdown text or legacy HTML content, not both.')
            if 'markdown' in fields:
                if item['kind'] != 'note':
                    raise HTTPException(422, 'Imported documents are read only. Create a note to write your findings.')
                if body.markdown is None:
                    raise HTTPException(422, 'Markdown must be text.')
                updates['markdown'] = body.markdown
                updates['content'] = render_note_markdown(body.markdown)
            if "content" in fields:
                if item["kind"] != "note":
                    raise HTTPException(422, "Imported documents are read only. Create a note to write your findings.")
                if body.content is None:
                    raise HTTPException(422, "Content must be text.")
                updates["content"] = clean_note(body.content)
                updates['markdown'] = note_html_to_markdown(updates['content'])
            assignments = ",".join(f"{key}=?" for key in updates)
            db.execute(f"UPDATE items SET {assignments} WHERE id=?", (*updates.values(), item_id))
        await hub.publish(request, "item", item_id)
        return public_item(item_or_404(item_id))

    @app.delete("/api/items/{item_id}")
    async def delete_item(item_id: str, request: Request):
        def remove():
            # A backup must finish copying the files referenced in its snapshot.
            with store.file_lock:
                item = item_or_404(item_id)
                with store.connect() as db:
                    db.execute("DELETE FROM items WHERE id=?", (item_id,))
                for name in {item["file_path"], item["pdf_path"]} - {None}:
                    (store.files / name).unlink(missing_ok=True)
        await run_in_threadpool(remove)
        await hub.publish(request, "workspace")
        return {"ok": True}

    @app.get("/api/items/{item_id}/file")
    def item_file(item_id: str, download: bool = False):
        item = item_or_404(item_id)
        name = item["file_path"] if download else (item["pdf_path"] or item["file_path"])
        if not name or not (store.files / name).exists():
            raise HTTPException(404, "The original file is unavailable.")
        is_pdf = name.endswith(".pdf")
        return FileResponse(store.files / name, media_type="application/pdf" if is_pdf else None,
                            filename=item["filename"] if download else None,
                            content_disposition_type="attachment" if download else "inline",
                            headers={"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"})

    def validate_anchor(anchor, item):
        if anchor.get("type") == "pdf":
            pages = anchor.get("pages")
            if not item["has_pdf"] or not isinstance(pages, list) or not 1 <= len(pages) <= 100:
                raise HTTPException(422, "Select text in a PDF page first.")
            total = 0
            for page in pages:
                if not isinstance(page, dict) or type(page.get("page")) is not int or not 1 <= page["page"] <= item["page_count"]:
                    raise HTTPException(422, "Invalid PDF page.")
                rects = page.get("rects")
                if not isinstance(rects, list) or not rects:
                    raise HTTPException(422, "Select text on the page first.")
                total += len(rects)
                if total > 10000:
                    raise HTTPException(422, "Select a smaller passage.")
                for rect in rects:
                    if not isinstance(rect, dict) or not all(isinstance(rect.get(k), (int, float)) and not isinstance(rect[k], bool)
                        and 0 <= rect[k] <= 1 for k in ("x", "y", "width", "height")):
                        raise HTTPException(422, "Invalid selection position.")
        elif anchor.get("type") == "text":
            if item["has_pdf"] or type(anchor.get("start")) is not int or type(anchor.get("end")) is not int:
                raise HTTPException(422, "Invalid text selection.")
            if not 0 <= anchor["start"] < anchor["end"] <= 10_000_000:
                raise HTTPException(422, "Invalid text selection.")
            for key in ("prefix", "suffix"):
                if not isinstance(anchor.get(key, ""), str) or len(anchor.get(key, "")) > 100:
                    raise HTTPException(422, "Invalid text context.")
        else:
            raise HTTPException(422, "Select a passage before annotating.")

    @app.get("/api/items/{item_id}/annotations")
    def get_annotations(item_id: str):
        item_or_404(item_id)
        return store.annotations(item_id)

    @app.post("/api/items/{item_id}/annotations", status_code=201)
    async def create_annotation(item_id: str, body: AnnotationInput, request: Request):
        item = item_or_404(item_id)
        validate_anchor(body.anchor, item)
        if not body.quote.strip():
            raise HTTPException(422, "Select some text first.")
        if body.kind == "comment" and not (body.comment or "").strip():
            raise HTTPException(422, "Write a comment before posting.")
        annotation_id = identifier()
        now = timestamp()
        with store.connect() as db:
            # The item may have been removed while another client was selecting.
            if not db.execute("SELECT id FROM items WHERE id=?", (item_id,)).fetchone():
                raise HTTPException(404, "This document no longer exists.")
            db.execute("INSERT INTO annotations VALUES (?,?,?,?,?,?,?,?)", (annotation_id, item_id,
                       body.kind, body.color, body.quote, json.dumps(body.anchor), 0, now))
            if body.comment and body.comment.strip():
                db.execute("INSERT INTO comments (id,annotation_id,body,created_at,kind) VALUES (?,?,?,?,?)",
                           (identifier(), annotation_id, body.comment.strip('\r\n'), now, body.comment_kind))
        await hub.publish(request, "annotations", item_id)
        return next(a for a in store.annotations(item_id) if a["id"] == annotation_id)

    def annotation_or_404(db, annotation_id):
        row = db.execute("SELECT * FROM annotations WHERE id=?", (annotation_id,)).fetchone()
        if not row:
            raise HTTPException(404, "This annotation no longer exists.")
        return row

    @app.patch("/api/annotations/{annotation_id}")
    async def update_annotation(annotation_id: str, body: AnnotationUpdate, request: Request):
        with store.connect() as db:
            annotation = annotation_or_404(db, annotation_id)
            if body.resolved is not None:
                db.execute("UPDATE annotations SET resolved=? WHERE id=?", (body.resolved, annotation_id))
            if body.color:
                db.execute("UPDATE annotations SET color=? WHERE id=?", (body.color, annotation_id))
        await hub.publish(request, "annotations", annotation["item_id"])
        return {"ok": True}

    @app.delete("/api/annotations/{annotation_id}")
    async def delete_annotation(annotation_id: str, request: Request):
        with store.connect() as db:
            annotation = annotation_or_404(db, annotation_id)
            db.execute("DELETE FROM annotations WHERE id=?", (annotation_id,))
        await hub.publish(request, "annotations", annotation["item_id"])
        return {"ok": True}

    @app.post("/api/annotations/{annotation_id}/comments", status_code=201)
    async def reply(annotation_id: str, body: CommentInput, request: Request):
        record = {"id": identifier(), "annotation_id": annotation_id, "body": body.body,
                  "created_at": timestamp(), "kind": body.kind}
        with store.connect() as db:
            annotation = annotation_or_404(db, annotation_id)
            db.execute("INSERT INTO comments (id,annotation_id,body,created_at,kind) VALUES (:id,:annotation_id,:body,:created_at,:kind)", record)
        await hub.publish(request, "annotations", annotation["item_id"])
        record['html'] = render_comment_markdown(record['body'])
        return record

    @app.patch('/api/comments/{comment_id}')
    async def set_comment_type(comment_id: str, body: CommentTypeInput, request: Request):
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('''SELECT c.*, a.item_id FROM comments c JOIN annotations a ON a.id=c.annotation_id
                WHERE c.id=?''', (comment_id,)).fetchone()
            if not row:
                raise HTTPException(404, 'This thread entry no longer exists.')
            db.execute('UPDATE comments SET kind=? WHERE id=?', (body.kind, comment_id))
            record = dict(row)
        item_id = record.pop('item_id')
        record['kind'] = body.kind
        record['html'] = render_comment_markdown(record['body'])
        await hub.publish(request, 'annotations', item_id)
        return record

    @app.get("/api/items/{item_id}/export")
    def export_item(item_id: str):
        item = public_item(item_or_404(item_id))
        return JSONResponse({"document": item, "annotations": store.annotations(item_id)},
                            headers={"Content-Disposition": 'attachment; filename="notate-annotations.json"'})

    @app.get("/api/backup")
    async def backup():
        def build_backup():
            handle, archive_path = tempfile.mkstemp(prefix="notate-backup-", suffix=".zip")
            os.close(handle)
            try:
                with store.file_lock, tempfile.TemporaryDirectory() as temporary:
                    snapshot = Path(temporary) / "notate.sqlite3"
                    with store.connect() as source, sqlite3.connect(snapshot) as destination:
                        source.backup(destination)
                        filenames = {name for row in destination.execute("SELECT file_path,pdf_path FROM items") for name in row if name}
                    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                        archive.write(snapshot, "notate.sqlite3")
                        for name in filenames:
                            archive.write(store.files / name, f"files/{name}")
                return archive_path
            except BaseException:
                Path(archive_path).unlink(missing_ok=True)
                raise
        path = await run_in_threadpool(build_backup)
        return FileResponse(path, filename="notate-workspace.zip", media_type="application/zip",
                            background=BackgroundTask(Path(path).unlink, missing_ok=True))

    @app.websocket("/api/events")
    async def events(websocket: WebSocket):
        origin = websocket.headers.get("origin")
        expected = f"{'https' if websocket.url.scheme == 'wss' else 'http'}://{websocket.headers.get('host')}"
        if (origin and origin != expected) or not authorized(websocket.cookies.get("notate_session")):
            await websocket.close(code=1008)
            return
        await websocket.accept()
        hub.clients.add(websocket)
        try:
            await websocket.send_json({"type": "connected", "instance": instance, "sequence": hub.sequence})
            while True:
                message = await websocket.receive_text()
                if message == "ping":
                    await websocket.send_json({"type": "pong"})
        except (WebSocketDisconnect, RuntimeError):
            pass
        finally:
            hub.clients.discard(websocket)

    @app.get("/")
    def index():
        return FileResponse(STATIC / "index.html", headers={"Cache-Control": "no-cache"})

    app.mount("/static", StaticFiles(directory=STATIC), name="static")
    return app
