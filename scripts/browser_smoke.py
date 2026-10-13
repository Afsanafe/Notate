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
    expect(page.locator(selector)).to_be_visible()
    expect(page.locator(selector)).to_contain_text(quote)
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


def check_workspace_layout(page):
    divider = page.locator('#panel-resizer')
    notes = page.locator('#annotations-panel')
    reader = page.locator('#reader')
    first_page = page.locator('.pdf-page[data-page="1"]')
    expect(divider).to_be_visible()
    original_width = notes.bounding_box()['width']
    original_pdf_width = first_page.bounding_box()['width']
    draft = page.locator('.reply-form').last.locator('.cm-content')
    draft.fill('Keep this unposted draft through layout changes.')
    page.evaluate('window.__layoutCanvas = document.querySelector(".pdf-page canvas")')
    handle = divider.bounding_box(); x = handle['x'] + handle['width']/2; y = handle['y'] + handle['height']/2
    page.mouse.move(x,y); page.mouse.down(); page.mouse.move(x-140,y,steps=12)
    assert abs(notes.bounding_box()['width'] - original_width - 140) < 2
    assert page.evaluate('window.__layoutCanvas === document.querySelector(".pdf-page canvas")'), 'PDF canvases should stay intact while dragging.'
    page.mouse.up()
    expect(first_page.locator('.textLayer')).to_be_visible()
    assert first_page.bounding_box()['width'] < original_pdf_width - 100
    expect(page.locator('body')).not_to_have_class('resizing-panels')
    expect(draft).to_contain_text('Keep this unposted draft')
    expect(page.locator('.annotation-mark.comment')).to_have_count(1)
    click_mark(page,'comment'); expect(page.locator('#annotation-popover')).to_be_visible()
    expect(page.locator('.popup-comment-text')).to_have_count(2)
    page.keyboard.press('Escape')
    page.screenshot(path=str(ARTIFACTS/'resizable-workspace.png'),full_page=True)
    draft.fill('')

    # Preserve the actual point being read, including a partly scrolled page.
    page.locator('#current-page').fill('6'); page.locator('#current-page').press('Enter')
    expect(page.locator('.pdf-page[data-page="6"] .textLayer')).to_be_visible()
    page.wait_for_function('document.querySelector("#current-page").value === "6" && Math.abs(document.querySelector(".pdf-page[data-page=\\"6\\"]").getBoundingClientRect().top - document.querySelector("#reader").getBoundingClientRect().top) < 3')
    page.evaluate('''() => {
      const reader = document.querySelector('#reader'), paper = document.querySelector('.pdf-page[data-page="6"]');
      reader.style.scrollBehavior = 'auto'; reader.scrollTop = paper.offsetTop + paper.offsetHeight * .18; reader.style.scrollBehavior = '';
    }''')
    divider.focus(); divider.press('Shift+ArrowLeft')
    expect(page.locator('.pdf-page[data-page="6"] .textLayer')).to_be_visible()
    expect(page.locator('#current-page')).to_have_value('6')
    fraction = page.evaluate('''() => {
      const reader = document.querySelector('#reader'), paper = document.querySelector('.pdf-page[data-page="6"]');
      return (reader.scrollTop-paper.offsetTop)/paper.offsetHeight;
    }''')
    assert abs(fraction-.18) < .015, fraction

    # Navigation only opens with a button, even after hovering or searching.
    old_reader_width = reader.bounding_box()['width']
    page.locator('#sidebar-collapse').click()
    expect(page.locator('#sidebar')).to_be_hidden()
    assert reader.bounding_box()['width'] > old_reader_width + 200
    expect(page.locator('.pdf-page[data-page="6"] .textLayer')).to_be_visible()
    expect(page.locator('#current-page')).to_have_value('6')
    expanded_width = reader.bounding_box()['width']
    page.mouse.move(3,480); page.wait_for_timeout(300)
    expect(page.locator('#sidebar')).to_be_hidden()
    assert abs(reader.bounding_box()['width'] - expanded_width) < 2
    page.keyboard.press('ControlOrMeta+k')
    expect(page.locator('#sidebar')).to_be_hidden()
    expect(page.locator('#sidebar-toggle')).to_be_focused()
    saved_width = notes.bounding_box()['width']
    page.reload(); expect(first_page.locator('.textLayer')).to_be_visible()
    expect(page.locator('#sidebar')).to_be_hidden()
    assert abs(notes.bounding_box()['width'] - saved_width) < 2
    page.mouse.move(3,480); page.wait_for_timeout(300)
    expect(page.locator('#sidebar')).to_be_hidden()
    page.locator('#sidebar-toggle').click()
    expect(page.locator('#sidebar')).to_be_visible()
    expect(page.locator('.app-shell')).not_to_have_class('nav-collapsed')
    page.keyboard.press('ControlOrMeta+k'); expect(page.locator('#search')).to_be_focused()
    page.mouse.move(800,500); expect(page.locator('#sidebar')).to_be_visible()

    # Bounds prevent an unusable reader and adapt when the viewport shrinks.
    divider.focus(); divider.press('End')
    assert notes.bounding_box()['width'] <= 720
    assert page.locator('#reader-column').bounding_box()['width'] >= 359
    page.set_viewport_size({'width':950,'height':982})
    expect(first_page.locator('.textLayer')).to_be_visible()
    assert page.locator('#reader-column').bounding_box()['width'] >= 359
    assert page.evaluate('document.documentElement.scrollWidth') <= 950
    page.set_viewport_size({'width':1512,'height':982})
    divider.focus(); divider.press('Home')
    expect(divider).to_have_attribute('aria-valuenow','240')
    divider.dblclick()
    assert abs(notes.bounding_box()['width'] - original_width) < 2
    expect(first_page.locator('.textLayer')).to_be_visible()
    page.locator('#close-annotations').click(); expect(divider).to_be_hidden()
    page.locator('#toggle-annotations').click(); expect(divider).to_be_visible()
    expect(first_page.locator('.textLayer')).to_be_visible()
    # Explicit zoom must survive layout changes.
    page.locator('#zoom-in').click(); expect(first_page.locator('.textLayer')).to_be_visible()
    zoom_width = first_page.bounding_box()['width']
    divider.focus(); divider.press('Shift+ArrowLeft')
    assert abs(first_page.bounding_box()['width'] - zoom_width) < 2
    page.locator('#zoom-fit').click(); expect(first_page.locator('.textLayer')).to_be_visible()
    divider.dblclick(); expect(first_page.locator('.textLayer')).to_be_visible()
    print('Resizable reader, drag performance, page-position preservation, layout persistence, button-controlled navigation, and keyboard controls work.',flush=True)


