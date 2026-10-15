import {createNoteEditor, getSourcePassageLinks, getSourceDefinitions, renderEditorMarkdown, TEXT_COLORS} from './vendor/note-editor.js?v=da3be2f236d39a9a';

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
  expand:'<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"/>',
  shrink:'<path d="M3 8h5V3M21 8h-5V3M16 21v-5h5M8 21v-5H3"/>',
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
  table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  edit:'<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z"/>',
  move:'<path d="M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',
  download:'<path d="M12 3v13m-4-4 4 4 4-4M4 17v4h16v-4"/>',
  copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  link:'<path d="m10 13 4-4M8 15l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 9l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
  notepad:'<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M3 7h4M3 12h4M3 17h4M11 8h5M11 12h5M11 16h3"/>',
  moon:'<path d="M20.8 13.3A9 9 0 0 1 10.7 3.2 9 9 0 1 0 20.8 13.3Z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
function icons(root = document) { $$('[data-icon]', root).forEach(node => { node.innerHTML = icon(node.dataset.icon); }); }
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function readLocal(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function writeLocal(key, value) { try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch { toast('Browser draft storage is full. Keep this window open until your note saves.', true); } }
const textColorLabels = {red:'Red',orange:'Orange',yellow:'Yellow','light-green':'Light green','dark-green':'Dark green','light-blue':'Light blue','dark-blue':'Dark blue',purple:'Purple'};
let notepadTextColor = readLocal('notate-notepad-text-color','red');
if (!TEXT_COLORS.includes(notepadTextColor)) notepadTextColor = 'red';
const state = {
  client: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : [...crypto.getRandomValues(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2,'0')).join(''), folders: [], items: [], annotations: [], active: null,
  view: 'all', folder: null, query: '', filter: 'all', selected: null, editing: false,
  color: readLocal('notate-color','yellow'), expanded: new Set(readLocal('notate-expanded',[])),
  recent: readLocal('notate-recent',[]), dirty: false, saving: null, conflict: false,
  selection: null, connected: false, loaded: false, opening: 0, pdf: null,
  observer: null, pdfDocuments: new Map(), zoom: null, page: 1, renderGeneration: 0,
  saveTimer: null, toastTimer: null, renderQueue: [], rendering: false, retryTimer: null,
  popupPreferences: readLocal('notate-popup-preferences', {}), popupTarget: null,
  popupMatches: [], popupDrafts: new Map(), replyDrafts: new Map(), replyForms: new Map(), popupFrame: null, popupPending: false,
  notepad: null, notepadLoading: null, notepadPages: new Map(), notepadPageList: [], notepadPageBusy: false,
  pendingPadLink: null, linkingPad: false, padSelectionFrame: null, padColorMenu: false,
  definitionTarget: null, definitionFrame: null,
  formattingEditor: 'notepad',
  livePreview: readLocal('notate-live-preview', true)
};
let noteEditor = null;
let notepadEditor = null;
let definitionEditor = null;
const layout = {
  navigationCollapsed: readLocal('notate-navigation-collapsed', false) === true,
  notesWidth: readLocal('notate-notes-width', null),
  fullscreen: false,
  drag: null, resizeTimer: null
};
if (!Number.isFinite(layout.notesWidth)) layout.notesWidth = null;
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
function updateNavigationLayout() {
  const shell = $('.app-shell'); const sidebar = $('#sidebar'); const mobile = innerWidth <= 640;
  shell.classList.toggle('nav-collapsed', layout.navigationCollapsed);
  const visible = !layout.fullscreen && (mobile ? sidebar.classList.contains('open') : !layout.navigationCollapsed);
  sidebar.inert = !visible; sidebar.setAttribute('aria-hidden', !visible);
  const toggle = $('#sidebar-toggle'); const collapse = $('#sidebar-collapse');
  toggle.setAttribute('aria-expanded', visible);
  toggle.title = toggle.ariaLabel = (mobile ? visible : !layout.navigationCollapsed) ? 'Hide navigation' : 'Show navigation';
  collapse.title = collapse.ariaLabel = 'Hide navigation';
  collapse.innerHTML = icon('left');
}
function closeNavigationDrawer() {
  const sidebar = $('#sidebar');
  if ((innerWidth <= 640 || layout.navigationCollapsed) && sidebar.contains(document.activeElement)) $('#sidebar-toggle').focus();
  sidebar.classList.remove('open'); updateNavigationLayout();
}
function setNavigationCollapsed(collapsed) {
  closeNavigationDrawer();
  if (collapsed && $('#sidebar').contains(document.activeElement)) $('#sidebar-toggle').focus();
  layout.navigationCollapsed = collapsed; writeLocal('notate-navigation-collapsed', collapsed);
  updateNavigationLayout(); updatePaneWidth(); scheduleReaderLayout();
}
function revealNavigation() {
  if (innerWidth <= 640) $('#sidebar').classList.add('open');
  updateNavigationLayout();
}
function setWorkspaceFullscreen(fullscreen) {
  finishPaneResize();
  layout.fullscreen = fullscreen;
  $('.app-shell').classList.toggle('workspace-fullscreen', fullscreen);
  closeNavigationDrawer();
  const button = $('#toggle-workspace-fullscreen');
  button.innerHTML = icon(fullscreen ? 'shrink' : 'expand');
  button.setAttribute('aria-pressed', fullscreen);
  button.title = button.ariaLabel = fullscreen ? 'Exit full screen (Escape)' : 'Full screen';
  $('#reader-toggle-annotations').hidden = !fullscreen;
  button.focus({preventScroll: true});
  updatePaneWidth(); scheduleReaderLayout(true);
}
function paneWidthLimits() {
  return {min: 240, max: Math.max(240, Math.min(720, $('#reading-workspace').clientWidth - 360 - 8))};
}
function updatePaneWidth() {
  const workspace = $('#reading-workspace'); const divider = $('#panel-resizer');
  const defaults = innerWidth >= 1600 ? 320 : innerWidth <= 1000 ? 250 : innerWidth <= 1250 ? 258 : 286;
  const {min, max} = paneWidthLimits(); const width = Math.round(Math.min(max, Math.max(min, layout.notesWidth ?? defaults)));
  workspace.style.setProperty('--notes-panel-width', `${width}px`);
  divider.setAttribute('aria-valuemin', min); divider.setAttribute('aria-valuemax', max); divider.setAttribute('aria-valuenow', width);
  divider.setAttribute('aria-valuetext', `${width} pixels for Notes & discoveries`);
  const available = innerWidth > 860 && !workspace.classList.contains('panel-hidden');
  divider.tabIndex = available ? 0 : -1; divider.setAttribute('aria-hidden', !available);
  const panelVisible = innerWidth <= 860 ? workspace.classList.contains('panel-mobile-open') : !workspace.classList.contains('panel-hidden');
  for (const id of ['toggle-annotations', 'reader-toggle-annotations']) {
    const button = $(`#${id}`);
    button.setAttribute('aria-expanded', panelVisible);
    button.title = button.ariaLabel = `${panelVisible ? 'Hide' : 'Show'} Notes & discoveries`;
  }
  schedulePopupPosition();
  return width;
}
function resizeNotesPane(width, remember = false) {
  const {min, max} = paneWidthLimits(); layout.notesWidth = Math.round(Math.min(max, Math.max(min, width)));
  updatePaneWidth();
  if (remember) { writeLocal('notate-notes-width', layout.notesWidth); scheduleReaderLayout(true); }
}
function finishPaneResize() {
  const drag = layout.drag; if (!drag) return;
  layout.drag = null; document.body.classList.remove('resizing-panels');
  const divider = $('#panel-resizer'); if (divider.hasPointerCapture(drag.pointerId)) divider.releasePointerCapture(drag.pointerId);
  writeLocal('notate-notes-width', layout.notesWidth); scheduleReaderLayout(true);
}
function scheduleReaderLayout(immediate = false) {
  clearTimeout(layout.resizeTimer);
  if (layout.drag) { schedulePopupPosition(); return; }
  const reflow = () => {
    if (state.pdf && !state.zoom) {
      const width = fittedPDFWidth();
      if (Math.abs(width - state.pdfBase.width * state.pdfScale) > 1) { hideSelection(); buildPDFPages(); }
    } else if (!state.pdf) renderTextMarks();
    noteEditor?.view.requestMeasure(); notepadEditor?.view.requestMeasure(); schedulePopupPosition();
  };
  if (immediate) reflow(); else layout.resizeTimer = setTimeout(reflow,150);
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
  dialog.showModal(); $('input,select,textarea',dialog)?.focus();
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
  if (item.kind === 'note') entries.push({label:'Download note (Markdown)',icon:'download',run:async () => { if (!await flushNote()) return; downloadBlob(new Blob([state.active.markdown],{type:'text/markdown;charset=utf-8'}),`${item.title.replace(/[^a-z\d -]/gi,'').slice(0,80) || 'note'}.md`); }},
    {label:'Download note (HTML)',icon:'download',run:async () => { if (!await flushNote()) return; const content = `<!doctype html><meta charset="utf-8"><title>${escapeHTML(item.title)}</title><body><h1>${escapeHTML(item.title)}</h1>${state.active.content}</body>`; downloadBlob(new Blob([content],{type:'text/html'}),`${item.title.replace(/[^a-z\d -]/gi,'').slice(0,80) || 'note'}.html`); }});
  entries.push(null,{label:'Delete document',icon:'trash',danger:true,run:() => modal('Delete this document?',`<p>“${escapeHTML(item.title)}”, its notepad, and its annotations will be permanently removed from this workspace. Download a backup first if you want to keep a copy.</p>`,'Delete document',async () => {
    await api(`/api/items/${item.id}`,{method:'DELETE'});
    if (state.notepad?.saving) await state.notepad.saving;
    writeLocal(`notate-draft-${item.id}`,null); writeLocal(`notate-notepad-page-${item.id}`,null);
    for (const page of state.notepadPageList.length ? state.notepadPageList : [{page:1}]) writeLocal(notepadDraftKey(item.id,page.page),null);
    for (const record of state.annotations) { state.replyDrafts.delete(record.id); state.popupDrafts.delete(record.id); }
    state.dirty = false; state.conflict = false; clearTimeout(state.saveTimer); resetReader(); state.active = null;
    await refreshWorkspace(); if (state.items.length) await openItem(state.items[0].id); else renderEmpty(); toast('Document deleted.');
  },{danger:true})});
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
  $('#notepad-context').textContent = $('#notepad-context').title = item.title;
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
  closeDefinition();
  cancelPadLink(); cancelAnimationFrame(state.padSelectionFrame); state.padSelectionFrame = null;
  hidePadSelectionTools();
  noteEditor?.destroy(); noteEditor = null; state.editing = false;
  if (state.notepad) clearTimeout(state.notepad.timer);
  for (const pad of state.notepadPages.values()) pad.editor?.destroy();
  notepadEditor = null; state.notepad = null; state.notepadLoading = null;
  state.notepadPages.clear(); state.notepadPageList = []; state.notepadPageBusy = false;
  $('#notepad-editor').replaceChildren();
  for (const form of state.replyForms.values()) form.markdownEditor?.destroy(); state.replyForms.clear();
  $('.popup-reply-form',$('#annotation-popover'))?.markdownEditor?.destroy(); $('#annotation-popover').replaceChildren();
  $('#reader-hint').textContent = 'Select text to highlight, underline, strike, or comment';
  state.observer?.disconnect(); state.observer = null; state.renderGeneration++; state.renderQueue = [];
  state.pdf = null; state.selection = null; hideSelection(); $('#comment-popover').hidden = true; $('#floating-menu').hidden = true;
  closeAnnotationPopover(); state.popupTarget = null; state.popupMatches = [];
}
async function openItem(id, edit = false, force = false) {
  if (state.linkingPad && state.active) { toast('Finishing your passage link…'); return; }
  if (state.active?.id === id && !force) { if (edit) setEditMode(true); closeNavigationDrawer(); return; }
  if (!await flushNote()) return;
  const opening = ++state.opening;
  const [item, annotations] = await Promise.all([api(`/api/items/${id}`),api(`/api/items/${id}/annotations`)]);
  if (opening !== state.opening) return;
  resetReader(); state.active = item; state.annotations = annotations; state.selected = null; state.filter = 'all'; state.page = 1; state.zoom = null;
  state.dirty = false; state.conflict = false; state.editing = false;
  const draft = readLocal(`notate-draft-${id}`,null);
  if (item.kind === 'note' && draft) {
    const source = typeof draft.markdown === 'string' ? draft.markdown
      : typeof draft.content === 'string' ? (await api('/api/notes/convert', {method:'POST', body:{content:draft.content}})).markdown : item.markdown;
    if (opening !== state.opening) return;
    if (source !== item.markdown) {
      state.active.markdown = source; state.active.revision = draft.revision; state.dirty = true; edit = true;
      if (draft.revision !== item.revision) state.conflict = true;
      writeLocal(`notate-draft-${id}`, {markdown:source,revision:state.active.revision});
      toast('Your unsaved draft has been restored.');
    } else writeLocal(`notate-draft-${id}`,null);
  }
  state.recent = [id,...state.recent.filter(value => value !== id)].slice(0,50); writeLocal('notate-recent',state.recent); writeLocal('notate-active',id);
  renderHeading(); renderNavigation(); renderAnnotations(); updateSaveState();
  closeNavigationDrawer(); $('#reader').scrollTop = 0;
  if (item.has_pdf) { $('#reader').innerHTML = '<div class="loading"><span class="spinner"></span>Opening your document…</div>'; await renderPDF(item,opening); }
  else renderText(item,edit);
  if (state.conflict) showConflictNotice();
  else if (state.dirty) state.saveTimer = setTimeout(() => saveNote(),800);
}
function renderText(item, edit = false) {
  const reader = $('#reader'); reader.innerHTML = '<article class="paper text-paper"><div class="document-content" id="note-content"></div><div id="note-editor" hidden></div><div class="annotation-layer"></div></article>';
  const content = $('#note-content'); content.innerHTML = item.content;
  $('.text-paper').classList.toggle('markdown-note', item.kind === 'note');
  $('#page-tools').hidden = true; $('#zoom-tools').hidden = true;
  if (item.kind === 'note') {
    $('#document-mode').innerHTML = '<div class="mode-toggle"><button id="read-mode" class="active">Read</button><button id="edit-mode">Edit note</button></div>';
    $('#read-mode').onclick = action(async () => { if (await flushNote()) setEditMode(false); }); $('#edit-mode').onclick = () => setEditMode(true);
  } else $('#document-mode').innerHTML = `<span class="read-mode">${icon('book')}Reading view${item.filename?.toLowerCase().endsWith('.docx') ? ' · formatted text' : ''}</span>`;
  setEditMode(edit && item.kind === 'note'); requestAnimationFrame(renderTextMarks);
}
function setEditMode(edit) {
  if (edit && typeof state.active?.markdown !== 'string') {
    toast('Restart the local Notate server to enable Markdown editing, then reload this window.', true); return;
  }
  state.editing = edit; const content = $('#note-content'); if (!content) return;
  content.hidden = edit; $('#note-editor').hidden = !edit;
  closeDefinition(); hidePadSelectionTools();
  if (edit && !noteEditor) noteEditor = createNoteEditor($('#note-editor'), state.active.markdown || '', onNoteInput, state.livePreview, {
    onApplyTextColor: () => applyEditorTextColor('note'),
    onDefinition: (definition,rect,label) => openDefinition(editorContext('note'),definition,rect,label),
    onHyperlink: url => window.open(url,'_blank','noopener,noreferrer'),
    onSelectionChange: (selection,update) => {
      if (noteEditor?.view.hasFocus) state.formattingEditor = 'note';
      mapDefinitionTarget(noteEditor,update); scheduleDefinition(); schedulePadSelectionTools();
    }
  });
  if (!edit) { content.innerHTML = state.active.content; prepareNoteReading(); requestAnimationFrame(renderTextMarks); }
  $('.text-paper').classList.toggle('editing',edit); $('#format-toolbar').hidden = !edit;
  $('#edit-mode')?.classList.toggle('active',edit); $('#read-mode')?.classList.toggle('active',!edit);
  updateEditorPreview(); if (edit) { state.formattingEditor = 'note'; noteEditor.focus(); } hideSelection(); closeAnnotationPopover();
  $('#reader-hint').textContent = edit ? 'Markdown saves automatically. Switch to Read to highlight or comment.' : 'Select text to highlight, underline, strike, or comment';
}
function prepareNoteReading() {
  const content = $('#note-content'); if (!content || state.active?.kind !== 'note') return;
  const definitions = getSourceDefinitions(state.active.markdown || '');
  $$('.md-definition[data-definition]',content).forEach((mark,index) => {
    const definition = definitions[index]; if (!definition) return;
    mark.dataset.definitionFrom = definition.from; mark.tabIndex = 0; mark.setAttribute('role','button');
    mark.title = '⌘/Ctrl-click to view definition';
    const open = () => openDefinition({kind:'note',editor:noteEditor,host:content,itemId:state.active.id},definition,mark.getBoundingClientRect(),mark.textContent);
    mark.addEventListener('pointerdown',event => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); event.stopPropagation(); open(); } });
    mark.addEventListener('keydown',event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
  });
  $$('a[href]',content).forEach(link => { link.target = '_blank'; link.rel = 'noopener noreferrer'; });
}
function updateEditorPreview() {
  const button = $('#markdown-preview-toggle');
  button.setAttribute('aria-pressed', state.livePreview); button.textContent = state.livePreview ? 'Live preview' : 'Markdown source';
  button.title = state.livePreview ? 'Show raw Markdown source' : 'Render Markdown as you leave each line';
}
function onNoteInput(source) {
  if (!state.active) return;
  state.dirty = true; state.active.markdown = source;
  writeLocal(`notate-draft-${state.active.id}`,{markdown:source,revision:state.active.revision}); updateSaveState();
  clearTimeout(state.saveTimer); if (!state.conflict) state.saveTimer = setTimeout(() => saveNote(),650);
}
async function saveNote() {
  if (state.saving) { await state.saving; if (state.dirty && !state.conflict) return saveNote(); return !state.dirty; }
  if (!state.dirty || !state.active || state.active.kind !== 'note') return true;
  if (state.conflict) return false;
  clearTimeout(state.saveTimer);
  const id = state.active.id; const markdown = state.active.markdown; const revision = state.active.revision;
  state.saving = (async () => {
    try {
      const saved = await api(`/api/items/${id}`,{method:'PATCH',body:{markdown,revision}});
      if (state.active?.id === id) {
        const newerSource = state.active.markdown; state.active = {...saved,markdown:newerSource};
        state.dirty = newerSource !== markdown;
        if (state.dirty) writeLocal(`notate-draft-${id}`,{markdown:newerSource,revision:saved.revision});
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
async function flushNote() { clearTimeout(state.saveTimer); await saveNote(); if (state.dirty) { toast(state.conflict ? 'Review the conflicting edits before leaving this note.' : 'Your note is still unsaved. Keep this window open or reconnect the server.',true); return false; } return flushNotepad(); }

function notepadDraftKey(id,page=1) { return `notate-notepad-draft-${id}${page > 1 ? `-page-${page}` : ''}`; }
function notepadEndpoint(pad) { return `/api/items/${pad.item_id}/notepad?page=${pad.pageNumber}`; }
function keepNotepadDraft(pad) { writeLocal(notepadDraftKey(pad.item_id,pad.pageNumber),{markdown:pad.markdown,revision:pad.revision}); }
function updateNotepadPages() {
  const pad = state.notepad, page = pad?.pageNumber || 1, total = state.notepadPageList.length || 1;
  const busy = !pad || state.notepadPageBusy || state.linkingPad;
  $('#notepad-page-label').textContent = `Page ${page} of ${total}`;
  $('#notepad-previous-page').disabled = busy || page <= 1;
  $('#notepad-next-page').disabled = busy || page >= total;
  $('#notepad-add-page').disabled = busy;
  $('#notepad-download').title = `Download Notepad page ${page} as Markdown`;
}
function updateNotepadPageMetadata(pad) {
  const metadata = state.notepadPageList.find(entry => entry.page === pad.pageNumber);
  if (metadata) Object.assign(metadata,{revision:pad.revision,updated_at:pad.updated_at});
}
function updateNotepadState() {
  const pad = state.notepad, button = $('#notepad-save-state'), notice = $('#notepad-notice');
  updateNotepadPages();
  if (!pad) return;
  button.textContent = state.linkingPad ? 'Linking passage…' : pad.conflict ? 'Review conflicting edits' : pad.saving ? 'Saving…' : pad.dirty ? 'Unsaved draft' : 'Saved locally';
  button.classList.toggle('dirty',pad.dirty); button.classList.toggle('conflict',pad.conflict);
  notice.textContent = pad.conflict ? 'Your draft is safe. Review the saved version before replacing it.' : pad.error || '';
  notice.hidden = !notice.textContent;
}
function makeNotepadPage(saved,pageNumber) {
  const pad = {...saved,pageNumber,dirty:false,conflict:false,saving:null,timer:null,error:'',sourceMode:false,scrollTop:0,editor:null};
  const key = notepadDraftKey(pad.item_id,pageNumber), draft = readLocal(key,null);
  if (draft && typeof draft.markdown === 'string' && draft.markdown !== saved.markdown) {
    pad.markdown = draft.markdown; pad.revision = draft.revision; pad.dirty = true;
    pad.conflict = draft.revision !== saved.revision;
    toast(`Your unsaved draft for Notepad page ${pageNumber} has been restored.`);
  } else writeLocal(key,null);
  return pad;
}
function mountNotepadPage(pad) {
  closeDefinition();
  cancelPadLink();
  if (state.notepad && notepadEditor) {
    state.notepad.scrollTop = notepadEditor.view.scrollDOM.scrollTop;
    notepadEditor.view.dom.remove();
  }
  state.notepad = pad;
  if (!pad.editor) pad.editor = createNoteEditor($('#notepad-editor'),pad.markdown,source => {
    pad.markdown = source; pad.dirty = true; keepNotepadDraft(pad);
    if (state.notepad === pad) updateNotepadState();
    clearTimeout(pad.timer); if (!pad.conflict) pad.timer = setTimeout(() => saveNotepad(pad),650);
  },!pad.sourceMode,{ariaLabel:'Document notepad Markdown editor',placeholder:'Capture your thoughts about this document… Use # for a heading.',
    onPassageLink: jumpToLinkedPassage, onApplyTextColor: () => applyEditorTextColor('notepad'),
    onDefinition: (definition,rect,label) => { if (state.notepad === pad) openDefinition(editorContext('notepad'),definition,rect,label); },
    onSelectionChange: (selection,update) => {
      if (state.notepad !== pad) return;
      if (pad.editor?.view.hasFocus) state.formattingEditor = 'notepad';
      mapDefinitionTarget(pad.editor,update);
      scheduleDefinition();
      const pending = state.pendingPadLink;
      if (pending && update.docChanged) {
        pending.start = update.changes.mapPos(pending.start,1); pending.end = update.changes.mapPos(pending.end,-1);
        pending.text = update.state.doc.sliceString(pending.start,Math.max(pending.start,pending.end));
        if (!pending.text.trim()) cancelPadLink(); else $('#pad-link-target').textContent = pending.text.slice(0,80);
      }
      schedulePadSelectionTools();
    }});
  else $('#notepad-editor').append(pad.editor.view.dom);
  notepadEditor = pad.editor;
  notepadEditor.view.requestMeasure();
  requestAnimationFrame(() => { if (state.notepad === pad) notepadEditor.view.scrollDOM.scrollTop = pad.scrollTop; });
  $('#notepad-source').setAttribute('aria-pressed',pad.sourceMode);
  $('#notepad-source').title = pad.sourceMode ? 'Show live Markdown formatting' : 'Show Markdown source';
  writeLocal(`notate-notepad-page-${pad.item_id}`,pad.pageNumber);
  updateNotepadState();
  if (pad.dirty && !pad.conflict) pad.timer = setTimeout(() => saveNotepad(pad),650);
}
async function ensureNotepad(pageNumber = null) {
  $('#notepad-context').textContent = $('#notepad-context').title = state.active?.title || 'Open a document to start a notepad.';
  if (!state.active) return false;
  if (state.notepad && (pageNumber === null || state.notepad.pageNumber === pageNumber)) return true;
  if (state.notepadLoading) { await state.notepadLoading; return ensureNotepad(pageNumber); }
  const id = state.active.id; $('#notepad-save-state').textContent = 'Opening…';
  $('#notepad-notice').hidden = true;
  const request = (async () => {
    if (!state.notepadPageList.length) {
      const result = await api(`/api/items/${id}/notepad/pages`);
      if (state.active?.id !== id) return false;
      state.notepadPageList = result.pages;
    }
    const preferred = pageNumber ?? readLocal(`notate-notepad-page-${id}`,1);
    const number = state.notepadPageList.some(entry => entry.page === preferred) ? preferred : 1;
    let pad = state.notepadPages.get(number);
    if (!pad) {
      const saved = await api(`/api/items/${id}/notepad?page=${number}`);
      if (state.active?.id !== id) return false;
      pad = makeNotepadPage(saved,number); state.notepadPages.set(number,pad);
    }
    mountNotepadPage(pad); return true;
  })(); state.notepadLoading = request;
  try {
    return await request;
  } catch (error) {
    if (state.active?.id !== id) return;
    $('#notepad-save-state').textContent = 'Retry';
    $('#notepad-notice').textContent = error.status === 404 ? 'Restart the Notate server to enable Notepad, then reload this window.' : error.message;
    $('#notepad-notice').hidden = false;
    return false;
  } finally { if (state.notepadLoading === request) state.notepadLoading = null; }
}
async function switchNotepadPage(number,create = false) {
  if (!state.notepad || state.notepadPageBusy || state.linkingPad || !create && number === state.notepad.pageNumber) return false;
  const pad = state.notepad, id = pad.item_id; state.notepadPageBusy = true;
  closeDefinition();
  cancelPadLink(); pad.editor.setReadOnly(true); updateNotepadState();
  try {
    if (!await flushNotepad()) return false;
    if (state.active?.id !== id) return false;
    if (create) {
      const added = await api(`/api/items/${id}/notepad/pages`,{method:'POST'});
      if (state.active?.id !== id) return false;
      const list = await api(`/api/items/${id}/notepad/pages`);
      if (state.active?.id !== id) return false;
      state.notepadPageList = list.pages; number = added.page;
      state.notepadPages.set(number,makeNotepadPage(added.notepad,number));
    }
    if (!state.notepadPageList.some(entry => entry.page === number)) return false;
    const opened = await ensureNotepad(number);
    if (opened && state.active?.id === id) notepadEditor.focus();
    return opened;
  } finally {
    if (state.notepadPages.get(pad.pageNumber) === pad) pad.editor.setReadOnly(false);
    if (state.active?.id === id) { state.notepadPageBusy = false; updateNotepadState(); }
  }
}
async function saveNotepad(pad = state.notepad) {
  if (!pad) return true;
  if (pad.saving) { await pad.saving; if (pad.dirty && !pad.conflict) return saveNotepad(pad); return !pad.dirty; }
  if (!pad.dirty) return true; if (pad.conflict) return false;
  clearTimeout(pad.timer); const source = pad.markdown, revision = pad.revision;
  pad.saving = (async () => {
    try {
      const saved = await api(notepadEndpoint(pad),{method:'PATCH',body:{markdown:source,revision}});
      pad.revision = saved.revision; pad.updated_at = saved.updated_at; pad.dirty = pad.markdown !== source || pad.conflict; pad.error = '';
      pad.dirty ? keepNotepadDraft(pad) : writeLocal(notepadDraftKey(pad.item_id,pad.pageNumber),null);
      if (state.notepadPages.get(pad.pageNumber) === pad) updateNotepadPageMetadata(pad);
      return true;
    } catch (error) {
      if (error.status === 409 || error.status === 404) pad.conflict = true;
      pad.error = error.message; return false;
    } finally { pad.saving = null; if (state.notepad === pad) updateNotepadState(); }
  })();
  updateNotepadState(); return pad.saving;
}
async function flushNotepad() {
  if (state.notepad) clearTimeout(state.notepad.timer);
  await saveNotepad();
  if (state.notepad?.dirty) { toast(state.notepad.conflict ? 'Review the notepad conflict before leaving this page.' : 'Your notepad is still unsaved. Reconnect the local server or download your draft.',true); return false; }
  return true;
}
async function synchronizeNotepad() {
  const pad = state.notepad; if (!pad) return;
  const id = pad.item_id, list = await api(`/api/items/${id}/notepad/pages`);
  if (state.active?.id !== id) return;
  state.notepadPageList = list.pages;
  for (const metadata of list.pages) {
    const cached = state.notepadPages.get(metadata.page);
    if (!cached) continue;
    if (cached.saving) await cached.saving;
    if (state.active?.id !== id) return;
    if (metadata.revision <= cached.revision) continue;
    if (cached.dirty) { cached.conflict = true; continue; }
    const latest = await api(notepadEndpoint(cached));
    if (state.active?.id !== id || state.notepadPages.get(metadata.page) !== cached) return;
    if (cached.dirty || cached.saving) cached.conflict = true;
    else {
      if (state.notepad === cached) cancelPadLink();
      Object.assign(cached,latest); cached.editor?.setSource(latest.markdown);
    }
  }
  updateNotepadState();
}
function schedulePadSelectionTools() {
  cancelAnimationFrame(state.padSelectionFrame);
  state.padSelectionFrame = requestAnimationFrame(() => { state.padSelectionFrame = null; updatePadSelectionTools(); });
}
function hidePadSelectionTools() {
  state.padColorMenu = false;
  $('#notepad-selection-toolbar').hidden = true;
  $('#notepad-color-toggle').setAttribute('aria-expanded','false');
  $('#note-color-toggle').setAttribute('aria-expanded','false');
}
function updateNotepadPalette() {
  const label = textColorLabels[notepadTextColor];
  for (const button of $$('[data-notepad-color]')) button.setAttribute('aria-pressed',button.dataset.notepadColor === notepadTextColor);
  for (const button of $$('.notepad-color-control')) button.style.setProperty('--notepad-current-color',`var(--text-color-${notepadTextColor})`);
  for (const id of ['notepad-color-toggle','note-color-toggle']) $(`#${id}`).title = $(`#${id}`).ariaLabel = `Text color: ${label}`;
  $('#notepad-apply-color').title = $('#notepad-apply-color').ariaLabel = `Apply ${label.toLowerCase()} text (⌘/Ctrl Shift H)`;
}
function setNotepadTextColor(color,remember = true) {
  if (!TEXT_COLORS.includes(color)) return;
  notepadTextColor = color;
  if (remember) writeLocal('notate-notepad-text-color',color);
  updateNotepadPalette();
}
function editorContext(kind = state.formattingEditor) {
  if (kind === 'note') return state.editing && noteEditor ? {kind,editor:noteEditor,host:$('#note-editor'),itemId:state.active.id} : null;
  return state.notepad && notepadEditor ? {kind:'notepad',editor:notepadEditor,host:$('#notepad-editor'),itemId:state.active.id,pad:state.notepad} : null;
}
function definitionIsCurrent(target) {
  return target && state.active?.id === target.itemId && (target.kind === 'note'
    ? !state.editing || noteEditor === target.editor
    : state.notepad === target.pad && !state.notepadPageBusy && !state.linkingPad);
}
function mapDefinitionTarget(editor,update) {
  const target = state.definitionTarget;
  if (editor && target?.editor === editor && update.docChanged) {
    target.from = update.changes.mapPos(target.from,target.existing ? -1 : 1);
    target.to = update.changes.mapPos(target.to,-1);
  }
}
function applyEditorTextColor(kind = state.formattingEditor) {
  const context = editorContext(kind);
  if (context && (kind === 'note' || !state.linkingPad && !state.pendingPadLink) && context.editor.selectionCanFormat()) context.editor.applyTextColor(notepadTextColor);
}
function closeDefinition() {
  cancelAnimationFrame(state.definitionFrame); state.definitionFrame = null;
  state.definitionTarget = null; definitionEditor?.destroy(); definitionEditor = null;
  $('#notepad-definition-popover').hidden = true;
  $('#notepad-definition-editor').replaceChildren();
}
function scheduleDefinition() {
  if (!state.definitionTarget) return;
  cancelAnimationFrame(state.definitionFrame);
  state.definitionFrame = requestAnimationFrame(() => { state.definitionFrame = null; positionDefinition(); });
}
function positionDefinition() {
  const target = state.definitionTarget, popup = $('#notepad-definition-popover');
  if (!definitionIsCurrent(target) || popup.hidden) return;
  const marked = target.existing ? $(`[data-definition-from="${target.from}"]`,target.host) : null;
  const rect = marked?.getBoundingClientRect() || target.editor?.view.coordsAtPos(Math.min(Math.max(0,target.from),target.editor.view.state.doc.length)) || target.rect || target.host.getBoundingClientRect();
  const top = rect.top-popup.offsetHeight-8;
  position(popup,rect.left,top >= 8 ? top : rect.bottom+8);
}
function editableDefinitionTarget() {
  let target = state.definitionTarget; if (!definitionIsCurrent(target)) return;
  if (target.kind === 'note' && !state.editing) {
    const saved = {...target}; setEditMode(true);
    state.definitionTarget = target = {...saved,...editorContext('note')};
    $('#notepad-definition-popover').hidden = false;
  }
  return target;
}
function editDefinition() {
  const target = editableDefinitionTarget(); if (!target) return;
  $('#notepad-definition-display').hidden = true; $('#notepad-definition-read-actions').hidden = true;
  $('#notepad-definition-form').hidden = false; $('#notepad-definition-error').hidden = true;
  $('#notepad-definition-heading').textContent = target.existing ? 'Edit definition' : 'Define selection';
  definitionEditor?.destroy(); $('#notepad-definition-editor').replaceChildren();
  definitionEditor = createNoteEditor($('#notepad-definition-editor'),target.definition || '',scheduleDefinition,true,
    {ariaLabel:'Definition text',placeholder:'Write your definition…',maxLength:20_000,onSubmit:saveDefinition});
  positionDefinition(); definitionEditor.focus(); scheduleDefinition();
}
function openDefinition(context,definition,rect,label) {
  if (!definitionIsCurrent(context)) return;
  closeDefinition(); hidePadSelectionTools(); hideSelection(); closeAnnotationPopover();
  if (context.kind === 'note' && !state.editing) getSelection().removeAllRanges();
  state.definitionTarget = {...definition,...context,existing:true,rect};
  $('#notepad-definition-term').textContent = label || definition.text;
  $('#notepad-definition-heading').textContent = 'Definition';
  $('#notepad-definition-form').hidden = true; $('#notepad-definition-error').hidden = true;
  const display = $('#notepad-definition-display'); display.hidden = false;
  $('#notepad-definition-read-actions').hidden = false;
  display.innerHTML = renderEditorMarkdown(definition.definition);
  $$('a',display).forEach(link => { link.target = '_blank'; link.rel = 'noopener noreferrer'; });
  const popup = $('#notepad-definition-popover'); popup.hidden = false;
  positionDefinition(); popup.focus({preventScroll:true});
}
function beginDefinition() {
  const context = editorContext();
  if (!definitionIsCurrent(context) || context.kind === 'notepad' && state.pendingPadLink || !context.editor.selectionCanDefine()) return;
  const editor = context.editor, source = editor.getSource();
  const selected = editor.getSelectedDefinition(); const {from,to} = editor.view.state.selection.main;
  const selection = getSelection(), rect = selection.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
  const label = selection.toString().trim() || source.slice(from,to);
  closeDefinition(); hidePadSelectionTools();
  state.definitionTarget = selected ? {...selected,...context,existing:true,rect} : {from,to,text:source.slice(from,to),...context,existing:false,rect};
  $('#notepad-definition-term').textContent = selected ? selected.text : label;
  $('#notepad-definition-popover').hidden = false; editDefinition();
}
function saveDefinition() {
  const target = state.definitionTarget, source = definitionEditor?.getSource().trim();
  if (!definitionIsCurrent(target)) return;
  const error = $('#notepad-definition-error');
  if (!source) { error.textContent = 'Write a definition before saving.'; error.hidden = false; scheduleDefinition(); return; }
  if (!target.editor.setDefinition(source,target)) {
    error.textContent = 'The marked text or definition changed. Your draft is still here; select the text again to apply it.';
    error.hidden = false; scheduleDefinition(); return;
  }
  closeDefinition(); schedulePadSelectionTools();
}
function updatePadSelectionTools() {
  const toolbar = $('#notepad-selection-toolbar'), context = editorContext(), editor = context?.editor;
  const note = context?.kind === 'note', locked = !note && (state.linkingPad || !!state.pendingPadLink);
  const padCanLink = !!notepadEditor && !state.linkingPad && notepadEditor.selectionCanLink() && notepadEditor.view.state.selection.main.to - notepadEditor.view.state.selection.main.from <= 100_000;
  $('#notepad-link').disabled = !padCanLink;
  const hyperlink = note && editor.getHyperlinkTarget();
  const linkButton = $('#link-pad-selection');
  linkButton.disabled = note ? !hyperlink : !padCanLink;
  linkButton.title = linkButton.ariaLabel = note ? (hyperlink?.existing ? 'Edit hyperlink' : 'Add hyperlink to selected text') : 'Link selected Notepad text to a reading passage';
  $('#editor-link-label').textContent = note ? 'Hyperlink' : 'Link';
  $('#note-hyperlink').disabled = !state.editing || !noteEditor?.getHyperlinkTarget();
  const canFormat = !!editor && !locked && editor.selectionCanFormat();
  $('#notepad-underline').disabled = $('#notepad-apply-color').disabled = !canFormat;
  $('#notepad-define').disabled = !canFormat || !editor.selectionCanDefine();
  $('#notepad-define').title = editor?.getSelectedDefinition() ? 'Edit definition for selected text' : 'Define selected text';
  $('#notepad-underline').setAttribute('aria-pressed',canFormat && editor.selectionIsUnderlined());
  const focused = editor?.view.hasFocus || toolbar.contains(document.activeElement);
  toolbar.setAttribute('aria-label',note ? 'Format selected note text' : 'Format selected Notepad text');
  toolbar.hidden = !editor || !note && state.filter !== 'notepad' || locked || !!state.definitionTarget || $('#modal').open || !(state.padColorMenu || (canFormat || !!hyperlink) && focused);
  $('#notepad-color-toggle').disabled = !notepadEditor || state.linkingPad || !!state.pendingPadLink;
  $('#notepad-color-toggle').setAttribute('aria-expanded',!note && !toolbar.hidden);
  $('#note-color-toggle').setAttribute('aria-expanded',note && !toolbar.hidden);
  $('#note-define').disabled = !state.editing || !noteEditor?.selectionCanDefine();
  if (toolbar.hidden) return;
  if (state.padColorMenu) {
    const anchor = $(note ? '#note-color-toggle' : '#notepad-color-toggle').getBoundingClientRect();
    position(toolbar,anchor.left,anchor.bottom+8); return;
  }
  const {from,to} = editor.view.state.selection.main; const first = editor.view.coordsAtPos(from), last = editor.view.coordsAtPos(to);
  const bounds = (note ? $('#reader') : context.host).getBoundingClientRect();
  if (!first || !last || first.bottom < bounds.top || first.top > bounds.bottom) { hidePadSelectionTools(); return; }
  const above = first.top-toolbar.offsetHeight-8;
  position(toolbar,first.left,above >= Math.max(8,bounds.top) ? above : last.bottom+8);
}
function beginNoteHyperlink() {
  const context = editorContext('note'), target = context?.editor.getHyperlinkTarget();
  if (!target) return;
  hidePadSelectionTools(); closeDefinition();
  const current = () => state.editing && state.active?.id === context.itemId && noteEditor === context.editor;
  modal(target.existing ? 'Edit hyperlink' : 'Add hyperlink',
    `<p>${escapeHTML(target.text)}</p><label for="note-link-url">URL</label><input id="note-link-url" name="url" type="url" placeholder="https://example.com" value="${escapeHTML(target.url || '')}" required><p>Use an https://, http://, or mailto: address. ⌘/Ctrl-click the linked text to open it.</p>${target.existing ? '<button type="button" id="note-link-remove" class="button subtle">Remove hyperlink</button>' : ''}`,
    'Save link', data => {
      if (!current() || !context.editor.setHyperlink(data.get('url').trim(),target)) throw new Error('Use a valid web or email address. If the selected text changed, select it again.');
      requestAnimationFrame(() => context.editor.focus());
    });
  if (target.existing) $('#note-link-remove').onclick = () => {
    if (!current() || !context.editor.removeHyperlink(target)) { toast('The linked text changed. Select its current text again.',true); return; }
    $('#modal').close(); requestAnimationFrame(() => context.editor.focus());
  };
}
function cancelPadLink() {
  state.pendingPadLink = null; $('#pad-link-banner').hidden = true; $('#pad-action-label').textContent = 'Pad';
  $('[data-annotate="pad"]').title = 'Add this passage to Notepad';
  hidePadSelectionTools();
}
async function beginPadLink() {
  if (!notepadEditor?.selectionCanLink() || state.linkingPad) return;
  const {from,to} = notepadEditor.view.state.selection.main;
  if (to - from > 100_000) { toast('Select a smaller Notepad passage.',true); return; }
  if (state.editing && !await flushNote()) return;
  state.pendingPadLink = {itemId:state.active.id,start:from,end:to,text:notepadEditor.getSource().slice(from,to)};
  $('#pad-link-target').textContent = state.pendingPadLink.text.slice(0,80); $('#pad-link-banner').hidden = false;
  $('#pad-action-label').textContent = 'Link to pad'; $('[data-annotate="pad"]').title = 'Link this passage to your selected Notepad text';
  hidePadSelectionTools(); hideSelection(); closeAnnotationPopover();
  if (state.editing) setEditMode(false);
  if (innerWidth <= 860) $('#reading-workspace').classList.remove('panel-mobile-open');
  $('#reader').focus({preventScroll:true}); toast('Select the source passage, then choose Link to pad.');
}
async function createPadLink() {
  const selected = state.selection; if (!selected || selected.itemId !== state.active?.id || state.linkingPad) return;
  const id = selected.itemId; state.linkingPad = true; let lockedEditor;
  const button = $('[data-annotate="pad"]'); button.disabled = true;
  updateNotepadState();
  try {
    await ensureNotepad(); if (!state.notepad || !await flushNote()) return;
    const pending = state.pendingPadLink?.itemId === id ? {...state.pendingPadLink} : null;
    const pad = state.notepad, source = pad.markdown;
    lockedEditor = notepadEditor; lockedEditor.setReadOnly(true);
    const result = await api(`/api/items/${id}/pad-links`,{method:'POST',body:{quote:selected.quote,anchor:selected.anchor,revision:pad.revision,
      page:pad.pageNumber,
      selection:pending ? {start:pending.start,end:pending.end,text:pending.text} : null}});
    await refreshWorkspace().catch(() => {});
    if (state.active?.id !== id || state.notepad !== pad) return;
    // Retain any typing that happened while the link request was in flight.
    if (pad.markdown !== source) {
      pad.conflict = true; pad.error = 'Your passage link was saved. Review the saved Notepad to keep your newer typing.';
      keepNotepadDraft(pad); updateNotepadState();
    } else {
      Object.assign(pad,result.notepad,{dirty:false,conflict:false,error:''}); writeLocal(notepadDraftKey(id,pad.pageNumber),null);
      updateNotepadPageMetadata(pad);
      notepadEditor.setSource(pad.markdown); updateNotepadState();
    }
    if (!state.annotations.some(record => record.id === result.annotation.id)) state.annotations.push(result.annotation);
    state.selected = result.annotation.id;
    hideSelection(); getSelection().removeAllRanges(); state.selection = null; cancelPadLink(); renderMarks();
    lockedEditor.setReadOnly(false); lockedEditor = null;
    await jumpToNotepad(result.annotation.id);
  } catch (error) {
    if (error.status === 409) { await synchronizeNotepad(); toast('Notepad changed in another window. Select your text again to link it.',true); }
    else throw error;
  } finally { if (lockedEditor?.view.dom.isConnected) lockedEditor.setReadOnly(false); state.linkingPad = false; button.disabled = false; updateNotepadState(); schedulePadSelectionTools(); }
}
async function jumpToNotepad(id) {
  const record = state.annotations.find(record => record.id === id); if (!record || record.kind !== 'pad') return;
  const itemId = state.active.id; closeAnnotationPopover(); hideSelection(); state.selected = id;
  state.filter = 'notepad'; openPanel(); renderAnnotations(); await ensureNotepad();
  if (state.active?.id !== itemId) return;
  if (!notepadEditor?.getPassageLinks().some(link => link.id === id)) {
    try {
      const found = await api(`/api/items/${itemId}/notepad/links/${id}`);
      if (state.active?.id !== itemId) return;
      if (!state.notepadPageList.some(entry => entry.page === found.page)) {
        const list = await api(`/api/items/${itemId}/notepad/pages`);
        if (state.active?.id !== itemId) return;
        state.notepadPageList = list.pages;
      }
      const cached = state.notepadPages.get(found.page);
      if (!cached) state.notepadPages.set(found.page,makeNotepadPage(found.notepad,found.page));
      else if (!cached.dirty && !cached.saving && found.notepad.revision > cached.revision) {
        Object.assign(cached,found.notepad); cached.editor?.setSource(cached.markdown); updateNotepadPageMetadata(cached);
      }
      if (found.page !== state.notepad?.pageNumber && !await switchNotepadPage(found.page)) return;
    } catch (error) { if (error.status === 404) { toast(error.message,true); return; } throw error; }
  }
  if (state.active?.id !== itemId) return;
  if (!notepadEditor?.revealPassageLink(id)) toast('The linked Notepad text was removed. The original reading passage is still marked.',true);
  renderMarks(); schedulePadSelectionTools();
}
function jumpToLinkedPassage(id) {
  const record = state.annotations.find(record => record.id === id);
  if (!record || record.kind !== 'pad') { toast('This passage link no longer exists in this document.',true); return; }
  cancelPadLink(); hideSelection(); hidePadSelectionTools();
  focusAnnotation(id,true,{keepNotepad:true});
  if (innerWidth <= 860) $('#reading-workspace').classList.remove('panel-mobile-open');
  $('#reader').focus({preventScroll:true});
}
function downloadNotepad() {
  if (!state.notepad) return;
  const pageSuffix = state.notepadPageList.length > 1 ? `-page-${state.notepad.pageNumber}` : '';
  downloadBlob(new Blob([state.notepad.markdown],{type:'text/markdown;charset=utf-8'}),`${state.active.title.replace(/[^a-z\d -]/gi,'').slice(0,80) || 'document'}-notepad${pageSuffix}.md`);
}
async function reviewNotepadConflict() {
  const pad = state.notepad; if (!pad) return;
  let latest;
  try { latest = await api(notepadEndpoint(pad)); }
  catch (error) {
    if (error.status !== 404) throw error;
    modal('Keep your notepad', '<p>This document was deleted in another window. Save your notepad as a new note or download the draft.</p><label for="recovered-pad-title">Note title</label><input id="recovered-pad-title" name="title" required maxlength="250"><button type="button" id="download-pad-draft" class="button subtle">Download draft</button>', 'Save as new note',async data => {
      if (state.dirty) throw new Error('Recover your main note draft first. You can download this notepad while reviewing it.');
      const saved = await api('/api/notes',{method:'POST',body:{title:data.get('title'),markdown:pad.markdown}});
      pad.dirty = false; pad.conflict = false; writeLocal(notepadDraftKey(pad.item_id,pad.pageNumber),null);
      await refreshWorkspace(); await openItem(saved.id,true);
    });
    $('#recovered-pad-title').value = `${state.active.title} — Notepad`.slice(0,250); $('#download-pad-draft').onclick = downloadNotepad; return;
  }
  modal('Review notepad versions', '<p>Another window saved a newer version. Keep your draft to replace it, or load the saved version.</p><details><summary>Saved Markdown</summary><pre id="saved-pad-version"></pre></details><button type="button" id="download-pad-draft" class="button subtle">Download my draft</button>', 'Keep my draft',async () => {
    pad.revision = latest.revision; pad.conflict = false; pad.dirty = true; keepNotepadDraft(pad);
    if (!await saveNotepad()) throw new Error('The saved version changed again. Reopen the review to see its latest version.');
  },{cancelText:'Load saved version',onCancel:action(async () => {
    const current = await api(notepadEndpoint(pad));
    if (state.notepad !== pad) return;
    Object.assign(pad,current,{dirty:false,conflict:false,error:''}); writeLocal(notepadDraftKey(pad.item_id,pad.pageNumber),null);
    updateNotepadPageMetadata(pad);
    notepadEditor.setSource(pad.markdown); updateNotepadState(); $('#modal').close();
  })});
  $('#saved-pad-version').textContent = latest.markdown || '(Empty notepad)'; $('#download-pad-draft').onclick = downloadNotepad;
}
function showConflictNotice() {
  updateSaveState(); if ($('.conflict-notice')) return;
  const notice = document.createElement('div'); notice.className = 'conflict-notice';
  notice.innerHTML = 'This note changed in another window. Your draft is safe.<button>Review versions</button>';
  $('button',notice).onclick = action(reviewConflict); $('#reader').prepend(notice);
}
async function reviewConflict() {
  const draft = state.active.markdown; let latest;
  try { latest = await api(`/api/items/${state.active.id}`); }
  catch (error) {
    if (error.status !== 404) throw error;
    const oldId = state.active.id; const title = state.active.title;
    modal('Keep this thought', `<p>This note was deleted in another window. Your draft is still here. Save it as a new note to keep writing.</p><label for="recovered-title">Note title</label><input id="recovered-title" name="title" value="${escapeHTML(title)}" required maxlength="250"><button type="button" id="download-draft" class="button subtle" style="margin-top:14px">Download my draft</button>`, 'Save as new note', async data => {
      const folder = state.folders.some(folder => folder.id === state.active.folder_id) ? state.active.folder_id : null;
      const recovered = await api('/api/notes',{method:'POST',body:{title:data.get('title'),folder_id:folder,markdown:draft}});
      if (state.notepad?.item_id === oldId) {
        if (state.notepad.markdown) await api(`/api/items/${recovered.id}/notepad`,{method:'PATCH',body:{revision:0,markdown:state.notepad.markdown}});
        state.notepad.dirty = false; state.notepad.conflict = false; writeLocal(notepadDraftKey(oldId,state.notepad.pageNumber),null);
      }
      state.dirty = false; state.conflict = false; writeLocal(`notate-draft-${oldId}`,null); await refreshWorkspace(); await openItem(recovered.id,true);
    });
    $('#download-draft').onclick = () => downloadBlob(new Blob([draft],{type:'text/markdown'}),'notate-unsaved-draft.md'); return;
  }
  modal('Two thoughts at once', '<p>Another window saved a newer version. Choose <strong>Keep my draft</strong> to replace it with this window’s draft, or use <strong>Load saved version</strong> to discard this draft. You can copy or download your draft before deciding.</p><button type="button" id="download-draft" class="button subtle">Download my draft</button>', 'Keep my draft', async () => {
    // Use the reviewed revision. A further edit during this dialog is still rejected.
    state.active.revision = latest.revision; state.conflict = false;
    writeLocal(`notate-draft-${state.active.id}`,{markdown:draft,revision:latest.revision});
    if (!await saveNote()) throw new Error('The saved version changed again. Reopen the review to compare the latest version.');
    $('.conflict-notice')?.remove();
  },{cancelText:'Load saved version',onCancel:async () => {
    $('#modal').close(); state.dirty = false; state.conflict = false; writeLocal(`notate-draft-${state.active.id}`,null); await openItem(state.active.id,false,true);
  }});
  $('#download-draft').onclick = () => downloadBlob(new Blob([draft],{type:'text/markdown'}),'notate-unsaved-draft.md');
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
function fittedPDFWidth() {
  const reader = $('#reader'); const style = getComputedStyle(reader);
  return Math.min(850, Math.max(180, reader.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)));
}
function buildPDFPages() {
  if (!state.pdf) return;
  const reader = $('#reader'); const top = reader.getBoundingClientRect().top + 40;
  const visible = $$('.pdf-page',reader).find(page => page.getBoundingClientRect().bottom > top);
  const position = visible ? {page: visible.dataset.page, fraction: (reader.scrollTop - visible.offsetTop) / visible.offsetHeight, atTop: reader.scrollTop < 1} : null;
  state.observer?.disconnect(); state.renderGeneration++; state.renderQueue = [];
  const width = state.zoom ? state.pdfBase.width*state.zoom : fittedPDFWidth();
  const scale = width/state.pdfBase.width; state.pdfScale = scale; $('#zoom-fit').textContent = state.zoom ? `${Math.round(scale*100)}%` : 'Fit';
  const fragment = document.createDocumentFragment();
  for (let number = 1; number <= state.pdf.numPages; number++) {
    const page = document.createElement('div'); page.className = 'paper pdf-page'; page.dataset.page = number;
    page.style.width = `${width}px`; page.style.height = `${state.pdfBase.height*scale}px`;
    page.style.setProperty('--scale-factor',scale); page.style.setProperty('--total-scale-factor',scale);
    page.innerHTML = `<div class="page-placeholder">Page ${number}</div><div class="annotation-layer"></div>`; fragment.append(page);
  }
  reader.replaceChildren(fragment);
  if (position) {
    const page = $(`.pdf-page[data-page="${position.page}"]`,reader);
    const behavior = reader.style.scrollBehavior; reader.style.scrollBehavior = 'auto';
    reader.scrollTop = position.atTop ? 0 : page.offsetTop + position.fraction * page.offsetHeight;
    reader.style.scrollBehavior = behavior;
    state.page = Number(position.page); $('#current-page').value = state.page;
  }
  state.observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) queuePage(entry.target);
  },{root:reader,rootMargin:'600px 0px'});
  $$('.pdf-page',reader).forEach(page => state.observer.observe(page));
  queuePage($(`.pdf-page[data-page="${state.page}"]`,reader)); renderPDFMarks();
  if (!position && state.page > 1) goToPage(state.page);
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
  if (state.editing) { hideSelection(); return; }
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
  if (matches.length && !state.pendingPadLink) {
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
  const y = rect.top-toolbar.offsetHeight-8 > 8 ? rect.top-toolbar.offsetHeight-8 : rect.bottom+8;
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
  $('#comment-form').markdownEditor.setSource(''); $('#comment-form').setEntryKind('reply');
  position(box,toolbar.left,toolbar.bottom+8); $('#comment-form').markdownEditor.focus();
}
$('#comment-form').onsubmit = action(async event => {
  event.preventDefault(); const form = event.currentTarget; const body = form.markdownEditor.getSource();
  if (!body.trim() || form.dataset.posting === 'true') return;
  form.dataset.posting = 'true'; form.setEntryKind(form.dataset.kind);
  try { await annotate('comment',body,form.dataset.kind || 'reply'); }
  finally { form.dataset.posting = 'false'; form.setEntryKind(form.dataset.kind); }
});
setupMarkdownComposer($('#comment-form'));
$('#close-comment').onclick = () => { $('#comment-popover').hidden = true; };
$$('[data-annotate]').forEach(button => { button.onmousedown = event => event.preventDefault(); button.onclick = action(() => button.dataset.annotate === 'pad' ? createPadLink() : button.dataset.annotate === 'comment' ? openCommentComposer() : annotate(button.dataset.annotate)); });
$('#selection-color').onmousedown = event => event.preventDefault();
$('#selection-color').onclick = event => {
  const container = $('#floating-menu'); container.innerHTML = `<div class="color-options">${['yellow','green','blue','pink'].map(color => `<button class="color-option ${color} ${color === state.color ? 'active' : ''}" data-color="${color}" aria-label="${color} annotation color"></button>`).join('')}</div>`;
  container.hidden = false; const rect = event.currentTarget.getBoundingClientRect(); position(container,rect.right,rect.bottom+7,true);
  $$('[data-color]',container).forEach(button => { button.onmousedown = event => event.preventDefault(); button.onclick = () => { state.color = button.dataset.color; writeLocal('notate-color',state.color); $('#selection-color').className = `color-trigger ${state.color}`; container.hidden = true; }; });
};

function annotationMark(record, rectangle, percent) {
  const mark = document.createElement('button'); mark.type = 'button'; mark.className = `annotation-mark ${record.kind} ${record.color}${state.selected === record.id ? ' selected' : ''}`;
  mark.dataset.annotation = record.id; mark.title = `${record.kind === 'pad' ? 'Open linked Notepad text' : record.kind === 'strike' ? 'Strikethrough' : record.kind}: ${record.quote.slice(0,150)}`;
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
  const layer = $('.annotation-layer',paper); layer.replaceChildren(); if (state.editing) return; const bounds = paper.getBoundingClientRect();
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
function setupMarkdownComposer(form, kind = 'reply', onDraft = null, body = '') {
  const host = $('.comment-editor',form), submit = $('button[type="submit"]',form);
  const baseLabel = submit.textContent.trim();
  const controls = document.createElement('div'); controls.className = 'markdown-composer-controls';
  controls.innerHTML = `${entryTypeSwitch(kind)}<div class="composer-tools"><button type="button" data-composer-format="bold" title="Bold (⌘/Ctrl B)" aria-label="Bold"><b>B</b></button><button type="button" data-composer-format="italic" title="Italic (⌘/Ctrl I)" aria-label="Italic"><i>I</i></button><button type="button" class="composer-source" title="Show Markdown source" aria-label="Toggle Markdown source" aria-pressed="false">MD</button></div>`;
  form.prepend(controls);
  form.markdownEditor = createNoteEditor(host,body,() => {
    form.setEntryKind(form.dataset.kind || 'reply');
    requestAnimationFrame(() => {
      schedulePopupPosition();
      const box = form.closest('#comment-popover');
      if (box && !box.hidden) position(box,parseFloat(box.style.left) || 8,parseFloat(box.style.top) || 8);
    });
  },true,{ariaLabel:host.dataset.label,placeholder:host.dataset.placeholder,maxLength:20000,
    onSubmit:() => { if (form.markdownEditor.getSource().trim() && form.dataset.posting !== 'true') form.requestSubmit(); }});
  form.setEntryKind = value => {
    value = value === 'answer' ? 'answer' : 'reply';
    form.dataset.kind = value; form.classList.toggle('answer-composer',value === 'answer');
    $$('[data-entry-kind]',controls).forEach(button => button.setAttribute('aria-pressed',button.dataset.entryKind === value));
    submit.innerHTML = `${value === 'answer' ? 'Post answer' : form.dataset.postLabel || baseLabel}${icon('up')}`;
    submit.disabled = form.dataset.posting === 'true' || !form.markdownEditor.getSource().trim();
    onDraft?.({body:form.markdownEditor.getSource(),kind:value}); schedulePopupPosition();
  };
  $$('button',controls).forEach(button => button.onmousedown = event => event.preventDefault());
  $$('[data-entry-kind]',controls).forEach(button => button.onclick = () => form.setEntryKind(button.dataset.entryKind));
  $$('[data-composer-format]',controls).forEach(button => button.onclick = () => form.markdownEditor.format(button.dataset.composerFormat));
  $('.composer-source',controls).onclick = event => {
    const button = event.currentTarget, source = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed',source); button.title = source ? 'Show live Markdown formatting' : 'Show Markdown source';
    form.markdownEditor.setPreview(!source); form.markdownEditor.focus();
  };
  form.setEntryKind(kind); return form;
}
function replyComposer(record, popup = false) {
  const form = document.createElement('form'); form.className = popup ? 'popup-reply-form' : 'reply-form'; form.dataset.id = record.id;
  const label = popup ? 'Reply beside passage' : record.comments.length ? 'Reply to thread' : 'Add a comment to this annotation';
  form.innerHTML = `<div class="comment-editor compact-editor" data-label="${label}" data-placeholder="${record.comments.length ? 'An answer, or another thought…' : 'Add a thought to this passage…'}"></div><div class="reply-footer"><span>⌘ / Ctrl Enter to post</span><button type="submit" class="${popup ? 'button primary' : ''}">${record.comments.length ? 'Reply' : 'Post'}${icon('up')}</button></div>`;
  const drafts = popup ? state.popupDrafts : state.replyDrafts;
  const draft = drafts.get(record.id);
  setupMarkdownComposer(form,draft?.kind || 'reply',value => drafts.set(record.id,value),typeof draft === 'string' ? draft : draft?.body || '');
  form.onsubmit = action(async event => {
    event.preventDefault(); const body = form.markdownEditor.getSource(); const itemId = state.active?.id;
    if (!body.trim() || form.dataset.posting === 'true') return;
    form.dataset.posting = 'true'; form.setEntryKind(form.dataset.kind);
    try {
      await api(`/api/annotations/${record.id}/comments`,{method:'POST',body:{body,kind:form.dataset.kind || 'reply'}});
      if (form.markdownEditor.getSource() === body) { form.markdownEditor.setSource(''); form.setEntryKind(form.dataset.kind); drafts.delete(record.id); }
      if (state.active?.id === itemId) { state.selected = record.id; await refreshAnnotations(); }
    } finally { form.dataset.posting = 'false'; form.setEntryKind(form.dataset.kind); }
  });
  return form;
}
function renderAnnotationPopover() {
  const box = $('#annotation-popover'); if (box.hidden) return;
  const record = state.annotations.find(record => record.id === state.selected);
  if (!record || !popupsEnabled()) { closeAnnotationPopover(); return; }
  const previous = $('.popup-reply-form',box); const wasFocused = previous?.markdownEditor.view.hasFocus;
  const scroll = $('.popup-thread',box)?.scrollTop || 0;
  const labels = {highlight:'Highlight',underline:'Underline',strike:'Strikethrough',comment:'Comment thread',pad:'Notepad link'};
  const matches = state.popupMatches.map(id => state.annotations.find(record => record.id === id)).filter(Boolean);
  box.innerHTML = `<div class="passage-popover-heading"><span class="popup-label">${icon(record.comments.length ? 'comment' : 'highlighter')}${labels[record.kind]}${record.resolved ? ' · Resolved' : ''}</span><button class="icon-button popup-close" aria-label="Close passage popup">${icon('close')}</button></div>${matches.length > 1 ? `<div class="popup-matches"><span>${matches.length} marks at this passage</span><div>${matches.map((match,index) => `<button data-match="${match.id}" aria-pressed="${match.id === record.id}" title="${escapeHTML(match.quote)}">${index+1}. ${labels[match.kind]}</button>`).join('')}</div></div>` : ''}<blockquote class="popup-quote ${record.color}">${escapeHTML(record.quote)}</blockquote><div class="popup-thread">${record.comments.length ? record.comments.map(comment => commentMarkup(comment,true)).join('') : '<p class="popup-empty">A passage worth keeping. Add a thought or question here.</p>'}</div>${record.resolved ? '' : '<form class="popup-reply-form"></form>'}<div class="popup-actions"><button class="popup-resolve">${icon('check')}${record.resolved ? 'Reopen thread' : 'Resolve'}</button>${state.selection ? '<button class="popup-annotate">Annotate selection</button><button class="popup-pad">Pad</button>' : ''}<button class="popup-panel" title="Focus this entry in Notes & discoveries">${icon('panel')}In panel</button></div>`;
  box.dataset.annotation = record.id;
  $('.popup-close',box).onclick = closeAnnotationPopover;
  $$('[data-match]',box).forEach(button => { button.onclick = () => focusAnnotation(button.dataset.match,false,{matches:state.popupMatches}); });
  $('.popup-panel',box).onclick = () => { closeAnnotationPopover(); $(`.annotation-card[data-annotation="${record.id}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'}); };
  $('.popup-annotate',box)?.addEventListener('click',() => { closeAnnotationPopover(); showSelectionToolbar(); });
  $('.popup-pad',box)?.addEventListener('click',action(createPadLink));
  const placeholder = $('.popup-reply-form',box);
  if (placeholder) {
    const reuse = previous?.dataset.id === record.id;
    const form = reuse ? previous : replyComposer(record,true);
    if (previous && !reuse) previous.markdownEditor.destroy();
    placeholder.replaceWith(form); form.markdownEditor.view.requestMeasure();
    if (wasFocused && reuse) form.markdownEditor.focus();
  } else previous?.markdownEditor.destroy();
  bindCommentTypes(box);
  $('.popup-resolve',box).onclick = action(async () => {
    await api(`/api/annotations/${record.id}`,{method:'PATCH',body:{resolved:!record.resolved}});
    state.filter = record.resolved ? 'all' : 'resolved'; await refreshAnnotations();
  });
  $('.popup-thread',box).scrollTop = scroll; positionAnnotationPopover();
}
function openPanel() {
  const workspace = $('#reading-workspace');
  workspace.classList.remove('panel-hidden'); workspace.classList.add('panel-mobile-open');
  updatePaneWidth(); scheduleReaderLayout(true);
}
function focusAnnotation(id, scrollDocument = false, options = {}) {
  const linked = state.annotations.find(record => record.id === id);
  if (linked?.kind === 'pad' && !scrollDocument) { action(() => jumpToNotepad(id))(); return; }
  if (state.editing && scrollDocument) {
    action(async () => { if (await flushNote()) { setEditMode(false); renderTextMarks(); focusAnnotation(id,true,options); } })();
    return;
  }
  const record = state.annotations.find(value => value.id === id); if (!record) return;
  state.popupMatches = options.matches || [id];
  state.popupPending = scrollDocument;
  const mark = options.mark || passageMark(id, options.range);
  if (mark) rememberPopupTarget(mark);
  else state.popupTarget = {id, page:record.anchor.pages?.[0]?.page || null, segment:0};
  state.selected = id; if (!options.keepNotepad) state.filter = record.resolved ? 'resolved' : 'all'; openPanel(); renderAnnotations(); renderMarks();
  const card = $(`[data-annotation="${id}"]`,$('#annotations-list')); card?.scrollIntoView({block:'nearest',behavior:'smooth'});
  if (scrollDocument) {
    const first = $(`[data-annotation="${id}"]`,$('#reader'));
    if (first) first.scrollIntoView({block:'center',behavior:'smooth'});
    else if (record.anchor.pages?.length) goToPage(record.anchor.pages[0].page);
    else toast('The selected passage was edited or removed. The original quote is kept in this thread.');
  }
  if (record.kind !== 'pad' && popupsEnabled()) { $('#annotation-popover').hidden = false; renderAnnotationPopover(); }
  else closeAnnotationPopover();
}
async function refreshAnnotations() {
  if (!state.active) return;
  const id = state.active.id; const records = await api(`/api/items/${id}/annotations`);
  if (state.active?.id !== id) return; state.annotations = records; renderMarks(); renderAnnotations(); await refreshWorkspace();
  if (!$('#annotation-popover').hidden) {
    const selected = records.find(record => record.id === state.selected);
    if (state.filter !== 'notepad' && selected && selected.resolved !== (state.filter === 'resolved')) { state.filter = selected.resolved ? 'resolved' : 'all'; renderAnnotations(); }
    renderAnnotationPopover();
  }
}
function annotationClipboardText(record, item = state.active, linked = null) {
  const singleLine = value => String(value ?? '').replace(/[\r\n]+/g,' ');
  const quoteBlock = value => String(value).replace(/\r\n?/g,'\n').split('\n').map(line => `> ${line}`).join('\n');
  const folderPath = []; const seen = new Set(); let folderId = item.folder_id;
  while (folderId && !seen.has(folderId)) {
    seen.add(folderId); const folder = state.folders.find(folder => folder.id === folderId); if (!folder) break;
    folderPath.unshift(singleLine(folder.name)); folderId = folder.parent_id;
  }
  const labels = {highlight:'Highlight',underline:'Underline',strike:'Strikethrough',comment:'Commented highlight',pad:'Notepad link'};
  const source = ['# Reading annotation','',`Document: ${singleLine(item.title)}`];
  if (item.filename) source.push(`Original file: ${singleLine(item.filename)}`);
  source.push(`Folder: ${folderPath.join(' / ') || 'Unfiled'}`);
  if (record.anchor.type === 'pdf') {
    const pages = [...new Set(record.anchor.pages.map(page => page.page))].sort((a,b) => a-b);
    source.push(`PDF ${pages.length === 1 ? 'page' : 'pages'}: ${pages.join(', ')}`);
  } else source.push(`Location: ${item.kind === 'note' ? 'Note text' : 'Document text'}`);
  source.push(`Annotation: ${labels[record.kind]}`,`Status: ${record.resolved ? 'Resolved' : 'Open'}`);
  if (record.orphaned) source.push('Source location: The original passage was edited or removed; the saved quotation is preserved.');
  source.push('','## Highlighted source text','',quoteBlock(record.quote));
  if (record.kind === 'pad') {
    const link = linked || notepadEditor?.getPassageLinks().find(link => link.id === record.id);
    if (link) source.push('',`Notepad page: ${linked?.page || state.notepad.pageNumber}`);
    source.push('','## Linked Notepad text','',link ? quoteBlock(link.text) : 'Open Notepad to view the associated text.');
  }
  source.push('','## My comments, questions, and answers (chronological)');
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
  const item = state.active; button.disabled = true;
  let text = annotationClipboardText(record,item);
  try {
    let linked = null;
    if (record.kind === 'pad') {
      const pages = [state.notepad,...state.notepadPages.values()].filter(Boolean);
      for (const pad of pages) {
        const match = pad.editor?.getPassageLinks().find(link => link.id === record.id);
        if (match) { linked = {...match,page:pad.pageNumber}; break; }
      }
      if (!linked) {
        try {
          const located = await api(`/api/items/${item.id}/notepad/links/${record.id}`);
          const match = getSourcePassageLinks(located.notepad.markdown).find(link => link.id === record.id);
          if (match) linked = {...match,page:located.page};
        } catch (error) { if (error.status !== 404) throw error; }
      }
    }
    text = annotationClipboardText(record,item,linked);
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
  const pad = state.filter === 'notepad'; list.hidden = pad; $('#document-notepad').hidden = !pad;
  hidePadSelectionTools();
  if (pad) { ensureNotepad(); return; }
  if (state.definitionTarget?.kind === 'notepad') closeDefinition();
  // Reuse live editors during sync so selection, undo, and drafts stay intact.
  const focusId = document.activeElement?.closest('.reply-form')?.dataset.id;
  const ids = new Set(state.annotations.map(record => record.id));
  for (const [id,form] of state.replyForms) if (!ids.has(id)) { form.markdownEditor.destroy(); state.replyForms.delete(id); state.replyDrafts.delete(id); }
  const scroll = list.scrollTop; list.replaceChildren();
  const records = state.annotations.filter(record => state.filter === 'resolved' ? record.resolved : !record.resolved && (state.filter !== 'comments' || record.comments.length));
  if (!records.length) {
    list.innerHTML = `<div class="annotation-empty"><div class="empty-illustration">${icon(state.filter === 'resolved' ? 'check' : 'comment')}</div><h3>${state.filter === 'resolved' ? 'Answers worth keeping.' : 'Leave a little thought.'}</h3><p>${state.filter === 'resolved' ? 'Resolved questions and threads<br>will live here for a second look.' : 'Select a passage that makes you pause.<br>Ask a question. Make a connection.'}</p>${state.filter === 'resolved' ? '' : '<div class="annotation-tip"><strong>A small tip</strong><br>Your comments highlight their passage,<br>so you can always find your way back.</div>'}</div>`; return;
  }
  for (const record of records) {
    const card = document.createElement('article'); card.className = `annotation-card${state.selected === record.id ? ' selected' : ''}${record.resolved ? ' resolved' : ''}`; card.dataset.annotation = record.id; card.dataset.kind = record.kind;
    const labels = {highlight:'Highlight',underline:'Underlined',strike:'Strikethrough',comment:'A thought',pad:'Notepad link'};
    const location = record.anchor.type === 'pdf' ? ` · p. ${record.anchor.pages.map(page => page.page).join(', ')}` : '';
    card.innerHTML = `<div class="annotation-card-header">${icon(record.comments.length ? 'comment' : 'highlighter')}<span class="annotation-label">${labels[record.kind]}${location}</span><span class="annotation-actions"><button class="icon-button annotation-copy" aria-label="Copy passage and thread for an LLM" title="Copy passage and thread for an LLM">${icon('copy')}</button><button class="icon-button annotation-menu" aria-label="Annotation options">${icon('more')}</button></span></div><button class="annotation-quote ${record.color}" title="Jump to selected passage"><span>${escapeHTML(record.quote.slice(0,350))}${record.quote.length > 350 ? '…' : ''}</span></button>${record.orphaned ? '<div class="orphan-warning">The passage was edited. Your original quote is preserved.</div>' : ''}`;
    $('.annotation-quote',card).onclick = () => focusAnnotation(record.id,true);
    $('.annotation-copy',card).onclick = () => copyAnnotation(record,$('.annotation-copy',card));
    const deleteEntry = {label:record.kind === 'pad' ? 'Remove Notepad link' : 'Delete annotation',icon:'trash',danger:true,run:() => modal(record.kind === 'pad' ? 'Remove this Notepad link?' : 'Delete this annotation?', record.kind === 'pad' ? '<p>The reading mark and link will be removed. Your Notepad text will be kept.</p>' : '<p>The mark and all replies in this thread will be removed.</p>','Delete annotation',async () => {
      if (record.kind === 'pad' && !await flushNotepad()) return;
      await api(`/api/annotations/${record.id}`,{method:'DELETE'});
      if (record.kind === 'pad') await synchronizeNotepad();
      await refreshAnnotations();
    },{danger:true})};
    $('.annotation-menu',card).onclick = event => menu(event.currentTarget,[{label:'Jump to passage',icon:'book',run:() => focusAnnotation(record.id,true)},...(record.kind === 'pad' ? [{label:'Open linked Notepad text',icon:'notepad',run:() => jumpToNotepad(record.id)}] : []),null,deleteEntry]);
    if (record.kind === 'pad') {
      const openPad = document.createElement('button'); openPad.className = 'pad-open button subtle'; openPad.innerHTML = `${icon('notepad')}Open linked Notepad text`;
      openPad.onclick = action(() => jumpToNotepad(record.id)); card.append(openPad);
      list.append(card); continue;
    }
    for (const comment of record.comments) {
      card.insertAdjacentHTML('beforeend',commentMarkup(comment));
    }
    if (!record.resolved) {
      let form = state.replyForms.get(record.id);
      if (!form) { form = replyComposer(record); state.replyForms.set(record.id,form); }
      form.dataset.postLabel = record.comments.length ? 'Reply' : 'Post'; form.setEntryKind(form.dataset.kind);
      card.append(form); form.markdownEditor.view.requestMeasure();
    }
    const resolve = document.createElement('button'); resolve.className = 'resolve-button'; resolve.innerHTML = `${icon('check')}${record.resolved ? 'Resolved · Reopen thread' : 'Mark as resolved'}`;
    resolve.onclick = action(async () => { await api(`/api/annotations/${record.id}`,{method:'PATCH',body:{resolved:!record.resolved}}); await refreshAnnotations(); toast(record.resolved ? 'Thread reopened.' : 'One more question, answered.'); }); card.append(resolve); list.append(card);
  }
  bindCommentTypes(list);
  list.scrollTop = scroll;
  if (focusId && state.replyForms.get(focusId)?.isConnected) state.replyForms.get(focusId).markdownEditor.focus();
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
    else if (message.scope === 'notepad' && message.id === state.active?.id) await synchronizeNotepad();
    else if (message.scope === 'item' && message.id === state.active?.id) await synchronizeActive();
    else if (message.scope === 'workspace' && state.active && !state.items.some(item => item.id === state.active.id)) {
      if (state.dirty) { state.conflict = true; if (state.notepad?.dirty) { state.notepad.conflict = true; updateNotepadState(); } showConflictNotice(); toast('This note was deleted in another window. Download your draft to keep it.',true); }
      else if (state.notepad?.dirty) { state.notepad.conflict = true; state.filter = 'notepad'; openPanel(); renderAnnotations(); updateNotepadState(); }
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
  else { const scroll = $('#reader').scrollTop; state.active = latest; renderHeading(); if (current.kind === 'note') { $('#note-content').innerHTML = latest.content; prepareNoteReading(); noteEditor?.setSource(latest.markdown || ''); renderTextMarks(); } $('#reader').scrollTop = scroll; }
}
async function synchronize() {
  await refreshWorkspace();
  if (state.active && state.items.some(item => item.id === state.active.id)) { await synchronizeActive(); await synchronizeNotepad(); await refreshAnnotations(); if (state.dirty && !state.conflict) await saveNote(); if (state.notepad?.dirty && !state.notepad.conflict) await saveNotepad(); }
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
  if (event.key === 'notate-notepad-text-color') setNotepadTextColor(readLocal('notate-notepad-text-color','red'),false);
  if (event.key === 'notate-popup-preferences') {
    state.popupPreferences = readLocal('notate-popup-preferences',{}); updatePopupToggle();
    if (!popupsEnabled()) closeAnnotationPopover();
  }
  if (event.key === 'notate-navigation-collapsed') {
    layout.navigationCollapsed = readLocal('notate-navigation-collapsed', false) === true;
    closeNavigationDrawer(); updatePaneWidth(); scheduleReaderLayout();
  }
  if (event.key === 'notate-notes-width' && !layout.drag) {
    const width = readLocal('notate-notes-width', null); layout.notesWidth = Number.isFinite(width) ? width : null;
    updatePaneWidth(); scheduleReaderLayout();
  }
});
for (const id of ['import','sidebar-import']) $(`#${id}`).onclick = () => $('#file-input').click();
$('#file-input').onchange = action(async event => { const files = [...event.target.files]; event.target.value = ''; await importFiles(files); });
$('#search').oninput = event => { state.query = event.target.value; renderNavigation(); };
$$('.nav-button').forEach(button => { button.onclick = () => chooseView(button.dataset.view); });
$('#document-menu').onclick = event => showDocumentMenu(event.currentTarget);
$('#toggle-workspace-fullscreen').onclick = () => setWorkspaceFullscreen(!layout.fullscreen);
function toggleAnnotations() {
  const workspace = $('#reading-workspace');
  if (innerWidth <= 860) workspace.classList.toggle('panel-mobile-open');
  else workspace.classList.toggle('panel-hidden');
  updatePaneWidth(); scheduleReaderLayout(true);
}
$('#toggle-annotations').onclick = toggleAnnotations;
$('#reader-toggle-annotations').onclick = toggleAnnotations;
$('#close-annotations').onclick = () => {
  $('#reading-workspace').classList.add('panel-hidden'); $('#reading-workspace').classList.remove('panel-mobile-open');
  $(layout.fullscreen ? '#reader-toggle-annotations' : '#toggle-annotations').focus({preventScroll: true});
  updatePaneWidth(); scheduleReaderLayout(true);
};
$$('[data-filter]').forEach(button => { button.onclick = () => { state.filter = button.dataset.filter; renderAnnotations(); }; });
$('#sidebar-toggle').onclick = () => {
  if (innerWidth > 640) setNavigationCollapsed(!layout.navigationCollapsed);
  else if ($('#sidebar').classList.contains('open')) closeNavigationDrawer(); else revealNavigation();
};
$('#sidebar-collapse').onclick = () => innerWidth <= 640 ? closeNavigationDrawer() : setNavigationCollapsed(!layout.navigationCollapsed);
$('#panel-resizer').addEventListener('pointerdown', event => {
  if (event.button !== 0 || !event.isPrimary || innerWidth <= 860) return;
  event.preventDefault(); hideSelection(); getSelection().removeAllRanges();
  layout.drag = {pointerId: event.pointerId, startX: event.clientX, startWidth: $('#annotations-panel').getBoundingClientRect().width};
  clearTimeout(layout.resizeTimer); document.body.classList.add('resizing-panels');
  event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus();
});
$('#panel-resizer').addEventListener('pointermove', event => {
  if (layout.drag?.pointerId === event.pointerId) resizeNotesPane(layout.drag.startWidth + layout.drag.startX - event.clientX);
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) $('#panel-resizer').addEventListener(type, event => {
  if (layout.drag?.pointerId === event.pointerId) finishPaneResize();
});
$('#panel-resizer').addEventListener('keydown', event => {
  const {min, max} = paneWidthLimits(); const current = $('#annotations-panel').getBoundingClientRect().width; const step = event.shiftKey ? 40 : 10;
  const width = {ArrowLeft: current + step, ArrowRight: current - step, Home: min, End: max}[event.key];
  if (width === undefined) return; event.preventDefault(); resizeNotesPane(width, true);
});
$('#panel-resizer').ondblclick = () => {
  layout.notesWidth = null; writeLocal('notate-notes-width', null); updatePaneWidth(); scheduleReaderLayout(true);
};
$('#previous-page').onclick = () => goToPage(state.page-1); $('#next-page').onclick = () => goToPage(state.page+1);
$('#current-page').onchange = event => goToPage(Number(event.target.value) || 1);
$('#zoom-out').onclick = () => zoomPDF(-1); $('#zoom-in').onclick = () => zoomPDF(1); $('#zoom-fit').onclick = () => zoomPDF(0);
$('#save-state').onclick = action(() => { if (state.conflict) return reviewConflict(); });
$$('[data-format]').forEach(button => {
  button.onmousedown = event => event.preventDefault(); button.onclick = () => noteEditor?.format(button.dataset.format);
});
$('#markdown-preview-toggle').onmousedown = event => event.preventDefault();
$('#markdown-preview-toggle').onclick = () => {
  state.livePreview = !state.livePreview; writeLocal('notate-live-preview',state.livePreview);
  noteEditor?.setPreview(state.livePreview); updateEditorPreview(); noteEditor?.focus();
};
$('#insert-table').onmousedown = event => event.preventDefault();
$('#insert-table').onclick = () => insertTableDialog(noteEditor);
function insertTableDialog(editor) {
  if (!editor) return;
  modal('Insert a table', '<label for="table-columns">Columns</label><input id="table-columns" name="columns" type="number" min="1" max="12" value="3" required><label for="table-rows">Rows below the header</label><input id="table-rows" name="rows" type="number" min="1" max="50" value="2" required><p class="table-help">Click a cell to edit its Markdown. Move outside the table to see its formatted appearance.</p>', 'Insert table', async data => {
    const rows = Number(data.get('rows')), columns = Number(data.get('columns'));
    if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || rows > 50 || columns < 1 || columns > 12) throw new Error('Use 1–12 columns and 1–50 rows.');
    if (!editor.view.dom.isConnected) throw new Error('Open the editor again to insert a table.');
    editor.insertTable(rows,columns); requestAnimationFrame(() => editor.focus());
  });
}
$$('[data-notepad-format]').forEach(button => {
  button.onmousedown = event => event.preventDefault(); button.onclick = () => notepadEditor?.format(button.dataset.notepadFormat);
});
$('#notepad-table').onmousedown = event => event.preventDefault();
$('#notepad-table').onclick = () => insertTableDialog(notepadEditor);
$('#notepad-source').onmousedown = event => event.preventDefault();
$('#notepad-source').onclick = () => {
  const pad = state.notepad; if (!pad) return;
  pad.sourceMode = !pad.sourceMode; $('#notepad-source').setAttribute('aria-pressed',pad.sourceMode);
  $('#notepad-source').title = pad.sourceMode ? 'Show live Markdown formatting' : 'Show Markdown source';
  notepadEditor.setPreview(!pad.sourceMode); notepadEditor.focus();
};
$('#notepad-color-palette').innerHTML = TEXT_COLORS.map(color => `<button type="button" data-notepad-color="${color}" title="${textColorLabels[color]}" aria-label="${textColorLabels[color]} text" aria-pressed="false"><span style="background:var(--text-color-${color})" aria-hidden="true"></span></button>`).join('');
updateNotepadPalette();
for (const button of $$('#notepad-selection-toolbar button')) button.onmousedown = event => event.preventDefault();
$$('[data-notepad-color]').forEach(button => { button.onclick = () => {
  setNotepadTextColor(button.dataset.notepadColor); applyEditorTextColor();
  state.padColorMenu = false; editorContext()?.editor.focus(); schedulePadSelectionTools();
}; });
for (const [id,kind] of [['notepad-color-toggle','notepad'],['note-color-toggle','note']]) {
  $(`#${id}`).onmousedown = event => event.preventDefault();
  $(`#${id}`).onclick = () => {
    const context = editorContext(kind); if (!context || kind === 'notepad' && (state.linkingPad || state.pendingPadLink)) return;
    const same = state.formattingEditor === kind; state.formattingEditor = kind;
    if (same && !$('#notepad-selection-toolbar').hidden) hidePadSelectionTools();
    else { state.padColorMenu = true; updatePadSelectionTools(); }
  };
}
$('#notepad-underline').onclick = () => { editorContext()?.editor.format('underline'); schedulePadSelectionTools(); };
$('#notepad-apply-color').onclick = () => applyEditorTextColor();
$('#notepad-define').onclick = beginDefinition;
$('#note-define').onmousedown = $('#note-hyperlink').onmousedown = event => event.preventDefault();
$('#note-define').onclick = () => { state.formattingEditor = 'note'; beginDefinition(); };
$('#note-hyperlink').onclick = beginNoteHyperlink;
$('#note-download').onclick = action(async () => {
  if (!state.active || !await flushNote()) return;
  downloadBlob(new Blob([state.active.markdown],{type:'text/markdown;charset=utf-8'}),`${state.active.title.replace(/[^a-z\d -]/gi,'').slice(0,80) || 'note'}.md`);
});
$('#notepad-definition-edit').onclick = editDefinition;
$('#notepad-definition-remove').onclick = () => {
  const target = editableDefinitionTarget(); if (!target) return;
  if (!target.editor.removeDefinition(target)) { toast('The marked text or definition changed. Open its current definition again.',true); return; }
  closeDefinition(); schedulePadSelectionTools();
};
for (const id of ['notepad-definition-close','notepad-definition-cancel']) $(`#${id}`).onclick = () => {
  const target = state.definitionTarget; closeDefinition();
  if (target?.kind === 'note' && !state.editing) $('#reader').focus({preventScroll:true}); else target?.editor?.focus();
  schedulePadSelectionTools();
};
$('#notepad-definition-form').onsubmit = event => { event.preventDefault(); saveDefinition(); };
new ResizeObserver(scheduleDefinition).observe($('#notepad-definition-popover'));
$('#notepad-save-state').onclick = action(async () => state.notepad?.conflict ? reviewNotepadConflict() : state.notepad ? saveNotepad() : ensureNotepad());
$('#notepad-previous-page').onclick = action(() => switchNotepadPage(state.notepad.pageNumber-1));
$('#notepad-next-page').onclick = action(() => switchNotepadPage(state.notepad.pageNumber+1));
$('#notepad-add-page').onclick = action(() => switchNotepadPage(null,true));
$('#notepad-download').onclick = downloadNotepad;
$('#notepad-link').onmousedown = $('#link-pad-selection').onmousedown = event => event.preventDefault();
$('#notepad-link').onclick = action(beginPadLink);
$('#link-pad-selection').onclick = action(() => state.formattingEditor === 'note' ? beginNoteHyperlink() : beginPadLink());
$('#cancel-pad-link').onclick = cancelPadLink;
$('#notepad-editor').addEventListener('focusout',schedulePadSelectionTools);
$('#notepad-editor').addEventListener('scroll',() => { schedulePadSelectionTools(); scheduleDefinition(); },true);
$('#reader').addEventListener('pointerdown',() => $('#reader').classList.add('selecting'));
$('#reader').addEventListener('pointerup',event => {
  $('#reader').classList.remove('selecting');
  if (event.target.closest('.annotation-mark')) return;
  if ((event.ctrlKey || event.metaKey) && event.target.closest('[data-definition-from]')) return;
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
  hideSelection(); schedulePadSelectionTools(); scheduleDefinition(); schedulePopupPosition(); clearTimeout(scrollTimer); scrollTimer = setTimeout(() => {
    if (!state.pdf) return; const top = $('#reader').getBoundingClientRect().top+40;
    const page = $$('.pdf-page').find(element => element.getBoundingClientRect().bottom > top);
    if (page) { state.page = Number(page.dataset.page); $('#current-page').value = state.page; releaseDistantCanvases(); }
  },100);
},{passive:true});
document.addEventListener('pointerdown',event => {
  if (!event.target.closest('#notepad-definition-popover,#notepad-define,#note-define') && !((event.ctrlKey || event.metaKey) && event.target.closest('[data-definition-from]'))) closeDefinition();
  if (!event.target.closest('#notepad-editor,#note-editor,#notepad-selection-toolbar,#notepad-link,#notepad-color-toggle,#note-color-toggle,#note-define,#note-hyperlink')) hidePadSelectionTools();
  if (!event.target.closest('#floating-menu,#selection-color,.annotation-menu,.folder-menu,#document-menu')) $('#floating-menu').hidden = true;
  if (!event.target.closest('#selection-toolbar,#comment-popover,#reader')) hideSelection();
  if (!event.target.closest('#sidebar,#sidebar-toggle,#floating-menu,#modal')) closeNavigationDrawer();
  if (!event.target.closest('#annotation-popover,#reader,#toggle-popups,#theme-toggle,.annotation-quote')) closeAnnotationPopover();
});
document.addEventListener('keydown',event => {
  if (event.key === 'Escape') {
    const dismissing = event.defaultPrevented || $('#modal').open || state.pendingPadLink || layout.drag ||
      $$('#notepad-definition-popover,#notepad-selection-toolbar,#selection-toolbar,#annotation-popover,#comment-popover,#floating-menu').some(node => !node.hidden);
    closeDefinition(); hidePadSelectionTools(); cancelPadLink(); hideSelection(); closeAnnotationPopover(); $('#comment-popover').hidden = true; $('#floating-menu').hidden = true; closeNavigationDrawer(); finishPaneResize();
    if (layout.fullscreen && !dismissing) setWorkspaceFullscreen(false);
  }
  if (!(event.metaKey || event.ctrlKey)) return;
  if (event.key.toLowerCase() === 'k') { event.preventDefault(); if (layout.fullscreen) setWorkspaceFullscreen(false); ($('#sidebar').inert ? $('#sidebar-toggle') : $('#search')).focus(); }
  if (event.key.toLowerCase() === 's') { event.preventDefault(); saveNote(); saveNotepad(); }
  if (event.key.toLowerCase() === 'n' && !$('#modal').open) { event.preventDefault(); newNoteDialog(); }
});
window.addEventListener('beforeunload',event => { if (state.dirty || state.notepad?.dirty) { event.preventDefault(); event.returnValue = ''; } });
document.addEventListener('visibilitychange',() => { if (document.hidden) { if (state.dirty) saveNote(); if (state.notepad?.dirty) saveNotepad(); } else if (state.loaded && state.connected) synchronize().catch(() => {}); });
let mobileNavigation = innerWidth <= 640;
window.addEventListener('resize',() => {
  scheduleDefinition();
  hideSelection();
  if (innerWidth <= 860) finishPaneResize();
  if (mobileNavigation !== (innerWidth <= 640)) { mobileNavigation = innerWidth <= 640; closeNavigationDrawer(); }
  updateNavigationLayout(); updatePaneWidth(); scheduleReaderLayout();
});
let observedReaderWidth = 0;
new ResizeObserver(entries => {
  const width = entries[0].contentRect.width;
  if (Math.abs(width - observedReaderWidth) > .5) { observedReaderWidth = width; hideSelection(); scheduleReaderLayout(); }
}).observe($('#reader'));
let dragDepth = 0;
document.addEventListener('dragenter',event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); dragDepth++; $('#drop-overlay').hidden = false; } });
document.addEventListener('dragleave',() => { dragDepth = Math.max(0,dragDepth-1); if (!dragDepth) $('#drop-overlay').hidden = true; });
document.addEventListener('dragover',event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } });
document.addEventListener('drop',action(async event => { event.preventDefault(); dragDepth = 0; $('#drop-overlay').hidden = true; await importFiles([...event.dataTransfer.files]); }));
updateNavigationLayout(); updatePaneWidth();
document.documentElement.dataset.notateReady = 'true';
boot();
