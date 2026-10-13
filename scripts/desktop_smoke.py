"""Open the actual native desktop launcher, verify WKWebView, then close it."""

import json
import socket
import sys
import tempfile
import time
from pathlib import Path

import httpx
import webview

from browser_smoke import sample_pdf
from notate import cli


def run():
    results = {}
    real_start = webview.start
    with tempfile.TemporaryDirectory(prefix='notate-desktop-') as directory:
        with socket.socket() as handle:
            handle.bind(('127.0.0.1',0)); port = handle.getsockname()[1]
        url = f'http://127.0.0.1:{port}'

        def check():
            window = webview.windows[0]

            def wait_for(expression, timeout=20):
                deadline = time.monotonic()+timeout
                while time.monotonic() < deadline:
                    try:
                        if window.evaluate_js(expression): return
                    except Exception: pass
                    time.sleep(.1)
                raise AssertionError(f'Native view timed out: {expression}')

            try:
                wait_for("document.querySelector('#document-title')?.textContent === 'Welcome to Notate'")
                wait_for("document.querySelector('#connection-label')?.textContent.includes('synced')")
                imported = httpx.post(url+'/api/import',files={'file':('Desktop reading test.pdf',sample_pdf(),'application/pdf')}).json()
                item_id = imported['id']
                wait_for(f"!!document.querySelector('.file-card[data-id=\"{item_id}\"]')")
                window.evaluate_js(f"document.querySelector('.file-card[data-id=\"{item_id}\"]').click()")
                wait_for("!!document.querySelector('.pdf-page .textLayer span')")
                window.evaluate_js('''(() => {
                  window.__layoutNotesWidth = document.querySelector('#annotations-panel').getBoundingClientRect().width;
                  window.__layoutPDFWidth = document.querySelector('.pdf-page').getBoundingClientRect().width;
                  const divider = document.querySelector('#panel-resizer'); divider.focus();
                  divider.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',shiftKey:true,bubbles:true,cancelable:true}));
                })()''')
                wait_for("document.querySelector('#annotations-panel').getBoundingClientRect().width === window.__layoutNotesWidth + 40")
                wait_for("!!document.querySelector('.pdf-page .textLayer span') && document.querySelector('.pdf-page').getBoundingClientRect().width < window.__layoutPDFWidth")
                window.evaluate_js("window.__layoutReaderWidth = document.querySelector('#reader').getBoundingClientRect().width; document.querySelector('#sidebar-collapse').click()")
                wait_for("getComputedStyle(document.querySelector('#sidebar')).display === 'none' && document.querySelector('#reader').getBoundingClientRect().width > window.__layoutReaderWidth + 200")
                window.evaluate_js("document.elementFromPoint(2,400).dispatchEvent(new PointerEvent('pointerenter',{clientX:2,clientY:400})); document.querySelector('#sidebar-toggle').click(); document.querySelector('#panel-resizer').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))")
                wait_for("!document.querySelector('.app-shell').classList.contains('nav-collapsed') && document.querySelector('#annotations-panel').getBoundingClientRect().width === window.__layoutNotesWidth")
                wait_for("!!document.querySelector('.pdf-page .textLayer span')")
                results['workspace_layout'] = 'passed'
                window.evaluate_js('''(() => {
                  const container = document.querySelector('.pdf-page .textLayer');
                  const walker = document.createTreeWalker(container,NodeFilter.SHOW_TEXT);
                  const quote = 'Your discoveries belong together in Notate.';
                  let node; while (node = walker.nextNode()) {
                    const start = node.textContent.indexOf(quote); if (start < 0) continue;
                    const range = document.createRange(); range.setStart(node,start); range.setEnd(node,start+quote.length);
                    getSelection().removeAllRanges(); getSelection().addRange(range);
                    container.dispatchEvent(new PointerEvent('pointerup',{bubbles:true})); return;
                  }
                  throw new Error('No native Pad selection found.');
                })()''')
                wait_for("document.querySelector('#selection-toolbar').hidden === false")
                window.evaluate_js("document.querySelector('[data-annotate=pad]').click()")
                wait_for("document.querySelector('#notepad-editor .md-pad-link')?.textContent === 'Your discoveries belong together in Notate.'")
                window.evaluate_js("window.__padLinkId = document.querySelector('#notepad-editor .md-pad-link').dataset.passageLink; document.execCommand('insertText',false,'Desktop discovery')")
                wait_for("document.querySelector('#notepad-editor .md-pad-link')?.textContent === 'Desktop discovery'")
                wait_for("document.querySelector('#notepad-save-state').textContent === 'Saved locally'")
                link_id = window.evaluate_js('window.__padLinkId')
                assert f'[Desktop discovery](#notate-passage-{link_id})' in httpx.get(url+f'/api/items/{item_id}/notepad').json()['markdown']
                window.evaluate_js("document.querySelector('#notepad-editor .md-pad-link').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0}))")
                wait_for("document.activeElement.id === 'reader' && document.querySelector('#reader .annotation-mark.pad').classList.contains('selected')")
                window.evaluate_js("document.querySelector('#reader .annotation-mark.pad').click()")
                wait_for("document.activeElement === document.querySelector('#notepad-editor .cm-content')")
                httpx.delete(url+f'/api/annotations/{link_id}').raise_for_status()
                wait_for("!document.querySelector('#reader .annotation-mark.pad') && !document.querySelector('#notepad-editor .md-pad-link')")
                wait_for("document.querySelector('#notepad-editor .cm-content').textContent.includes('Desktop discovery')")
                # Keep the existing native Notepad check's empty starting state.
                pad = httpx.get(url+f'/api/items/{item_id}/notepad').json()
                httpx.patch(url+f'/api/items/{item_id}/notepad',json={'revision':pad['revision'],'markdown':''}).raise_for_status()
                wait_for("!document.querySelector('#notepad-editor .cm-content').textContent.includes('Desktop discovery')")
                window.evaluate_js("document.querySelector('[data-filter=all]').click()")
                results['pad_passage_links'] = 'passed'
                window.evaluate_js('''(() => {
                  const container = document.querySelector('.pdf-page .textLayer');
                  const walker = document.createTreeWalker(container,NodeFilter.SHOW_TEXT);
                  const quote = 'Reading is a conversation with an idea.';
                  let node;
                  while (node = walker.nextNode()) {
                    const index = node.textContent.indexOf(quote); if (index < 0) continue;
                    const range = document.createRange(); range.setStart(node,index); range.setEnd(node,index+quote.length);
                    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
                    container.dispatchEvent(new PointerEvent('pointerup',{bubbles:true})); return true;
                  }
                  throw new Error('No native selectable PDF text found.');
                })()''')
                wait_for("document.querySelector('#selection-toolbar').hidden === false")
                window.evaluate_js("document.querySelector('[data-annotate=comment]').click()")
                wait_for("document.querySelector('#comment-popover').hidden === false")
                window.evaluate_js("document.querySelector('#comment-body .cm-content').focus(); document.querySelector('#comment-body .cm-content').dispatchEvent(new KeyboardEvent('keydown',{key:'b',code:'KeyB',metaKey:true,bubbles:true,cancelable:true})); document.execCommand('insertText',false,'A question')")
                wait_for("document.querySelector('#comment-form').markdownEditor.getSource() === '**A question**'")
                window.evaluate_js("for(let step=0;step<2;step++) document.querySelector('#comment-body .cm-content').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',code:'ArrowRight',bubbles:true,cancelable:true})); document.execCommand('insertText',false,' from the desktop app.')")
                wait_for("document.querySelector('#comment-form').markdownEditor.getSource().endsWith(' from the desktop app.')")
                window.evaluate_js("document.querySelector('#comment-body .cm-content').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}))")
                wait_for("document.querySelector('#comment-form .comment-editor strong')?.textContent === 'A question'")
                window.evaluate_js("document.querySelector('#comment-form').requestSubmit()")
                wait_for("document.querySelector('.comment-text')?.textContent === 'A question from the desktop app.'")
                records = httpx.get(url+f'/api/items/{item_id}/annotations').json()
                assert records[0]['comments'][0]['body'] == '**A question** from the desktop app.'
                window.evaluate_js("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text => { window.__copiedAnnotationText = text; }}}); document.querySelector('.annotation-copy').click()")
                wait_for("window.__copiedAnnotationText?.includes('PDF page: 1')")
                copied = window.evaluate_js('window.__copiedAnnotationText')
                assert 'Original file: Desktop reading test.pdf' in copied
                assert '## Highlighted source text\n\n> Reading is a conversation with an idea.' in copied
                assert '### Initial comment or question\n\n> **A question** from the desktop app.' in copied
                window.evaluate_js("if (document.documentElement.dataset.theme !== 'dark') document.querySelector('#theme-toggle').click()")
                wait_for("document.documentElement.dataset.theme === 'dark'")
                window.evaluate_js('''(() => {
                  const container = document.querySelector('.pdf-page .textLayer');
                  const walker = document.createTreeWalker(container,NodeFilter.SHOW_TEXT);
                  let node; while (node = walker.nextNode()) {
                    const index = node.textContent.indexOf('Reading'); if (index < 0) continue;
                    const range = document.createRange(); range.setStart(node,index); range.setEnd(node,index+7);
                    getSelection().removeAllRanges(); getSelection().addRange(range);
                    container.dispatchEvent(new PointerEvent('pointerup',{bubbles:true})); return;
                  }
                })()''')
                wait_for("document.querySelector('#annotation-popover').hidden === false")
                wait_for("document.querySelector('.annotation-card.selected')?.dataset.annotation === document.querySelector('#annotation-popover').dataset.annotation")
                window.evaluate_js("document.querySelector('.popup-reply-form [data-entry-kind=answer]').click(); document.querySelector('.popup-reply-form').markdownEditor.focus(); document.execCommand('insertText',false,'**An answer** from the passage popup.')")
                wait_for("document.querySelector('.popup-reply-form').markdownEditor.getSource().endsWith(' from the passage popup.')")
                window.evaluate_js("document.querySelector('.popup-reply-form .cm-content').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}))")
                wait_for("document.querySelector('.popup-reply-form .comment-editor strong')?.textContent === 'An answer'")
                window.evaluate_js("document.querySelector('.popup-reply-form').requestSubmit()")
                wait_for("document.querySelector('.popup-thread').textContent.includes('An answer from the passage popup.')")
                records = httpx.get(url+f'/api/items/{item_id}/annotations').json()
                assert len(records) == 1 and len(records[0]['comments']) == 2
                assert records[0]['comments'][1]['kind'] == 'answer'
                wait_for("!!document.querySelector('#annotations-list .comment-entry.answer .comment-text strong')")
                window.evaluate_js("document.querySelector('#annotations-list .comment-entry .saved-kind-switch [data-entry-kind=answer]').click()")
                wait_for("document.querySelectorAll('#annotations-list .comment-entry.answer').length === 2")
                window.evaluate_js("document.querySelector('#annotations-list .comment-entry .saved-kind-switch [data-entry-kind=reply]').click()")
                wait_for("document.querySelectorAll('#annotations-list .comment-entry.answer').length === 1")
                window.evaluate_js("document.querySelector('.annotation-copy').click()")
                wait_for("window.__copiedAnnotationText?.includes('### Answer 1')")
                assert '> **An answer** from the passage popup.' in window.evaluate_js('window.__copiedAnnotationText')
                window.evaluate_js("document.querySelector('#toggle-popups').click()")
                wait_for("document.querySelector('#annotation-popover').hidden && document.querySelector('#toggle-popups').getAttribute('aria-pressed') === 'false'")
                window.evaluate_js("document.querySelector('[data-filter=notepad]').click()")
                wait_for("!!document.querySelector('#notepad-editor .cm-content')")
                window.evaluate_js("document.querySelector('#notepad-editor .cm-content').focus(); document.querySelector('#notepad-editor .cm-content').dispatchEvent(new KeyboardEvent('keydown',{key:'i',code:'KeyI',metaKey:true,bubbles:true,cancelable:true})); document.execCommand('insertText',false,'Desktop pad')")
                wait_for("document.querySelector('#notepad-editor .cm-content').textContent.includes('*Desktop pad*')")
                window.evaluate_js("document.querySelector('#notepad-editor .cm-content').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',code:'ArrowRight',bubbles:true,cancelable:true})); document.querySelector('#notepad-editor .cm-content').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}))")
                wait_for("document.querySelector('#notepad-editor em')?.textContent === 'Desktop pad'")
                wait_for("document.querySelector('#notepad-save-state').textContent === 'Saved locally'")
                assert httpx.get(url+f'/api/items/{item_id}/notepad').json()['markdown'] == '*Desktop pad*\n'
                window.evaluate_js("document.querySelector('[data-filter=all]').click()")
                note = httpx.post(url+'/api/notes',json={'title':'Desktop Markdown test','markdown':''}).json()
                note_id = note['id']
                wait_for(f"!!document.querySelector('.file-card[data-id=\"{note_id}\"]')")
                window.evaluate_js(f"document.querySelector('.file-card[data-id=\"{note_id}\"]').click()")
                wait_for("document.querySelector('#document-title')?.textContent === 'Desktop Markdown test'")
                window.evaluate_js("document.querySelector('#edit-mode').click()")
                wait_for("!!document.querySelector('#note-editor .cm-content')")
                window.evaluate_js("document.querySelector('#note-editor .cm-content').focus(); document.execCommand('insertText',false,'# Desktop heading')")
                wait_for("document.querySelector('#note-editor .cm-content').textContent.includes('# Desktop heading')")
                window.evaluate_js("document.querySelector('#note-editor .cm-content').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}))")
                wait_for("document.querySelector('#note-editor .md-h1')?.textContent === 'Desktop heading'")
                window.evaluate_js("document.querySelector('#insert-table').click()")
                wait_for("document.querySelector('#modal').open")
                window.evaluate_js("document.querySelector('#table-columns').value = 2; document.querySelector('#table-rows').value = 2; document.querySelector('#modal-form').requestSubmit()")
                wait_for("document.querySelectorAll('.md-table-preview th').length === 2 && document.querySelectorAll('.md-table-preview td').length === 4")
                window.evaluate_js("document.querySelector('.md-table-preview td').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}))")
                wait_for("!document.querySelector('.md-table-preview')")
                window.evaluate_js("document.execCommand('insertText',false,'Desktop finding')")
                wait_for("document.querySelector('#note-editor .cm-content').textContent.includes('Desktop finding')")
                window.evaluate_js("for (let step=0;step<8;step++) document.querySelector('#note-editor .cm-content').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',code:'ArrowDown',bubbles:true,cancelable:true}))")
                wait_for("document.querySelector('.md-table-preview td')?.textContent === 'Desktop finding'")
                wait_for("document.querySelector('#save-state').textContent === 'Saved locally'")
                saved = httpx.get(url+f'/api/items/{note_id}').json()
                assert saved['markdown'].startswith('# Desktop heading\n') and '| Column 1 | Column 2 |' in saved['markdown']
                assert 'Desktop finding' in saved['markdown']
                window.evaluate_js("document.querySelector('#read-mode').click()")
                wait_for("document.querySelector('#note-content h1')?.textContent === 'Desktop heading'")
                wait_for("document.querySelectorAll('#note-content th').length === 2")
                answer_note = httpx.post(url+'/api/notes',json={'title':'Native inline answer','markdown':''}).json()
                answer_id = answer_note['id']
                wait_for(f"!!document.querySelector('.file-card[data-id=\"{answer_id}\"]')")
                window.evaluate_js(f"document.querySelector('.file-card[data-id=\"{answer_id}\"]').click()")
                wait_for("document.querySelector('#document-title').textContent === 'Native inline answer'")
                window.evaluate_js("document.querySelector('#edit-mode').click()")
                wait_for("!!document.querySelector('#note-editor .cm-content')")
                window.evaluate_js("document.querySelector('#note-editor .cm-content').focus(); document.querySelector('#note-editor .cm-content').dispatchEvent(new KeyboardEvent('keydown',{key:'e',code:'KeyE',metaKey:true,bubbles:true,cancelable:true})); document.execCommand('insertText',false,'A useful finding.')")
                wait_for("document.querySelector('#note-editor .md-answer-text')?.textContent.includes('A useful finding.')")
                window.evaluate_js("document.querySelector('#note-editor .cm-content').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}))")
                wait_for("document.querySelector('#note-editor .md-answer-label')?.textContent === 'Answer:'")
                wait_for("document.querySelector('#save-state').textContent === 'Saved locally'")
                assert httpx.get(url+f'/api/items/{answer_id}').json()['markdown'] == '**Answer:** *A useful finding.*\n'
                window.evaluate_js("document.querySelector('#read-mode').click()")
                wait_for("document.querySelector('#note-content .md-answer-text')?.textContent === 'A useful finding.'")
                assert window.evaluate_js("getComputedStyle(document.querySelector('#note-content .md-answer-text')).color") == 'rgb(159, 201, 243)'
                window.evaluate_js("document.querySelector('#theme-toggle').click()")
                wait_for("document.documentElement.dataset.theme === 'light'")
                assert window.evaluate_js("getComputedStyle(document.querySelector('#note-content .md-answer-text')).color") == 'rgb(35, 79, 135)'
                assert window.evaluate_js("getComputedStyle(document.querySelector('#note-content .md-answer-text')).fontWeight") == '400'
                template_note = httpx.post(url+'/api/notes',json={'title':'Native question and example','markdown':''}).json()
                template_id = template_note['id']
                wait_for(f"!!document.querySelector('.file-card[data-id=\"{template_id}\"]')")
                window.evaluate_js(f"document.querySelector('.file-card[data-id=\"{template_id}\"]').click()")
                wait_for("document.querySelector('#document-title').textContent === 'Native question and example'")
                window.evaluate_js("document.querySelector('#edit-mode').click()")
                wait_for("!!document.querySelector('#note-editor .cm-content')")
                window.evaluate_js("document.querySelector('#note-editor .cm-content').focus(); document.querySelector('#note-editor .cm-content').dispatchEvent(new KeyboardEvent('keydown',{key:'M',code:'KeyM',metaKey:true,shiftKey:true,bubbles:true,cancelable:true})); document.execCommand('insertText',false,'Why does this work?')")
                wait_for("document.querySelector('#note-editor .md-question-text')?.textContent.includes('Why does this work?')")
                window.evaluate_js("document.querySelector('#note-editor .cm-content').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true})); document.querySelector('#note-editor .cm-content').dispatchEvent(new KeyboardEvent('keydown',{key:'E',code:'KeyE',metaKey:true,shiftKey:true,bubbles:true,cancelable:true})); document.execCommand('insertText',false,'A practical example.')")
                wait_for("document.querySelector('#note-editor .md-example-text')?.textContent.includes('A practical example.')")
                window.evaluate_js("document.querySelector('#note-editor .cm-content').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true})); document.querySelector('#note-editor .cm-content').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}))")
                wait_for("document.querySelector('#note-editor .md-question-label')?.textContent === 'Question:' && document.querySelector('#note-editor .md-example-label')?.textContent === 'For Example:'")
                assert window.evaluate_js("document.querySelector('#note-editor .md-bullet').textContent") == '◦'
                wait_for("document.querySelector('#save-state').textContent === 'Saved locally'")
                assert httpx.get(url+f'/api/items/{template_id}').json()['markdown'] == '**Question:** *Why does this work?*\n\n**For Example:**\n\t- *A practical example.*\n\n'
                window.evaluate_js("document.querySelector('#read-mode').click()")
                wait_for("document.querySelector('#note-content .md-question-text')?.textContent === 'Why does this work?'")
                assert window.evaluate_js("getComputedStyle(document.querySelector('#note-content .md-question-text')).color") == 'rgb(152, 107, 0)'
                assert window.evaluate_js("getComputedStyle(document.querySelector('#note-content ul')).listStyleType") == 'circle'
                window.evaluate_js("document.querySelector('#theme-toggle').click()")
                assert window.evaluate_js("getComputedStyle(document.querySelector('#note-content .md-question-text')).color") == 'rgb(241, 205, 103)'
                results['question_example_shortcuts'] = 'passed'
                results.update(status='passed',native_engine='macOS WKWebView',pdf_text_selection=True,comment_saved_in_shared_backend=True,
                               dark_mode=True,contained_selection=True,passage_popup_reply=True,popup_toggle=True,copy_markdown=True,markdown_preview=True,answer_types=True,
                               note_markdown_live_preview=True,note_tables=True,comment_live_editing=True,command_shortcuts=True,document_notepad=True,inline_answer_shortcut=True)
                print('Native live Markdown comments, Command B/I shortcuts, document Notepad, note editing, tables, annotations, and blue answers passed.',flush=True)
            except BaseException as error:
                results.update(status='failed',error=str(error))
                print(f'Desktop verification failed: {error}',flush=True)
            finally:
                window.destroy()

        webview.start = lambda *args, **kwargs: real_start(check,*args,**kwargs)
        sys.argv = ['notate','desktop','--port',str(port),'--data-dir',directory]
        cli.main()
        try:
            httpx.get(url+'/api/health',timeout=.5)
        except httpx.HTTPError:
            results['owned_server_stopped_on_close'] = True
        else:
            raise AssertionError('The desktop-owned server did not shut down.')
    artifact = Path(__file__).resolve().parent.parent/'.local-data'/'artifacts'/'desktop-results.json'
    artifact.parent.mkdir(parents=True,exist_ok=True)
    artifact.write_text(json.dumps(results,indent=2))
    if results.get('status') != 'passed': raise AssertionError(results)


if __name__ == '__main__':
    run()