def check_pad_passage_links(page, context, url):
    original_id = page.locator('.file-card.active').get_attribute('data-id')
    theme = page.locator('html').get_attribute('data-theme')
    source = 'Evidence follows a question.\n\n' + '\n'.join(f'Reading observation {number}: keep track of what the evidence says.' for number in range(70)) + '\n\nFindings need a reliable source.'
    page.locator('#file-input').set_input_files({'name':'Linked reading passages.txt','mimeType':'text/plain','buffer':source.encode()})
    expect(page.locator('#document-title')).to_have_text('Linked reading passages')
    item_id = page.locator('.file-card.active').get_attribute('data-id')
    select_text(page,'#note-content','Evidence follows a question.')
    page.locator('[data-annotate="pad"]').click()
    expect(page.locator('[data-annotate="pad"]')).to_be_enabled()
    expect(page.locator('[data-filter="notepad"]')).to_have_attribute('aria-selected','true')
    expect(page.locator('#notepad-editor .md-pad-link')).to_have_text('Evidence follows a question.')
    assert '#notate-passage-' not in page.locator('#notepad-editor .cm-content').inner_text(), 'Live links must hide their destination syntax.'
    records = page.request.get(f'{url}/api/items/{item_id}/annotations').json()
    auto_id = records[0]['id']
    assert records[0]['kind'] == 'pad'
    link = page.locator(f'#notepad-editor [data-passage-link="{auto_id}"]')
    link.click(); expect(page.locator('#reader')).to_be_focused()
    expect(page.locator(f'#reader [data-annotation="{auto_id}"]')).to_have_class('annotation-mark pad orange selected')
    click_mark(page,'pad')
    expect(page.locator('#notepad-editor .cm-content')).to_be_focused()

    editor = page.locator('#notepad-editor .cm-content')
    editor.press('ControlOrMeta+End'); editor.press_sequentially('My interpretation is a hypothesis.')
    editor.press('ArrowLeft')
    for _ in range(10): editor.press('Shift+ArrowLeft')
    expect(page.locator('#notepad-selection-toolbar')).to_be_visible()
    page.locator('#link-pad-selection').click()
    expect(page.locator('#pad-link-banner')).to_be_visible()
    expect(page.locator('#pad-link-target')).to_have_text('hypothesis')
    select_text(page,'#note-content','Findings need a reliable source.')
    expect(page.locator('#pad-action-label')).to_have_text('Link to pad')
    page.locator('[data-annotate="pad"]').click()
    expect(page.locator('[data-annotate="pad"]')).to_be_enabled()
    expect(page.locator('#pad-link-banner')).to_be_hidden()
    expect(page.locator('#notepad-editor .md-pad-link')).to_have_count(2)
    records = page.request.get(f'{url}/api/items/{item_id}/annotations').json()
    word_id = next(record['id'] for record in records if record['quote'] == 'Findings need a reliable source.')
    word_link = page.locator(f'#notepad-editor [data-passage-link="{word_id}"]')
    expect(word_link).to_have_text('hypothesis')
    word_link.click()
    try:
        page.wait_for_function('document.querySelector("#reader").scrollTop > 1000',timeout=5000)
    except Exception:
        print(page.evaluate('''() => ({
          scroll:document.querySelector('#reader').scrollTop,
          height:document.querySelector('#reader').scrollHeight,
          focused:document.activeElement.outerHTML.slice(0,250),
          toast:document.querySelector('#toast').textContent,
          links:[...document.querySelectorAll('[data-passage-link]')].map(node => [node.dataset.passageLink,node.textContent]),
          marks:[...document.querySelectorAll('#reader .annotation-mark')].map(node => [node.dataset.annotation,node.className,node.getBoundingClientRect().top])
        })'''),flush=True)
        page.screenshot(path=str(ARTIFACTS/'pad-link-failure.png'),full_page=True)
        raise
    mark = page.locator(f'#reader [data-annotation="{word_id}"]').first
    page.wait_for_function('''id => {
      const mark = document.querySelector('#reader [data-annotation="'+id+'"]'), reader = document.querySelector('#reader');
      const box = mark.getBoundingClientRect(), bounds = reader.getBoundingClientRect();
      return box.top >= bounds.top && box.bottom <= bounds.bottom;
    }''',arg=word_id)
    mark.evaluate('node => node.click()')
    expect(editor).to_be_focused()
    expect(word_link).to_have_text('hypothesis')
    # This is a normal editable Markdown link; changing its label keeps the destination.
    # The reader-to-pad jump selected the exact linked word for us.
    editor.press_sequentially('working idea')
    expect(word_link).to_have_text('working idea')
    expect(page.locator('#notepad-save-state')).to_have_text('Saved locally')
    saved = page.request.get(f'{url}/api/items/{item_id}/notepad').json()['markdown']
    assert f'[working idea](#notate-passage-{word_id})' in saved
    assert 'My interpretation is a ' in saved
    page.locator('#notepad-source').click(); expect(editor).to_contain_text('#notate-passage-')
    page.locator('#notepad-source').click(); assert '#notate-passage-' not in editor.inner_text()
    if page.locator('html').get_attribute('data-theme') != 'light': page.locator('#theme-toggle').click()
    assert word_link.evaluate('node => getComputedStyle(node).textDecorationLine') == 'underline'
    assert word_link.evaluate('node => getComputedStyle(node).color') == 'rgb(154, 75, 10)'
    page.screenshot(path=str(ARTIFACTS/'pad-links-light.png'),full_page=True)
    page.locator('#theme-toggle').click()
    assert word_link.evaluate('node => getComputedStyle(node).color') == 'rgb(255, 193, 124)'
    page.screenshot(path=str(ARTIFACTS/'pad-links-dark.png'),full_page=True)

    second = context.new_page(); second.goto(url)
    expect(second.locator('#document-title')).to_have_text('Linked reading passages')
    second.locator('[data-filter="notepad"]').click()
    expect(second.locator(f'[data-passage-link="{word_id}"]')).to_have_text('working idea')
    page.reload(); expect(page.locator('#note-content')).to_contain_text('Findings need a reliable source.')
    page.locator(f'#annotations-list [data-annotation="{word_id}"] .annotation-copy').click()
    page.wait_for_function("window.__copiedAnnotationText?.includes('> working idea')")
    page.locator('[data-filter="notepad"]').click()
    expect(page.locator(f'[data-passage-link="{word_id}"]')).to_have_text('working idea')
    # Removing a saved link keeps the user's words and synchronizes both panes.
    page.locator('[data-filter="all"]').click()
    card = page.locator(f'#annotations-list [data-annotation="{word_id}"]')
    card.locator('.annotation-copy').click()
    page.wait_for_function("window.__copiedAnnotationText?.includes('## Linked Notepad text')")
    assert '> working idea' in page.evaluate('window.__copiedAnnotationText')
    card.locator('.annotation-menu').click()
    page.locator('#floating-menu .menu-item').filter(has_text='Remove Notepad link').click(); page.locator('#modal-submit').click()
    expect(page.locator(f'#reader [data-annotation="{word_id}"]')).to_have_count(0)
    expect(second.locator(f'[data-passage-link="{word_id}"]')).to_have_count(0)
    expect(second.locator('#notepad-editor .cm-content')).to_contain_text('My interpretation is a working idea.')
    second.close()
    page.locator('[data-filter="notepad"]').click()
    expect(page.locator('#notepad-editor .md-pad-link')).to_have_count(1)
    editor.press('ControlOrMeta+End')
    editor.press_sequentially('\n\n| Topic | Finding |\n| --- | --- |\n| tableword | details |\n\n')
    expect(page.locator('#notepad-editor .md-table-preview td').first).to_have_text('tableword')
    page.locator('#notepad-editor .md-table-preview td').first.click()
    page.locator('#notepad-link').click()
    select_text(page,'#note-content','Reading observation 69')
    page.locator('[data-annotate="pad"]').click()
    expect(page.locator('[data-annotate="pad"]')).to_be_enabled()
    records = page.request.get(f'{url}/api/items/{item_id}/annotations').json()
    table_id = next(record['id'] for record in records if record['quote'] == 'Reading observation 69')
    editor.press('ControlOrMeta+End')
    table_link = page.locator(f'#notepad-editor .md-table-preview [data-passage-link="{table_id}"]')
    expect(table_link).to_have_text('tableword')
    table_link.click(); expect(page.locator('#reader')).to_be_focused()
    expect(page.locator(f'#reader [data-annotation="{table_id}"]')).to_have_class('annotation-mark pad orange selected')
    table_link.click(modifiers=['ControlOrMeta'])
    expect(editor).to_be_focused()
    editor.press_sequentially('table finding'); editor.press('ControlOrMeta+End')
    expect(table_link).to_have_text('table finding')
    expect(page.locator('#notepad-save-state')).to_have_text('Saved locally')
    # Cancelling the association does not create a mark or change Notepad.
    editor.press_sequentially('Unlinked words')
    for _ in range(5): editor.press('Shift+ArrowLeft')
    page.locator('#notepad-link').click(); expect(page.locator('#pad-link-banner')).to_be_visible()
    page.keyboard.press('Escape'); expect(page.locator('#pad-link-banner')).to_be_hidden()
    assert len(page.request.get(f'{url}/api/items/{item_id}/annotations').json()) == 2
    if page.locator('html').get_attribute('data-theme') != theme: page.locator('#theme-toggle').click()
    page.locator(f'.file-card[data-id="{original_id}"]').click()
    expect(page.locator('.pdf-page[data-page="1"] .textLayer')).to_be_visible()
    assert page.request.delete(f'{url}/api/items/{item_id}').status == 200
    expect(page.locator(f'.file-card[data-id="{item_id}"]')).to_have_count(0)
    print('Reading-to-Pad links, selected-word associations, bidirectional jumps, editable labels, light/dark styles, reload, sync, copy, unlink, and cancellation work.',flush=True)


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
    page.locator('#comment-body .cm-content').fill('A table discovery.'); page.locator('#comment-form button[type="submit"]').click()
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


