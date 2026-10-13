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
                window.evaluate_js("document.querySelector('#comment-body').value = 'A question from the desktop app.'; document.querySelector('#comment-form').requestSubmit()")
                wait_for("document.querySelector('.comment-text')?.textContent === 'A question from the desktop app.'")
                records = httpx.get(url+f'/api/items/{item_id}/annotations').json()
                assert records[0]['comments'][0]['body'] == 'A question from the desktop app.'
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
                window.evaluate_js("document.querySelector('.popup-reply-form textarea').value = 'An answer from the passage popup.'; document.querySelector('.popup-reply-form').requestSubmit()")
                wait_for("document.querySelector('.popup-thread').textContent.includes('An answer from the passage popup.')")
                records = httpx.get(url+f'/api/items/{item_id}/annotations').json()
                assert len(records) == 1 and len(records[0]['comments']) == 2
                window.evaluate_js("document.querySelector('#toggle-popups').click()")
                wait_for("document.querySelector('#annotation-popover').hidden && document.querySelector('#toggle-popups').getAttribute('aria-pressed') === 'false'")
                results.update(status='passed',native_engine='macOS WKWebView',pdf_text_selection=True,comment_saved_in_shared_backend=True,
                               dark_mode=True,contained_selection=True,passage_popup_reply=True,popup_toggle=True)
                print('Native desktop PDF rendering, text selection, dark mode, passage popups, replies, and toggle passed.',flush=True)
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
