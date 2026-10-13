const $ = (query, root = document) => root.querySelector(query);
const $$ = (query, root = document) => [...root.querySelectorAll(query)];
const paths = {
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  library:'<path d="M4 4v16M8 4v16M12 4v16M16 4l4 15M3 20h18"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  file:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  upload:'<path d="M12 16V3m-4 4 4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  archive:'<path d="M4 8h16v12H4zM3 3h18v5H3zM9 12h6"/>',
  home:'<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/>',
  panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16M18 8h1M18 12h1"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  book:'<path d="M12 5v16M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2Z"/>',
  left:'<path d="m14 6-6 6 6 6"/>', right:'<path d="m9 6 6 6-6 6"/>',
  mouse:'<rect x="7" y="2" width="10" height="20" rx="5"/><path d="M12 6v4"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  comment:'<path d="M21 11a8 8 0 0 1-8 8H6l-4 3V10a8 8 0 0 1 8-8h3a8 8 0 0 1 8 8Z"/><path d="M7 8h10M7 12h7"/>',
  highlighter:'<path d="m5 12 8-8a2 2 0 0 1 3 0l4 4a2 2 0 0 1 0 3l-8 8ZM5 12l7 7M5 16l-3 5h6l2-3M14 5l6 6"/>',
  spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4"/>',
  up:'<path d="M12 19V5m-5 5 5-5 5 5"/>',
  list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/>',
  quote:'<path d="M10 11H4V5h6v9a4 4 0 0 1-4 4M20 11h-6V5h6v9a4 4 0 0 1-4 4"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  edit:'<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z"/>',
  move:'<path d="M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',
  download:'<path d="M12 3v13m-4-4 4 4 4-4M4 17v4h16v-4"/>',
  copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  moon:'<path d="M20.8 13.3A9 9 0 0 1 10.7 3.2 9 9 0 1 0 20.8 13.3Z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
function icons(root = document) { $$('[data-icon]', root).forEach(node => { node.innerHTML = icon(node.dataset.icon); }); }
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function readLocal(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function writeLocal(key, value) { try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch { toast('Browser draft storage is full. Keep this window open until your note saves.', true); } }
const state = {
  client: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : [...crypto.getRandomValues(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2,'0')).join(''), folders: [], items: [], annotations: [], active: null,
  view: 'all', folder: null, query: '', filter: 'all', selected: null, editing: false,
  color: readLocal('notate-color','yellow'), expanded: new Set(readLocal('notate-expanded',[])),
  recent: readLocal('notate-recent',[]), dirty: false, saving: null, conflict: false,
  selection: null, connected: false, loaded: false, opening: 0, pdf: null,
  observer: null, pdfDocuments: new Map(), zoom: null, page: 1, renderGeneration: 0,
  saveTimer: null, toastTimer: null, renderQueue: [], rendering: false, retryTimer: null,
  popupPreferences: readLocal('notate-popup-preferences', {}), popupTarget: null,
  popupMatches: [], popupDrafts: new Map(), popupFrame: null, popupPending: false
};
icons();
function setTheme(theme, remember = true) {
  document.documentElement.dataset.theme = theme;
  if (remember) writeLocal('notate-theme', theme);
  const dark = theme === 'dark'; const button = $('#theme-toggle');
  button.innerHTML = icon(dark ? 'sun' : 'moon'); button.setAttribute('aria-pressed', dark);
  button.title = button.ariaLabel = dark ? 'Switch to light mode' : 'Switch to dark mode';
  $('meta[name="theme-color"]').content = dark ? '#19221e' : '#f4f3ed';
}
function popupsEnabled() { return !!state.active && state.popupPreferences[state.active.id] !== false; }
function updatePopupToggle() {
  const button = $('#toggle-popups'); const enabled = popupsEnabled();
  button.disabled = !state.active; button.setAttribute('aria-pressed', enabled);
  button.title = state.active ? `${enabled ? 'Disable' : 'Enable'} passage popups for this ${state.active.kind === 'note' ? 'note' : 'document'}` : 'Open a document to set passage popups';
}
setTheme(document.documentElement.dataset.theme || 'light', false);
function toast(message, error = false) {
  const node = $('#toast'); node.textContent = message; node.classList.toggle('error', error); node.hidden = false;
  clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => { node.hidden = true; }, error ? 6500 : 3500);
}
async function api(path, options = {}) {
  const headers = {'X-Notate-Client': state.client, ...options.headers};
  if (options.body && !(options.body instanceof FormData)) { headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(options.body); }
  let response;
  try { response = await fetch(path, {...options, headers}); }
  catch { const error = new Error('The local server is unavailable. Your unsaved note is kept in this browser.'); error.status = 0; throw error; }
  if (!response.ok) {
    let data; try { data = await response.json(); } catch { data = {}; }
    const detail = Array.isArray(data.detail) ? data.detail.map(item => item.msg).join(' ') : data.detail;
    const error = new Error(detail || `The request failed (${response.status}).`); error.status = response.status; throw error;
  }
  return response.json();
}
function action(callback) { return async (...args) => { try { await callback(...args); } catch (error) { toast(error.message, true); } }; }
function age(value, compact = false) {
  const delta = Date.now() - new Date(value).getTime();
  if (delta < 60000) return compact ? 'now' : 'just now';
  if (delta < 3600000) return `${Math.floor(delta/60000)}${compact ? 'm' : ' min ago'}`;
  if (delta < 86400000) return `${Math.floor(delta/3600000)}${compact ? 'h' : ' hours ago'}`;
  if (delta < 172800000) return 'Yesterday';
  return new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'});
}
function folderName(id) { return state.folders.find(folder => folder.id === id)?.name || 'Unfiled'; }
function updateSaveState() {
  const node = $('#save-state');
  node.textContent = state.conflict ? 'Review conflicting edits' : state.saving ? 'Saving…' : state.dirty ? 'Unsaved draft' : 'Saved locally';
  node.classList.toggle('dirty', state.dirty); node.classList.toggle('conflict', state.conflict);
}
async function refreshWorkspace() {
  const data = await api('/api/workspace'); state.folders = data.folders; state.items = data.items;
  if (state.folder && !state.folders.some(folder => folder.id === state.folder)) { state.folder = null; state.view = 'all'; }
  renderNavigation();
}
function filteredItems() {
  let result = state.items;
  if (state.folder) result = result.filter(item => item.folder_id === state.folder);
  if (state.view === 'recent') result = state.recent.map(id => state.items.find(item => item.id === id)).filter(Boolean);
  const term = state.query.toLowerCase().trim();
  if (term) result = result.filter(item => `${item.title} ${item.filename || ''} ${folderName(item.folder_id)}`.toLowerCase().includes(term));
  return result;
}
function renderNavigation() {
  $('#all-count').textContent = state.items.length;
  $$('.nav-button').forEach(button => button.classList.toggle('active',!state.folder && state.view === button.dataset.view));
  $('#breadcrumb-current').textContent = state.folder ? folderName(state.folder) : state.view === 'recent' ? 'Recently opened' : 'All documents';
  const tree = $('#folder-tree'); tree.replaceChildren();
  function branch(parent, depth = 0) {
    state.folders.filter(folder => folder.parent_id === parent).forEach(folder => {
      const children = state.folders.some(child => child.parent_id === folder.id);
      const node = document.createElement('div'); node.className = `folder-row${folder.id === state.folder ? ' active' : ''}`; node.style.paddingLeft = `${4 + depth*13}px`;
      const count = state.items.filter(item => item.folder_id === folder.id).length;
      node.innerHTML = `<button class="folder-chevron ${state.expanded.has(folder.id) ? 'expanded' : ''}" aria-label="${state.expanded.has(folder.id) ? 'Collapse' : 'Expand'} ${escapeHTML(folder.name)}" ${children ? '' : 'style="visibility:hidden"'}>${icon('right')}</button><button class="folder-button"><span class="folder-icon ${folder.color}">${icon('folder')}</span><span class="name">${escapeHTML(folder.name)}</span><span class="folder-count">${count || ''}</span></button><button class="icon-button folder-menu" aria-label="Options for ${escapeHTML(folder.name)}">${icon('more')}</button>`;
      $('.folder-chevron',node).onclick = () => { state.expanded.has(folder.id) ? state.expanded.delete(folder.id) : state.expanded.add(folder.id); writeLocal('notate-expanded',[...state.expanded]); renderNavigation(); };
      $('.folder-button',node).onclick = () => { state.folder = folder.id; state.view = 'folder'; renderNavigation(); };
      $('.folder-menu',node).onclick = event => showFolderMenu(folder, event.currentTarget);
      tree.append(node); if (children && state.expanded.has(folder.id)) branch(folder.id,depth+1);
    });
  }
  branch(null);
  const items = filteredItems(); $('#file-count').textContent = items.length;
  $('#file-list-label').textContent = state.query ? 'SEARCH RESULTS' : state.folder ? 'IN THIS FOLDER' : state.view === 'recent' ? 'RECENTLY OPENED' : 'YOUR DOCUMENTS';
  const files = $('#file-list'); files.replaceChildren();
  for (const item of items) {
    const button = document.createElement('button'); button.className = `file-card${state.active?.id === item.id ? ' active' : ''}`;
    button.dataset.id = item.id;
    const detail = item.kind === 'note' ? 'Note' : item.has_pdf ? `${item.page_count} ${item.page_count === 1 ? 'page' : 'pages'}` : 'Document';
    button.innerHTML = `<span class="file-type-icon ${item.kind}">${icon('file')}</span><span class="file-details"><strong>${escapeHTML(item.title)}</strong><small>${detail}<span class="meta-separator"> · </span>${state.folder ? age(item.updated_at) : escapeHTML(folderName(item.folder_id))}</small></span>`;
    button.title = item.title; button.onclick = action(() => openItem(item.id)); files.append(button);
  }
  if (!items.length) files.innerHTML = `<div class="empty-files">${state.query ? 'No documents found.<br>Try a different search.' : 'A fresh page.<br>Add a note or import a document.'}</div>`;
}
async function chooseView(view, folder = null) { state.view = view; state.folder = folder; renderNavigation(); }

function modal(title, body, submit = 'Save', callback = async () => {}, options = {}) {
  const dialog = $('#modal'); if (dialog.open) dialog.close();
  $('#modal-title').textContent = title; $('#modal-body').innerHTML = body;
  const save = $('#modal-submit'); save.textContent = submit; save.disabled = false; save.className = `button ${options.danger ? 'danger' : 'primary'}`;
  $('#modal-cancel').textContent = options.cancelText || 'Cancel'; $('#modal-cancel').hidden = !!options.noCancel;
  $('#modal-close').hidden = !!options.noCancel;
  $('#modal-form').onsubmit = async event => {
    event.preventDefault(); save.disabled = true;
    $$('.modal-error', dialog).forEach(node => node.remove());
    try { await callback(new FormData(event.currentTarget)); dialog.close(); }
    catch (error) { const node = document.createElement('p'); node.className = 'modal-error'; node.textContent = error.message; $('#modal-body').append(node); }
    finally { save.disabled = false; }
  };
  dialog.oncancel = event => { if (options.noCancel) event.preventDefault(); };
  $('#modal-cancel').onclick = options.onCancel || (() => dialog.close());
  dialog.showModal(); requestAnimationFrame(() => $('input,select,textarea',dialog)?.focus());
}
$('#modal-close').onclick = () => $('#modal').close();
function folderOptions(selected = null, excluded = new Set()) {
  let value = `<option value="">Unfiled / top level</option>`;
  function add(parent, depth = 0) {
    state.folders.filter(folder => folder.parent_id === parent).forEach(folder => {
      if (excluded.has(folder.id)) return;
      value += `<option value="${folder.id}" ${selected === folder.id ? 'selected' : ''}>${'— '.repeat(depth)}${escapeHTML(folder.name)}</option>`; add(folder.id,depth+1);
    });
  }
  add(null); return value;
}
function folderDialog(folder = null, parent = state.folder) {
  const excluded = new Set();
  if (folder) {
    const collect = id => { excluded.add(id); state.folders.filter(child => child.parent_id === id).forEach(child => collect(child.id)); }; collect(folder.id);
  }
  modal(folder ? 'Edit folder' : 'A place for your ideas', `<label for="folder-name">Folder name</label><input id="folder-name" name="name" value="${escapeHTML(folder?.name || '')}" placeholder="e.g. Research, Fall semester, Good ideas" maxlength="120" required><label for="folder-parent">Inside</label><select id="folder-parent" name="parent">${folderOptions(folder ? folder.parent_id : parent,excluded)}</select><label for="folder-color">Folder color</label><select id="folder-color" name="color">${['sage','sand','blue','rose'].map(color => `<option value="${color}" ${folder?.color === color ? 'selected' : ''}>${color[0].toUpperCase()+color.slice(1)}</option>`).join('')}</select>`,folder ? 'Save folder' : 'Create folder',async data => {
    await api(folder ? `/api/folders/${folder.id}` : '/api/folders',{method:folder ? 'PATCH' : 'POST', body:{name:data.get('name'),parent_id:data.get('parent') || null,color:data.get('color')}});
    if (data.get('parent')) state.expanded.add(data.get('parent')); await refreshWorkspace(); toast(folder ? 'Folder updated.' : 'A new space, ready for you.');
  });
}
function newNoteDialog() {
  modal('Start a new thought', `<label for="note-title">Note title</label><input id="note-title" name="title" placeholder="What’s on your mind?" maxlength="250" required><label for="note-folder">Folder</label><select id="note-folder" name="folder">${folderOptions(state.folder)}</select>`, 'Create note', async data => {
    if (!await flushNote()) throw new Error('Save or resolve your current draft before creating another note.');
    const item = await api('/api/notes',{method:'POST',body:{title:data.get('title'),folder_id:data.get('folder') || null}});
    await refreshWorkspace(); await openItem(item.id,true); toast('A blank page, just for you.');
  });
}
function menu(anchor, entries) {
  const container = $('#floating-menu'); container.replaceChildren();
  for (const entry of entries) {
    if (!entry) { const line = document.createElement('div'); line.className = 'menu-divider'; container.append(line); continue; }
    const button = document.createElement('button'); button.className = `menu-item${entry.danger ? ' danger' : ''}`; button.innerHTML = `${icon(entry.icon)}${escapeHTML(entry.label)}`;
    button.onclick = action(async () => { container.hidden = true; await entry.run(); }); container.append(button);
  }
  container.hidden = false; const rect = anchor.getBoundingClientRect(); position(container,rect.right,rect.bottom+6,true);
}
function position(node, x, y, alignRight = false) {
  const rect = node.getBoundingClientRect();
  node.style.left = `${Math.max(8,Math.min(x-(alignRight ? rect.width : 0),innerWidth-rect.width-8))}px`;
  node.style.top = `${Math.max(8,Math.min(y,innerHeight-rect.height-8))}px`;
}
function showFolderMenu(folder, anchor) {
  menu(anchor,[{label:'Edit folder',icon:'edit',run:() => folderDialog(folder)}, {label:'Add subfolder',icon:'folder',run:() => folderDialog(null,folder.id)},null,
    {label:'Delete empty folder',icon:'trash',danger:true,run:() => modal('Delete this folder?',`<p>Delete “${escapeHTML(folder.name)}”? The folder must be empty.</p>`,'Delete folder',async () => { await api(`/api/folders/${folder.id}`,{method:'DELETE'}); await refreshWorkspace(); toast('Folder deleted.'); },{danger:true})}]);
}
function showDocumentMenu(anchor) {
  const item = state.active; if (!item) return;
  const entries = [
    {label:'Rename document',icon:'edit',run:() => modal('Rename document',`<label for="rename">Title</label><input id="rename" name="title" value="${escapeHTML(item.title)}" maxlength="250" required>`,'Save title',async data => { if (!await flushNote()) throw new Error('Resolve your unsaved draft first.'); state.active = await api(`/api/items/${item.id}`,{method:'PATCH',body:{revision:state.active.revision,title:data.get('title')}}); renderHeading(); await refreshWorkspace(); })},
    {label:'Move to folder',icon:'move',run:() => modal('Find a new home',`<label for="move-folder">Folder</label><select id="move-folder" name="folder">${folderOptions(item.folder_id)}</select>`,'Move document',async data => { if (!await flushNote()) throw new Error('Resolve your unsaved draft first.'); state.active = await api(`/api/items/${item.id}`,{method:'PATCH',body:{revision:state.active.revision,folder_id:data.get('folder') || null}}); renderHeading(); await refreshWorkspace(); toast('Document moved.'); })},
    {label:'Export annotations (JSON)',icon:'download',run:() => download(`/api/items/${item.id}/export`)},
  ];
  if (item.filename) entries.push({label:'Download original file',icon:'download',run:() => download(`/api/items/${item.id}/file?download=true`)});
  if (item.kind === 'note') entries.push({label:'Download note (HTML)',icon:'download',run:async () => { if (!await flushNote()) return; const content = `<!doctype html><meta charset="utf-8"><title>${escapeHTML(item.title)}</title><body><h1>${escapeHTML(item.title)}</h1>${state.active.content}</body>`; downloadBlob(new Blob([content],{type:'text/html'}),`${item.title.replace(/[^a-z\d -]/gi,'').slice(0,80) || 'note'}.html`); }});
  entries.push(null,{label:'Delete document',icon:'trash',danger:true,run:() => modal('Delete this document?',`<p>“${escapeHTML(item.title)}” and its annotations will be permanently removed from this workspace. Download a backup first if you want to keep a copy.</p>`,'Delete document',async () => { await api(`/api/items/${item.id}`,{method:'DELETE'}); writeLocal(`notate-draft-${item.id}`,null); state.dirty = false; state.conflict = false; state.active = null; clearTimeout(state.saveTimer); await refreshWorkspace(); if (state.items.length) await openItem(state.items[0].id); else renderEmpty(); toast('Document deleted.'); },{danger:true})});
  menu(anchor,entries);
}
function download(url) { const link = document.createElement('a'); link.href = url; link.download = ''; document.body.append(link); link.click(); link.remove(); }
function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url),10000); }