def exercise_format_shortcuts(editor, modifier):
    editor.fill('selected'); editor.press(modifier+'+a'); editor.press(modifier+'+b')
    expect(editor).to_contain_text('**selected**')
    editor.press(modifier+'+b'); expect(editor).to_have_text('selected')
    editor.press(modifier+'+i'); expect(editor).to_contain_text('*selected*')
    editor.press(modifier+'+i'); expect(editor).to_have_text('selected')
    editor.fill(''); editor.press(modifier+'+b'); expect(editor).to_contain_text('** **')
    editor.page.keyboard.insert_text('bold'); editor.press('ArrowRight'); editor.press('ArrowRight')
    editor.press_sequentially(' and '); editor.press(modifier+'+i'); editor.page.keyboard.insert_text('italic')
    editor.press('ArrowRight'); editor.press('Enter')
    return '**bold** and *italic*\n'


def exercise_answer_shortcut(editor, modifier):
    editor.fill(''); editor.press(modifier+'+e')
    expect(editor).to_contain_text('**Answer:** * *')
    editor.page.keyboard.insert_text('A useful finding.')
    expect(editor.locator('.md-answer-text')).to_contain_text('A useful finding.')
    editor.press('Enter')
    expect(editor.locator('.md-answer-label')).to_have_text('Answer:')
    expect(editor.locator('.md-answer-text')).to_have_text('A useful finding.')
    editor.press(modifier+'+z'); editor.press(modifier+'+z')
    redo = modifier+'+Shift+z' if modifier == 'Meta' else modifier+'+y'
    editor.press(redo); editor.press(redo)
    expect(editor.locator('.md-answer-text')).to_have_text('A useful finding.')
    return '**Answer:** *A useful finding.*\n'


