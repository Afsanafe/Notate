"""Exercise the actual web UI in Chrome against an isolated local workspace.

Run with: .venv/bin/python scripts/browser_smoke.py
Artifacts are written to .local-data/artifacts; test data is temporary.
"""

import io
import argparse
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import httpx
from docx import Document
from playwright.sync_api import sync_playwright, expect
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject


ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / '.local-data' / 'artifacts'


def sample_pdf():
    writer = PdfWriter()
    font = DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),
                             NameObject('/BaseFont'):NameObject('/Helvetica')})
    reference = writer._add_object(font)
    for number in range(1, 13):
        page = writer.add_blank_page(width=612,height=792)
        page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):reference})})
        content = DecodedStreamObject()
        content.set_data(f'BT /F1 9 Tf 64 735 Td (NOTATE / READING NOTES) Tj /F1 25 Tf 0 -45 Td (A field guide to better questions) Tj /F1 11 Tf 0 -40 Td (Reading is a conversation with an idea.) Tj 0 -24 Td (Highlight a thought. Ask a question. Find an answer.) Tj 0 -24 Td (Your discoveries belong together in Notate.) Tj /F1 15 Tf 0 -55 Td (01   Stay curious) Tj /F1 11 Tf 0 -28 Td (The best reading starts with a small question.) Tj 0 -22 Td (Take a moment to notice what surprises you.) Tj 0 -22 Td (Connect a passage to something you already know.) Tj /F1 15 Tf 0 -55 Td (02   Follow the thread) Tj /F1 11 Tf 0 -28 Td (Keep questions and answers next to their source.) Tj 0 -22 Td (Return to a thought when new evidence appears.) Tj 0 -22 Td (A little annotation can become a bigger discovery.) Tj /F1 9 Tf 0 -140 Td (A personal reading room) Tj 360 0 Td ({number:02d}) Tj ET'.encode())
        page[NameObject('/Contents')] = writer._add_object(content)
    output = io.BytesIO(); writer.write(output); return output.getvalue()


def select_text(page, selector, quote):
    page.locator(selector).evaluate('''(container, quote) => {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let node; while (node = walker.nextNode()) {
        const start = node.textContent.indexOf(quote);
        if (start < 0) continue;
        const range = document.createRange(); range.setStart(node,start); range.setEnd(node,start+quote.length);
        const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
        const rect = range.getBoundingClientRect();
        container.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:rect.right,clientY:rect.top+rect.height/2}));
        return;
      }
      throw new Error('Selection text not found: ' + quote);
    }''',quote)
    expect(page.locator('#selection-toolbar')).to_be_visible()