async function importFiles(files) {
  if (!files.length || !await flushNote()) return;
  let last = null; let imported = 0;
  const button = $('#import'); button.disabled = true;
  const folder = state.folder;
  for (const file of files) {
    toast(`Importing ${file.name}…`); const data = new FormData(); data.append('file',file);
    try { last = await api(`/api/import${folder ? `?folder_id=${folder}` : ''}`,{method:'POST',body:data}); imported++; }
    catch (error) { toast(`${file.name}: ${error.message}`,true); }
  }
  button.disabled = false; await refreshWorkspace();
  if (last) { await openItem(last.id); toast(`${imported} ${imported === 1 ? 'document' : 'documents'} added to your reading room.`); }
}

function renderHeading() {
  const item = state.active; if (!item) return;
  document.title = `${item.title} — Notate`;
  $('#document-title').textContent = item.title; $('#document-title').title = item.title;
  $('#document-eyebrow').textContent = item.kind === 'note' ? 'A SPACE FOR YOUR THOUGHTS' : 'YOUR READING ROOM';
  $('#document-meta').innerHTML = `<span class="type-tag ${item.kind}">${item.kind === 'pdf' ? 'PDF' : item.kind === 'note' ? 'NOTE' : item.has_pdf ? 'DOCUMENT · PDF VIEW' : 'DOCUMENT'}</span><span>${icon('folder')} ${escapeHTML(folderName(item.folder_id))}</span>${item.page_count ? `<span class="meta-separator">·</span><span>${item.page_count} pages</span>` : ''}<span class="meta-separator updated-label">·</span><span class="updated-label">Updated ${age(item.updated_at)}</span>`;
  $('#document-menu').disabled = false; $('#toggle-annotations').disabled = false;
  updatePopupToggle();
}
function renderEmpty() {
  resetReader(); state.active = null; state.annotations = []; renderNavigation(); renderAnnotations();
  $('#document-title').textContent = 'Make room for a new idea.'; $('#document-eyebrow').textContent = 'YOUR READING ROOM';
  $('#document-meta').textContent = 'A home for your reading and everything you discover.';
  $('#page-tools').hidden = true; $('#zoom-tools').hidden = true; $('#format-toolbar').hidden = true;
  $('#document-mode').innerHTML = `<span class="read-mode">${icon('book')}Reading view</span>`;
  $('#reader').innerHTML = `<div class="empty-workspace"><div class="empty-illustration">${icon('book')}</div><h2>Every discovery starts somewhere.</h2><p>Bring a document you’ve been meaning to read.<br>Or open a blank page and follow a thought.</p><div class="empty-actions"><button class="button subtle" id="empty-note">${icon('plus')}New note</button><button class="button primary" id="empty-import">${icon('upload')}Import a document</button></div></div>`;
  $('#empty-note').onclick = newNoteDialog; $('#empty-import').onclick = () => $('#file-input').click();
  $('#document-menu').disabled = true; $('#toggle-annotations').disabled = true;
  updatePopupToggle();
}
function resetReader() {
  state.observer?.disconnect(); state.observer = null; state.renderGeneration++; state.renderQueue = [];
  state.pdf = null; state.selection = null; hideSelection(); $('#comment-popover').hidden = true; $('#floating-menu').hidden = true;
  closeAnnotationPopover(); state.popupTarget = null; state.popupMatches = [];
}
async function openItem(id, edit = false, force = false) {
  if (state.active?.id === id && !force) { if (edit) setEditMode(true); $('#sidebar').classList.remove('open'); return; }
  if (!await flushNote()) return;
  const opening = ++state.opening;
  const [item, annotations] = await Promise.all([api(`/api/items/${id}`),api(`/api/items/${id}/annotations`)]);
  if (opening !== state.opening) return;
  resetReader(); state.active = item; state.annotations = annotations; state.selected = null; state.filter = 'all'; state.page = 1; state.zoom = null;
  state.dirty = false; state.conflict = false; state.editing = false;
  const draft = readLocal(`notate-draft-${id}`,null);
  if (item.kind === 'note' && draft && draft.content !== item.content) {
    state.active.content = draft.content; state.dirty = true;
    if (draft.revision !== item.revision) { state.active.revision = draft.revision; state.conflict = true; }
    toast('Your unsaved draft has been restored.');
  }
  state.recent = [id,...state.recent.filter(value => value !== id)].slice(0,50); writeLocal('notate-recent',state.recent); writeLocal('notate-active',id);
  renderHeading(); renderNavigation(); renderAnnotations(); updateSaveState();
  $('#sidebar').classList.remove('open'); $('#reader').scrollTop = 0;
  if (item.has_pdf) { $('#reader').innerHTML = '<div class="loading"><span class="spinner"></span>Opening your document…</div>'; await renderPDF(item,opening); }
  else renderText(item,edit);
  if (state.conflict) showConflictNotice();
  else if (state.dirty) state.saveTimer = setTimeout(() => saveNote(),800);
}
function renderText(item, edit = false) {
  const reader = $('#reader'); reader.innerHTML = '<article class="paper text-paper"><div class="document-content" id="note-content"></div><div class="annotation-layer"></div></article>';
  const content = $('#note-content'); content.innerHTML = item.content;
  $('#page-tools').hidden = true; $('#zoom-tools').hidden = true;
  if (item.kind === 'note') {
    $('#document-mode').innerHTML = '<div class="mode-toggle"><button id="read-mode" class="active">Read</button><button id="edit-mode">Edit note</button></div>';
    $('#read-mode').onclick = action(async () => { if (await flushNote()) setEditMode(false); }); $('#edit-mode').onclick = () => setEditMode(true);
    content.addEventListener('input',onNoteInput);
    content.addEventListener('paste', event => { event.preventDefault(); document.execCommand('insertText',false,event.clipboardData.getData('text/plain')); });
    content.addEventListener('drop', event => { event.preventDefault(); });
  } else $('#document-mode').innerHTML = `<span class="read-mode">${icon('book')}Reading view${item.filename?.toLowerCase().endsWith('.docx') ? ' · formatted text' : ''}</span>`;
  setEditMode(edit && item.kind === 'note'); requestAnimationFrame(renderTextMarks);
}
function setEditMode(edit) {
  state.editing = edit; const content = $('#note-content'); if (!content) return;
  content.contentEditable = edit ? 'true' : 'false'; content.spellcheck = edit;
  $('.text-paper').classList.toggle('editing',edit); $('#format-toolbar').hidden = !edit;
  $('#edit-mode')?.classList.toggle('active',edit); $('#read-mode')?.classList.toggle('active',!edit);
  if (edit) content.focus(); hideSelection(); closeAnnotationPopover();
}
function onNoteInput() {
  if (!state.active) return;
  state.dirty = true; state.active.content = $('#note-content').innerHTML;
  writeLocal(`notate-draft-${state.active.id}`,{content:state.active.content,revision:state.active.revision}); updateSaveState();
  clearTimeout(state.saveTimer); if (!state.conflict) state.saveTimer = setTimeout(() => saveNote(),650);
  requestAnimationFrame(renderTextMarks);
}
async function saveNote() {
  if (state.saving) { await state.saving; if (state.dirty && !state.conflict) return saveNote(); return !state.dirty; }
  if (!state.dirty || !state.active || state.active.kind !== 'note') return true;
  if (state.conflict) return false;
  clearTimeout(state.saveTimer);
  const id = state.active.id; const content = state.active.content; const revision = state.active.revision;
  state.saving = (async () => {
    try {
      const saved = await api(`/api/items/${id}`,{method:'PATCH',body:{content,revision}});
      if (state.active?.id === id) {
        const newerContent = state.active.content; state.active = {...saved,content:newerContent};
        state.dirty = newerContent !== content;
        if (state.dirty) writeLocal(`notate-draft-${id}`,{content:newerContent,revision:saved.revision});
        else writeLocal(`notate-draft-${id}`,null);
        await refreshWorkspace();
      }
      return true;
    } catch (error) {
      if (error.status === 409) { state.conflict = true; showConflictNotice(); }
      else toast(error.message,true);
      return false;
    } finally { state.saving = null; updateSaveState(); }
  })();
  updateSaveState(); return state.saving;
}
async function flushNote() { clearTimeout(state.saveTimer); await saveNote(); if (state.dirty) { toast(state.conflict ? 'Review the conflicting edits before leaving this note.' : 'Your note is still unsaved. Keep this window open or reconnect the server.',true); return false; } return true; }
function showConflictNotice() {
  updateSaveState(); if ($('.conflict-notice')) return;
  const notice = document.createElement('div'); notice.className = 'conflict-notice';
  notice.innerHTML = 'This note changed in another window. Your draft is safe.<button>Review versions</button>';
  $('button',notice).onclick = action(reviewConflict); $('#reader').prepend(notice);
}
async function reviewConflict() {
  const draft = state.active.content; let latest;
  try { latest = await api(`/api/items/${state.active.id}`); }
  catch (error) {
    if (error.status !== 404) throw error;
    const oldId = state.active.id; const title = state.active.title;
    modal('Keep this thought', `<p>This note was deleted in another window. Your draft is still here. Save it as a new note to keep writing.</p><label for="recovered-title">Note title</label><input id="recovered-title" name="title" value="${escapeHTML(title)}" required maxlength="250"><button type="button" id="download-draft" class="button subtle" style="margin-top:14px">Download my draft</button>`, 'Save as new note', async data => {
      const folder = state.folders.some(folder => folder.id === state.active.folder_id) ? state.active.folder_id : null;
      const recovered = await api('/api/notes',{method:'POST',body:{title:data.get('title'),folder_id:folder,content:draft}});
      state.dirty = false; state.conflict = false; writeLocal(`notate-draft-${oldId}`,null); await refreshWorkspace(); await openItem(recovered.id,true);
    });
    $('#download-draft').onclick = () => downloadBlob(new Blob([draft],{type:'text/html'}),'notate-unsaved-draft.html'); return;
  }
  modal('Two thoughts at once', '<p>Another window saved a newer version. Choose <strong>Keep my draft</strong> to replace it with this window’s draft, or use <strong>Load saved version</strong> to discard this draft. You can copy or download your draft before deciding.</p><button type="button" id="download-draft" class="button subtle">Download my draft</button>', 'Keep my draft', async () => {
    // Use the reviewed revision. A further edit during this dialog is still rejected.
    state.active.revision = latest.revision; state.conflict = false;
    writeLocal(`notate-draft-${state.active.id}`,{content:draft,revision:latest.revision});
    if (!await saveNote()) throw new Error('The saved version changed again. Reopen the review to compare the latest version.');
    $('.conflict-notice')?.remove();
  },{cancelText:'Load saved version',onCancel:async () => {
    $('#modal').close(); state.dirty = false; state.conflict = false; writeLocal(`notate-draft-${state.active.id}`,null); await openItem(state.active.id,false,true);
  }});
  $('#download-draft').onclick = () => downloadBlob(new Blob([draft],{type:'text/html'}),'notate-unsaved-draft.html');
}