def assert_answer_style(container, dark=False):
    label = container.locator('.md-answer-label'); answer = container.locator('.md-answer-text')
    expect(label).to_have_text('Answer:'); expect(answer).to_have_text('A useful finding.')
    assert int(label.evaluate('(node) => getComputedStyle(node).fontWeight')) >= 700
    style = answer.evaluate('''node => { const style=getComputedStyle(node); return {
        color:style.color,weight:style.fontWeight,italic:style.fontStyle,size:style.fontSize,
        bodySize:getComputedStyle(node.closest('.cm-line,p,td') || node.parentElement).fontSize}; }''')
    assert style['weight'] == '400' and style['italic'] == 'italic' and style['size'] == style['bodySize'], style
    assert style['color'] == ('rgb(159, 201, 243)' if dark else 'rgb(35, 79, 135)'), style


def check_inline_answer_shortcut(page, url, modifier):
    if page.locator('html').get_attribute('data-theme') == 'dark': page.locator('#theme-toggle').click()
    title = f'{modifier} inline answer checks'
    page.locator('#new-note').click(); page.locator('#note-title').fill(title); page.locator('#modal-submit').click()
    editor = page.locator('#note-editor .cm-content')
    # Selected words become the answer without losing the original text.
    editor.fill('A useful finding.'); editor.press(modifier+'+a'); editor.press(modifier+'+e')
    expect(editor).to_contain_text('**Answer:** *A useful finding.*')
    editor.press('Enter')
    assert_answer_style(editor)
    editor.press(modifier+'+z'); editor.press(modifier+'+z')
    expect(editor).to_have_text('A useful finding.')
    redo = modifier+'+Shift+z' if modifier == 'Meta' else modifier+'+y'
    editor.press(redo); editor.press(redo)
    assert_answer_style(editor)
    page.locator('#read-mode').click(); assert_answer_style(page.locator('#note-content'))
    note_id = page.locator('.file-card.active').get_attribute('data-id')
    assert httpx.get(url+f'/api/items/{note_id}').json()['markdown'] == '**Answer:** *A useful finding.*\n'
    page.locator('#theme-toggle').click(); assert_answer_style(page.locator('#note-content'),dark=True)
    page.locator('#edit-mode').click(); assert_answer_style(page.locator('#note-editor .cm-content'),dark=True)
    page.locator('#read-mode').click()
    select_text(page,'#note-content','A useful finding.'); page.locator('[data-annotate="comment"]').click()
    comment = page.locator('#comment-body .cm-content')
    exercise_answer_shortcut(comment,modifier); assert_answer_style(comment,dark=True)
    comment.press(modifier+'+Enter')
    assert_answer_style(page.locator('#annotations-list .comment-text'),dark=True)
    reply = page.locator('.reply-form .cm-content')
    exercise_answer_shortcut(reply,modifier); assert_answer_style(reply,dark=True)
    reply.press(modifier+'+Enter')
    expect(page.locator('#annotations-list .comment-text')).to_have_count(2)
    click_mark(page,'comment')
    popup = page.locator('.popup-reply-form .cm-content')
    exercise_answer_shortcut(popup,modifier); assert_answer_style(popup,dark=True)
    popup.press(modifier+'+Enter')
    expect(page.locator('.popup-comment-text')).to_have_count(3)
    page.locator('.popup-close').click()
    if modifier == 'Meta':
        page.locator('.annotation-copy').click()
        page.wait_for_function("window.__copiedAnnotationText?.includes('> **Answer:** *A useful finding.*')")
    page.locator('[data-filter="notepad"]').click()
    pad = page.locator('#notepad-editor .cm-content')
    source = exercise_answer_shortcut(pad,modifier); assert_answer_style(pad,dark=True)
    expect(page.locator('#notepad-save-state')).to_have_text('Saved locally')
    assert httpx.get(url+f'/api/items/{note_id}/notepad').json()['markdown'] == source
    page.screenshot(path=str(ARTIFACTS/f'inline-answer-{modifier.lower()}-dark.png'),full_page=True)
    page.locator('#theme-toggle').click(); assert_answer_style(pad)
    page.screenshot(path=str(ARTIFACTS/f'inline-answer-{modifier.lower()}-light.png'),full_page=True)
    page.reload(); assert_answer_style(page.locator('#note-content'))
    assert_answer_style(page.locator('#annotations-list .comment-text').first)
    page.locator('[data-filter="notepad"]').click()
    page.locator('#notepad-editor .cm-content').press('ArrowDown')
    assert_answer_style(page.locator('#notepad-editor .cm-content'))
    page.locator('.file-card').filter(has_text='Welcome to Notate').click()
    print(f'{modifier} E inserts inline answers in every editor; selected text, undo/redo, body typography, day/night colors, saved rendering, copy, and reopen work.',flush=True)