def run(additional_pdf=None):
    ARTIFACTS.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='notate-browser-') as temporary:
        with socket.socket() as socket_handle:
            socket_handle.bind(('127.0.0.1',0)); port = socket_handle.getsockname()[1]
        url = f'http://127.0.0.1:{port}'
        process = subprocess.Popen([sys.executable,'-m','notate','serve','--port',str(port),'--data-dir',temporary],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        try:
            for _ in range(100):
                try:
                    if httpx.get(url+'/api/health',timeout=.2).status_code == 200: break
                except httpx.HTTPError: pass
                time.sleep(.1)
            else: raise RuntimeError('The test server did not start.')
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(channel='chrome',headless=True)
                context = browser.new_context(viewport={'width':1512,'height':982},device_scale_factor=1)
                page = context.new_page(); errors = []; outside_requests = []
                page.on('pageerror',lambda error: errors.append(str(error)))
                page.on('request',lambda request: outside_requests.append(request.url) if not request.url.startswith(url) else None)
                page.goto(url); expect(page.locator('#document-title')).to_have_text('Welcome to Notate')
                expect(page.locator('#connection-label')).to_contain_text('synced')
                print('Workspace loads and connects to live sync.',flush=True)

                page.locator('#add-folder').click(); page.locator('#folder-name').fill('Research')
                page.locator('#modal-submit').click(); expect(page.get_by_role('button',name='Research',exact=False).first).to_be_visible()
                page.locator('.folder-button').filter(has_text='Research').click()
                page.locator('#add-folder').click(); page.locator('#folder-name').fill('Questions'); page.locator('#modal-submit').click()
                expect(page.locator('.folder-button').filter(has_text='Questions')).to_be_visible()
                page.locator('.folder-button').filter(has_text='Questions').click()
                page.locator('#new-note').click(); page.locator('#note-title').fill('My research findings'); page.locator('#modal-submit').click()
                expect(page.locator('#document-title')).to_have_text('My research findings')
                page.locator('#note-content').fill('A good question starts a discovery. Evidence helps us find an answer.')
                expect(page.locator('#save-state')).to_have_text('Saved locally')
                page.locator('#read-mode').click()
                select_text(page,'#note-content','A good question'); page.locator('[data-annotate="comment"]').click()
                page.locator('#comment-body').fill('What makes a question useful?'); page.locator('#comment-form button[type="submit"]').click()
                expect(page.locator('.comment-text')).to_have_text('What makes a question useful?')
                page.locator('.reply-form textarea').fill('It can be answered with evidence.'); page.locator('.reply-form button').click()
                expect(page.locator('.comment-text')).to_have_count(2)
                expect(page.locator('.annotation-mark.comment')).to_have_count(1)
                select_text(page,'#note-content','Evidence'); page.locator('[data-annotate="underline"]').click()
                expect(page.locator('.annotation-mark.underline')).to_have_count(1)
                select_text(page,'#note-content','discovery'); page.locator('[data-annotate="strike"]').click()
                expect(page.locator('.annotation-mark.strike')).to_have_count(1)
                print('Nested folders, note autosave, anchored comments, replies, underline, and strikethrough work.',flush=True)

                second = context.new_page(); second.goto(url)
                expect(second.locator('#document-title')).to_have_text('My research findings')
                expect(second.locator('.comment-text')).to_have_count(2)
                page.locator('.reply-form').first.locator('textarea').fill('A finding worth keeping.'); page.locator('.reply-form').first.locator('button').click()
                expect(second.locator('.comment-text')).to_have_count(3)
                page.locator('.resolve-button').first.click(); expect(page.locator('.comment-text')).to_have_count(0)
                page.locator('[data-filter="resolved"]').click(); expect(page.locator('.comment-text')).to_have_count(3)
                page.locator('.resolve-button').click(); page.locator('[data-filter="all"]').click()
                expect(page.locator('.comment-text')).to_have_count(3)
                print('Two-window live sync, resolve, and reopen work.',flush=True)

                # Simultaneous editing keeps the local draft and asks for an explicit choice.
                page.locator('#edit-mode').click(); second.locator('#edit-mode').click()
                page.locator('#note-content').fill('A newer saved version from the first window.')
                second.locator('#note-content').fill('A draft from the second window that must survive.')
                expect(page.locator('#save-state')).to_have_text('Saved locally')
                expect(second.locator('.conflict-notice')).to_be_visible()
                expect(second.locator('#note-content')).to_contain_text('must survive')
                second.locator('.conflict-notice button').click(); second.locator('#modal-submit').click()
                expect(second.locator('#save-state')).to_have_text('Saved locally')
                expect(page.locator('#note-content')).to_contain_text('must survive')
                second.close()
                print('Conflicting edits preserve drafts and resolve explicitly.',flush=True)

                pdf_path = Path(temporary)/'A field guide to better questions.pdf'; pdf_path.write_bytes(sample_pdf())
                start = time.monotonic(); page.locator('#file-input').set_input_files(pdf_path)
                expect(page.locator('.pdf-page[data-page="1"] .textLayer')).to_be_visible(timeout=15000)
                pdf_open = time.monotonic()-start
                expect(page.locator('#total-pages')).to_have_text('12')
                expect(page.locator('.pdf-page[data-page="1"] .textLayer')).to_contain_text('Reading is a conversation')
                select_text(page,'.pdf-page[data-page="1"] .textLayer','Reading is a conversation with an idea.')
                page.locator('[data-annotate="highlight"]').click(); expect(page.locator('.annotation-mark.highlight')).to_have_count(1)
                select_text(page,'.pdf-page[data-page="1"] .textLayer','The best reading starts with a small question.')
                page.locator('[data-annotate="comment"]').click(); page.locator('#comment-body').fill('How can I make this a habit?')
                page.locator('#comment-form button[type="submit"]').click(); expect(page.locator('.comment-text')).to_have_text('How can I make this a habit?')
                page.locator('.reply-form').last.locator('textarea').fill('Write one question before opening each paper.'); page.locator('.reply-form').last.locator('button').click()
                expect(page.locator('.comment-text')).to_have_count(2)
                before = page.locator('.annotation-mark.comment').evaluate('(node) => node.getBoundingClientRect().width')
                page.locator('#zoom-in').click(); expect(page.locator('.pdf-page[data-page="1"] .textLayer')).to_be_visible()
                after = page.locator('.annotation-mark.comment').evaluate('(node) => node.getBoundingClientRect().width')
                assert after > before, (before,after)
                page.locator('#zoom-fit').click(); expect(page.locator('.pdf-page[data-page="1"] .textLayer')).to_be_visible()
                page.locator('#current-page').fill('12'); page.locator('#current-page').press('Enter')
                expect(page.locator('.pdf-page[data-page="12"] .textLayer')).to_be_visible()
                page.locator('#current-page').fill('1'); page.locator('#current-page').press('Enter')
                expect(page.locator('.pdf-page[data-page="1"] .textLayer')).to_be_visible()
                page.reload(); expect(page.locator('.pdf-page[data-page="1"] .textLayer')).to_be_visible()
                expect(page.locator('.annotation-mark.comment')).to_have_count(1)
                expect(page.locator('.comment-text')).to_have_count(2)
                page.screenshot(path=str(ARTIFACTS/'desktop-web.png'),full_page=True)
                print(f'PDF text selection, zoom, lazy pages, reload persistence work. Import to first text layer: {pdf_open:.2f}s.',flush=True)

                mobile = browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
                phone = mobile.new_page(); phone.goto(url); expect(phone.locator('#document-title')).to_have_text('A field guide to better questions')
                phone.locator('#sidebar-toggle').click(); expect(phone.locator('#sidebar')).to_be_visible()
                phone.locator('.file-card').filter(has_text='A field guide').click(); expect(phone.locator('.pdf-page[data-page="1"] .textLayer')).to_be_visible()
                phone.locator('#toggle-annotations').click(); expect(phone.locator('#annotations-panel')).to_be_visible()
                phone.screenshot(path=str(ARTIFACTS/'mobile-web.png'),full_page=True)
                assert phone.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile page overflows'
                print('Mobile navigation, reader, and annotation panel work.',flush=True)
                mobile.close()

                additional_result = None
                if additional_pdf:
                    source = Path(additional_pdf).resolve()
                    page.locator('#file-input').set_input_files(source)
                    expect(page.locator('.pdf-page[data-page="1"] .textLayer')).to_be_visible(timeout=15000)
                    expected_pages = len(PdfReader(source).pages)
                    expect(page.locator('#total-pages')).to_have_text(str(expected_pages))
                    page.locator('#current-page').fill(str(expected_pages)); page.locator('#current-page').press('Enter')
                    expect(page.locator(f'.pdf-page[data-page="{expected_pages}"] .textLayer')).to_be_visible()
                    page.locator('#current-page').fill('1'); page.locator('#current-page').press('Enter')
                    expect(page.locator('.pdf-page[data-page="1"] .textLayer')).to_be_visible()
                    # Finish navigation before selecting; a smooth page jump deliberately
                    # hides annotation tools while the document is moving.
                    page.locator('#reader').evaluate('''async reader => {
                      reader.scrollTo({top:0,behavior:'instant'});
                      await new Promise(requestAnimationFrame);
                      await new Promise(requestAnimationFrame);
                    }''')
                    selected = page.locator('.pdf-page[data-page="1"] .textLayer span').evaluate_all('(spans) => spans.map(span => span.textContent).find(text => text.trim().length > 15)')
                    assert selected, 'The supplied PDF needs selectable text for this annotation check.'
                    select_text(page,'.pdf-page[data-page="1"] .textLayer',selected)
                    page.locator('[data-annotate="comment"]').click(); page.locator('#comment-body').fill('Import verification: this passage is selectable.')
                    page.locator('#comment-form button[type="submit"]').click()
                    expect(page.locator('.comment-text')).to_have_text('Import verification: this passage is selectable.')
                    page.reload(); expect(page.locator('.pdf-page[data-page="1"] .textLayer')).to_be_visible()
                    expect(page.locator('.annotation-mark.comment')).to_have_count(1)
                    expect(page.locator('.comment-text')).to_have_text('Import verification: this passage is selectable.')
                    page.screenshot(path=str(ARTIFACTS/'pdf-import.png'),full_page=True)
                    additional_result = {'filename':source.name,'pages':expected_pages,'annotation_persisted':True}
                    print(f'{source.name}: imported {expected_pages} pages; first/last pages render, text selects, and comments persist.',flush=True)

                assert not outside_requests, outside_requests
                assert not errors, errors
                browser.close()
                (ARTIFACTS/'browser-results.json').write_text(json.dumps({'status':'passed','pdf_first_open_seconds':round(pdf_open,2),'browser_errors':errors,'external_requests':outside_requests,'additional_pdf':additional_result},indent=2))
                print('No browser errors or external asset requests. Browser checks passed.',flush=True)
        finally:
            process.terminate()
            try: process.wait(timeout=5)
            except subprocess.TimeoutExpired: process.kill(); process.wait()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Check the Notate web UI in an isolated workspace.')
    parser.add_argument('--pdf',type=Path,help='Also check import, rendering, and annotations on this PDF.')
    run(parser.parse_args().pdf)
