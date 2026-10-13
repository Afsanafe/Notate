import io
import json
import sqlite3
import threading
import zipfile

from docx import Document
from fastapi.testclient import TestClient
from pypdf import PdfReader, PdfWriter
import pytest

from notate.app import create_app


def new_note(client, **overrides):
    response = client.post('/api/notes', json={'title':'Research question','content':'<p>A good question starts a discovery.</p>',**overrides})
    assert response.status_code == 201
    return response.json()


def text_annotation(client, item_id, **overrides):
    response = client.post(f'/api/items/{item_id}/annotations', json={
        'kind':'comment','color':'yellow','quote':'A good question',
        'anchor':{'type':'text','start':0,'end':15,'prefix':'','suffix':' starts'},
        'comment':'Why does this matter?',**overrides})
    assert response.status_code == 201
    return response.json()


def test_note_conflicts_do_not_overwrite_and_persist(client, app):
    item = new_note(client)
    saved = client.patch(f'/api/items/{item["id"]}',json={'revision':1,'content':'<p>The first window saved this.</p>'})
    assert saved.status_code == 200
    assert saved.json()['revision'] == 2
    stale = client.patch(f'/api/items/{item["id"]}',json={'revision':1,'content':'<p>A stale draft.</p>'})
    assert stale.status_code == 409
    with TestClient(create_app(app.state.store.directory)) as restarted:
        actual = restarted.get(f'/api/items/{item["id"]}').json()
        assert actual['content'] == '<p>The first window saved this.</p>'
        assert actual['revision'] == 2


def test_nested_folder_cycles_and_nonempty_delete(client):
    root = client.post('/api/folders',json={'name':'Research'}).json()
    child = client.post('/api/folders',json={'name':'Questions','parent_id':root['id']}).json()
    cycle = client.patch(f'/api/folders/{root["id"]}',json={'name':'Research','parent_id':child['id']})
    assert cycle.status_code == 409
    note = new_note(client,folder_id=child['id'])
    assert client.delete(f'/api/folders/{child["id"]}').status_code == 409
    assert client.patch(f'/api/items/{note["id"]}',json={'revision':1,'folder_id':None}).status_code == 200
    assert client.delete(f'/api/folders/{child["id"]}').status_code == 200
    assert client.delete(f'/api/folders/{root["id"]}').status_code == 200
    assert client.get(f'/api/items/{note["id"]}').json()['folder_id'] is None


def test_threads_replies_resolving_and_cascade(client, app):
    note = new_note(client)
    annotation = text_annotation(client,note['id'])
    response = client.post(f'/api/annotations/{annotation["id"]}/comments',json={'body':'It helps connect observations.'})
    assert response.status_code == 201
    assert client.patch(f'/api/annotations/{annotation["id"]}',json={'resolved':True}).status_code == 200
    records = client.get(f'/api/items/{note["id"]}/annotations').json()
    assert records[0]['resolved'] is True
    assert [c['body'] for c in records[0]['comments']] == ['Why does this matter?','It helps connect observations.']
    assert client.delete(f'/api/items/{note["id"]}').status_code == 200
    with app.state.store.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM annotations').fetchone()[0] == 0
        assert db.execute('SELECT COUNT(*) FROM comments').fetchone()[0] == 0


def test_answer_type_markdown_changes_persist_sync_and_export(client, app):
    note = new_note(client)
    annotation = text_annotation(client,note['id'],comment='**Question:** why?')
    first = annotation['comments'][0]
    assert first['kind'] == 'reply' and '<strong>Question:</strong>' in first['html']
    body = '**Finding:** evidence helps.\n\n- Observe\n- Compare\n\n`result = 2`'
    answer = client.post(f'/api/annotations/{annotation["id"]}/comments',json={'body':body,'kind':'answer'}).json()
    assert answer['kind'] == 'answer' and answer['body'] == body
    assert '<strong>Finding:</strong>' in answer['html'] and '<ul>' in answer['html'] and '<code>result = 2</code>' in answer['html']
    with client.websocket_connect('/api/events') as socket:
        socket.receive_json()
        changed = client.patch(f'/api/comments/{answer["id"]}',json={'kind':'reply'},headers={'X-Notate-Client':'other-window'})
        assert changed.status_code == 200 and changed.json()['body'] == body and changed.json()['kind'] == 'reply'
        event = socket.receive_json()
        assert event['scope'] == 'annotations' and event['id'] == note['id'] and event['client'] == 'other-window'
    assert client.patch(f'/api/comments/{answer["id"]}',json={'kind':'answer'}).status_code == 200
    with TestClient(create_app(app.state.store.directory)) as restarted:
        exported = restarted.get(f'/api/items/{note["id"]}/export').json()['annotations'][0]['comments']
        assert exported[1]['kind'] == 'answer' and exported[1]['body'] == body
    assert client.patch(f'/api/comments/{answer["id"]}',json={'kind':'unexpected'}).status_code == 422
    assert client.patch('/api/comments/missing',json={'kind':'answer'}).status_code == 404


