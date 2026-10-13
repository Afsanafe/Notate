// This file is bundled into static/vendor/note-editor.js. No CDN or build step
// is needed to run Notate; npm is only used when developing the editor.
import {EditorState, EditorSelection, StateField, StateEffect, Transaction, Prec, Facet, Compartment} from '@codemirror/state';
import {EditorView, Decoration, WidgetType, keymap, drawSelection, dropCursor, placeholder} from '@codemirror/view';
import {defaultKeymap, history, historyKeymap, indentWithTab, isolateHistory, insertNewline} from '@codemirror/commands';
import {syntaxTree, ensureSyntaxTree} from '@codemirror/language';
import {markdown, insertNewlineContinueMarkup} from '@codemirror/lang-markdown';
import {Table, Strikethrough} from '@lezer/markdown';
import MarkdownIt from 'markdown-it';

const renderer = new MarkdownIt({html: false, breaks: true});
// Notes' safe reading view has no embedded images. Table previews likewise
// display image labels without fetching remote assets.
renderer.renderer.rules.image = (tokens, index) => renderer.utils.escapeHtml(tokens[index].content);
const changePreview = StateEffect.define();
const passageLinkHandler = Facet.define({combine: values => values[0]});
function passageLink(state, node) {
  if (node.name !== 'Link') return null;
  const match = /^\[([\s\S]*?)\]\(#notate-passage-([a-f0-9]{32})\)$/.exec(state.doc.sliceString(node.from,node.to));
  return match ? {id: match[2], from: node.from, to: node.to, start: node.from + 1, end: node.from + 1 + match[1].length, text: match[1]} : null;
}
function passageLinks(state) {
  const links = [];
  const tree = ensureSyntaxTree(state,state.doc.length,100) || syntaxTree(state);
  tree.iterate({enter(node) { const link = passageLink(state,node); if (link) links.push(link); }});
  return links;
}
function activatePassageLink(view, event) {
  const link = event.target.closest?.('[data-passage-link]'); const handler = view.state.facet(passageLinkHandler);
  if (!link || !handler || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  event.preventDefault(); handler(link.dataset.passageLink); return true;
}
const previewEnabled = StateField.define({
  create: () => true,
  update: (value, transaction) => transaction.effects.find(effect => effect.is(changePreview))?.value ?? value
});

function styleInlineAnswers(container) {
  container.querySelectorAll('strong').forEach(label => {
    if (label.textContent !== 'Answ:') return;
    let sibling = label.nextSibling;
    while (sibling?.nodeType === Node.TEXT_NODE && !sibling.textContent.trim()) sibling = sibling.nextSibling;
    if (sibling?.nodeName === 'EM') { label.classList.add('md-answer-label'); sibling.classList.add('md-answer-text'); }
  });
}
function isAnswerLabel(state, node) {
  return node?.name === 'StrongEmphasis' && /^(?:\*\*Answ:\*\*|__Answ:__)$/.test(state.doc.sliceString(node.from,node.to));
}
function isAnswerText(state, node) {
  const label = node.node.prevSibling;
  return node.name === 'Emphasis' && isAnswerLabel(state,label) && /^[ \t]*$/.test(state.doc.sliceString(label.to,node.from));
}

class Bullet extends WidgetType {
  toDOM() { const span = document.createElement('span'); span.className = 'md-bullet'; span.textContent = '•'; return span; }
}

class TablePreview extends WidgetType {
  constructor(source, from, cells) { super(); this.source = source; this.from = from; this.cells = cells; }
  eq(other) { return this.source === other.source && this.from === other.from; }
  toDOM(view) {
    const container = document.createElement('div'); container.className = 'md-table-preview';
    // markdown-it has HTML disabled and rejects unsafe link protocols.
    container.innerHTML = renderer.render(this.source);
    styleInlineAnswers(container);
    container.querySelectorAll('a').forEach(link => {
      const match = /^#notate-passage-([a-f0-9]{32})$/.exec(link.getAttribute('href'));
      if (!match) return;
      link.classList.add('md-pad-link'); link.dataset.passageLink = match[1];
      link.title = 'Jump to reading passage · ⌘/Ctrl-click to edit';
      link.addEventListener('click', event => { event.preventDefault(); });
      link.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') activatePassageLink(view,event); });
    });
    container.setAttribute('aria-label', 'Markdown table. Click a cell to edit.');
    container.querySelectorAll('th,td').forEach((cell, index) => {
      cell.title = 'Click to edit this cell’s Markdown';
      cell.addEventListener('pointerdown', event => {
        if (activatePassageLink(view,event)) return;
        event.preventDefault();
        const target = this.cells[index];
        const linked = event.target.closest('[data-passage-link]');
        const passage = linked && passageLinks(view.state).find(link => link.id === linked.dataset.passageLink);
        const from = passage?.start ?? target?.from ?? this.from;
        const to = passage?.end ?? target?.to ?? from;
        if (target?.missing) {
          // Markdown permits short rows; materialize any omitted cells only
          // when the user clicks one of those cells to edit it.
          const insert = (target.trailing ? '' : ' |') + '   |'.repeat(target.missing);
          view.dispatch({changes: {from, insert}, selection: {anchor: from + insert.length - 2}, scrollIntoView: true, userEvent: 'input'});
        } else view.dispatch({selection: EditorSelection.single(from, to), scrollIntoView: true});
        view.focus();
      });
    });
    return container;
  }
  ignoreEvent() { return true; }
}

function liveDecorations(state) {
  const preview = state.field(previewEnabled);
  const ranges = [], styledLines = new Set();
  const active = (from, to = from) => state.selection.ranges.some(range =>
    state.doc.lineAt(range.from).from <= to && state.doc.lineAt(range.to).to >= from);
  const hide = (from, to) => { if (to > from) ranges.push(Decoration.replace({}).range(from, to)); };
  const mark = (from, to, className, tagName, attributes) => {
    if (to > from) ranges.push(Decoration.mark({class: className, tagName, attributes}).range(from, to));
  };
  const lineStyle = (from, className) => {
    const line = state.doc.lineAt(from), key = `${line.number}:${className}`;
    if (!styledLines.has(key)) { styledLines.add(key); ranges.push(Decoration.line({class: className}).range(line.from)); }
  };
  syntaxTree(state).iterate({enter(node) {
    const {name, from, to} = node;
    const passage = passageLink(state,node);
    if (passage) {
      mark(passage.start,passage.end,'md-pad-link',null,{'data-passage-link':passage.id,role:'link',tabindex:'0',title:'Jump to reading passage · ⌘/Ctrl-click to edit'});
      if (preview) { hide(from,passage.start); hide(passage.end,to); }
    }
    if (!preview) return;
    const answerLabel = isAnswerLabel(state,node), answerText = isAnswerText(state,node);
    if (name === 'Table' && active(from, to)) {
      for (let number = state.doc.lineAt(from).number; number <= state.doc.lineAt(to).number; number++) lineStyle(state.doc.line(number).from, 'md-table-source');
    }
    if (name === 'Table' && !active(from, to)) {
      const cells = [];
      let columns = 0;
      for (let row = node.node.firstChild; row; row = row.nextSibling) {
        if (row.name !== 'TableHeader' && row.name !== 'TableRow') continue;
        // The parser omits TableCell nodes for empty cells. Delimiter positions
        // retain those cells and correctly ignore escaped pipes within text.
        let start = row.from, end = row.to;
        while (start < end && /\s/.test(state.doc.sliceString(start, start + 1))) start++;
        while (end > start && /\s/.test(state.doc.sliceString(end - 1, end))) end--;
        const rowCells = [];
        const addCell = (begin, finish) => {
          const text = state.doc.sliceString(begin, finish);
          if (!text.trim()) { const position = begin + (text.startsWith(' ') ? 1 : 0); rowCells.push({from: position, to: position}); }
          else rowCells.push({from: begin + text.length - text.trimStart().length, to: begin + text.trimEnd().length});
        };
        let cellStart = start;
        for (let child = row.firstChild; child; child = child.nextSibling) {
          if (child.name !== 'TableDelimiter') continue;
          if (child.from > start) addCell(cellStart, child.from);
          cellStart = child.to;
        }
        if (cellStart < end) addCell(cellStart, end);
        if (row.name === 'TableHeader') columns = rowCells.length;
        for (let index = 0; index < columns; index++) cells.push(rowCells[index] || {
          from: end, to: end, missing: index - rowCells.length + 1, trailing: state.doc.sliceString(end - 1, end) === '|'
        });
      }
      ranges.push(Decoration.replace({block: true, widget: new TablePreview(state.doc.sliceString(from, to), from, cells)}).range(from, to));
      return false;
    }
    const heading = /^(?:ATX|Setext)Heading([1-6])$/.exec(name);
    if (heading && !active(from, to)) lineStyle(from, `md-heading md-h${heading[1]}`);
    if (name === 'Blockquote') {
      for (let number = state.doc.lineAt(from).number; number <= state.doc.lineAt(to).number; number++) {
        const line = state.doc.line(number); if (!active(line.from, line.to)) lineStyle(line.from, 'md-quote');
      }
    }
    if (name === 'FencedCode' || name === 'CodeBlock') {
      for (let number = state.doc.lineAt(from).number; number <= state.doc.lineAt(to).number; number++) lineStyle(state.doc.line(number).from, 'md-code-block');
    }
    // Answer text keeps its color and emphasis while the current line exposes
    // Markdown syntax for editing, as well as after that line is completed.
    if (answerLabel) mark(from,to,'md-strong md-answer-label','strong');
    if (answerText) mark(from,to,'md-emphasis md-answer-text','em');
    if (active(from, to)) return;
    if (name === 'HeaderMark' || name === 'QuoteMark') {
      hide(from, to + (state.doc.sliceString(to, to + 1) === ' ' ? 1 : 0));
    } else if (name === 'ListMark' && /^[*+-]$/.test(state.doc.sliceString(from, to))) {
      ranges.push(Decoration.replace({widget: new Bullet()}).range(from, to));
    } else if (name === 'StrongEmphasis' && !answerLabel) mark(from, to, 'md-strong', 'strong');
    else if (name === 'Emphasis' && !answerText) mark(from, to, 'md-emphasis', 'em');
    else if (name === 'Strikethrough') mark(from, to, 'md-strike', 's');
    else if (name === 'InlineCode') mark(from, to, 'md-inline-code', 'code');
    else if (name === 'EmphasisMark' || name === 'StrikethroughMark' || name === 'CodeMark') hide(from, to);
    else if (name === 'Escape') hide(from, from + 1);
    else if (name === 'Link' && !passage) {
      const match = /^\[([\s\S]*?)\]\([\s\S]*\)$/.exec(state.doc.sliceString(from, to));
      if (match) { hide(from, from + 1); mark(from + 1, from + 1 + match[1].length, 'md-link'); hide(from + 1 + match[1].length, to); }
    }
  }});
  return Decoration.set(ranges, true);
}

const livePreview = StateField.define({
  create: state => liveDecorations(state),
  update: (value, transaction) => transaction.docChanged || transaction.selection || transaction.effects.length
    ? liveDecorations(transaction.state) : value,
  provide: field => EditorView.decorations.from(field)
});

export function createNoteEditor(parent, source, onChange, preview = true, options = {}) {
  let suppressChange = false;
  const editing = new Compartment();
  parent.classList.add('markdown-editor');
  const view = new EditorView({parent, state: EditorState.create({doc: source, extensions: [
    markdown({extensions: [Table, Strikethrough], completeHTMLTags: false}),
    history(), drawSelection(), dropCursor(), EditorView.lineWrapping,
    editing.of([EditorState.readOnly.of(false), EditorView.editable.of(true)]),
    EditorView.contentAttributes.of({'aria-label': options.ariaLabel || 'Note Markdown editor', spellcheck: 'true', autocapitalize: 'sentences'}),
    placeholder(options.placeholder || 'Start writing… Use # for a heading, **bold**, or the table button above.'),
    EditorState.transactionFilter.of(transaction => transaction.docChanged && transaction.newDoc.length > (options.maxLength || 5_000_000) ? [] : transaction),
    previewEnabled, livePreview,
    passageLinkHandler.of(options.onPassageLink),
    EditorView.domEventHandlers({
      pointerdown: (event, editor) => event.button === 0 && activatePassageLink(editor,event),
      keydown: (event, editor) => (event.key === 'Enter' || event.key === ' ') && activatePassageLink(editor,event)
    }),
    Prec.high(keymap.of([
      {key: 'Mod-b', run: () => { format('bold'); return true; }},
      {key: 'Mod-i', run: () => { format('italic'); return true; }},
      {key: 'Mod-e', run: () => { insertAnswer(); return true; }},
      {key: 'Enter', run: finishAnswerLine},
      ...(options.onSubmit ? [{key:'Mod-Enter', run: () => { options.onSubmit(); return true; }}] : [])
    ])),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    EditorView.updateListener.of(update => {
      if (update.docChanged && !suppressChange) onChange(update.state.doc.toString());
      if (update.selectionSet || update.docChanged || update.geometryChanged || update.focusChanged) options.onSelectionChange?.(update.state.selection.main, update);
    })
  ]})});
  if (!preview) view.dispatch({effects: changePreview.of(false)});
  function wrap(marker) {
    const {from, to} = view.state.selection.main, selected = view.state.doc.sliceString(from, to);
    const text = selected || ' ';
    const surrounding = view.state.doc.sliceString(Math.max(0, from - marker.length), to + marker.length);
    if (selected && surrounding === marker + selected + marker) {
      view.dispatch({changes: {from: from - marker.length, to: to + marker.length, insert: selected},
        selection: EditorSelection.single(from - marker.length, to - marker.length), userEvent: 'input', annotations:isolateHistory.of('full')});
    } else {
      view.dispatch({changes: {from, to, insert: marker + text + marker},
        selection: EditorSelection.single(from + marker.length, from + marker.length + text.length), userEvent: 'input', annotations:isolateHistory.of('full')});
    }
    view.focus();
  }
  function format(kind) {
    if (view.state.readOnly) return;
    if (kind === 'bold' || kind === 'italic') return wrap(kind === 'bold' ? '**' : '*');
    const {from, to} = view.state.selection.main;
    const first = view.state.doc.lineAt(from), last = view.state.doc.lineAt(to);
    const prefix = kind === 'heading' ? '## ' : kind === 'list' ? '- ' : kind === 'quote' ? '> ' : '';
    const lines = [];
    for (let number = first.number; number <= last.number; number++) {
      const text = view.state.doc.line(number).text.replace(/^(?:#{1,6}\s+|>\s?|[-+*]\s+|\d+[.)]\s+)/, '');
      lines.push(prefix + text);
    }
    const insert = lines.join('\n');
    view.dispatch({changes: {from: first.from, to: last.to, insert}, selection: {anchor: first.from + insert.length}, userEvent: 'input', annotations:isolateHistory.of('full')}); view.focus();
  }
  function insertAnswer() {
    if (view.state.readOnly) return;
    const {from, to} = view.state.selection.main;
    const selected = view.state.doc.sliceString(from,to), text = selected || ' ';
    const prefix = '**Answ:** *';
    view.dispatch({changes:{from,to,insert:prefix+text+'*'},
      selection:selected ? {anchor:from+prefix.length+text.length}
        : EditorSelection.single(from+prefix.length,from+prefix.length+text.length),
      userEvent:'input',annotations:isolateHistory.of('full')});
    view.focus();
  }
  function finishAnswerLine() {
    const selection = view.state.selection.main;
    if (!selection.empty) return false;
    let node = syntaxTree(view.state).resolveInner(selection.head,-1);
    while (node && node.name !== 'Emphasis') node = node.parent;
    if (!node || !isAnswerText(view.state,node) || selection.head !== node.to-1) return false;
    // Typing at the end of the inserted answer then pressing Enter finishes
    // its italic span and starts a normal line (including list continuation).
    view.dispatch({selection:{anchor:node.to}});
    return insertNewlineContinueMarkup(view) || insertNewline(view);
  }
  return {
    view, format, insertAnswer,
    setReadOnly: value => view.dispatch({effects: editing.reconfigure([EditorState.readOnly.of(value), EditorView.editable.of(!value)])}),
    getSource: () => view.state.doc.toString(),
    getPassageLinks: () => passageLinks(view.state),
    revealPassageLink(id) {
      const link = passageLinks(view.state).find(link => link.id === id); if (!link) return false;
      view.dispatch({selection: EditorSelection.single(link.start,link.end), effects: EditorView.scrollIntoView(link.start,{y:'center'}), annotations: Transaction.addToHistory.of(false)});
      view.focus(); return true;
    },
    selectionCanLink() {
      const {from,to,empty} = view.state.selection.main;
      if (empty || !view.state.doc.sliceString(from,to).trim() || /\n\s*\n/.test(view.state.doc.sliceString(from,to))) return false;
      let allowed = true;
      syntaxTree(view.state).iterate({from,to,enter(node) {
        if (['Link','Image','InlineCode','FencedCode','CodeBlock'].includes(node.name) && node.from < to && node.to > from) allowed = false;
      }});
      return allowed;
    },
    setSource(value) {
      if (value === view.state.doc.toString()) return;
      suppressChange = true;
      try { view.dispatch({changes: {from: 0, to: view.state.doc.length, insert: value},
        selection: {anchor: Math.min(view.state.selection.main.head, value.length)}, annotations: Transaction.addToHistory.of(false)}); }
      finally { suppressChange = false; }
    },
    setPreview: enabled => view.dispatch({effects: changePreview.of(enabled)}),
    insertTable(rows, columns) {
      if (view.state.readOnly) return;
      const {from, to} = view.state.selection.main;
      const row = cells => `| ${cells.join(' | ')} |`;
      const table = [row(Array.from({length: columns}, (_, index) => `Column ${index + 1}`)),
        row(Array(columns).fill('---')), ...Array.from({length: rows}, () => row(Array(columns).fill(' ')))].join('\n');
      const before = view.state.doc.sliceString(0, from), after = view.state.doc.sliceString(to);
      const prefix = before ? before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n' : '';
      const suffix = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
      const insert = prefix + table + suffix;
      view.dispatch({changes: {from, to, insert}, selection: {anchor: from + prefix.length + table.length + suffix.length}, scrollIntoView: true, userEvent: 'input', annotations:isolateHistory.of('full')}); view.focus();
    },
    focus: () => view.focus(),
    destroy: () => view.destroy()
  };
}