let pdfModulePromise;
async function pdfModule() {
  if (!pdfModulePromise) pdfModulePromise = import('/static/vendor/pdf.mjs').then(module => { module.GlobalWorkerOptions.workerSrc = '/static/vendor/pdf.worker.mjs'; return module; });
  return pdfModulePromise;
}
async function renderPDF(item, opening) {
  try {
    const pdfjs = await pdfModule();
    let pdf = state.pdfDocuments.get(item.id);
    if (!pdf) {
      pdf = await pdfjs.getDocument({url:`/api/items/${item.id}/file`, cMapUrl:'/static/vendor/cmaps/',cMapPacked:true,
        standardFontDataUrl:'/static/vendor/standard_fonts/',wasmUrl:'/static/vendor/wasm/',isEvalSupported:false}).promise;
      state.pdfDocuments.set(item.id,pdf);
      if (state.pdfDocuments.size > 3) { const [key,old] = state.pdfDocuments.entries().next().value; state.pdfDocuments.delete(key); old.destroy(); }
    }
    if (opening !== state.opening) return;
    state.pdf = pdf; const first = await pdf.getPage(1);
    if (opening !== state.opening) return;
    state.pdfBase = first.getViewport({scale:1});
    $('#page-tools').hidden = false; $('#zoom-tools').hidden = false; $('#format-toolbar').hidden = true;
    $('#document-mode').innerHTML = `<span class="read-mode">${icon('book')}Reading view</span>`;
    $('#total-pages').textContent = pdf.numPages; $('#current-page').max = pdf.numPages;
    buildPDFPages();
    if (!first.getTextContent) return;
  } catch (error) {
    if (opening !== state.opening) return;
    $('#reader').innerHTML = `<div class="empty-workspace"><div class="empty-illustration">${icon('file')}</div><h2>This document needs another look.</h2><p>${escapeHTML(error.message)}</p><button class="button subtle" id="retry-pdf">Try again</button></div>`;
    $('#retry-pdf').onclick = action(() => openItem(item.id,false,true));
  }
}
function buildPDFPages() {
  if (!state.pdf) return;
  const reader = $('#reader'); state.observer?.disconnect(); state.renderGeneration++; state.renderQueue = [];
  const available = reader.clientWidth - (innerWidth < 641 ? 22 : 42);
  const width = state.zoom ? state.pdfBase.width*state.zoom : Math.min(850, Math.max(180,available));
  const scale = width/state.pdfBase.width; state.pdfScale = scale; $('#zoom-fit').textContent = state.zoom ? `${Math.round(scale*100)}%` : 'Fit';
  const fragment = document.createDocumentFragment();
  for (let number = 1; number <= state.pdf.numPages; number++) {
    const page = document.createElement('div'); page.className = 'paper pdf-page'; page.dataset.page = number;
    page.style.width = `${width}px`; page.style.height = `${state.pdfBase.height*scale}px`;
    page.style.setProperty('--scale-factor',scale); page.style.setProperty('--total-scale-factor',scale);
    page.innerHTML = `<div class="page-placeholder">Page ${number}</div><div class="annotation-layer"></div>`; fragment.append(page);
  }
  reader.replaceChildren(fragment);
  state.observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) queuePage(entry.target);
  },{root:reader,rootMargin:'600px 0px'});
  $$('.pdf-page',reader).forEach(page => state.observer.observe(page));
  queuePage($('.pdf-page',reader)); renderPDFMarks();
  if (state.page > 1) goToPage(state.page);
  schedulePopupPosition();
}
function queuePage(element) {
  if (!element || element.dataset.rendered || element.dataset.queued) return;
  element.dataset.queued = '1'; state.renderQueue.push({element,generation:state.renderGeneration,pdf:state.pdf,scale:state.pdfScale});
  drainRenderQueue();
}
async function drainRenderQueue() {
  if (state.rendering) return;
  state.rendering = true;
  while (state.renderQueue.length) {
    const job = state.renderQueue.shift(); const {element,generation,pdf,scale} = job;
    if (generation !== state.renderGeneration || !element.isConnected) continue;
    try {
      const pdfjs = await pdfModule(); const page = await pdf.getPage(Number(element.dataset.page));
      if (generation !== state.renderGeneration) continue;
      const viewport = page.getViewport({scale});
      element.style.width = `${viewport.width}px`; element.style.height = `${viewport.height}px`;
      const pixelRatio = Math.min(devicePixelRatio || 1,2); const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width*pixelRatio); canvas.height = Math.ceil(viewport.height*pixelRatio);
      canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
      element.prepend(canvas);
      await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport,transform:pixelRatio !== 1 ? [pixelRatio,0,0,pixelRatio,0,0] : null}).promise;
      if (generation !== state.renderGeneration) continue;
      const layer = document.createElement('div'); layer.className = 'textLayer'; element.append(layer);
      const text = await page.getTextContent();
      await new pdfjs.TextLayer({textContentSource:text,container:layer,viewport}).render();
      element.dataset.rendered = '1'; $('.page-placeholder',element)?.remove(); renderPDFMarks(element);
      schedulePopupPosition();
      if (pdf.numPages === 1 && !text.items.some(item => item.str?.trim())) toast('This page is an image scan. Text selection needs a searchable PDF with OCR.');
    } catch (error) {
      if (generation === state.renderGeneration) { const placeholder = $('.page-placeholder',element); if (placeholder) placeholder.textContent = `Page could not render: ${error.message}`; }
    }
  }
  state.rendering = false;
}
function goToPage(number) {
  if (!state.pdf) return; number = Math.min(Math.max(1,number),state.pdf.numPages); state.page = number;
  $('#current-page').value = number; const element = $(`.pdf-page[data-page="${number}"]`); queuePage(element);
  element?.scrollIntoView({behavior:'smooth',block:'start'});
}
function releaseDistantCanvases() {
  if (!state.pdf || !getSelection().isCollapsed) return;
  const rendered = $$('.pdf-page[data-rendered]'); if (rendered.length <= 10) return;
  for (const page of rendered) {
    if (Math.abs(Number(page.dataset.page)-state.page) <= 5) continue;
    const canvas = $('canvas',page); if (canvas) { canvas.width = 0; canvas.height = 0; canvas.remove(); }
    $('.textLayer',page)?.remove(); delete page.dataset.rendered; delete page.dataset.queued;
    const placeholder = document.createElement('div'); placeholder.className = 'page-placeholder'; placeholder.textContent = `Page ${page.dataset.page}`; page.prepend(placeholder);
  }
}
function zoomPDF(direction) {
  if (!state.pdf) return;
  state.zoom = direction === 0 ? null : Math.min(2.5,Math.max(.4,(state.zoom || state.pdfScale)+direction*.15));
  hideSelection(); buildPDFPages();
}