def test_existing_comment_database_migrates_without_losing_threads(client, app):
    note = new_note(client)
    annotation = text_annotation(client,note['id'],comment='**Original** question.')
    # Recreate the schema used by earlier Notate installations, preserving its rows.
    with app.state.store.connect() as db:
        db.executescript('''
            CREATE TABLE legacy_comments (id TEXT PRIMARY KEY,
                annotation_id TEXT NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
                body TEXT NOT NULL, created_at TEXT NOT NULL);
            INSERT INTO legacy_comments SELECT id,annotation_id,body,created_at FROM comments;
            DROP TABLE comments;
            ALTER TABLE legacy_comments RENAME TO comments;
        ''')
    for _ in range(2):
        with TestClient(create_app(app.state.store.directory)) as restarted:
            comments = restarted.get(f'/api/items/{note["id"]}/annotations').json()[0]['comments']
            assert len(comments) == 1
            assert comments[0]['id'] == annotation['comments'][0]['id']
            assert comments[0]['body'] == '**Original** question.' and comments[0]['kind'] == 'reply'
            assert '<strong>Original</strong>' in comments[0]['html']
    with TestClient(create_app(app.state.store.directory)) as restarted:
        assert restarted.patch(f'/api/comments/{comments[0]["id"]}',json={'kind':'answer'}).status_code == 200


def test_markdown_preview_matches_saved_rendering_and_sanitizes_html(client):
    body = '# Heading\n\n**bold** and *italic* and ~~old~~\nnext line\n\n> a quotation\n\n1. first\n2. second\n\n```python\nprint("hello")\n```\n\n| Key | Value |\n| --- | --- |\n| A | B |\n\n[safe](https://example.com)'
    rendered = client.post('/api/markdown/preview',json={'body':body})
    assert rendered.status_code == 200
    html = rendered.json()['html']
    for tag in ('<h1>', '<strong>', '<em>', '<s>', '<br>', '<blockquote>', '<ol>', '<pre><code>', '<table>'):
        assert tag in html
    assert 'href="https://example.com"' in html
    note = new_note(client)
    annotation = text_annotation(client,note['id'],comment=body,comment_kind='answer')
    assert annotation['comments'][0]['html'] == html and annotation['comments'][0]['kind'] == 'answer'
    unsafe = '<script>alert(1)</script><img src=x onerror=alert(1)>[unsafe](javascript:alert(1))'
    sanitized = client.post('/api/markdown/preview',json={'body':unsafe}).json()['html']
    assert '<script' not in sanitized and '<img' not in sanitized and 'onerror' not in sanitized and 'javascript:' not in sanitized
    indented = client.post(f'/api/annotations/{annotation["id"]}/comments',json={'body':'    indented code'}).json()
    assert indented['body'] == '    indented code' and '<pre><code>indented code' in indented['html']
    assert client.post('/api/markdown/preview',json={'body':'x'*20001}).status_code == 422


def test_pdf_bytes_preserved_range_requests_and_anchors(client, pdf_bytes):
    response = client.post('/api/import',files={'file':('field-guide.pdf',pdf_bytes,'application/pdf')})
    assert response.status_code == 201
    item = response.json()
    assert item['has_pdf'] is True and item['page_count'] == 2
    assert 'file_path' not in item
    assert client.get(f'/api/items/{item["id"]}/file').content == pdf_bytes
    partial = client.get(f'/api/items/{item["id"]}/file',headers={'Range':'bytes=0-99'})
    assert partial.status_code == 206 and partial.content == pdf_bytes[:100]
    anchor = {'type':'pdf','pages':[{'page':1,'rects':[{'x':.1,'y':.1,'width':.3,'height':.02}]}]}
    annotation = text_annotation(client,item['id'],anchor=anchor,quote='Reading is a conversation',kind='underline',comment=None)
    assert annotation['anchor'] == anchor
    anchor['pages'][0]['page'] = 3
    assert client.post(f'/api/items/{item["id"]}/annotations',json={'kind':'highlight','quote':'text','anchor':anchor}).status_code == 422
    assert client.patch(f'/api/items/{item["id"]}',json={'revision':1,'content':'Replaced'}).status_code == 422