def exercise_question_example(editor, modifier):
    editor.fill('Selected words'); editor.press(modifier+'+a'); editor.press(modifier+'+m')
    expect(editor).to_contain_text('**Question:** *Selected words*')
    editor.press('Enter')
    expect(editor.locator('.md-question-label')).to_have_text('Question:')
    expect(editor.locator('.md-question-text')).to_have_text('Selected words')
    editor.press(modifier+'+z'); editor.press(modifier+'+z')
    redo = modifier+'+Shift+z' if modifier == 'Meta' else modifier+'+y'
    editor.press(redo); editor.press(redo)
    expect(editor.locator('.md-question-text')).to_have_text('Selected words')
    editor.fill('A practical example.'); editor.press(modifier+'+a'); editor.press(modifier+'+Shift+e')
    expect(editor.locator('.md-example-label')).to_have_text('For Example:')
    expect(editor.locator('.md-example-text')).to_contain_text('A practical example.')
    expect(editor.locator('.md-bullet')).to_have_text('◦')
    editor.fill(''); editor.press(modifier+'+m')
    expect(editor).to_contain_text('**Question:** * *')
    editor.page.keyboard.insert_text('Why does this work?'); editor.press('Enter')
    editor.press(modifier+'+Shift+e')
    editor.page.keyboard.insert_text('A practical example.'); editor.press('Enter'); editor.press('Enter')
    expect(editor.locator('.md-example-text')).to_have_text('A practical example.')
    editor.page.keyboard.insert_text('- Parent\n- Child\n- Grandchild')
    editor.press('ArrowUp'); editor.press('Tab'); editor.press('ArrowDown'); editor.press('Tab'); editor.press('Tab')
    expect(editor.locator('.md-bullet').last).to_have_text('▪')
    editor.press('Shift+Tab'); expect(editor.locator('.md-bullet').last).to_have_text('◦')
    editor.press('Tab'); expect(editor.locator('.md-bullet').last).to_have_text('▪')
    assert editor.locator('.md-bullet').evaluate_all('nodes => nodes.slice(-3).map(node => node.textContent)') == ['•','◦','▪']
    return '**Question:** *Why does this work?*\n\n**For Example:**\n\t- *A practical example.*\n\n- Parent\n\t- Child\n\t\t- Grandchild'


def assert_question_example(container, dark=False):
    expect(container.locator('.md-question-label')).to_have_text('Question:')
    expect(container.locator('.md-example-label')).to_have_text('For Example:')
    question = container.locator('.md-question-text')
    expect(question).to_have_text('Why does this work?')
    style = question.evaluate('node => ({color:getComputedStyle(node).color,weight:getComputedStyle(node).fontWeight,italic:getComputedStyle(node).fontStyle})')
    assert style == {'color':'rgb(241, 205, 103)' if dark else 'rgb(152, 107, 0)','weight':'400','italic':'italic'}, style
    expect(container.locator('.md-example-text')).to_have_text('A practical example.')


def check_question_example_shortcuts(page, url, modifier):
    if page.locator('html').get_attribute('data-theme') == 'dark': page.locator('#theme-toggle').click()
    title = modifier+' question and example checks'
    page.locator('#new-note').click(); page.locator('#note-title').fill(title); page.locator('#modal-submit').click()
    editor = page.locator('#note-editor .cm-content')
    source = exercise_question_example(editor,modifier); assert_question_example(editor)
    expect(page.locator('#save-state')).to_have_text('Saved locally')
    note_id = page.locator('.file-card.active').get_attribute('data-id')
    assert httpx.get(url+f'/api/items/{note_id}').json()['markdown'] == source
    page.locator('#read-mode').click(); assert_question_example(page.locator('#note-content'))
    shapes = page.locator('#note-content ul').evaluate_all('nodes => nodes.slice(-3).map(node => getComputedStyle(node).listStyleType)')
    assert shapes == ['disc','circle','square'], shapes
    select_text(page,'#note-content','Why does this work?'); page.locator('[data-annotate="comment"]').click()
    comment = page.locator('#comment-body .cm-content'); exercise_question_example(comment,modifier)
    comment.press(modifier+'+Enter'); assert_question_example(page.locator('#annotations-list .comment-text'))
    reply = page.locator('.reply-form .cm-content'); exercise_question_example(reply,modifier)
    reply.press(modifier+'+Enter'); expect(page.locator('.comment-text')).to_have_count(2)
    click_mark(page,'comment')
    popup = page.locator('.popup-reply-form .cm-content'); exercise_question_example(popup,modifier)
    popup.press(modifier+'+Enter'); expect(page.locator('.popup-comment-text')).to_have_count(3)
    page.locator('.popup-close').click()
    page.locator('[data-filter="notepad"]').click()
    pad = page.locator('#notepad-editor .cm-content'); exercise_question_example(pad,modifier); assert_question_example(pad)
    expect(page.locator('#notepad-save-state')).to_have_text('Saved locally')
    assert httpx.get(url+f'/api/items/{note_id}/notepad').json()['markdown'] == source
    page.screenshot(path=str(ARTIFACTS/f'question-example-{modifier.lower()}-light.png'),full_page=True)
    page.locator('#theme-toggle').click(); assert_question_example(pad,dark=True)
    page.screenshot(path=str(ARTIFACTS/f'question-example-{modifier.lower()}-dark.png'),full_page=True)
    page.reload(); assert_question_example(page.locator('#note-content'),dark=True)
    page.locator('[data-filter="notepad"]').click(); page.locator('#notepad-editor .cm-content').press('ArrowDown')
    assert_question_example(page.locator('#notepad-editor'),dark=True)
    page.locator('.file-card').filter(has_text='Welcome to Notate').click()
    print(f'{modifier} M questions and Shift E examples work in every editor, with gold text, literal tabs, nesting shapes, undo/redo, persistence, and light/dark themes.',flush=True)