function textNodes(container) {
  const walker = document.createTreeWalker(container,NodeFilter.SHOW_TEXT); const result = []; let node;
  while ((node = walker.nextNode())) result.push(node); return result;
}
function selectedRects(container, range) {
  const rects = [];
  for (const node of textNodes(container)) {
    if (!node.textContent || !range.intersectsNode(node)) continue;
    const selected = document.createRange(); selected.selectNodeContents(node);
    if (node === range.startContainer) selected.setStart(node,range.startOffset);
    if (node === range.endContainer) selected.setEnd(node,range.endOffset);
    for (const rect of selected.getClientRects()) if (rect.width > .5 && rect.height > .5) rects.push(rect);
  }
  return rects;
}
function mergeRects(rects) {
  const sorted = rects.sort((a,b) => Math.abs(a.y-b.y) > .005 ? a.y-b.y : a.x-b.x); const output = [];
  for (const rect of sorted) {
    const previous = output.at(-1);
    if (previous && Math.abs(previous.y-rect.y)<.006 && Math.abs(previous.height-rect.height)<.012 && rect.x <= previous.x+previous.width+.008) previous.width = Math.max(previous.x+previous.width,rect.x+rect.width)-previous.x;
    else output.push({...rect});
  }
  return output;
}
function captureSelection() {
  const selection = getSelection();
  if (!state.active || !selection.rangeCount || selection.isCollapsed || !selection.toString().trim()) { hideSelection(); return; }
  const range = selection.getRangeAt(0);
  if (!$('#reader').contains(range.startContainer) || !$('#reader').contains(range.endContainer)) return;
  let anchor; let quote = selection.toString();
  if (state.active.has_pdf) {
    const pages = [];
    for (const page of $$('.pdf-page')) {
      const text = $('.textLayer',page); if (!text || !range.intersectsNode(text)) continue;
      const bounds = page.getBoundingClientRect();
      const rects = selectedRects(text,range).map(rect => ({x:Math.max(0,(rect.left-bounds.left)/bounds.width),y:Math.max(0,(rect.top-bounds.top)/bounds.height),width:Math.min(1,rect.width/bounds.width),height:Math.min(1,rect.height/bounds.height)}));
      if (rects.length) pages.push({page:Number(page.dataset.page),rects:mergeRects(rects)});
    }
    if (!pages.length) return; anchor = {type:'pdf',pages};
  } else {
    const content = $('#note-content'); if (!content?.contains(range.startContainer) || !content.contains(range.endContainer)) return;
    const before = document.createRange(); before.selectNodeContents(content); before.setEnd(range.startContainer,range.startOffset);
    const start = before.toString().length; const end = start+range.toString().length; const full = content.textContent;
    quote = full.slice(start,end); anchor = {type:'text',start,end,prefix:full.slice(Math.max(0,start-40),start),suffix:full.slice(end,end+40)};
  }
  state.selection = {quote,anchor,range:range.cloneRange(),itemId:state.active.id};
  const matches = matchingSelectionAnnotations(anchor, range);
  if (matches.length) {
    hideSelection(); $('#comment-popover').hidden = true;
    focusAnnotation(matches[0].id, false, {matches:matches.map(record => record.id), range});
    return;
  }
  closeAnnotationPopover(); showSelectionToolbar();
}
function showSelectionToolbar() {
  const range = state.selection?.range; if (!range) return;
  const rect = range.getBoundingClientRect(); const toolbar = $('#selection-toolbar'); toolbar.hidden = false;
  $('#selection-color').className = `color-trigger ${state.color}`;
  const y = rect.top-45 > 8 ? rect.top-45 : rect.bottom+8;
  position(toolbar,Math.max(rect.left,rect.left+(rect.width-toolbar.offsetWidth)/2),y);
}
function hideSelection() { $('#selection-toolbar').hidden = true; }
async function annotate(kind, comment = null, commentKind = 'reply') {
  const selected = state.selection; if (!selected || state.active?.id !== selected.itemId) return;
  if (!await flushNote()) return;
  const record = await api(`/api/items/${selected.itemId}/annotations`,{method:'POST',body:{kind,color:state.color,quote:selected.quote,anchor:selected.anchor,comment,comment_kind:commentKind}});
  state.annotations.push(record); state.selected = record.id; state.filter = 'all';
  hideSelection(); getSelection().removeAllRanges(); $('#comment-popover').hidden = true; state.selection = null;
  renderAnnotations(); renderMarks(); await refreshWorkspace();
  if (kind === 'comment') { openPanel(); requestAnimationFrame(() => $(`[data-annotation="${record.id}"]`, $('#annotations-list'))?.scrollIntoView({block:'nearest'})); }
  else toast(kind === 'highlight' ? 'A thought worth keeping.' : kind === 'underline' ? 'Passage underlined.' : 'Passage crossed out.');
}
function openCommentComposer() {
  if (!state.selection) return;
  const toolbar = $('#selection-toolbar').getBoundingClientRect(); hideSelection();
  closeAnnotationPopover();
  const box = $('#comment-popover'); box.hidden = false; $('#comment-quote').textContent = state.selection.quote;
  $('#comment-body').value = ''; $('#comment-form').setEntryKind('reply'); $('#comment-body').dispatchEvent(new Event('input'));
  position(box,toolbar.left,toolbar.bottom+8); $('#comment-body').focus();
}
$('#comment-form').onsubmit = action(async event => { event.preventDefault(); const button = $('button[type="submit"]',event.currentTarget); button.disabled = true; try { await annotate('comment',$('#comment-body').value,event.currentTarget.dataset.kind || 'reply'); } finally { button.disabled = false; } });
setupMarkdownComposer($('#comment-form'));
$('#close-comment').onclick = () => { $('#comment-popover').hidden = true; };
$('#comment-body').onkeydown = event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); $('#comment-form').requestSubmit(); } };
$$('[data-annotate]').forEach(button => { button.onmousedown = event => event.preventDefault(); button.onclick = action(() => button.dataset.annotate === 'comment' ? openCommentComposer() : annotate(button.dataset.annotate)); });
$('#selection-color').onmousedown = event => event.preventDefault();
$('#selection-color').onclick = event => {
  const container = $('#floating-menu'); container.innerHTML = `<div class="color-options">${['yellow','green','blue','pink'].map(color => `<button class="color-option ${color} ${color === state.color ? 'active' : ''}" data-color="${color}" aria-label="${color} annotation color"></button>`).join('')}</div>`;
  container.hidden = false; const rect = event.currentTarget.getBoundingClientRect(); position(container,rect.right,rect.bottom+7,true);
  $$('[data-color]',container).forEach(button => { button.onmousedown = event => event.preventDefault(); button.onclick = () => { state.color = button.dataset.color; writeLocal('notate-color',state.color); $('#selection-color').className = `color-trigger ${state.color}`; container.hidden = true; }; });
};

