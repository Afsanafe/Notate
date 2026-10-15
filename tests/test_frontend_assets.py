"""Updates must load one matching set of frontend modules and styles."""

import hashlib
import re
from pathlib import Path


STATIC = Path(__file__).resolve().parents[1] / 'notate' / 'static'


def test_frontend_asset_versions_match_shipped_files():
    html = (STATIC / 'index.html').read_text()
    for asset in ('app.js', 'style.css', 'vendor/pdf_viewer.css'):
        revision = hashlib.sha256((STATIC / asset).read_bytes()).hexdigest()[:16]
        assert f'/static/{asset}?v={revision}"' in html, 'Rebuild frontend assets with npm run build:editor.'
    app = (STATIC / 'app.js').read_text()
    dependency = re.search(r"from ['\"]\./vendor/note-editor\.js\?v=([a-f0-9]+)['\"]", app)
    assert dependency, 'The editor dependency needs its own cache version.'
    assert dependency[1] == hashlib.sha256((STATIC / 'vendor/note-editor.js').read_bytes()).hexdigest()[:16]