def check_comments_notepad_and_shortcuts(page, url, modifier, label):
    page.locator('#new-note').click(); page.locator('#note-title').fill(label); page.locator('#modal-submit').click()
    source = exercise_format_shortcuts(page.locator('#note-editor .cm-content'),modifier)
    expect(page.locator('#note-editor strong')).to_have_text('bold')
    expect(page.locator('#note-editor em')).to_have_text('italic')
    page.locator('#read-mode').click()
    note_id = page.locator('.file-card.active').get_attribute('data-id')
    assert httpx.get(url+f'/api/items/{note_id}').json()['markdown'] == source
    select_text(page,'#note-content','bold'); page.locator('[data-annotate="comment"]').click()
    comment = page.locator('#comment-body .cm-content')
    exercise_format_shortcuts(comment,modifier)
    expect(page.locator('#comment-form .comment-editor strong')).to_have_text('bold')
    expect(page.locator('#comment-form .markdown-preview')).to_have_count(0)
    comment.press(modifier+'+Enter')
    expect(page.locator('#annotations-list .comment-text strong')).to_have_text('bold')
    reply = page.locator('.reply-form .cm-content')
    exercise_format_shortcuts(reply,modifier)
    page.locator('.reply-form [data-entry-kind="answer"]').click(); reply.press(modifier+'+Enter')
    expect(page.locator('#annotations-list .comment-entry.answer')).to_have_count(1)
    click_mark(page,'comment')
    popup = page.locator('.popup-reply-form .cm-content')
    exercise_format_shortcuts(popup,modifier)
    expect(page.locator('.popup-reply-form .comment-editor strong')).to_have_text('bold')
    popup.press(modifier+'+Enter')
    expect(page.locator('.popup-comment-text')).to_have_count(3)
    page.locator('.popup-close').click()

    # Incoming comments must retain the live editor, focus, and undo history.
    reply.fill('draft in progress'); reply.press(modifier+'+b')
    thread = httpx.get(url+f'/api/items/{note_id}/annotations').json()[0]
    httpx.post(url+f'/api/annotations/{thread["id"]}/comments',json={'body':'An incoming comment.'})
    expect(page.locator('#annotations-list .comment-text')).to_have_count(4)
    expect(reply).to_be_focused(); reply.press(modifier+'+z')
    expect(reply).to_have_text('draft in progress')
    page.locator('[data-filter="notepad"]').click()
    pad = page.locator('#notepad-editor .cm-content'); expect(pad).to_be_visible()
    pad_source = exercise_format_shortcuts(pad,modifier)
    pad.press_sequentially('# Scratchpad'); pad.press('Enter')
    expect(page.locator('#notepad-editor .md-h1')).to_have_text('Scratchpad')
    expect(page.locator('#notepad-save-state')).to_have_text('Saved locally')
    page.locator('#notepad-table').click(); page.locator('#table-columns').fill('2'); page.locator('#table-rows').fill('1'); page.locator('#modal-submit').click()
    expect(page.locator('#notepad-editor .md-table-preview table')).to_be_visible()
    page.locator('#notepad-editor .md-table-preview td').first.click(); page.keyboard.insert_text('Finding')
    for _ in range(8): pad.press('ArrowDown')
    expect(page.locator('#notepad-editor .md-table-preview td').first).to_have_text('Finding')
    expect(page.locator('#notepad-save-state')).to_have_text('Saved locally')
    saved_pad = httpx.get(url+f'/api/items/{note_id}/notepad').json()
    assert saved_pad['markdown'].startswith(pad_source+'# Scratchpad\n') and 'Finding' in saved_pad['markdown']
    assert httpx.get(url+f'/api/items/{note_id}').json()['markdown'] == source
    page.screenshot(path=str(ARTIFACTS/f'notepad-{modifier.lower()}.png'),full_page=True)
    with page.expect_download() as download: page.locator('#notepad-download').click()
    assert Path(download.value.path()).read_text() == saved_pad['markdown']
    page.locator('[data-filter="all"]').click()
    expect(page.locator('.reply-form .cm-content')).to_have_text('draft in progress')
    page.locator('[data-filter="notepad"]').click()
    expect(page.locator('#notepad-editor .md-h1')).to_have_text('Scratchpad')

    other = page.context.new_page(); other.goto(url)
    expect(other.locator('#document-title')).to_have_text(label); other.locator('[data-filter="notepad"]').click()
    expect(other.locator('#notepad-editor .cm-content')).to_contain_text('Scratchpad')
    pad.fill('First window update.')
    expect(page.locator('#notepad-save-state')).to_have_text('Saved locally')
    expect(other.locator('#notepad-editor .cm-content')).to_contain_text('First window update.')
    pad.fill('The first window saves a new version.')
    other.locator('#notepad-editor .cm-content').fill('The second window keeps this draft.')
    expect(page.locator('#notepad-save-state')).to_have_text('Saved locally')
    expect(other.locator('#notepad-save-state')).to_have_text('Review conflicting edits')
    other.locator('#notepad-save-state').click(); expect(other.locator('#saved-pad-version')).to_have_text('The first window saves a new version.')
    other.locator('#modal-submit').click(); expect(other.locator('#notepad-save-state')).to_have_text('Saved locally')
    expect(pad).to_contain_text('The second window keeps this draft.')
    other.close(); page.reload(); page.locator('[data-filter="notepad"]').click()
    expect(page.locator('#notepad-editor .cm-content')).to_contain_text('The second window keeps this draft.')
    # Draft recovery on reload and per-document separation.
    record = httpx.get(url+f'/api/items/{note_id}/notepad').json()
    page.evaluate('''pad => localStorage.setItem(`notate-notepad-draft-${pad.item_id}`,JSON.stringify(pad))''',
                  {'item_id':note_id,'markdown':'# Recovered notepad\n','revision':record['revision']})
    page.reload(); page.locator('[data-filter="notepad"]').click()
    expect(page.locator('#notepad-editor .cm-content')).to_contain_text('Recovered notepad')
    expect(page.locator('#notepad-save-state')).to_have_text('Saved locally')
    page.locator('.file-card').filter(has_text='Welcome to Notate').click()
    page.locator('[data-filter="notepad"]').click(); expect(page.locator('#notepad-editor .cm-content')).to_be_visible()
    welcome_id = page.locator('.file-card.active').get_attribute('data-id')
    assert httpx.get(url+f'/api/items/{welcome_id}/notepad').json()['markdown'] == ''
    page.locator('[data-filter="all"]').click()
    print(f'{modifier} B/I shortcuts work in notes, comments, replies, popups, and Notepad; Notepad saves, syncs, isolates documents, preserves conflicts, and recovers drafts.',flush=True)