function annotationMark(record, rectangle, percent) {
  const mark = document.createElement('button'); mark.type = 'button'; mark.className = `annotation-mark ${record.kind} ${record.color}${state.selected === record.id ? ' selected' : ''}`;
  mark.dataset.annotation = record.id; mark.title = `${record.kind === 'strike' ? 'Strikethrough' : record.kind}: ${record.quote.slice(0,150)}`;
  mark.setAttribute('aria-label',mark.title); const unit = percent ? '%' : 'px'; const multiplier = percent ? 100 : 1;
  for (const [property,key] of [['left','x'],['top','y'],['width','width'],['height','height']]) mark.style[property] = `${rectangle[key]*multiplier}${unit}`;
  mark.onclick = () => focusAnnotation(record.id, false, {mark}); return mark;
}
function renderPDFMarks(onlyPage = null) {
  for (const page of onlyPage ? [onlyPage] : $$('.pdf-page')) {
    const layer = $('.annotation-layer',page); layer.replaceChildren(); const number = Number(page.dataset.page);
    for (const record of state.annotations) {
      const anchor = record.anchor.pages?.find(selected => selected.page === number);
      if (anchor) anchor.rects.forEach(rect => layer.append(annotationMark(record,rect,true)));
    }
  }
}
function anchoredRange(record, content) {
  const text = content.textContent; let start = record.anchor.start; let end = record.anchor.end;
  if (text.slice(start,end) !== record.quote) {
    let best = -1; let bestScore = -Infinity; let position = -1;
    while ((position = text.indexOf(record.quote,position+1)) !== -1) {
      let score = -Math.abs(position-start)/Math.max(text.length,1);
      if (record.anchor.prefix && text.slice(Math.max(0,position-record.anchor.prefix.length),position) === record.anchor.prefix) score += 3;
      if (record.anchor.suffix && text.slice(position+record.quote.length,position+record.quote.length+record.anchor.suffix.length) === record.anchor.suffix) score += 3;
      if (score > bestScore) { best = position; bestScore = score; }
    }
    if (best < 0) return null; start = best; end = best+record.quote.length;
  }
  const range = document.createRange(); let offset = 0; let started = false;
  for (const node of textNodes(content)) {
    const length = node.textContent.length;
    if (!started && start <= offset+length) { range.setStart(node,Math.max(0,start-offset)); started = true; }
    if (started && end <= offset+length) { range.setEnd(node,Math.max(0,end-offset)); return range; }
    offset += length;
  }
  return null;
}
function renderTextMarks() {
  const content = $('#note-content'); const paper = $('.text-paper'); if (!content || !paper) return;
  const layer = $('.annotation-layer',paper); layer.replaceChildren(); const bounds = paper.getBoundingClientRect();
  for (const record of state.annotations) {
    if (record.anchor.type !== 'text') continue;
    const range = anchoredRange(record,content); record.orphaned = !range;
    if (range) for (const rect of selectedRects(content,range)) layer.append(annotationMark(record,{x:rect.left-bounds.left,y:rect.top-bounds.top,width:rect.width,height:rect.height},false));
  }
  schedulePopupPosition();
}
function renderMarks() { state.active?.has_pdf ? renderPDFMarks() : renderTextMarks(); }
function orderedMatches(records) {
  return records.sort((a,b) => Number(b.id === state.selected)-Number(a.id === state.selected)
    || a.quote.length-b.quote.length || Number(!!b.comments.length)-Number(!!a.comments.length)
    || b.created_at.localeCompare(a.created_at));
}
function matchingSelectionAnnotations(anchor, range) {
  const records = state.annotations.filter(record => {
    if (record.anchor.type !== anchor.type) return false;
    if (anchor.type === 'text') {
      const content = $('#note-content'); const existing = content && anchoredRange(record,content);
      return existing && range.compareBoundaryPoints(Range.START_TO_START,existing) >= 0
        && range.compareBoundaryPoints(Range.END_TO_END,existing) <= 0;
    }
    return anchor.pages.every(page => {
      const existing = record.anchor.pages.find(other => other.page === page.page);
      return existing && page.rects.every(rect => existing.rects.some(mark => rect.x >= mark.x-.003
        && rect.y >= mark.y-.004 && rect.x+rect.width <= mark.x+mark.width+.003
        && rect.y+rect.height <= mark.y+mark.height+.004));
    });
  });
  return orderedMatches(records);
}
function annotationsAtPoint(x,y) {
  const marks = $$('.annotation-mark',$('#reader')).filter(mark => {
    const rect = mark.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top-1 && y <= rect.bottom+1;
  });
  const ids = new Set(marks.map(mark => mark.dataset.annotation));
  return {records:orderedMatches(state.annotations.filter(record => ids.has(record.id))),marks};
}
function passageMark(id, range = null) {
  const marks = $$('.annotation-mark',$('#reader')).filter(mark => mark.dataset.annotation === id);
  if (range) {
    const rects = [...range.getClientRects()];
    const matching = marks.find(mark => { const bounds = mark.getBoundingClientRect(); return rects.some(rect => rect.left < bounds.right && rect.right > bounds.left && rect.top < bounds.bottom && rect.bottom > bounds.top); });
    if (matching) return matching;
  }
  const viewport = $('#reader').getBoundingClientRect();
  return marks.find(mark => { const rect = mark.getBoundingClientRect(); return rect.top < viewport.bottom && rect.bottom > viewport.top; }) || marks[0];
}
function rememberPopupTarget(mark) {
  const page = mark.closest('.pdf-page'); const container = page || mark.closest('.text-paper');
  const marks = $$('.annotation-mark',container).filter(other => other.dataset.annotation === mark.dataset.annotation);
  state.popupTarget = {id:mark.dataset.annotation,page:page ? Number(page.dataset.page) : null,segment:marks.indexOf(mark)};
}
function popupTargetMark() {
  const target = state.popupTarget; if (!target) return null;
  const container = target.page ? $(`.pdf-page[data-page="${target.page}"]`) : $('.text-paper');
  if (!container) return null;
  return $$('.annotation-mark',container).filter(mark => mark.dataset.annotation === target.id)[target.segment];
}
function closeAnnotationPopover() { $('#annotation-popover').hidden = true; state.popupPending = false; }
function schedulePopupPosition() {
  if ($('#annotation-popover').hidden || state.popupFrame) return;
  state.popupFrame = requestAnimationFrame(() => { state.popupFrame = null; positionAnnotationPopover(); });
}
function positionAnnotationPopover() {
  const box = $('#annotation-popover'); if (box.hidden) return;
  const mark = popupTargetMark(); if (!mark) { closeAnnotationPopover(); return; }
  const rect = mark.getBoundingClientRect(); const reader = $('#reader').getBoundingClientRect();
  if (rect.bottom <= reader.top || rect.top >= reader.bottom || rect.right <= reader.left || rect.left >= reader.right) {
    if (state.popupPending) box.style.visibility = 'hidden';
    else closeAnnotationPopover();
    return;
  }
  state.popupPending = false; box.style.visibility = '';
  const topEdge = Math.max(8,reader.top+6); const bottomEdge = Math.min(innerHeight-8,reader.bottom-6);
  const above = rect.top-topEdge-10; const below = bottomEdge-rect.bottom-10;
  box.style.maxHeight = `${Math.min(460,bottomEdge-topEdge)}px`;
  let height = box.getBoundingClientRect().height;
  const placeAbove = above >= height || (below < height && above > below);
  const available = placeAbove ? above : below;
  box.style.maxHeight = `${Math.max(140,Math.min(460,available))}px`;
  height = box.getBoundingClientRect().height;
  const width = box.getBoundingClientRect().width; const center = Math.max(reader.left,Math.min(reader.right,rect.left+rect.width/2));
  const left = Math.max(8,Math.min(center-width/2,innerWidth-width-8));
  box.style.left = `${left}px`; box.style.top = `${Math.max(topEdge,Math.min(placeAbove ? rect.top-height-10 : rect.bottom+10,bottomEdge-height))}px`;
  box.style.setProperty('--anchor-offset',`${Math.min(width-18,Math.max(18,center-left))}px`);
  box.dataset.placement = placeAbove ? 'above' : 'below';
}
function entryTypeSwitch(kind = 'reply', saved = false) {
  return `<div class="entry-type-switch ${saved ? 'saved-kind-switch' : 'composer-kind-switch'}" role="group" aria-label="${saved ? 'Entry type' : 'Post type'}"><button type="button" data-entry-kind="reply" aria-pressed="${kind !== 'answer'}">Reply</button><button type="button" data-entry-kind="answer" aria-pressed="${kind === 'answer'}">Answer</button></div>`;
}
function commentMarkup(comment, popup = false) {
  const kind = comment.kind === 'answer' ? 'answer' : 'reply';
  const html = comment.html ?? `<p>${escapeHTML(comment.body).replace(/\n/g,'<br>')}</p>`;
  return `<div class="comment-entry ${kind}" data-comment="${comment.id}"><div class="comment-author"><span class="comment-avatar">Y</span><span>You</span>${entryTypeSwitch(kind,true)}<time datetime="${escapeHTML(comment.created_at)}" title="${escapeHTML(new Date(comment.created_at).toLocaleString())}">${age(comment.created_at,true)}</time></div><div class="${popup ? 'popup-comment-text' : 'comment-text'} markdown-body">${html}</div></div>`;
}
function bindCommentTypes(root) {
  $$('.comment-entry[data-comment]',root).forEach(entry => {
    $$('.saved-kind-switch button',entry).forEach(button => {
      button.onclick = action(async () => {
        if (button.getAttribute('aria-pressed') === 'true') return;
        const controls = $$('.saved-kind-switch button',entry); controls.forEach(control => control.disabled = true);
        try { await api(`/api/comments/${entry.dataset.comment}`,{method:'PATCH',body:{kind:button.dataset.entryKind}}); await refreshAnnotations(); }
        finally { controls.forEach(control => control.disabled = false); }
      });
    });
  });
  prepareMarkdownLinks(root);
}
function prepareMarkdownLinks(root) {
  $$('.markdown-body a',root).forEach(link => { link.target = '_blank'; link.rel = 'noopener noreferrer'; });
}
function setupMarkdownComposer(form, kind = 'reply', onDraft = null) {
  const textarea = $('textarea',form); const submit = $('button[type="submit"]',form);
  const baseLabel = submit.textContent.trim(); const controls = document.createElement('div'); controls.className = 'markdown-composer-controls';
  controls.innerHTML = `${entryTypeSwitch(kind)}<span title="Bold, italic, headings, lists, links, tables, and code">Markdown</span>`;
  form.prepend(controls);
  const preview = document.createElement('div'); preview.className = 'markdown-preview'; preview.hidden = true;
  preview.innerHTML = '<span class="markdown-preview-label">Preview</span><div class="markdown-body"></div>'; textarea.after(preview);
  let timer; let generation = 0;
  const notifyDraft = () => onDraft?.({body:textarea.value,kind:form.dataset.kind});
  form.setEntryKind = value => {
    form.dataset.kind = value; form.classList.toggle('answer-composer',value === 'answer');
    $$('[data-entry-kind]',controls).forEach(button => button.setAttribute('aria-pressed',button.dataset.entryKind === value));
    submit.innerHTML = `${value === 'answer' ? 'Post answer' : baseLabel}${icon('up')}`; notifyDraft(); schedulePopupPosition();
  };
  $$('[data-entry-kind]',controls).forEach(button => button.onclick = () => form.setEntryKind(button.dataset.entryKind));
  const previewInput = () => {
    clearTimeout(timer); const current = ++generation; const body = textarea.value;
    notifyDraft(); preview.hidden = !body.trim(); if (preview.hidden) { $('.markdown-body',preview).replaceChildren(); schedulePopupPosition(); return; }
    timer = setTimeout(async () => {
      if (!form.isConnected) return;
      try {
        const rendered = await api('/api/markdown/preview',{method:'POST',body:{body}});
        if (!form.isConnected || current !== generation) return;
        $('.markdown-body',preview).innerHTML = rendered.html; prepareMarkdownLinks(preview); schedulePopupPosition();
        const composer = form.closest('#comment-popover');
        if (composer && !composer.hidden) position(composer,parseFloat(composer.style.left) || 8,parseFloat(composer.style.top) || 8);
      } catch { if (form.isConnected && current === generation) $('.markdown-body',preview).textContent = 'Preview will return when the local server reconnects. Your draft is kept.'; }
    },160);
  };
  textarea.addEventListener('input',previewInput); form.setEntryKind(kind); if (textarea.value) previewInput();
}
function renderAnnotationPopover() {
  const box = $('#annotation-popover'); if (box.hidden) return;
  const record = state.annotations.find(record => record.id === state.selected);
  if (!record || !popupsEnabled()) { closeAnnotationPopover(); return; }
  const previous = $('.popup-reply-form textarea',box); const wasFocused = previous === document.activeElement; const caret = previous?.selectionStart;
  const scroll = $('.popup-thread',box)?.scrollTop || 0;
  const labels = {highlight:'Highlight',underline:'Underline',strike:'Strikethrough',comment:'Comment thread'};
  const matches = state.popupMatches.map(id => state.annotations.find(record => record.id === id)).filter(Boolean);
  box.innerHTML = `<div class="passage-popover-heading"><span class="popup-label">${icon(record.comments.length ? 'comment' : 'highlighter')}${labels[record.kind]}${record.resolved ? ' · Resolved' : ''}</span><button class="icon-button popup-close" aria-label="Close passage popup">${icon('close')}</button></div>${matches.length > 1 ? `<div class="popup-matches"><span>${matches.length} marks at this passage</span><div>${matches.map((match,index) => `<button data-match="${match.id}" aria-pressed="${match.id === record.id}" title="${escapeHTML(match.quote)}">${index+1}. ${labels[match.kind]}</button>`).join('')}</div></div>` : ''}<blockquote class="popup-quote ${record.color}">${escapeHTML(record.quote)}</blockquote><div class="popup-thread">${record.comments.length ? record.comments.map(comment => commentMarkup(comment,true)).join('') : '<p class="popup-empty">A passage worth keeping. Add a thought or question here.</p>'}</div>${record.resolved ? '' : `<form class="popup-reply-form"><textarea aria-label="Reply beside passage" placeholder="${record.comments.length ? 'An answer, or another thought…' : 'Add a thought to this passage…'}" maxlength="20000" required rows="2"></textarea><div><span>⌘ Enter to post</span><button type="submit" class="button primary">${record.comments.length ? 'Reply' : 'Post'}${icon('up')}</button></div></form>`}<div class="popup-actions"><button class="popup-resolve">${icon('check')}${record.resolved ? 'Reopen thread' : 'Resolve'}</button>${state.selection ? '<button class="popup-annotate">Annotate selection</button>' : ''}<button class="popup-panel" title="Focus this entry in Notes & discoveries">${icon('panel')}In panel</button></div>`;
  box.dataset.annotation = record.id;
  $('.popup-close',box).onclick = closeAnnotationPopover;
  $$('[data-match]',box).forEach(button => { button.onclick = () => focusAnnotation(button.dataset.match,false,{matches:state.popupMatches}); });
  $('.popup-panel',box).onclick = () => { closeAnnotationPopover(); $(`.annotation-card[data-annotation="${record.id}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'}); };
  $('.popup-annotate',box)?.addEventListener('click',() => { closeAnnotationPopover(); showSelectionToolbar(); });
  const form = $('.popup-reply-form',box);
  if (form) {
    const draft = state.popupDrafts.get(record.id); const textarea = $('textarea',form); textarea.value = typeof draft === 'string' ? draft : draft?.body || '';
    setupMarkdownComposer(form,draft?.kind || 'reply',draft => state.popupDrafts.set(record.id,draft));
    textarea.onkeydown = event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); form.requestSubmit(); } };
    form.onsubmit = action(async event => {
      event.preventDefault(); const button = $('button[type="submit"]',form); button.disabled = true;
      try {
        await api(`/api/annotations/${record.id}/comments`,{method:'POST',body:{body:textarea.value,kind:form.dataset.kind || 'reply'}});
        state.popupDrafts.delete(record.id); await refreshAnnotations();
      } finally { button.disabled = false; }
    });
    if (wasFocused) { textarea.focus({preventScroll:true}); textarea.setSelectionRange(caret,caret); }
  }
  bindCommentTypes(box);
  $('.popup-resolve',box).onclick = action(async () => {
    await api(`/api/annotations/${record.id}`,{method:'PATCH',body:{resolved:!record.resolved}});
    state.filter = record.resolved ? 'all' : 'resolved'; await refreshAnnotations();
  });
  $('.popup-thread',box).scrollTop = scroll; positionAnnotationPopover();
}
function openPanel() {
  const workspace = $('#reading-workspace'); const wasHidden = workspace.classList.contains('panel-hidden');
  workspace.classList.remove('panel-hidden'); workspace.classList.add('panel-mobile-open');
  if (wasHidden && innerWidth > 860 && state.pdf && !state.zoom) buildPDFPages();
}
function focusAnnotation(id, scrollDocument = false, options = {}) {
  const record = state.annotations.find(value => value.id === id); if (!record) return;
  state.popupMatches = options.matches || [id];
  state.popupPending = scrollDocument;
  const mark = options.mark || passageMark(id, options.range);
  if (mark) rememberPopupTarget(mark);
  else state.popupTarget = {id, page:record.anchor.pages?.[0]?.page || null, segment:0};
  state.selected = id; state.filter = record.resolved ? 'resolved' : 'all'; openPanel(); renderAnnotations(); renderMarks();
  const card = $(`[data-annotation="${id}"]`,$('#annotations-list')); card?.scrollIntoView({block:'nearest',behavior:'smooth'});
  if (scrollDocument) {
    const first = $(`[data-annotation="${id}"]`,$('#reader'));
    if (first) first.scrollIntoView({block:'center',behavior:'smooth'});
    else if (record.anchor.pages?.length) goToPage(record.anchor.pages[0].page);
    else toast('The selected passage was edited or removed. The original quote is kept in this thread.');
  }
  if (popupsEnabled()) { $('#annotation-popover').hidden = false; renderAnnotationPopover(); }
  else closeAnnotationPopover();
}
async function refreshAnnotations() {
  if (!state.active) return;
  const id = state.active.id; const records = await api(`/api/items/${id}/annotations`);
  if (state.active?.id !== id) return; state.annotations = records; renderMarks(); renderAnnotations(); await refreshWorkspace();
  if (!$('#annotation-popover').hidden) {
    const selected = records.find(record => record.id === state.selected);
    if (selected && selected.resolved !== (state.filter === 'resolved')) { state.filter = selected.resolved ? 'resolved' : 'all'; renderAnnotations(); }
    renderAnnotationPopover();
  }
}
function annotationClipboardText(record, item = state.active) {
  const singleLine = value => String(value ?? '').replace(/[\r\n]+/g,' ');
  const quoteBlock = value => String(value).replace(/\r\n?/g,'\n').split('\n').map(line => `> ${line}`).join('\n');
  const folderPath = []; const seen = new Set(); let folderId = item.folder_id;
  while (folderId && !seen.has(folderId)) {
    seen.add(folderId); const folder = state.folders.find(folder => folder.id === folderId); if (!folder) break;
    folderPath.unshift(singleLine(folder.name)); folderId = folder.parent_id;
  }
  const labels = {highlight:'Highlight',underline:'Underline',strike:'Strikethrough',comment:'Commented highlight'};
  const source = ['# Reading annotation','',`Document: ${singleLine(item.title)}`];
  if (item.filename) source.push(`Original file: ${singleLine(item.filename)}`);
  source.push(`Folder: ${folderPath.join(' / ') || 'Unfiled'}`);
  if (record.anchor.type === 'pdf') {
    const pages = [...new Set(record.anchor.pages.map(page => page.page))].sort((a,b) => a-b);
    source.push(`PDF ${pages.length === 1 ? 'page' : 'pages'}: ${pages.join(', ')}`);
  } else source.push(`Location: ${item.kind === 'note' ? 'Note text' : 'Document text'}`);
  source.push(`Annotation: ${labels[record.kind]}`,`Status: ${record.resolved ? 'Resolved' : 'Open'}`);
  if (record.orphaned) source.push('Source location: The original passage was edited or removed; the saved quotation is preserved.');
  source.push('','## Highlighted source text','',quoteBlock(record.quote),'','## My comments, questions, and answers (chronological)');
  if (!record.comments.length) source.push('','No comments or questions recorded.');
  let answers = 0; let replies = 0;
  record.comments.forEach((comment,index) => source.push('',comment.kind === 'answer' ? `### Answer ${++answers}` : index === 0 ? '### Initial comment or question' : `### Reply ${++replies}`,'',quoteBlock(comment.body)));
  return source.join('\n');
}
async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* Try selection-based copying for local webviews and HTTP LAN clients. */ }
  }
  const focused = document.activeElement; const selection = getSelection();
  const ranges = selection ? Array.from({length:selection.rangeCount},(_,index) => selection.getRangeAt(index).cloneRange()) : [];
  const field = document.createElement('textarea'); field.value = text; field.readOnly = true;
  field.setAttribute('aria-hidden','true'); field.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;font-size:16px';
  document.body.append(field);
  let copied;
  try { field.focus({preventScroll:true}); field.select(); field.setSelectionRange(0,text.length); copied = document.execCommand('copy'); }
  finally {
    field.remove(); if (focused?.isConnected) focused.focus({preventScroll:true});
    if (selection) { selection.removeAllRanges(); ranges.forEach(range => { try { selection.addRange(range); } catch { /* The document may have changed while copying. */ } }); }
  }
  if (!copied) throw new Error('Clipboard access is unavailable.');
}
async function copyAnnotation(record, button) {
  if (!state.active || record.item_id !== state.active.id) return;
  const text = annotationClipboardText(record); button.disabled = true;
  try {
    await writeClipboard(text);
    button.innerHTML = icon('check'); button.title = 'Copied passage and thread';
    toast('Copied passage and thread as Markdown.');
    setTimeout(() => { if (button.isConnected) { button.innerHTML = icon('copy'); button.title = 'Copy passage and thread for an LLM'; } },1800);
  } catch {
    modal('Copy passage and thread','<p>Clipboard access was blocked. Select the text below and press ⌘C / Ctrl+C to copy.</p><label for="annotation-copy-text">Passage and saved comments</label><textarea id="annotation-copy-text" readonly></textarea>','Done');
    const field = $('#annotation-copy-text'); field.value = text;
    requestAnimationFrame(() => { field.focus(); field.select(); });
  } finally { button.disabled = false; }
}
function renderAnnotations() {
  $('#annotation-count').textContent = state.annotations.length; $('#all-annotations-count').textContent = state.annotations.filter(record => !record.resolved).length;
  $$('[data-filter]').forEach(button => { const active = button.dataset.filter === state.filter; button.classList.toggle('active',active); button.setAttribute('aria-selected',active); });
  const list = $('#annotations-list');
  // Keep an in-progress reply while another window posts to the same document.
  const drafts = new Map($$('.reply-form',list).map(form => [form.dataset.id,{body:$('textarea',form).value,kind:form.dataset.kind || 'reply'}]));
  const focus = document.activeElement; const focusId = focus?.closest('.reply-form')?.dataset.id; const caret = focusId ? focus.selectionStart : null;
  const scroll = list.scrollTop; list.replaceChildren();
  const records = state.annotations.filter(record => state.filter === 'resolved' ? record.resolved : !record.resolved && (state.filter !== 'comments' || record.comments.length));
  if (!records.length) {
    list.innerHTML = `<div class="annotation-empty"><div class="empty-illustration">${icon(state.filter === 'resolved' ? 'check' : 'comment')}</div><h3>${state.filter === 'resolved' ? 'Answers worth keeping.' : 'Leave a little thought.'}</h3><p>${state.filter === 'resolved' ? 'Resolved questions and threads<br>will live here for a second look.' : 'Select a passage that makes you pause.<br>Ask a question. Make a connection.'}</p>${state.filter === 'resolved' ? '' : '<div class="annotation-tip"><strong>A small tip</strong><br>Your comments highlight their passage,<br>so you can always find your way back.</div>'}</div>`; return;
  }
  for (const record of records) {
    const card = document.createElement('article'); card.className = `annotation-card${state.selected === record.id ? ' selected' : ''}${record.resolved ? ' resolved' : ''}`; card.dataset.annotation = record.id;
    const labels = {highlight:'Highlight',underline:'Underlined',strike:'Strikethrough',comment:'A thought'};
    const location = record.anchor.type === 'pdf' ? ` · p. ${record.anchor.pages.map(page => page.page).join(', ')}` : '';
    card.innerHTML = `<div class="annotation-card-header">${icon(record.comments.length ? 'comment' : 'highlighter')}<span class="annotation-label">${labels[record.kind]}${location}</span><span class="annotation-actions"><button class="icon-button annotation-copy" aria-label="Copy passage and thread for an LLM" title="Copy passage and thread for an LLM">${icon('copy')}</button><button class="icon-button annotation-menu" aria-label="Annotation options">${icon('more')}</button></span></div><button class="annotation-quote ${record.color}" title="Jump to selected passage"><span>${escapeHTML(record.quote.slice(0,350))}${record.quote.length > 350 ? '…' : ''}</span></button>${record.orphaned ? '<div class="orphan-warning">The passage was edited. Your original quote is preserved.</div>' : ''}`;
    $('.annotation-quote',card).onclick = () => focusAnnotation(record.id,true);
    $('.annotation-copy',card).onclick = () => copyAnnotation(record,$('.annotation-copy',card));
    $('.annotation-menu',card).onclick = event => menu(event.currentTarget,[{label:'Jump to passage',icon:'book',run:() => focusAnnotation(record.id,true)},null,{label:'Delete annotation',icon:'trash',danger:true,run:() => modal('Delete this annotation?', '<p>The mark and all replies in this thread will be removed.</p>','Delete annotation',async () => { await api(`/api/annotations/${record.id}`,{method:'DELETE'}); await refreshAnnotations(); },{danger:true})}]);
    for (const comment of record.comments) {
      card.insertAdjacentHTML('beforeend',commentMarkup(comment));
    }
    if (!record.resolved) {
      const form = document.createElement('form'); form.className = 'reply-form'; form.dataset.id = record.id;
      form.innerHTML = `<textarea aria-label="${record.comments.length ? 'Reply to thread' : 'Add a comment to this annotation'}" placeholder="${record.comments.length ? 'An answer, or another thought…' : 'Add a thought to this passage…'}" maxlength="20000" required rows="1"></textarea><div class="reply-footer"><span>${record.comments.length ? 'Keep the conversation going' : 'Turn a highlight into a thread'}</span><button type="submit">${record.comments.length ? 'Reply' : 'Post'}${icon('up')}</button></div>`;
      const draft = drafts.get(record.id); $('textarea',form).value = draft?.body || '';
      setupMarkdownComposer(form,draft?.kind || 'reply');
      form.onsubmit = action(async event => { event.preventDefault(); const button = $('button[type="submit"]',form); button.disabled = true; try { await api(`/api/annotations/${record.id}/comments`,{method:'POST',body:{body:$('textarea',form).value,kind:form.dataset.kind || 'reply'}}); $('textarea',form).value = ''; state.selected = record.id; await refreshAnnotations(); } finally { button.disabled = false; } });
      $('textarea',form).onkeydown = event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); form.requestSubmit(); } }; card.append(form);
    }
    const resolve = document.createElement('button'); resolve.className = 'resolve-button'; resolve.innerHTML = `${icon('check')}${record.resolved ? 'Resolved · Reopen thread' : 'Mark as resolved'}`;
    resolve.onclick = action(async () => { await api(`/api/annotations/${record.id}`,{method:'PATCH',body:{resolved:!record.resolved}}); await refreshAnnotations(); toast(record.resolved ? 'Thread reopened.' : 'One more question, answered.'); }); card.append(resolve); list.append(card);
  }
  bindCommentTypes(list);
  list.scrollTop = scroll;
  if (focusId) { const textarea = $(`.reply-form[data-id="${focusId}"] textarea`,list); textarea?.focus({preventScroll:true}); textarea?.setSelectionRange(caret,caret); }
}