@pytest.mark.parametrize('algorithm', ['AES-128', 'AES-256'])
def test_openable_aes_pdf_imports_without_changing_original(client, pdf_bytes, algorithm):
    writer = PdfWriter(clone_from=PdfReader(io.BytesIO(pdf_bytes)))
    writer.encrypt(user_password='', owner_password='document-owner', algorithm=algorithm)
    output = io.BytesIO()
    writer.write(output)
    encrypted = output.getvalue()
    response = client.post('/api/import',files={'file':('aes-encrypted.pdf',encrypted,'application/pdf')})
    assert response.status_code == 201, response.json()
    item = response.json()
    assert item['has_pdf'] is True and item['page_count'] == 2
    assert client.get(f'/api/items/{item["id"]}/file?download=true').content == encrypted


def test_aes_pdf_with_opening_password_still_requires_unlocked_copy(client, app, pdf_bytes):
    writer = PdfWriter(clone_from=PdfReader(io.BytesIO(pdf_bytes)))
    writer.encrypt(user_password='opening-password', owner_password='document-owner', algorithm='AES-256')
    output = io.BytesIO()
    writer.write(output)
    response = client.post('/api/import',files={'file':('password-protected.pdf',output.getvalue(),'application/pdf')})
    assert response.status_code == 422
    assert 'password protected' in response.json()['detail']
    assert list(app.state.store.files.iterdir()) == []


def test_missing_aes_dependency_has_actionable_error(client, monkeypatch, pdf_bytes):
    from pypdf.errors import DependencyError

    def missing_crypto(path):
        raise DependencyError('cryptography is required for AES algorithm')

    monkeypatch.setattr('notate.documents.PdfReader',missing_crypto)
    response = client.post('/api/import',files={'file':('aes.pdf',pdf_bytes,'application/pdf')})
    assert response.status_code == 422
    assert 'AES support is missing' in response.json()['detail']
    assert 'restart' in response.json()['detail']


def test_docx_fallback_preserves_text_formatting_tables(client, monkeypatch):
    monkeypatch.setattr('notate.documents.convert_office',lambda *args:None)
    document = Document()
    document.add_heading('A Word document',0)
    paragraph = document.add_paragraph('A useful ')
    paragraph.add_run('finding').bold = True
    table = document.add_table(rows=1,cols=2)
    table.cell(0,0).text = 'Question'
    table.cell(0,1).text = 'Answer'
    data = io.BytesIO()
    document.save(data)
    imported = client.post('/api/import',files={'file':('research.docx',data.getvalue())})
    assert imported.status_code == 201
    item = client.get(f'/api/items/{imported.json()["id"]}').json()
    assert not item['has_pdf']
    assert '<h1>A Word document</h1>' in item['content']
    assert '<strong>finding</strong>' in item['content']
    assert '<table>' in item['content'] and 'Answer' in item['content']


def test_bad_imports_are_removed(client, app):
    assert client.post('/api/import',files={'file':('broken.pdf',b'not a PDF')}).status_code == 422
    assert client.post('/api/import',files={'file':('broken.docx',b'not a Word archive')}).status_code == 422
    assert client.post('/api/import',files={'file':('empty.txt',b'')}).status_code == 422
    assert client.post('/api/import',files={'file':('bad.html',b'<script>alert(1)</script>')}).status_code == 422
    assert list(app.state.store.files.iterdir()) == []


def test_local_sync_events_identify_origin_and_scope(client):
    with client.websocket_connect('/api/events') as socket:
        assert socket.receive_json()['type'] == 'connected'
        response = client.post('/api/notes',headers={'X-Notate-Client':'desktop-window'},json={'title':'Live note'})
        assert response.status_code == 201
        event = socket.receive_json()
        assert event['scope'] == 'workspace' and event['client'] == 'desktop-window'
        assert event['sequence'] == 1
        socket.send_text('ping')
        assert socket.receive_json() == {'type':'pong'}


