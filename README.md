# Notate

A Python desktop and web app for keeping your documents, questions, and discoveries together. Runs locally, with a shared SQLite backend and live updates across open browser tabs and desktop windows.

## Run it

Python 3.11 or newer is required. The project includes its PDF viewer and assets; no Node build or runtime CDN is needed.

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[desktop]"
```

Start the web app:

```sh
python -m notate serve
```~

Open **http://127.0.0.1:8765** in your browser.

Start the native desktop app in another terminal:

```sh
source .venv/bin/activate
python -m notate desktop
```

Desktop mode uses the running server on port 8765. If no server is running, it starts one and stops that server when the desktop window closes. Run `serve` separately to keep the backend available after closing the desktop window. Both interfaces share exactly the same data and features.

For a simple launch, run one of these scripts from the project folder:

| Launch | Terminal command | Double-click on macOS |
| --- | --- | --- |
| Desktop | `./start_desktop.sh` | **Notate Desktop.command** |
| Browser | `./start_browser.sh` | **Notate Web.command** |
| Both | `./start_both.sh` | **Notate Both.command** |

The launchers create the virtual environment and install dependencies if needed. Browser and both modes automatically open your default browser after the backend is ready. All modes reuse an existing Notate backend on the selected port. In this checkout, dependencies are already installed.

Keep the launcher's terminal open when it starts a backend. In browser or both mode, **Ctrl+C** stops that backend; closing the desktop window in both mode keeps the browser working. In desktop-only mode, closing the window stops the backend it started. A launcher that reuses another running backend leaves it running.

You can pass options to any script, for example `./start_both.sh --port 9000 --data-dir /path/to/workspace`. Use the same port for interfaces sharing a backend; if a backend is already running there, its workspace is used. The scripts also work when invoked from another folder.

For only the web app, install with `python -m pip install -e .`. The native window uses [pywebview](https://pywebview.flowrl.com/guide/usage.html): macOS uses WKWebView; Windows requires WebView2; Linux needs a supported GTK or Qt webview runtime. See pywebview's platform installation instructions for your system.

## Organize, read, and annotate

- Create folders and nested subfolders using **+** in the sidebar. The folder menu lets you rename, recolor, or move a folder. Empty folders can be deleted.
- Choose a folder, then use **New note** or **Import document**. Dragging files onto the app imports them into the selected folder. Rename or move a document from its **…** menu.
- Notes have **Read** and **Edit note** modes. Editing saves automatically, with bold, italic, headings, lists, and quotes. Pasted text is inserted as plain text.
- Select text to open a floating toolbar with **Highlight**, **Underline**, **Strikethrough**, **Comment**, and four annotation colors.
- Comments automatically highlight the selected text. Click the passage or its quote in the side panel to return to the thread. Reply with an answer or finding, then **Mark as resolved**. Resolved threads can be reopened.
- The sidebar search finds documents by title, filename, or folder. Recently opened documents are tracked per browser.
- Keyboard shortcuts: **⌘/Ctrl K** searches, **⌘/Ctrl N** creates a note, **⌘/Ctrl S** saves, and **⌘/Ctrl Enter** posts a comment or reply.

PDF annotations are stored separately from the original file. They persist across reopenings and zoom changes. The original PDF remains intact; **Download original file** returns that file without annotation marks. **Export annotations** downloads quotes, positions, comments, and replies as JSON. PDF embedding/export of annotations is not implemented.

## Document fidelity and performance

**PDF:** PDF.js draws the original pages and adds a selectable text layer. Pages render when they approach the viewport, distant canvases are released to limit memory use, the server supports HTTP range requests, and up to three parsed documents remain cached in memory. Fonts, character maps, and image decoders are bundled for offline operation. The browser renders documents directly inside the reader. There is still some first-open parsing/rendering time, especially with large or complex PDFs; zero latency is not guaranteed.

**Word (.docx):** If LibreOffice is installed, Notate converts the document once to a PDF and uses the same reader. This usually provides the closest available approximation of the original layout. Without LibreOffice, a formatted HTML reading view preserves paragraphs, headings, bold/italic/underline, images, and tables, but does not preserve exact pagination, fonts, headers, footers, or complex Word layouts. LibreOffice conversion can take longer on the first import.

**Legacy Office (.doc, .odt, .rtf):** Requires LibreOffice. Install LibreOffice separately; on macOS the app also finds it at `/Applications/LibreOffice.app`.

**Markdown and text:** Imported as a formatted, selectable reading view. Text files must use UTF-8. Imports are limited to 100 MB per file, and DOCX archives to 200 MB uncompressed.

Image-only PDFs display correctly but require OCR before text can be selected. Locked PDFs must be unlocked before import. OCR and handwriting annotation are not included.

PDFs that open without a password but use AES encryption (often with printing or editing permissions) are supported. The `pypdf[crypto]` dependency includes the required cryptography library. Older installations can update with `python -m pip install -e ".[desktop]"`, then restart the backend; the start scripts also install this dependency when it is missing.

## Storage, sync, and backups

Default workspace locations:

| System | Location |
| --- | --- |
| macOS | `~/Library/Application Support/Notate` |
| Windows | `%LOCALAPPDATA%\Notate` |
| Linux | `$XDG_DATA_HOME/notate` or `~/.local/share/notate` |

The workspace contains `notate.sqlite3` and a `files/` directory. Override the location with `--data-dir /path/to/workspace` in both modes. SQLite uses transactions, foreign keys, and WAL. Clients receive live changes through WebSockets and refresh when they reconnect. Note saves check revisions; conflicts preserve the draft and offer **Keep my draft**, **Load saved version**, and a draft download. Unsaved drafts are also kept in browser storage on that device.

Use the archive button at the bottom of the sidebar to download a workspace ZIP with a consistent SQLite snapshot and the imported files. To restore, stop the server, extract the ZIP into a **new, empty directory**, then run:

```sh
python -m notate serve --data-dir /path/to/restored-workspace
```

Sync means multiple clients use one running backend. It does not merge two separate databases or provide offline multi-device editing. The desktop and web interfaces work without an internet connection once dependencies are installed; the local backend must be running.

To access one backend from another device on your local network, set a workspace password and bind to the network:

```sh
export NOTATE_TOKEN='choose-a-long-workspace-password'
python -m notate serve --host 0.0.0.0
```

Open `http://YOUR_COMPUTER_LAN_IP:8765` on the other device and enter the password. A desktop client can use `python -m notate desktop --connect http://YOUR_COMPUTER_LAN_IP:8765`. Network binding requires a password. This is a personal, single-user workspace: comments are labeled “You,” not separate accounts. For access beyond a trusted LAN, use an HTTPS reverse proxy or private VPN; the built-in server serves HTTP and should not be exposed directly to the public internet.

## Development and verification

```sh
python -m pip install -e ".[desktop,dev]"
python -m pytest -q
python scripts/browser_smoke.py
python scripts/desktop_smoke.py
```

The browser smoke check uses an installed Chrome, an isolated temporary workspace, and a temporary server. It exercises folders, rich notes, text annotations, replies, resolution, two-window synchronization, conflicting edits, PDF text selection, zoom, page navigation, persistence, and the mobile layout. Screenshots and results go to `.local-data/artifacts/`. No user workspace is modified.

For development without using your normal workspace:

```sh
python -m notate serve --data-dir .local-data --port 8765
```

The Python API is documented at `/docs`. Code lives in `notate/app.py` (API and events), `storage.py` (SQLite), `documents.py` (imports), `cli.py` (server and desktop), and `static/` (the shared interface). PDF.js is vendored under `static/vendor/` with its license.