function connectEvents() {
  const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/events`);
  let pingTimer;
  socket.onopen = () => {
    state.connected = true; $('#connection-dot').className = 'status-dot connected'; $('#connection-label').textContent = 'Local workspace · synced';
    pingTimer = setInterval(() => { if (socket.readyState === WebSocket.OPEN) socket.send('ping'); },20000);
    if (state.loaded) synchronize().catch(error => toast(error.message,true));
  };
  socket.onmessage = action(async event => {
    const message = JSON.parse(event.data); if (message.type !== 'change' || message.client === state.client) return;
    await refreshWorkspace();
    if (message.scope === 'annotations' && message.id === state.active?.id) await refreshAnnotations();
    else if (message.scope === 'item' && message.id === state.active?.id) await synchronizeActive();
    else if (message.scope === 'workspace' && state.active && !state.items.some(item => item.id === state.active.id)) {
      if (state.dirty) { state.conflict = true; showConflictNotice(); toast('This note was deleted in another window. Download your draft to keep it.',true); }
      else { state.active = null; state.items.length ? await openItem(state.items[0].id) : renderEmpty(); }
    }
  });
  socket.onerror = () => socket.close();
  socket.onclose = () => { clearInterval(pingTimer); state.connected = false; $('#connection-dot').className = 'status-dot offline'; $('#connection-label').textContent = 'Reconnecting to local server…'; clearTimeout(state.retryTimer); state.retryTimer = setTimeout(connectEvents,2500); };
}
async function synchronizeActive() {
  if (!state.active) return;
  const current = state.active; const latest = await api(`/api/items/${current.id}`);
  if (state.active?.id !== current.id || latest.revision === current.revision) return;
  if (state.dirty || state.saving) { state.conflict = true; showConflictNotice(); }
  else { const scroll = $('#reader').scrollTop; state.active = latest; renderHeading(); if (current.kind === 'note') { $('#note-content').innerHTML = latest.content; renderTextMarks(); } $('#reader').scrollTop = scroll; }
}
async function synchronize() {
  await refreshWorkspace();
  if (state.active && state.items.some(item => item.id === state.active.id)) { await synchronizeActive(); await refreshAnnotations(); if (state.dirty && !state.conflict) await saveNote(); }
}
async function boot() {
  try {
    await refreshWorkspace(); const last = readLocal('notate-active',null); const id = state.items.some(item => item.id === last) ? last : state.items[0]?.id;
    if (id) await openItem(id); else renderEmpty(); state.loaded = true; connectEvents();
  } catch (error) {
    if (error.status === 401) {
      modal('Unlock your workspace','<p>This local server is protected with a workspace password.</p><label for="password">Password</label><input type="password" id="password" name="password" required autocomplete="current-password">','Unlock',async data => { await api('/api/session',{method:'POST',body:{token:data.get('password')}}); setTimeout(boot,0); },{noCancel:true});
    } else { $('#reader').innerHTML = `<div class="empty-workspace"><h2>Your workspace is taking a moment.</h2><p>${escapeHTML(error.message)}</p><button class="button primary" id="retry-boot">Reconnect</button></div>`; $('#retry-boot').onclick = boot; }
  }
}

$('#new-note').onclick = newNoteDialog; $('#add-folder').onclick = () => folderDialog();
$('#theme-toggle').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
$('#toggle-popups').onclick = () => {
  if (!state.active) return;
  state.popupPreferences[state.active.id] = !popupsEnabled();
  writeLocal('notate-popup-preferences',state.popupPreferences); updatePopupToggle();
  if (!popupsEnabled()) closeAnnotationPopover();
};
window.addEventListener('storage',event => {
  if (event.key === 'notate-theme') setTheme(readLocal('notate-theme','light'),false);
  if (event.key === 'notate-popup-preferences') {
    state.popupPreferences = readLocal('notate-popup-preferences',{}); updatePopupToggle();
    if (!popupsEnabled()) closeAnnotationPopover();
  }
});
for (const id of ['import','sidebar-import']) $(`#${id}`).onclick = () => $('#file-input').click();
$('#file-input').onchange = action(async event => { const files = [...event.target.files]; event.target.value = ''; await importFiles(files); });
$('#search').oninput = event => { state.query = event.target.value; renderNavigation(); };
$$('.nav-button').forEach(button => { button.onclick = () => chooseView(button.dataset.view); });
$('#document-menu').onclick = event => showDocumentMenu(event.currentTarget);
$('#toggle-annotations').onclick = () => {
  const workspace = $('#reading-workspace');
  if (innerWidth <= 860) workspace.classList.toggle('panel-mobile-open');
  else workspace.classList.toggle('panel-hidden');
  setTimeout(() => { if (state.pdf && !state.zoom) buildPDFPages(); else renderTextMarks(); },0);
};
$('#close-annotations').onclick = () => { $('#reading-workspace').classList.add('panel-hidden'); $('#reading-workspace').classList.remove('panel-mobile-open'); if (state.pdf && !state.zoom) buildPDFPages(); else requestAnimationFrame(renderTextMarks); };
$$('[data-filter]').forEach(button => { button.onclick = () => { state.filter = button.dataset.filter; renderAnnotations(); }; });
$('#sidebar-toggle').onclick = () => $('#sidebar').classList.toggle('open');
$('#previous-page').onclick = () => goToPage(state.page-1); $('#next-page').onclick = () => goToPage(state.page+1);
$('#current-page').onchange = event => goToPage(Number(event.target.value) || 1);
$('#zoom-out').onclick = () => zoomPDF(-1); $('#zoom-in').onclick = () => zoomPDF(1); $('#zoom-fit').onclick = () => zoomPDF(0);
$('#save-state').onclick = action(() => { if (state.conflict) return reviewConflict(); });
$$('[data-format]').forEach(button => {
  button.onmousedown = event => event.preventDefault(); button.onclick = () => { $('#note-content')?.focus(); document.execCommand(button.dataset.format,false,button.dataset.value || null); onNoteInput(); };
});
$('#reader').addEventListener('pointerdown',() => $('#reader').classList.add('selecting'));
$('#reader').addEventListener('pointerup',event => {
  $('#reader').classList.remove('selecting');
  if (event.target.closest('.annotation-mark')) return;
  setTimeout(() => {
    captureSelection();
    if (!getSelection().toString().trim() && !state.editing) {
      const hit = annotationsAtPoint(event.clientX,event.clientY);
      if (hit.records.length) {
        const id = hit.records[0].id; state.selection = null;
        focusAnnotation(id,false,{matches:hit.records.map(record => record.id),mark:hit.marks.find(mark => mark.dataset.annotation === id)});
      } else closeAnnotationPopover();
    }
  },20);
});
$('#reader').addEventListener('keyup',event => { if (event.shiftKey) captureSelection(); });
let scrollTimer;
$('#reader').addEventListener('scroll',() => {
  hideSelection(); schedulePopupPosition(); clearTimeout(scrollTimer); scrollTimer = setTimeout(() => {
    if (!state.pdf) return; const top = $('#reader').getBoundingClientRect().top+40;
    const page = $$('.pdf-page').find(element => element.getBoundingClientRect().bottom > top);
    if (page) { state.page = Number(page.dataset.page); $('#current-page').value = state.page; releaseDistantCanvases(); }
  },100);
},{passive:true});
document.addEventListener('pointerdown',event => {
  if (!event.target.closest('#floating-menu,#selection-color,.annotation-menu,.folder-menu,#document-menu')) $('#floating-menu').hidden = true;
  if (!event.target.closest('#selection-toolbar,#comment-popover,#reader')) hideSelection();
  if (!event.target.closest('#sidebar,#sidebar-toggle')) $('#sidebar').classList.remove('open');
  if (!event.target.closest('#annotation-popover,#reader,#toggle-popups,#theme-toggle,.annotation-quote')) closeAnnotationPopover();
});
document.addEventListener('keydown',event => {
  if (event.key === 'Escape') { hideSelection(); closeAnnotationPopover(); $('#comment-popover').hidden = true; $('#floating-menu').hidden = true; $('#sidebar').classList.remove('open'); }
  if (!(event.metaKey || event.ctrlKey)) return;
  if (event.key.toLowerCase() === 'k') { event.preventDefault(); $('#sidebar').classList.add('open'); $('#search').focus(); }
  if (event.key.toLowerCase() === 's') { event.preventDefault(); saveNote(); }
  if (event.key.toLowerCase() === 'n' && !$('#modal').open) { event.preventDefault(); newNoteDialog(); }
});
window.addEventListener('beforeunload',event => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });
document.addEventListener('visibilitychange',() => { if (document.hidden && state.dirty) saveNote(); else if (!document.hidden && state.loaded && state.connected) synchronize().catch(() => {}); });
let resizeTimer; window.addEventListener('resize',() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { hideSelection(); if (state.pdf && !state.zoom) buildPDFPages(); else renderTextMarks(); schedulePopupPosition(); },200); });
new ResizeObserver(() => { if (!state.pdf) requestAnimationFrame(renderTextMarks); }).observe($('#reader'));
let dragDepth = 0;
document.addEventListener('dragenter',event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); dragDepth++; $('#drop-overlay').hidden = false; } });
document.addEventListener('dragleave',() => { dragDepth = Math.max(0,dragDepth-1); if (!dragDepth) $('#drop-overlay').hidden = true; });
document.addEventListener('dragover',event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } });
document.addEventListener('drop',action(async event => { event.preventDefault(); dragDepth = 0; $('#drop-overlay').hidden = true; await importFiles([...event.dataTransfer.files]); }));
boot();
