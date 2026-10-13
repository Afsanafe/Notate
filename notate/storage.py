"""SQLite persistence. Each operation owns its connection and transaction."""

import json
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from .documents import note_html_to_markdown, render_comment_markdown


def identifier():
    return uuid.uuid4().hex


def timestamp():
    return datetime.now(timezone.utc).isoformat()


class Store:
    def __init__(self, directory: Path):
        self.file_lock = threading.RLock()
        self.directory = directory.resolve()
        self.directory.mkdir(parents=True, exist_ok=True)
        self.files = self.directory / "files"
        self.files.mkdir(exist_ok=True)
        self.path = self.directory / "notate.sqlite3"
        with self.connect() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS folders (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, parent_id TEXT REFERENCES folders(id),
                    color TEXT NOT NULL DEFAULT 'sage', created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS items (
                    id TEXT PRIMARY KEY, title TEXT NOT NULL, kind TEXT NOT NULL,
                    folder_id TEXT REFERENCES folders(id), content TEXT NOT NULL DEFAULT '',
                    filename TEXT, file_path TEXT, pdf_path TEXT, page_count INTEGER,
                    size INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS annotations (
                    id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
                    kind TEXT NOT NULL, color TEXT NOT NULL, quote TEXT NOT NULL,
                    anchor TEXT NOT NULL, resolved INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS comments (
                    id TEXT PRIMARY KEY, annotation_id TEXT NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
                    body TEXT NOT NULL, created_at TEXT NOT NULL,
                    kind TEXT NOT NULL DEFAULT 'reply' CHECK(kind IN ('reply', 'answer'))
                );
                CREATE INDEX IF NOT EXISTS items_folder ON items(folder_id);
                CREATE INDEX IF NOT EXISTS annotations_item ON annotations(item_id);
                CREATE INDEX IF NOT EXISTS comments_annotation ON comments(annotation_id);
            """)
            db.execute("BEGIN IMMEDIATE")
            if 'kind' not in {row['name'] for row in db.execute('PRAGMA table_info(comments)')}:
                db.execute("ALTER TABLE comments ADD COLUMN kind TEXT NOT NULL DEFAULT 'reply' CHECK(kind IN ('reply', 'answer'))")
            if 'markdown' not in {row['name'] for row in db.execute('PRAGMA table_info(items)')}:
                db.execute('ALTER TABLE items ADD COLUMN markdown TEXT')
            if not db.execute("SELECT value FROM settings WHERE key = 'initialized'").fetchone():
                now = timestamp()
                reading, notes = identifier(), identifier()
                db.executemany("INSERT INTO folders VALUES (?,?,?,?,?)", [
                    (reading, "Reading room", None, "sage", now),
                    (notes, "My notes", None, "sand", now),
                ])
                content = """<h1>A little space for big ideas.</h1>
<p>Welcome to Notate. Keep your reading, questions, and discoveries together in a workspace that lives on your computer.</p>
<h2>Make it your own</h2>
<p>Create folders in the sidebar to organize a project, a course, or a curiosity. Use <strong>New note</strong> to capture your thoughts, or <strong>Import</strong> to bring in a PDF, Word document, Markdown file, or text file.</p>
<h2>Read with a pencil in hand</h2>
<p>Select a few words in this note to see your annotation tools. Highlight a passage, underline something important, cross out an idea, or leave a comment. Comments highlight their text automatically.</p>
<blockquote>A good question is the beginning of a discovery.</blockquote>
<p>Use a comment to ask a question. Reply to the same thread when you find an answer, then resolve it to keep track of your progress.</p>
<h2>One workspace, two ways in</h2>
<p>Open Notate in your browser or the desktop app. Both connect to the same local Python server, and updates appear live in other open windows. Your files and annotations stay in the local database.</p>
<p><em>Try it: select “A good question” above and add your first comment.</em></p>"""
                db.execute("INSERT INTO items (id,title,kind,folder_id,content,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
                           (identifier(), "Welcome to Notate", "note", notes, content, now, now))
                db.execute("INSERT INTO settings VALUES ('initialized', '1')")
            # Retain the original rendered content and all text anchors. The new
            # source is rendered only after the user actually edits the note.
            for note in db.execute("SELECT id,content FROM items WHERE kind='note' AND markdown IS NULL").fetchall():
                db.execute('UPDATE items SET markdown=? WHERE id=?',
                           (note_html_to_markdown(note['content']), note['id']))

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def folders(self):
        with self.connect() as db:
            return [dict(row) for row in db.execute("SELECT * FROM folders ORDER BY name COLLATE NOCASE")]

    def items(self):
        with self.connect() as db:
            return [dict(row) for row in db.execute("""SELECT id,title,kind,folder_id,filename,page_count,size,
                revision,created_at,updated_at, CASE WHEN pdf_path IS NOT NULL OR kind='pdf' THEN 1 ELSE 0 END AS has_pdf,
                (SELECT COUNT(*) FROM annotations a WHERE a.item_id=items.id) AS annotation_count
                FROM items ORDER BY updated_at DESC""")]

    def item(self, item_id):
        with self.connect() as db:
            row = db.execute("SELECT * FROM items WHERE id=?", (item_id,)).fetchone()
            if not row:
                return None
            item = dict(row)
            item["has_pdf"] = bool(item["pdf_path"] or item["kind"] == "pdf")
            return item

    def annotations(self, item_id):
        with self.connect() as db:
            rows = db.execute("SELECT * FROM annotations WHERE item_id=? ORDER BY created_at", (item_id,)).fetchall()
            result = []
            for row in rows:
                record = dict(row)
                record["anchor"] = json.loads(record["anchor"])
                record["resolved"] = bool(record["resolved"])
                record["comments"] = [dict(c) for c in db.execute(
                    "SELECT * FROM comments WHERE annotation_id=? ORDER BY created_at,rowid", (record["id"],))]
                for comment in record["comments"]:
                    comment["html"] = render_comment_markdown(comment["body"])
                result.append(record)
            return result
