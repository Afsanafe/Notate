# Notate

A Python desktop and web app for keeping your documents, questions, and discoveries together. Runs locally, with a shared SQLite backend and live updates across open browser tabs and desktop windows.

## Run it

Python 3.11 or newer is required. The project includes its PDF viewer, Markdown editor, and assets; no Node build or runtime CDN is needed.

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
- Notes have **Read** and **Edit note** modes and save Markdown source automatically. In **Live preview**, type `# Title` and press Enter to see a heading immediately. Completed lines display bold, italic, strikethrough, links, inline code, lists, quotes, and code blocks; return to a line to edit its Markdown syntax. The toolbar formats Markdown and provides **Table**, with a choice of columns and rows. Click a table cell to edit its source, then move outside the table to preview it. Switch **Live preview** to **Markdown source** to see all syntax. Undo/redo and **⌘/Ctrl B / I** work in the editor. Use **Read** to annotate rendered text, including table cells.
- **Edit note** also has Notepad's eight text colors, underline, definitions, and Markdown download. Select text for the formatting popup, or use the **A**, **Define**, and **Hyperlink** buttons above the note. **⌘/Ctrl+Shift+H** applies the current color, shared with Notepad. **Define** attaches a saved Markdown definition; **⌘/Ctrl-click** the marked words in Edit or Read mode to view, edit, or remove it. **Hyperlink** adds a web or email link, styled with an indigo highlight and underline in both themes. Select linked words to edit or remove their URL; **⌘/Ctrl-click** opens it while editing, and a normal click opens it in Read mode. Colors, definitions, and links support undo/redo and persist in saved notes, sync, and Markdown downloads.
- Existing HTML notes gain Markdown source automatically while retaining their rendered content, revisions, and annotations until edited. Underlined text remains supported as `<u>text</u>`. Old unsaved HTML browser drafts are recovered into Markdown. The document **…** menu downloads notes as **Markdown (.md)** or **HTML**.
- Select text to open a floating toolbar with **Highlight**, **Underline**, **Strikethrough**, **Comment**, and four annotation colors.
- Comments automatically highlight the selected text. Click the passage or its quote in the side panel to return to the thread. Reply with an answer or finding, then **Mark as resolved**. Resolved threads can be reopened.
- Each saved thread entry has a **Reply / Answer** switch. Replies keep the ordinary comment style; answers have a blue background, border, and subtle shadow in light and dark themes. Choose the type before posting or change it afterward. Types sync across clients and persist in the workspace; assigning an answer leaves thread resolution under your control.
- Comments, replies, and answers use the same live Markdown editor as notes. Completed lines render in the editor; return to a line to edit its syntax. There is no separate preview box. Use **B**, **I**, or keyboard shortcuts to format text, and **MD** to toggle raw source. Saved entries keep their rendered formatting in the sidebar and passage popup, and copying a thread labels answers separately for LLM use. Drafts, cursor position, and undo history remain intact when another window updates the thread.
- **⌘B / ⌘I** on macOS and **Ctrl+B / Ctrl+I** on Ubuntu/Linux wrap selected text in `**bold**` or `*italic*`. With no selection, they insert `** **` or `* *` with the inner space selected so you can type immediately. The shortcuts work in notes, comments, replies, answers, and Notepad. **⌘/Ctrl Enter** posts a comment or reply.
- **⌘E / Ctrl+E** inserts `**Answer:** * *` with a bold label and italic blue body. **⌘ShiftM / Ctrl+Shift+M** inserts `**Question:** * *` with a bold label and italic gold body. **⌘ShiftE / Ctrl+Shift+E** inserts `**For Example:**` followed by a newline and one tab, then `- * *`. Each shortcut formats selected text or selects the inner space for immediate typing. They work in notes, comments, replies, answers, and Notepad; colors adapt to light/dark mode. Enter finishes the italic body. Example bullets continue with Enter; Enter again on an empty bullet returns to normal text. Markdown source, downloads, clipboard text, and saved entries retain the labels and literal indentation. Previously saved **Answ:** entries retain their formatting.
- Use **Tab** to indent a bullet and **Shift+Tab** to outdent it. Nested lists cycle through filled circles, hollow circles, and squares in live editing and rendered reading/comment views. Indentation uses a tab (four columns) so nesting survives saving and reopening.
- The **Notepad** tab beside **All**, **Threads**, and **Resolved** provides a Markdown scratchpad for each document or note. It supports live formatting, tables, undo/redo, raw source mode, Markdown downloads, automatic saving, and live sync. Notepads have independent revisions so they can be edited alongside the main note and its threads. Unsaved drafts are kept in this browser; conflicts offer **Keep my draft**, **Load saved version**, and a download. They are included in JSON exports and workspace backups, and deleting a document deletes its saved notepad.
- Select a reading passage and choose **Pad** to add it as a link in the document's Notepad. Clicking its turquoise reading mark opens and selects the associated Notepad text; clicking the turquoise, underlined Notepad text jumps back to the passage. Link colors adapt to light/dark mode and apply to existing links. To link your own wording, select unlinked Notepad text and choose **Link to passage** (or the chain button), select its source in Reading view, then choose **Link to pad**. Cancel with the banner button or Escape. Links work with PDFs, imported text/Word documents, and notes, and persist and sync with the workspace. Live preview hides the internal Markdown destination. Use **⌘/Ctrl-click** to edit a linked label; editing or moving it retains its destination. The annotation menu's **Remove Notepad link** removes the reading mark and link while keeping your words. On small screens, jumping to the source closes the Notepad overlay to reveal the reader.
- Select text in **Notepad** to open its formatting popup. Choose **Underline** or a text color: red, orange, yellow, light green, dark green, light blue, dark blue, or purple. Colors use readable shades in each theme. **⌘/Ctrl+Shift+H** applies the current color to your selection. The **A** color control in the Notepad toolbar also lets you choose a color without selecting text; that color is remembered across documents and reloads in this browser or desktop view. Formatting works with passage links and Markdown tables, supports undo/redo, and persists, syncs, and downloads with the Notepad. Source mode exposes inline HTML such as `<u>` and `<span class="md-text-red">`; live preview displays only the formatted text.
- Each document's **Notepad** has numbered pages. Beside the **Document notepad** label and filename, compact header controls show the current page number, **← / →** to browse pages, and **+** to add and open a blank page. Existing Notepads become page 1. Navigation saves the current page first, preserves each page's cursor, scroll, source mode, and undo history while the document stays open, and remembers your last page across reloads. Pages save and sync independently, so editing different pages in two windows does not cause a conflict. Reading marks open the page containing their linked text. The Notepad download button exports the current page; annotation JSON exports and workspace backups include every page.
- Select a word or phrase in **Notepad**, choose **Define**, write its definition using live Markdown, and **Save** (or **⌘/Ctrl+Enter**). Defined text has a darker highlight and bold type. **⌘-click** on Mac or **Ctrl-click** opens a small dark definition popup beside the word, with **Edit** and **Remove definition** controls. Escape, the close button, or clicking outside dismisses it; keyboard users can focus a defined word and press Enter or Space. Definitions stay attached when you edit or move their words, support undo/redo, and save, sync, export, and download with the page. Source mode exposes their encoded inline metadata.
- Use the **copy** button beside an annotation's page reference in **Notes & discoveries** to copy that passage and its saved thread as Markdown. The clipboard includes the document title, original filename, folder path, PDF page(s), annotation type/status, full highlighted source text, and every saved comment/question and reply in chronological order. Source text and personal notes have separate headings for easy pasting into an LLM. Unsaved reply drafts are excluded; highlights without comments can also be copied.
- Click any word in a marked passage, or select a contiguous part of it, to select its entry in **Notes & discoveries**. Marks that wrap across lines stay connected to the same entry. Overlapping marks can be chosen in the passage popup; **Annotate selection** opens the tools for an additional annotation.
- The top-bar **Popups** switch enables or disables existing annotation threads beside their passage, separately for each document or note. Popups show above or below the text and support replies and resolution. Turning popups off keeps sidebar navigation available. Clicking **Comment** to create a new thread still opens its composer.
- The moon/sun button switches **dark/light mode**. Dark mode covers the workspace, notes, and PDF pages. The PDF display filter changes on-screen colors while preserving the original file. Theme and per-document popup settings are remembered in this browser or desktop view; browser tabs sharing the same origin also receive preference updates.
- The sidebar search finds documents by title, filename, or folder. Recently opened documents are tracked per browser.
- Drag the divider between **Reading view** and **Notes & discoveries** to change their widths. Focus the divider and use the arrow keys (Shift for larger steps), or double-click to reset. PDFs fit the available width after resizing and retain your reading position; explicit zoom stays unchanged. The chosen width is remembered in this browser or desktop view. On narrow screens, annotations continue to open as an overlay.
- Click **Full screen** (the expand icon in the reading toolbar) to fill the app window with the reader and **Notes & discoveries**. Reading controls, annotations, Notepad, and the width divider keep working. Use the panel icon to hide or reopen notes. Click the shrink icon or press **Escape** to return; Escape dismisses an open popup first. Your reading position, drafts, and navigation preference are preserved.
- Hide or reopen navigation using the top-left menu button; the arrow beside the logo also hides it. Closing it expands the workspace. Hovering at the left edge does not reopen navigation. The docked/hidden preference is remembered. **⌘/Ctrl K** focuses search when navigation is open, or focuses the menu button when navigation is closed.
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

The browser smoke check uses an installed Chrome, an isolated temporary workspace, and a temporary server. It exercises live Markdown formatting, tables, undo/redo, Markdown downloads, folders, text annotations, replies, resolution, two-window synchronization, conflicting edits, PDF text selection, zoom, page navigation, persistence, and the mobile layout. Screenshots and results go to `.local-data/artifacts/`. No user workspace is modified.

To change frontend code, install Node.js and run `npm ci`, then run `npm run build:editor` after your edits. The build bundles `frontend/note-editor.js` and versions the app script, editor dependency, and styles by content so reopening an existing workspace loads the matching update. The bundle and dependency license notices are checked in so normal Python installations run offline without Node.js. If the page cannot start, **Reload workspace** retries opening it without resetting saved documents.

For development without using your normal workspace:

```sh
python -m notate serve --data-dir .local-data --port 8765
```

The Python API is documented at `/docs`. Code lives in `notate/app.py` (API and events), `storage.py` (SQLite), `documents.py` (imports), `cli.py` (server and desktop), and `static/` (the shared interface). PDF.js is vendored under `static/vendor/` with its license.