def test_backup_is_restorable_and_exports_threads(client, tmp_path, pdf_bytes):
    note = new_note(client)
    text_annotation(client,note['id'])
    imported = client.post('/api/import',files={'file':('original.pdf',pdf_bytes)}).json()
    exported = client.get(f'/api/items/{note["id"]}/export').json()
    assert exported['annotations'][0]['comments'][0]['body'] == 'Why does this matter?'
    response = client.get('/api/backup')
    assert response.status_code == 200
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        archive.extractall(tmp_path / 'restored')
    with TestClient(create_app(tmp_path / 'restored')) as restored:
        assert restored.get(f'/api/items/{imported["id"]}/file').content == pdf_bytes
        assert len(restored.get(f'/api/items/{note["id"]}/annotations').json()[0]['comments']) == 1


def test_backup_keeps_snapshot_files_when_deleted_concurrently(client, app, pdf_bytes, monkeypatch):
    imported = client.post('/api/import',files={'file':('source.pdf',pdf_bytes)}).json()
    copying = threading.Event()
    resume = threading.Event()
    original_write = zipfile.ZipFile.write
    results = {}

    def delayed_write(archive, filename, arcname=None, *args, **kwargs):
        if arcname and arcname.endswith('.pdf'):
            copying.set()
            assert resume.wait(5)
        return original_write(archive,filename,arcname,*args,**kwargs)

    monkeypatch.setattr(zipfile.ZipFile,'write',delayed_write)
    backup = threading.Thread(target=lambda:results.update(backup=client.get('/api/backup')))
    delete = threading.Thread(target=lambda:results.update(delete=client.delete(f'/api/items/{imported["id"]}')))
    backup.start()
    try:
        assert copying.wait(5)
        delete.start()
        delete.join(.1)
        assert delete.is_alive(), 'Deletion must wait until the backup copies its source file.'
    finally:
        resume.set()
        backup.join(5)
        if delete.ident:
            delete.join(5)
    assert results['backup'].status_code == 200
    assert results['delete'].status_code == 200
    with zipfile.ZipFile(io.BytesIO(results['backup'].content)) as archive:
        pdf_name = next(name for name in archive.namelist() if name.endswith('.pdf'))
        assert archive.read(pdf_name) == pdf_bytes
    assert client.get(f'/api/items/{imported["id"]}').status_code == 404


def test_note_html_and_cross_origin_mutations_are_restricted(client):
    note = new_note(client,content='<p onclick="alert(1)">Safe</p><img src=x onerror=alert(1)><a href="javascript:alert(1)">link</a>')
    assert 'onclick' not in note['content'] and 'onerror' not in note['content'] and 'javascript:' not in note['content']
    response = client.post('/api/notes',headers={'Origin':'https://elsewhere.example'},json={'title':'Foreign request'})
    assert response.status_code == 403


def test_network_workspace_password(tmp_path):
    with TestClient(create_app(tmp_path / 'locked',token='workspace-secret')) as locked:
        assert locked.get('/').status_code == 200
        assert locked.get('/api/health').json()['locked'] is True
        assert locked.get('/api/workspace').status_code == 401
        assert locked.post('/api/session',json={'token':'wrong'}).status_code == 401
        response = locked.post('/api/session',json={'token':'workspace-secret'})
        assert response.status_code == 200
        assert 'HttpOnly' in response.headers['set-cookie']
        assert locked.get('/api/workspace').status_code == 200
        with locked.websocket_connect('/api/events') as socket:
            assert socket.receive_json()['type'] == 'connected'


def test_empty_comments_and_invalid_anchors_rejected(client):
    note = new_note(client)
    assert client.post(f'/api/items/{note["id"]}/annotations',json={'kind':'comment','quote':'A','comment':' ','anchor':{'type':'text','start':0,'end':1}}).status_code == 422
    assert client.post(f'/api/items/{note["id"]}/annotations',json={'kind':'highlight','quote':'A','anchor':{'type':'text','start':10,'end':1}}).status_code == 422
    annotation = text_annotation(client,note['id'])
    assert client.post(f'/api/annotations/{annotation["id"]}/comments',json={'body':'   '}).status_code == 422