def check_notepad_deletion(page, url):
    for title, remote in (('Deliberate notepad deletion',False),('Remote notepad deletion',True)):
        note = httpx.post(url+'/api/notes',json={'title':title,'markdown':''}).json()
        page.locator('.file-card').filter(has_text=title).click()
        expect(page.locator('#document-title')).to_have_text(title)
        page.locator('[data-filter="notepad"]').click()
        page.locator('#notepad-editor .cm-content').fill('**Preserved** notepad draft.')
        if not remote:
            page.locator('#document-menu').click(); page.locator('.menu-item').filter(has_text='Delete document').click()
            expect(page.locator('#modal-body')).to_contain_text('its notepad')
            page.locator('#modal-submit').click()
            expect(page.locator('#document-title')).not_to_have_text(title)
            assert httpx.get(url+f'/api/items/{note["id"]}').status_code == 404
        else:
            assert httpx.delete(url+f'/api/items/{note["id"]}').status_code == 200
            expect(page.locator('#notepad-save-state')).to_have_text('Review conflicting edits')
            page.locator('#notepad-save-state').click()
            expect(page.locator('#modal-title')).to_have_text('Keep your notepad')
            page.locator('#recovered-pad-title').fill('Recovered document notepad'); page.locator('#modal-submit').click()
            expect(page.locator('#document-title')).to_have_text('Recovered document notepad')
            expect(page.locator('#note-editor .cm-content')).to_contain_text('**Preserved** notepad draft.')
    page.locator('.file-card').filter(has_text='Welcome to Notate').click()
    print('Deliberate document deletion clears its notepad; remote deletion preserves drafts and can recover them as a new note.',flush=True)


