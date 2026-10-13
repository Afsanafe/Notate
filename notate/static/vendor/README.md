PDF.js 5.4.624, from the official `pdfjs-dist` npm package (Apache-2.0).
Legacy minified display and worker modules are renamed to pdf.mjs and pdf.worker.mjs.
Character maps, standard fonts, WebAssembly decoders, and text-layer styles are bundled
so documents render without a CDN or internet connection. See PDFJS-LICENSE and
licenses in the individual asset directories. The original PDF.js repository is
https://github.com/mozilla/pdf.js.

The offline Markdown editor is built from `frontend/note-editor.js` using
CodeMirror 6, the Lezer Markdown parser, and markdown-it. Versions are locked in
`package-lock.json`. `npm ci` and `npm run build:editor` rebuild the checked-in
`note-editor.js` bundle and its `EDITOR-LICENSES.txt` notices. Node is not needed
when running Notate. CodeMirror's project is https://codemirror.net/.
