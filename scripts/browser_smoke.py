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


def select_text(page, selector, quote, existing=False):
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
    expect(page.locator('#annotation-popover' if existing else '#selection-toolbar')).to_be_visible()


def click_mark(page, kind, segment=0):
    mark = page.locator(f'.annotation-mark.{kind}').nth(segment)
    bounds = mark.bounding_box()
    assert bounds
    page.mouse.click(bounds['x']+bounds['width']*.55,bounds['y']+bounds['height']*.5)


def check_markdown_editor(page, url):
    page.locator('#new-note').click(); page.locator('#note-title').fill('Markdown live preview')
    page.locator('#modal-submit').click()
    editor = page.locator('#note-editor .cm-content')
    expect(editor).to_be_visible()
    editor.press_sequentially('# Research log'); editor.press('Enter')
    expect(page.locator('#note-editor .md-h1')).to_have_text('Research log')
    # Returning to a completed line exposes its source for normal text editing.
    editor.press('ArrowUp')
    expect(page.locator('#note-editor .md-h1')).to_have_count(0)
    expect(editor).to_contain_text('# Research log')
    editor.press('ArrowDown')
    expect(page.locator('#note-editor .md-h1')).to_have_text('Research log')
    editor.press_sequentially('**Evidence** and *ideas* and ~~old~~ and `code`')
    editor.press('Enter')
    expect(page.locator('#note-editor strong')).to_have_text('Evidence')
    expect(page.locator('#note-editor em')).to_have_text('ideas')
    expect(page.locator('#note-editor s')).to_have_text('old')
    expect(page.locator('#note-editor code')).to_have_text('code')
    expect(page.locator('#selection-toolbar')).to_be_hidden()

    page.locator('#insert-table').click()
    page.locator('#table-columns').fill('2'); page.locator('#table-rows').fill('2')
    page.locator('#modal-submit').click()
    expect(page.locator('.md-table-preview table')).to_be_visible()
    expect(page.locator('.md-table-preview th')).to_have_count(2)
    expect(page.locator('.md-table-preview td')).to_have_count(4)
    expect(page.locator('#save-state')).to_have_text('Saved locally')
    page.locator('.md-table-preview th').first.click()
    expect(page.locator('.md-table-preview')).to_have_count(0)
    page.keyboard.insert_text('Topic')
    for _ in range(8): editor.press('ArrowDown')
    expect(page.locator('.md-table-preview th').first).to_have_text('Topic')
    expect(page.locator('#save-state')).to_have_text('Saved locally')
    modifier = 'Meta' if page.evaluate("navigator.platform.includes('Mac')") else 'Control'
    editor.press(modifier+'+z')
    expect(editor).to_contain_text('Column 1')
    editor.press(modifier+'+Shift+z')
    for _ in range(8): editor.press('ArrowDown')
    expect(page.locator('.md-table-preview th').first).to_have_text('Topic')
    page.locator('.md-table-preview td').nth(1).click()
    page.keyboard.insert_text('A finding')
    for _ in range(8): editor.press('ArrowDown')
    expect(page.locator('.md-table-preview td').nth(1)).to_have_text('A finding')
    expect(page.locator('.md-table-preview td').first).to_have_text('')
    page.locator('#markdown-preview-toggle').click()
    expect(page.locator('#markdown-preview-toggle')).to_have_text('Markdown source')
    expect(editor).to_contain_text('# Research log')
    expect(editor).to_contain_text('| Topic | Column 2 |')
    page.locator('#markdown-preview-toggle').click()
    expect(page.locator('.md-table-preview th').first).to_have_text('Topic')
    page.screenshot(path=str(ARTIFACTS/'markdown-live-preview.png'),full_page=True)
    page.locator('#read-mode').click()
    expect(page.locator('#note-content h1')).to_have_text('Research log')
    expect(page.locator('#note-content th').first).to_have_text('Topic')
    expect(page.locator('#note-content td').nth(1)).to_have_text('A finding')
    select_text(page,'#note-content th:first-child','Topic'); page.locator('[data-annotate="comment"]').click()
    page.locator('#comment-body').fill('A table discovery.'); page.locator('#comment-form button[type="submit"]').click()
    expect(page.locator('.comment-text')).to_have_text('A table discovery.')
    page.reload()
    expect(page.locator('#note-content h1')).to_have_text('Research log')
    expect(page.locator('.annotation-mark.comment')).to_have_count(1)
    page.locator('#edit-mode').click()
    page.locator('#markdown-preview-toggle').click()
    expect(page.locator('#note-editor .cm-content')).to_contain_text('| Topic | Column 2 |')
    page.locator('#markdown-preview-toggle').click()
    page.locator('#theme-toggle').click()
    expect(page.locator('html')).to_have_attribute('data-theme','dark')
    page.screenshot(path=str(ARTIFACTS/'markdown-dark-editor.png'),full_page=True)
    page.locator('#theme-toggle').click()
    page.locator('#document-menu').click()
    with page.expect_download() as download:
        page.locator('.menu-item').filter(has_text='Download note (Markdown)').click()
    source = Path(download.value.path()).read_text()
    assert source.startswith('# Research log\n')
    assert '**Evidence** and *ideas* and ~~old~~ and `code`' in source
    assert '| Topic | Column 2 |' in source and '| --- | --- |' in source
    assert 'A finding' in source
    page.locator('.annotation-quote').click()
    expect(page.locator('#note-content')).to_be_visible()
    expect(page.locator('#annotation-popover')).to_be_visible()
    page.locator('.popup-close').click()

    # Recover an unsaved HTML draft left by the previous editor version.
    legacy = httpx.post(url+'/api/notes',json={'title':'Legacy draft recovery','content':'<p>Saved thought.</p>'}).json()
    page.locator('.file-card').filter(has_text='Legacy draft recovery').click()
    expect(page.locator('#document-title')).to_have_text('Legacy draft recovery')
    expect(page.locator('#note-content')).to_have_text('Saved thought.')
    page.evaluate('''note => localStorage.setItem(`notate-draft-${note.id}`, JSON.stringify({
        content:'<h2>Recovered thought</h2><p>A <strong>finding</strong> from the old editor.</p>',revision:note.revision}))''',legacy)
    page.reload()
    expect(page.locator('#note-editor .cm-content')).to_be_visible()
    expect(page.locator('#note-editor .cm-content')).to_contain_text('## Recovered thought')
    expect(page.locator('#save-state')).to_have_text('Saved locally')
    recovered = httpx.get(url+f'/api/items/{legacy["id"]}').json()
    assert recovered['markdown'] == '## Recovered thought\n\nA **finding** from the old editor.'
    page.locator('#read-mode').click()
    expect(page.locator('#note-content h2')).to_have_text('Recovered thought')
    expect(page.locator('#note-content strong')).to_have_text('finding')
    page.locator('.file-card').filter(has_text='Welcome to Notate').click()
    print('Markdown renders after Enter, exposes source on edit, supports editable tables, undo/redo, downloads, and table annotations.',flush=True)


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
                # Capture clipboard writes without changing the user's system clipboard.
                context.add_init_script("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text => { window.__copiedAnnotationText = text; }}})")
                page = context.new_page(); errors = []; outside_requests = []
                page.on('pageerror',lambda error: errors.append(str(error)))
                page.on('request',lambda request: outside_requests.append(request.url) if not request.url.startswith(url) else None)
                page.goto(url); expect(page.locator('#document-title')).to_have_text('Welcome to Notate')
                expect(page.locator('#connection-label')).to_contain_text('synced')
                print('Workspace loads and connects to live sync.',flush=True)
                check_markdown_editor(page,url)

                page.locator('#add-folder').click(); page.locator('#folder-name').fill('Research')
                page.locator('#modal-submit').click(); expect(page.get_by_role('button',name='Research',exact=False).first).to_be_visible()
                page.locator('.folder-button').filter(has_text='Research').click()
                page.locator('#add-folder').click(); page.locator('#folder-name').fill('Questions'); page.locator('#modal-submit').click()
                expect(page.locator('.folder-button').filter(has_text='Questions')).to_be_visible()
                page.locator('.folder-button').filter(has_text='Questions').click()
                page.locator('#new-note').click(); page.locator('#note-title').fill('My research findings'); page.locator('#modal-submit').click()
                expect(page.locator('#document-title')).to_have_text('My research findings')
                page.locator('#note-editor .cm-content').fill('A good question starts a discovery. Evidence helps us find an answer.')
                expect(page.locator('#save-state')).to_have_text('Saved locally')
                page.locator('#read-mode').click()
                select_text(page,'#note-content','A good question'); page.locator('[data-annotate="comment"]').click()
                page.locator('#comment-body').fill('What makes a question useful?'); page.locator('#comment-form button[type="submit"]').click()
                expect(page.locator('.comment-text')).to_have_text('What makes a question useful?')
                page.locator('.reply-form textarea').fill('It can be answered with evidence.'); page.locator('.reply-form button[type="submit"]').click()
                expect(page.locator('.comment-text')).to_have_count(2)
                expect(page.locator('.annotation-mark.comment')).to_have_count(1)
                select_text(page,'#note-content','Evidence'); page.locator('[data-annotate="underline"]').click()
                expect(page.locator('.annotation-mark.underline')).to_have_count(1)
                select_text(page,'#note-content','discovery'); page.locator('[data-annotate="strike"]').click()
                expect(page.locator('.annotation-mark.strike')).to_have_count(1)
                print('Nested folders, note autosave, anchored comments, replies, underline, and strikethrough work.',flush=True)

                first_card = page.locator('#annotations-list .annotation-card').first
                first_card.locator('.reply-form textarea').fill('UNSENT DRAFT — leave this out of the copied thread.')
                first_card.locator('.annotation-copy').click()
                page.wait_for_function("window.__copiedAnnotationText?.includes('### Reply 1')")
                copied = page.evaluate('window.__copiedAnnotationText')
                assert 'Document: My research findings' in copied and 'Folder: Research / Questions' in copied
                assert 'Location: Note text' in copied and 'Status: Open' in copied
                assert '## Highlighted source text\n\n> A good question' in copied
                assert copied.index('What makes a question useful?') < copied.index('It can be answered with evidence.')
                assert 'UNSENT DRAFT' not in copied
                assert first_card.locator('.reply-form textarea').input_value().startswith('UNSENT DRAFT')
                first_card.locator('.reply-form textarea').fill('')
                page.evaluate('''() => {
                  window.__copiedAnnotationText = null;
                  navigator.clipboard.writeText = async () => { throw new Error('Clipboard denied'); };
                  window.__originalExecCommand = document.execCommand;
                  document.execCommand = function(command,...args) {
                    if (command === 'copy') {
                      const field = document.activeElement;
                      window.__copiedAnnotationText = field.value;
                      window.__copySelectedAll = field.selectionStart === 0 && field.selectionEnd === field.value.length;
                      return true;
                    }
                    return window.__originalExecCommand.call(this,command,...args);
                  };
                }''')
                first_card.locator('.annotation-copy').click(); page.wait_for_function('window.__copySelectedAll === true')
                assert page.evaluate('window.__copiedAnnotationText') == copied
                page.evaluate("document.execCommand = () => false")
                first_card.locator('.annotation-copy').click()
                expect(page.locator('#modal-title')).to_have_text('Copy passage and thread')
                assert page.locator('#annotation-copy-text').input_value() == copied
                page.locator('#modal-submit').click()
                page.evaluate("document.execCommand = window.__originalExecCommand; navigator.clipboard.writeText = async text => { window.__copiedAnnotationText = text; }")
                page.locator('#annotations-list .annotation-card').nth(1).locator('.annotation-copy').click()
                page.wait_for_function("window.__copiedAnnotationText?.includes('No comments or questions recorded.')")
                assert '## Highlighted source text\n\n> Evidence' in page.evaluate('window.__copiedAnnotationText')
                assert 'What makes a question useful?' not in page.evaluate('window.__copiedAnnotationText')

                page.locator('#new-note').click(); page.locator('#note-title').fill('Long quotation copy check'); page.locator('#modal-submit').click()
                expect(page.locator('#document-title')).to_have_text('Long quotation copy check')
                long_quote = 'A complete source passage, including <literal tags> & punctuation. ' * 14 + 'FINAL SOURCE SENTENCE.'
                long_comment = '## Question\n\n**How does this help?**\n\n' + 'A personal question about this source. ' * 12 + '\nFINAL COMMENT LINE.'
                long_source = long_quote.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
                page.locator('#note-editor .cm-content').fill(long_source); expect(page.locator('#save-state')).to_have_text('Saved locally')
                page.locator('#read-mode').click(); select_text(page,'#note-content',long_quote)
                page.locator('[data-annotate="comment"]').click(); page.locator('#comment-body').fill(long_comment)
                expect(page.locator('#comment-form .markdown-preview h2')).to_have_text('Question')
                expect(page.locator('#comment-form .markdown-preview strong')).to_have_text('How does this help?')
                page.locator('#comment-form button[type="submit"]').click()
                expect(page.locator('#annotation-count')).to_have_text('1')
                markdown_reply = 'Final answer in this thread.\n\n**Clear finding** with *evidence* and ~~old idea~~.\n\n- Observe\n- Compare\n\n```python\nresult = 2\n```\n\n[Reference](https://example.com)'
                page.locator('.reply-form textarea').fill(markdown_reply)
                expect(page.locator('.reply-form .markdown-preview strong')).to_have_text('Clear finding')
                expect(page.locator('.reply-form .markdown-preview li')).to_have_count(2)
                expect(page.locator('.reply-form .markdown-preview pre code')).to_contain_text('result = 2')
                page.locator('.reply-form button[type="submit"]').click()
                expect(page.locator('.comment-text')).to_have_count(2)
                expect(page.locator('.comment-text strong').last).to_have_text('Clear finding')
                expect(page.locator('.comment-text s')).to_have_text('old idea')
                page.locator('.annotation-copy').click()
                page.wait_for_function("window.__copiedAnnotationText?.includes('Final answer in this thread.')")
                full_copy = page.evaluate('window.__copiedAnnotationText')
                assert '\n'.join('> '+line for line in long_quote.split('\n')) in full_copy
                assert '\n'.join('> '+line for line in long_comment.split('\n')) in full_copy
                assert '### Reply 1\n\n> Final answer in this thread.' in full_copy
                entries = page.locator('#annotations-list .comment-entry')
                entries.last.locator('.saved-kind-switch [data-entry-kind="answer"]').click()
                expect(page.locator('#annotations-list .comment-entry.answer')).to_have_count(1)
                page.locator('.annotation-copy').click()
                page.wait_for_function("window.__copiedAnnotationText?.includes('### Answer 1')")
                assert '> **Clear finding** with *evidence*' in page.evaluate('window.__copiedAnnotationText')
                page.locator('.reply-form [data-entry-kind="answer"]').click()
                page.locator('.reply-form textarea').fill('**A draft to preserve**')
                entries.first.locator('.saved-kind-switch [data-entry-kind="answer"]').click()
                expect(page.locator('#annotations-list .comment-entry.answer')).to_have_count(2)
                assert page.locator('.reply-form textarea').input_value() == '**A draft to preserve**'
                expect(page.locator('.reply-form')).to_have_attribute('data-kind','answer')
                expect(page.locator('.reply-form .markdown-preview strong')).to_have_text('A draft to preserve')
                entries.first.locator('.saved-kind-switch [data-entry-kind="reply"]').click()
                expect(page.locator('#annotations-list .comment-entry.answer')).to_have_count(1)
                page.locator('.reply-form textarea').fill('')
                click_mark(page,'comment')
                expect(page.locator('#annotation-popover .comment-entry.answer')).to_have_count(1)
                expect(page.locator('#annotation-popover .markdown-body pre code')).to_contain_text('result = 2')
                page.locator('.popup-close').click()
                type_window = context.new_page(); type_window.goto(url)
                expect(type_window.locator('#document-title')).to_have_text('Long quotation copy check')
                expect(type_window.locator('#annotations-list .comment-entry.answer')).to_have_count(1)
                entries.last.locator('.saved-kind-switch [data-entry-kind="reply"]').click()
                expect(type_window.locator('#annotations-list .comment-entry.answer')).to_have_count(0)
                type_window.locator('#annotations-list .comment-entry').last.locator('[data-entry-kind="answer"]').click()
                expect(page.locator('#annotations-list .comment-entry.answer')).to_have_count(1)
                type_window.close(); page.reload()
                expect(page.locator('#annotations-list .comment-entry.answer')).to_have_count(1)
                expect(page.locator('.comment-text strong').last).to_have_text('Clear finding')
                page.evaluate("document.querySelector('#annotations-list .comment-entry.answer')?.scrollIntoView({block:'center',behavior:'instant'})")
                if page.locator('html').get_attribute('data-theme') == 'dark': page.locator('#theme-toggle').click()
                page.screenshot(path=str(ARTIFACTS/'markdown-answers-light.png'),full_page=True)
                page.locator('#theme-toggle').click()
                assert page.locator('.comment-entry.answer').evaluate(r'(entry) => { const color=getComputedStyle(entry).backgroundColor.match(/\d+/g).slice(0,3).map(Number); return color[2] > color[0]+10; }')
                page.screenshot(path=str(ARTIFACTS/'markdown-answers-dark.png'),full_page=True)
                print('Markdown previews and saved formatting, blue answers, type changes, draft preservation, live sync, persistence, and copy labels work.',flush=True)
                page.locator('#document-menu').click(); page.locator('#floating-menu .menu-item').filter(has_text='Delete document').click(); page.locator('#modal-submit').click()
                expect(page.locator('#document-title')).to_have_text('My research findings')
                print('Per-item Markdown copy includes full quotes, saved comments/replies, source context, and clipboard fallbacks; unsent drafts stay private.',flush=True)

                if page.locator('html').get_attribute('data-theme') != 'dark': page.locator('#theme-toggle').click()
                expect(page.locator('html')).to_have_attribute('data-theme','dark')
                assert page.locator('.annotation-card').first.evaluate(r'(node) => getComputedStyle(node).backgroundColor.match(/\d+/g).slice(0,3).every(channel => Number(channel) < 120)'), 'Annotation cards must use a dark reading surface.'
                page.set_viewport_size({'width':1050,'height':900})
                entire_note = 'A good question starts a discovery. Evidence helps us find an answer.'
                select_text(page,'#note-content',entire_note); page.locator('[data-annotate="highlight"]').click()
                expect(page.locator('.annotation-mark.highlight')).to_have_count(2)
                highlight_id = page.locator('.annotation-mark.highlight').first.get_attribute('data-annotation')
                click_mark(page,'highlight',1)
                expect(page.locator('#annotation-popover')).to_be_visible()
                expect(page.locator('#annotations-list .annotation-card.selected')).to_have_attribute('data-annotation',highlight_id)
                expect(page.locator('.annotation-mark.highlight.selected')).to_have_count(2)
                page.locator('.popup-reply-form textarea').fill('The whole passage is connected to this thought.')
                page.locator('.popup-reply-form button[type="submit"]').click()
                expect(page.locator('.popup-comment-text')).to_have_text('The whole passage is connected to this thought.')
                expect(page.locator(f'#annotations-list [data-annotation="{highlight_id}"] .comment-text')).to_have_text('The whole passage is connected to this thought.')
                page.locator('.popup-close').click()
                select_text(page,'#note-content','find an answer',existing=True)
                expect(page.locator('#annotation-popover')).to_have_attribute('data-annotation',highlight_id)
                expect(page.locator('#selection-toolbar')).to_be_hidden()
                expect(page.locator('#annotation-count')).to_have_text('4')
                page.locator('.popup-resolve').click(); expect(page.locator('.popup-label')).to_contain_text('Resolved')
                page.locator('.popup-resolve').click(); expect(page.locator('.popup-label')).not_to_contain_text('Resolved')
                page.screenshot(path=str(ARTIFACTS/'dark-note-popup.png'),full_page=True)

                # A contained selection can match overlapping annotations; choose the thread.
                select_text(page,'#note-content','good question',existing=True)
                expect(page.locator('.popup-matches')).to_contain_text('2 marks')
                page.locator('.popup-matches button').filter(has_text='Comment thread').click()
                expect(page.locator('.popup-comment-text')).to_have_count(2)
                selected_id = page.locator('#annotation-popover').get_attribute('data-annotation')
                expect(page.locator('#annotations-list .annotation-card.selected')).to_have_attribute('data-annotation',selected_id)
                page.locator('#toggle-popups').click(); expect(page.locator('#annotation-popover')).to_be_hidden()
                click_mark(page,'comment'); expect(page.locator('#annotation-popover')).to_be_hidden()
                expect(page.locator('#annotations-list .annotation-card.selected')).to_have_attribute('data-annotation',selected_id)
                page.reload(); expect(page.locator('#note-content')).to_contain_text(entire_note)
                expect(page.locator('html')).to_have_attribute('data-theme','dark')
                expect(page.locator('#toggle-popups')).to_have_attribute('aria-pressed','false')
                page.locator('[data-view="all"]').click(); page.locator('.file-card').filter(has_text='Welcome to Notate').click()
                expect(page.locator('#toggle-popups')).to_have_attribute('aria-pressed','true')
                page.locator('.file-card').filter(has_text='My research findings').click()
                expect(page.locator('#toggle-popups')).to_have_attribute('aria-pressed','false')
                page.locator('#toggle-popups').click()
                page.locator('.annotation-mark.highlight').last.focus(); page.keyboard.press('Enter')
                expect(page.locator('#annotation-popover')).to_be_visible()
                page.keyboard.press('Escape'); expect(page.locator('#annotation-popover')).to_be_hidden()
                page.locator(f'#annotations-list [data-annotation="{highlight_id}"] .annotation-menu').click()
                page.locator('#floating-menu .menu-item').filter(has_text='Delete annotation').click(); page.locator('#modal-submit').click()
                expect(page.locator('#annotation-count')).to_have_text('3')
                expect(page.locator('#annotations-list .comment-text')).to_have_count(2)
                page.set_viewport_size({'width':1512,'height':982})
                print('Dark mode, wrapped passage grouping, contained selections, overlapping marks, popup replies, and per-document preferences work.',flush=True)

                second = context.new_page(); second.goto(url)
                expect(second.locator('#document-title')).to_have_text('My research findings')
                expect(second.locator('.comment-text')).to_have_count(2)
                page.locator('.reply-form').first.locator('textarea').fill('A finding worth keeping.'); page.locator('.reply-form').first.locator('button[type="submit"]').click()
                expect(second.locator('.comment-text')).to_have_count(3)
                page.locator('.resolve-button').first.click(); expect(page.locator('.comment-text')).to_have_count(0)
                page.locator('[data-filter="resolved"]').click(); expect(page.locator('.comment-text')).to_have_count(3)
                page.locator('.annotation-copy').click()
                page.wait_for_function("window.__copiedAnnotationText?.includes('Status: Resolved')")
                page.locator('.resolve-button').click(); page.locator('[data-filter="all"]').click()
                expect(page.locator('.comment-text')).to_have_count(3)
                print('Two-window live sync, resolve, and reopen work.',flush=True)

                # Simultaneous editing keeps the local draft and asks for an explicit choice.
                page.locator('#edit-mode').click(); second.locator('#edit-mode').click()
                page.locator('#note-editor .cm-content').fill('A newer saved version from the first window.')
                second.locator('#note-editor .cm-content').fill('A draft from the second window that must survive.')
                expect(page.locator('#save-state')).to_have_text('Saved locally')
                expect(second.locator('.conflict-notice')).to_be_visible()
                expect(second.locator('#note-editor .cm-content')).to_contain_text('must survive')
                second.locator('.conflict-notice button').click(); second.locator('#modal-submit').click()
                expect(second.locator('#save-state')).to_have_text('Saved locally')
                expect(page.locator('#note-editor .cm-content')).to_contain_text('must survive')
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
                page.locator('.reply-form').last.locator('textarea').fill('Write one question before opening each paper.'); page.locator('.reply-form').last.locator('button[type="submit"]').click()
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
                page.locator('#annotations-list .annotation-card').last.locator('.annotation-copy').click()
                page.wait_for_function("window.__copiedAnnotationText?.includes('PDF page: 1')")
                pdf_copy = page.evaluate('window.__copiedAnnotationText')
                assert 'Original file: A field guide to better questions.pdf' in pdf_copy
                assert '> The best reading starts with a small question.' in pdf_copy
                assert '> How can I make this a habit?' in pdf_copy
                assert '> Write one question before opening each paper.' in pdf_copy
                assert 'Reading is a conversation with an idea.' not in pdf_copy
                click_mark(page,'comment')
                expect(page.locator('#annotation-popover')).to_be_visible()
                expect(page.locator('.popup-comment-text')).to_have_count(2)
                popup_box = page.locator('#annotation-popover').bounding_box()
                passage_box = page.locator('.annotation-mark.comment').bounding_box()
                assert popup_box['y']+popup_box['height'] <= passage_box['y']+2 or popup_box['y'] >= passage_box['y']+passage_box['height']-2, 'Popup should sit above or below its passage.'
                assert popup_box['x'] >= 0 and popup_box['x']+popup_box['width'] <= 1512
                page.screenshot(path=str(ARTIFACTS/'dark-pdf-popup.png'),full_page=True)
                page.locator('#toggle-popups').click(); click_mark(page,'comment'); expect(page.locator('#annotation-popover')).to_be_hidden()
                expect(page.locator('#annotations-list .annotation-card.selected')).to_be_visible()
                page.reload(); expect(page.locator('.pdf-page[data-page="1"] .textLayer')).to_be_visible()
                expect(page.locator('#toggle-popups')).to_have_attribute('aria-pressed','false')
                page.locator('#toggle-popups').click()
                page.screenshot(path=str(ARTIFACTS/'desktop-web.png'),full_page=True)
                print(f'PDF text selection, zoom, lazy pages, reload persistence work. Import to first text layer: {pdf_open:.2f}s.',flush=True)

                mobile = browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
                phone = mobile.new_page(); phone.goto(url); expect(phone.locator('#document-title')).to_have_text('A field guide to better questions')
                phone.locator('#sidebar-toggle').click(); expect(phone.locator('#sidebar')).to_be_visible()
                phone.locator('.file-card').filter(has_text='A field guide').click(); expect(phone.locator('.pdf-page[data-page="1"] .textLayer')).to_be_visible()
                phone.locator('#toggle-annotations').click(); expect(phone.locator('#annotations-panel')).to_be_visible()
                phone.locator('#close-annotations').click()
                phone.locator('#theme-toggle').click(); expect(phone.locator('html')).to_have_attribute('data-theme','dark')
                click_mark(phone,'comment'); expect(phone.locator('#annotation-popover')).to_be_visible()
                mobile_popup = phone.locator('#annotation-popover').bounding_box()
                assert mobile_popup['x'] >= 0 and mobile_popup['x']+mobile_popup['width'] <= 390
                phone.locator('.popup-close').click()
                phone.screenshot(path=str(ARTIFACTS/'mobile-web.png'),full_page=True)
                assert phone.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile page overflows'
                phone.locator('#close-annotations').click()
                phone.locator('#sidebar-toggle').click()
                phone.locator('.file-card').filter(has_text='Markdown live preview').click()
                phone.locator('#edit-mode').click()
                expect(phone.locator('.md-table-preview th').first).to_have_text('Topic')
                expect(phone.locator('#insert-table')).to_be_visible()
                phone.screenshot(path=str(ARTIFACTS/'mobile-markdown-editor.png'),full_page=True)
                assert phone.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile Markdown editor overflows'
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