def run(additional_pdf=None, links_only=False, templates_only=False):
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
                if templates_only:
                    check_inline_answer_shortcut(page,url,'Meta')
                    check_question_example_shortcuts(page,url,'Meta')
                    linux = browser.new_context(viewport={'width':1512,'height':982})
                    linux.add_init_script("Object.defineProperty(navigator,'platform',{configurable:true,get:()=> 'Linux x86_64'})")
                    linux_page = linux.new_page(); linux_page.goto(url)
                    check_inline_answer_shortcut(linux_page,url,'Control')
                    check_question_example_shortcuts(linux_page,url,'Control')
                    linux.close(); assert not errors, errors
                    browser.close(); return
                if links_only:
                    page.locator('#file-input').set_input_files({'name':'A field guide to better questions.pdf','mimeType':'application/pdf','buffer':sample_pdf()})
                    expect(page.locator('.pdf-page[data-page="1"] .textLayer')).to_be_visible()
                    check_pad_passage_links(page,context,url)
                    assert not errors, errors
                    assert not outside_requests, outside_requests
                    browser.close()
                    return
                check_markdown_editor(page,url)
                check_comments_notepad_and_shortcuts(page,url,'Meta','Mac shortcut checks')
                check_inline_answer_shortcut(page,url,'Meta')
                check_question_example_shortcuts(page,url,'Meta')
                linux = browser.new_context(viewport={'width':1512,'height':982})
                linux.add_init_script("Object.defineProperty(navigator,'platform',{configurable:true,get:()=> 'Linux x86_64'})")
                linux_page = linux.new_page(); linux_page.goto(url)
                linux_page.locator('.file-card').filter(has_text='Welcome to Notate').click()
                check_comments_notepad_and_shortcuts(linux_page,url,'Control','Linux shortcut checks')
                check_inline_answer_shortcut(linux_page,url,'Control')
                check_question_example_shortcuts(linux_page,url,'Control')
                linux.close()
                check_notepad_deletion(page,url)

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
                page.locator('#comment-body .cm-content').fill('What makes a question useful?'); page.locator('#comment-form button[type="submit"]').click()
                expect(page.locator('.comment-text')).to_have_text('What makes a question useful?')
                page.locator('.reply-form .cm-content').fill('It can be answered with evidence.'); page.locator('.reply-form button[type="submit"]').click()
                expect(page.locator('.comment-text')).to_have_count(2)
                expect(page.locator('.annotation-mark.comment')).to_have_count(1)
                select_text(page,'#note-content','Evidence'); page.locator('[data-annotate="underline"]').click()
                expect(page.locator('.annotation-mark.underline')).to_have_count(1)
                select_text(page,'#note-content','discovery'); page.locator('[data-annotate="strike"]').click()
                expect(page.locator('.annotation-mark.strike')).to_have_count(1)
                print('Nested folders, note autosave, anchored comments, replies, underline, and strikethrough work.',flush=True)

                first_card = page.locator('#annotations-list .annotation-card').first
                first_card.locator('.reply-form .cm-content').fill('UNSENT DRAFT — leave this out of the copied thread.')
                first_card.locator('.annotation-copy').click()
                page.wait_for_function("window.__copiedAnnotationText?.includes('### Reply 1')")
                copied = page.evaluate('window.__copiedAnnotationText')
                assert 'Document: My research findings' in copied and 'Folder: Research / Questions' in copied
                assert 'Location: Note text' in copied and 'Status: Open' in copied
                assert '## Highlighted source text\n\n> A good question' in copied
                assert copied.index('What makes a question useful?') < copied.index('It can be answered with evidence.')
                assert 'UNSENT DRAFT' not in copied
                assert first_card.locator('.reply-form .cm-content').inner_text().startswith('UNSENT DRAFT')
                first_card.locator('.reply-form .cm-content').fill('')
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
                page.locator('[data-annotate="comment"]').click(); page.locator('#comment-body .cm-content').fill(long_comment)
                expect(page.locator('#comment-form .md-h2')).to_have_text('Question')
                expect(page.locator('#comment-form .comment-editor strong')).to_have_text('How does this help?')
                page.locator('#comment-form button[type="submit"]').click()
                expect(page.locator('#annotation-count')).to_have_text('1')
                markdown_reply = 'Final answer in this thread.\n\n**Clear finding** with *evidence* and ~~old idea~~.\n\n- Observe\n- Compare\n\n```python\nresult = 2\n```\n\n[Reference](https://example.com)'
                page.locator('.reply-form .cm-content').fill(markdown_reply)
                expect(page.locator('.reply-form .comment-editor strong')).to_have_text('Clear finding')
                expect(page.locator('.reply-form .md-bullet')).to_have_count(2)
                expect(page.locator('.reply-form .md-code-block').filter(has_text='result = 2')).to_have_count(1)
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
                page.locator('.reply-form .cm-content').fill('**A draft to preserve**'); page.locator('.reply-form .cm-content').press('Enter')
                entries.first.locator('.saved-kind-switch [data-entry-kind="answer"]').click()
                expect(page.locator('#annotations-list .comment-entry.answer')).to_have_count(2)
                assert page.locator('.reply-form .cm-content').evaluate('(node) => node.closest("form").markdownEditor.getSource()') == '**A draft to preserve**\n'
                expect(page.locator('.reply-form')).to_have_attribute('data-kind','answer')
                expect(page.locator('.reply-form .comment-editor strong')).to_have_text('A draft to preserve')
                entries.first.locator('.saved-kind-switch [data-entry-kind="reply"]').click()
                expect(page.locator('#annotations-list .comment-entry.answer')).to_have_count(1)
                page.locator('.reply-form .cm-content').fill('')
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
                print('Live Markdown comment formatting, blue answers, type changes, draft preservation, live sync, persistence, and copy labels work.',flush=True)
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
                page.locator('.popup-reply-form .cm-content').fill('The whole passage is connected to this thought.')
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
                page.locator('.reply-form').first.locator('.cm-content').fill('A finding worth keeping.'); page.locator('.reply-form').first.locator('button[type="submit"]').click()
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
                page.locator('[data-annotate="comment"]').click(); page.locator('#comment-body .cm-content').fill('How can I make this a habit?')
                page.locator('#comment-form button[type="submit"]').click(); expect(page.locator('.comment-text')).to_have_text('How can I make this a habit?')
                page.locator('.reply-form').last.locator('.cm-content').fill('Write one question before opening each paper.'); page.locator('.reply-form').last.locator('button[type="submit"]').click()
                expect(page.locator('.comment-text')).to_have_count(2)
                check_workspace_layout(page)
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
                check_pad_passage_links(page,context,url)

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
                select_text(phone,'.pdf-page[data-page="1"] .textLayer','Your discoveries belong together in Notate.')
                phone.locator('[data-annotate="pad"]').click()
                expect(phone.locator('#annotations-panel')).to_be_visible()
                expect(phone.locator('#notepad-editor .md-pad-link')).to_have_text('Your discoveries belong together in Notate.')
                phone.locator('#notepad-editor .md-pad-link').click()
                expect(phone.locator('#annotations-panel')).to_be_hidden()
                expect(phone.locator('#reader')).to_be_focused()
                assert phone.evaluate('document.documentElement.scrollWidth') <= 390
                phone.screenshot(path=str(ARTIFACTS/'mobile-web.png'),full_page=True)
                assert phone.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile page overflows'
                phone.locator('#toggle-annotations').click(); expect(phone.locator('#annotations-panel')).to_be_visible()
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
                    page.locator('[data-annotate="comment"]').click(); page.locator('#comment-body .cm-content').fill('Import verification: this passage is selectable.')
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
    parser.add_argument('--links-only',action='store_true',help='Check passage links in an isolated workspace without the other UI checks.')
    parser.add_argument('--templates-only',action='store_true',help='Check Markdown template shortcuts in every editor on macOS and Linux.')
    args = parser.parse_args()
    run(args.pdf,args.links_only,args.templates_only)
