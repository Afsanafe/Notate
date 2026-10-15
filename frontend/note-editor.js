// This file is bundled into static/vendor/note-editor.js. No CDN or build step
// is needed to run Notate; npm is only used when developing the editor.
import {EditorState, EditorSelection, StateField, StateEffect, Transaction, Prec, Facet, Compartment} from '@codemirror/state';
import {EditorView, Decoration, WidgetType, keymap, drawSelection, dropCursor, placeholder} from '@codemirror/view';
import {defaultKeymap, history, historyKeymap, indentWithTab, isolateHistory, insertNewline} from '@codemirror/commands';
import {syntaxTree, ensureSyntaxTree, indentUnit} from '@codemirror/language';
import {markdown, insertNewlineContinueMarkup} from '@codemirror/lang-markdown';
import {Table, Strikethrough} from '@lezer/markdown';
import MarkdownIt from 'markdown-it';

const renderer = new MarkdownIt({html: false, breaks: true});
export const TEXT_COLORS = ['red','orange','yellow','light-green','dark-green','light-blue','dark-blue','purple'];
const colorOpening = /^<span class="md-text-(red|orange|yellow|light-green|dark-green|light-blue|dark-blue|purple)">/;
const definitionOpening = /^<span class="md-definition" data-definition="((?:[a-zA-Z0-9_.!~*'()-]|%[a-fA-F0-9]{2})*)">/;
function decodeDefinition(encoded) {
  try { const value = decodeURIComponent(encoded); return value.trim() && value.length <= 20_000 ? value : null; }
  catch { return null; }
}
const colorDelimiter = {}, underlineDelimiter = {};
const textFormatting = {
  defineNodes: ['TextColor','Underline','DefinedText','TextFormatMark'],
  parseInline: [{name:'NotateTextFormat',before:'HTMLTag',parse(cx,next,pos) {
    if (next !== 60) return -1;
    const source = cx.slice(pos,cx.end), color = colorOpening.exec(source);
    if (color) return cx.addDelimiter(colorDelimiter,pos,pos+color[0].length,true,false);
    const definition = definitionOpening.exec(source);
    if (definition && decodeDefinition(definition[1]) !== null) return cx.addDelimiter(colorDelimiter,pos,pos+definition[0].length,true,false);
    if (source.startsWith('<u>')) return cx.addDelimiter(underlineDelimiter,pos,pos+3,true,false);
    const closing = source.startsWith('</span>') ? {type:colorDelimiter,name:'TextColor',length:7}
      : source.startsWith('</u>') ? {type:underlineDelimiter,name:'Underline',length:4} : null;
    if (!closing) return -1;
    const index = cx.findOpeningDelimiter(closing.type); if (index === null) return -1;
    const opening = cx.getDelimiterAt(index), content = cx.takeContent(index);
    const name = definitionOpening.test(cx.slice(opening.from,opening.to)) ? 'DefinedText' : closing.name;
    return cx.addElement(cx.elt(name,opening.from,pos+closing.length,[
      cx.elt('TextFormatMark',opening.from,opening.to),...content,cx.elt('TextFormatMark',pos,pos+closing.length)
    ]));
  }}]
};
// Table previews permit only our exact formatting tags, with all other HTML
// still escaped by markdown-it. Children keep normal Markdown formatting.
renderer.inline.ruler.before('html_inline','notate_text_format',(state,silent) => {
  const source = state.src.slice(state.pos), color = colorOpening.exec(source);
  const definition = definitionOpening.exec(source);
  const defined = definition && decodeDefinition(definition[1]) !== null;
  const opening = color?.[0] || (defined ? definition[0] : source.startsWith('<u>') ? '<u>' : null);
  if (opening) {
    const closing = color || defined ? '</span>' : '</u>';
    if (!source.includes(closing,opening.length)) return false;
    if (!silent) {
      const token = state.push('notate_format_open',color || defined ? 'span' : 'u',1);
      if (color) token.attrSet('class',`md-text-${color[1]}`);
      if (defined) { token.attrSet('class','md-definition'); token.attrSet('data-definition',definition[1]); }
    }
    state.pos += opening.length; return true;
  }
  const closing = source.startsWith('</span>') ? '</span>' : source.startsWith('</u>') ? '</u>' : null;
  if (!closing) return false;
  const tag = closing === '</span>' ? 'span' : 'u';
  let depth = 0, matched = false;
  for (let index = state.tokens.length-1; index >= 0; index--) {
    const token = state.tokens[index]; if (token.tag !== tag) continue;
    if (token.type === 'notate_format_close') depth++;
    else if (token.type === 'notate_format_open') { if (!depth) { matched = true; break; } depth--; }
  }
  if (!matched) return false;
  if (!silent) state.push('notate_format_close',tag,-1);
  state.pos += closing.length; return true;
});
renderer.renderer.rules.notate_format_open = (tokens,index) => tokens[index].tag === 'u' ? '<u>'
  : `<span class="${tokens[index].attrGet('class')}"${tokens[index].attrGet('data-definition') !== null ? ` data-definition="${renderer.utils.escapeHtml(tokens[index].attrGet('data-definition'))}"` : ''}>`;
renderer.renderer.rules.notate_format_close = (tokens,index) => `</${tokens[index].tag}>`;
export function renderEditorMarkdown(source) { return renderer.render(source); }
// Notes' safe reading view has no embedded images. Table previews likewise
// display image labels without fetching remote assets.
renderer.renderer.rules.image = (tokens, index) => renderer.utils.escapeHtml(tokens[index].content);
const changePreview = StateEffect.define();
const passageLinkHandler = Facet.define({combine: values => values[0]});
const definitionHandler = Facet.define({combine: values => values[0]});
const hyperlinkHandler = Facet.define({combine: values => values[0]});
function safeHyperlink(value) {
  try {
    const url = new URL(value);
    return ['http:','https:','mailto:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
function hyperlinkNode(state,node) {
  if (node.name !== 'Link' || passageLink(state,node)) return null;
  const children = [];
  for (let child = node.node.firstChild; child; child = child.nextSibling) children.push(child);
  const closing = children.find(child => child.name === 'LinkMark' && state.doc.sliceString(child.from,child.to) === ']');
  const destination = children.find(child => child.name === 'URL');
  if (!closing || !destination) return null;
  const url = safeHyperlink(state.doc.sliceString(destination.from,destination.to).replace(/^<|>$/g,''));
  return url ? {from:node.from,to:node.to,start:node.from+1,end:closing.from,url,
    text:state.doc.sliceString(node.from+1,closing.from),source:state.doc.sliceString(node.from,node.to),existing:true} : null;
}
function activateHyperlink(view,event,keyboard = false) {
  const marked = event.target.closest?.('[data-hyperlink]'), handler = view.state.facet(hyperlinkHandler);
  if (!marked || !handler || !keyboard && !(event.metaKey || event.ctrlKey)) return false;
  const url = safeHyperlink(marked.dataset.hyperlink); if (!url) return false;
  event.preventDefault(); handler(url); return true;
}
function definitionNode(state,node) {
  if (node.name !== 'DefinedText') return null;
  const first = node.node.firstChild, last = node.node.lastChild;
  const match = definitionOpening.exec(state.doc.sliceString(first.from,first.to));
  const definition = match && decodeDefinition(match[1]);
  return definition === null || !match ? null : {from:node.from,to:node.to,start:first.to,end:last.from,
    text:state.doc.sliceString(first.to,last.from),definition};
}
function definitions(state) {
  const result = [], tree = ensureSyntaxTree(state,state.doc.length,100) || syntaxTree(state);
  tree.iterate({enter(node) { const definition = definitionNode(state,node); if (definition) result.push(definition); }});
  return result;
}
function activateDefinition(view,event,keyboard = false) {
  const marked = event.target.closest?.('[data-definition-from]'), handler = view.state.facet(definitionHandler);
  if (!marked || !handler || event.altKey || event.shiftKey || !keyboard && !(event.metaKey || event.ctrlKey)) return false;
  const definition = definitions(view.state).find(item => item.from === Number(marked.dataset.definitionFrom));
  if (!definition) return false;
  event.preventDefault(); handler(definition,marked.getBoundingClientRect(),marked.textContent); return true;
}
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
export function getSourcePassageLinks(source) {
  return passageLinks(EditorState.create({doc:source,extensions:markdown({extensions:[Table,Strikethrough,textFormatting]})}));
}
export function getSourceDefinitions(source) {
  return definitions(EditorState.create({doc:source,extensions:markdown({extensions:[Table,Strikethrough,textFormatting]})}));
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
    const kind = {'Answ:':'answer','Answer:':'answer','Question:':'question','For Example:':'example'}[label.textContent];
    if (!kind) return;
    let sibling = label.nextSibling;
    while (sibling?.nodeType === Node.TEXT_NODE && !sibling.textContent.trim()) sibling = sibling.nextSibling;
    if (sibling?.nodeName === 'EM') { label.classList.add(`md-${kind}-label`); sibling.classList.add(`md-${kind}-text`); }
  });
}
function templateLabel(state, node) {
  if (node?.name !== 'StrongEmphasis') return null;
  const match = /^(?:\*\*|__)(Answer|Answ|Question|For Example):(?:\*\*|__)$/.exec(state.doc.sliceString(node.from,node.to));
  return match ? {'Answer':'answer','Answ':'answer','Question':'question','For Example':'example'}[match[1]] : null;
}
function templateBody(state, node) {
  if (node.name !== 'Emphasis') return null;
  const label = node.node.prevSibling;
  const kind = templateLabel(state,label);
  if (kind && kind !== 'example' && /^[ \t]*$/.test(state.doc.sliceString(label.to,node.from))) return kind;
  const paragraph = node.node.parent;
  if (paragraph?.name === 'Paragraph' && templateLabel(state,paragraph.firstChild) === 'example'
      && /^\s*[-+*] /.test(state.doc.lineAt(node.from).text)) return 'example';
  return null;
}
function listDepth(node) {
  let depth = -1;
  for (let parent = node.node.parent; parent; parent = parent.parent) if (['BulletList','OrderedList'].includes(parent.name)) depth++;
  return Math.max(0,depth);
}
function indentationColumns(text) { let columns = 0; for (const character of text) columns += character === '\t' ? 4 - columns % 4 : 1; return columns; }

class Bullet extends WidgetType {
  constructor(depth) { super(); this.depth = depth; }
  eq(other) { return this.depth === other.depth; }
  toDOM() {
    const span = document.createElement('span'); span.className = 'md-bullet'; span.dataset.listDepth = this.depth;
    span.textContent = ['•','◦','▪'][this.depth % 3]; span.setAttribute('aria-hidden','true'); return span;
  }
}

class TablePreview extends WidgetType {
  constructor(source, from, cells) { super(); this.source = source; this.from = from; this.cells = cells; }
  eq(other) { return this.source === other.source && this.from === other.from; }
  toDOM(view) {
    const container = document.createElement('div'); container.className = 'md-table-preview';
    // markdown-it has HTML disabled and rejects unsafe link protocols.
    container.innerHTML = renderer.render(this.source);
    styleInlineAnswers(container);
    const items = definitions(view.state).filter(item => item.from >= this.from && item.to <= this.from+this.source.length);
    container.querySelectorAll('.md-definition').forEach((mark,index) => {
      if (!items[index]) return;
      mark.dataset.definitionFrom = items[index].from; mark.setAttribute('role','button'); mark.tabIndex = 0;
      mark.title = '⌘/Ctrl-click to view definition';
      mark.addEventListener('keydown',event => { if (event.key === 'Enter' || event.key === ' ') activateDefinition(view,event,true); });
    });
    container.querySelectorAll('a').forEach(link => {
      const match = /^#notate-passage-([a-f0-9]{32})$/.exec(link.getAttribute('href'));
      if (!match) {
        const url = safeHyperlink(link.getAttribute('href'));
        if (url && view.state.facet(hyperlinkHandler)) {
          link.dataset.hyperlink = url; link.classList.add('md-hyperlink'); link.tabIndex = 0;
          link.title = '⌘/Ctrl-click to open hyperlink';
          link.addEventListener('click',event => event.preventDefault());
          link.addEventListener('keydown',event => { if (event.key === 'Enter') activateHyperlink(view,event,true); });
        }
        return;
      }
      link.classList.add('md-pad-link'); link.dataset.passageLink = match[1];
      link.title = 'Jump to reading passage · ⌘/Ctrl-click to edit';
      link.addEventListener('click', event => { event.preventDefault(); });
      link.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') activatePassageLink(view,event); });
    });
    container.setAttribute('aria-label', 'Markdown table. Click a cell to edit.');
    container.querySelectorAll('th,td').forEach((cell, index) => {
      cell.title = 'Click to edit this cell’s Markdown';
      cell.addEventListener('pointerdown', event => {
        if (activateDefinition(view,event)) return;
        if (activatePassageLink(view,event)) return;
        if (activateHyperlink(view,event)) return;
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
    const hyperlink = state.facet(hyperlinkHandler) && hyperlinkNode(state,node);
    if (hyperlink) {
      mark(hyperlink.start,hyperlink.end,'md-hyperlink',null,{'data-hyperlink':hyperlink.url,role:'link',tabindex:'0',title:'⌘/Ctrl-click to open hyperlink'});
      if (preview) { hide(from,hyperlink.start); hide(hyperlink.end,to); }
    }
    const definition = definitionNode(state,node);
    if (definition) {
      mark(definition.start,definition.end,'md-definition','span',{'data-definition-from':String(definition.from),role:'button',tabindex:'0',title:'⌘/Ctrl-click to view definition'});
      if (preview) { hide(from,definition.start); hide(definition.end,to); }
    }
    if (!preview) return;
    if (name === 'TextColor' || name === 'Underline') {
      const first = node.node.firstChild, last = node.node.lastChild;
      const color = name === 'TextColor' && colorOpening.exec(state.doc.sliceString(first.from,first.to));
      mark(first.to,last.from,color ? `md-text-${color[1]}` : 'md-underline',name === 'Underline' ? 'u' : 'span');
      hide(first.from,first.to); hide(last.from,last.to);
    }
    const labelKind = templateLabel(state,node), bodyKind = templateBody(state,node);
    if (labelKind === 'example' && node.node.parent?.name === 'Paragraph') {
      for (let number = state.doc.lineAt(to).number + 1; number <= state.doc.lineAt(node.node.parent.to).number; number++) {
        const line = state.doc.line(number), bullet = /^([ \t]+)[-+*] /.exec(line.text);
        if (!bullet) continue;
        const position = line.from + bullet[1].length;
        ranges.push(Decoration.replace({widget:new Bullet(Math.floor(indentationColumns(bullet[1])/4))}).range(position,position+1));
      }
    }
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
    if (labelKind) mark(from,to,`md-strong md-${labelKind}-label`,'strong');
    if (bodyKind) mark(from,to,`md-emphasis md-${bodyKind}-text`,'em');
    if (name === 'ListMark' && /^[*+-]$/.test(state.doc.sliceString(from,to))) {
      ranges.push(Decoration.replace({widget:new Bullet(listDepth(node))}).range(from,to));
    }
    if (active(from, to)) return;
    if (name === 'HeaderMark' || name === 'QuoteMark') {
      hide(from, to + (state.doc.sliceString(to, to + 1) === ' ' ? 1 : 0));
    } else if (name === 'StrongEmphasis' && !labelKind) mark(from, to, 'md-strong', 'strong');
    else if (name === 'Emphasis' && !bodyKind) mark(from, to, 'md-emphasis', 'em');
    else if (name === 'Strikethrough') mark(from, to, 'md-strike', 's');
    else if (name === 'InlineCode') mark(from, to, 'md-inline-code', 'code');
    else if (name === 'EmphasisMark' || name === 'StrikethroughMark' || name === 'CodeMark') hide(from, to);
    else if (name === 'Escape') hide(from, from + 1);
    else if (name === 'Link' && !passage && !hyperlink) {
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
    markdown({extensions: [Table, Strikethrough, textFormatting], completeHTMLTags: false}),
    indentUnit.of('\t'), EditorState.tabSize.of(4),
    history(), drawSelection(), dropCursor(), EditorView.lineWrapping,
    editing.of([EditorState.readOnly.of(false), EditorView.editable.of(true)]),
    EditorView.contentAttributes.of({'aria-label': options.ariaLabel || 'Note Markdown editor', spellcheck: 'true', autocapitalize: 'sentences'}),
    placeholder(options.placeholder || 'Start writing… Use # for a heading, **bold**, or the table button above.'),
    EditorState.transactionFilter.of(transaction => transaction.docChanged && transaction.newDoc.length > (options.maxLength || 5_000_000) ? [] : transaction),
    previewEnabled, livePreview,
    passageLinkHandler.of(options.onPassageLink),
    definitionHandler.of(options.onDefinition),
    hyperlinkHandler.of(options.onHyperlink),
    EditorView.domEventHandlers({
      pointerdown: (event, editor) => event.button === 0 && (activateDefinition(editor,event) || activatePassageLink(editor,event) || activateHyperlink(editor,event)),
      keydown: (event, editor) => (event.key === 'Enter' || event.key === ' ') && (activateDefinition(editor,event,true) || activatePassageLink(editor,event) || activateHyperlink(editor,event,true))
    }),
    // Some platforms report shifted letters in lowercase, and synthetic
    // native events may omit keyCode. Handle Shift before letter fallback.
    Prec.high(EditorView.domEventHandlers({keydown: event => {
      if (event.altKey || !(event.metaKey || event.ctrlKey) || !event.shiftKey) return false;
      if (event.key.toLowerCase() === 'h' && options.onApplyTextColor) {
        event.preventDefault(); options.onApplyTextColor(); return true;
      }
      const kind = {e:'example',m:'question'}[event.key.toLowerCase()];
      if (!kind) return false;
      event.preventDefault(); insertTemplate(kind); return true;
    }})),
    Prec.high(keymap.of([
      {key: 'Mod-b', run: () => { format('bold'); return true; }},
      {key: 'Mod-i', run: () => { format('italic'); return true; }},
      {key: 'Mod-u', run: () => { format('underline'); return true; }},
      {key: 'Mod-e', run: () => { insertAnswer(); return true; }},
      {key: 'Mod-Shift-m', run: () => { insertTemplate('question'); return true; }},
      {key: 'Mod-Shift-e', run: () => { insertTemplate('example'); return true; }},
      ...(options.onApplyTextColor ? [{key:'Mod-Shift-h',run:() => { options.onApplyTextColor(); return true; }}] : []),
      {key: 'Enter', run: finishTemplateLine},
      ...(options.onSubmit ? [{key:'Mod-Enter', run: () => { options.onSubmit(); return true; }}] : [])
    ])),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    EditorView.updateListener.of(update => {
      if (update.docChanged && !suppressChange) onChange(update.state.doc.toString());
      if (update.selectionSet || update.docChanged || update.geometryChanged || update.focusChanged) options.onSelectionChange?.(update.state.selection.main, update);
    })
  ]})});
  if (!preview) view.dispatch({effects: changePreview.of(false)});
  function wrap(opening, closing = opening) {
    const {from, to} = view.state.selection.main, selected = view.state.doc.sliceString(from, to);
    const text = selected || ' ';
    const surrounding = view.state.doc.sliceString(Math.max(0, from - opening.length), to + closing.length);
    if (selected && surrounding === opening + selected + closing) {
      view.dispatch({changes: {from: from - opening.length, to: to + closing.length, insert: selected},
        selection: EditorSelection.single(from - opening.length, to - opening.length), userEvent: 'input', annotations:isolateHistory.of('full')});
    } else {
      view.dispatch({changes: {from, to, insert: opening + text + closing},
        selection: EditorSelection.single(from + opening.length, from + opening.length + text.length), userEvent: 'input', annotations:isolateHistory.of('full')});
    }
    view.focus();
  }
  function format(kind) {
    if (view.state.readOnly) return;
    if (kind === 'underline') {
      const {from,to,empty} = view.state.selection.main;
      if (empty || /^[\t ]+$/.test(view.state.doc.sliceString(from,to))) return wrap('<u>','</u>');
      return styleSelection('Underline','<u>','</u>');
    }
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
  function insertAnswer() { insertTemplate('answer'); }
  function insertTemplate(kind) {
    if (view.state.readOnly) return;
    const {from, to} = view.state.selection.main;
    const selected = view.state.doc.sliceString(from,to), text = selected || ' ';
    const before = view.state.doc.sliceString(0,from), after = view.state.doc.sliceString(to);
    const gap = kind !== 'example' || !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    const prefix = gap + (kind === 'example' ? '**For Example:**\n\t- *' : kind === 'question' ? '**Question:** *' : '**Answer:** *');
    const suffix = kind !== 'example' || !after || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
    view.dispatch({changes:{from,to,insert:prefix+text+'*'+suffix},
      selection:selected ? {anchor:from+prefix.length+text.length}
        : EditorSelection.single(from+prefix.length,from+prefix.length+text.length),
      userEvent:'input',annotations:isolateHistory.of('full')});
    view.focus();
  }
  function finishTemplateLine() {
    if (view.state.readOnly) return false;
    const selection = view.state.selection.main;
    if (!selection.empty) return false;
    const line = view.state.doc.lineAt(selection.head), exampleBullet = /^([ \t]+)[-+*] (.*)$/.exec(line.text);
    let example = false;
    if (exampleBullet && selection.head === line.to) {
      for (let number = line.number - 1; number >= 1; number--) {
        const previous = view.state.doc.line(number).text;
        if (/^(?:\*\*For Example:\*\*|__For Example:__)$/.test(previous)) { example = true; break; }
        if (!/^[ \t]+/.test(previous) || !previous.trim()) break;
      }
      let context = syntaxTree(view.state).resolveInner(selection.head,-1);
      while (context) { if (['FencedCode','CodeBlock'].includes(context.name)) example = false; context = context.parent; }
      if (example && !exampleBullet[2].trim()) {
        view.dispatch({changes:{from:line.from,to:line.to,insert:'\n'},selection:{anchor:line.from+1},userEvent:'input'}); return true;
      }
    }
    let node = syntaxTree(view.state).resolveInner(selection.head,-1);
    while (node && node.name !== 'Emphasis') node = node.parent;
    const kind = node && templateBody(view.state,node);
    if (!kind || selection.head !== node.to-1) {
      if (example) {
        const insert = '\n'+exampleBullet[1]+'- ';
        view.dispatch({changes:{from:line.to,insert},selection:{anchor:line.to+insert.length},userEvent:'input'}); return true;
      }
      return false;
    }
    // Typing at the end of the inserted answer then pressing Enter finishes
    // its italic span and starts a normal line (including list continuation).
    view.dispatch({selection:{anchor:node.to}});
    if (kind === 'example') {
      const indent = /^[ \t]*/.exec(view.state.doc.lineAt(node.from).text)[0]; const insert = '\n'+indent+'- ';
      view.dispatch({changes:{from:node.to,insert},selection:{anchor:node.to+insert.length},userEvent:'input'}); return true;
    }
    return insertNewlineContinueMarkup(view) || insertNewline(view);
  }
  function selectionCanFormat() {
    const {from,to,empty} = view.state.selection.main;
    if (view.state.readOnly || empty || !view.state.doc.sliceString(from,to).trim()) return false;
    let allowed = true;
    syntaxTree(view.state).iterate({from,to,enter(node) {
      if (['FencedCode','CodeBlock'].includes(node.name) && node.from < to && node.to > from) allowed = false;
    }});
    return allowed;
  }
  function selectionFormatNode(name) {
    const {from,to} = view.state.selection.main;
    let found = null;
    syntaxTree(view.state).iterate({from,to,enter(node) {
      if (node.name === name && node.node.firstChild.to === from && node.node.lastChild.from === to) found = node.node;
    }});
    return found;
  }
  function styleSelection(name,opening,closing) {
    if (!selectionCanFormat()) return false;
    const {from,to} = view.state.selection.main, existing = selectionFormatNode(name);
    let changes;
    if (existing) {
      changes = [{from:existing.firstChild.from,to:existing.firstChild.to,insert:name === 'Underline' ? '' : opening}];
      if (name === 'Underline') changes.push({from:existing.lastChild.from,to:existing.lastChild.to,insert:''});
    } else {
      changes = [];
      // Wrap each selected line separately, retaining paragraph/list structure
      // and allowing selections across blank lines to round-trip as Markdown.
      const first = view.state.doc.lineAt(from), last = view.state.doc.lineAt(to);
      for (let number = first.number; number <= last.number; number++) {
        const line = view.state.doc.line(number), prefix = /^[ \t]*(?:(?:#{1,6}|>|[-+*]|\d+[.)])[ \t]+)*/.exec(line.text)[0];
        const start = Math.max(from,line.from+prefix.length), end = Math.min(to,line.to);
        if (end <= start || !view.state.doc.sliceString(start,end).trim()) continue;
        changes.push({from:start,insert:opening},{from:end,insert:closing});
      }
    }
    if (!changes.length) return false;
    const changeSet = view.state.changes(changes);
    view.dispatch({changes:changeSet,selection:EditorSelection.single(changeSet.mapPos(from,1),changeSet.mapPos(to,-1)),
      userEvent:'input',annotations:isolateHistory.of('full')});
    view.focus(); return true;
  }
  function selectionCanDefine() {
    if (!selectionCanFormat()) return false;
    const {from,to} = view.state.selection.main;
    if (/\n\s*\n/.test(view.state.doc.sliceString(from,to))) return false;
    let allowed = true;
    syntaxTree(view.state).iterate({from,to,enter(node) { if (node.name === 'InlineCode' && node.from < to && node.to > from) allowed = false; }});
    return allowed;
  }
  function selectedDefinition() {
    const {from,to} = view.state.selection.main;
    return definitions(view.state).filter(item => item.start <= from && item.end >= to).at(-1) || null;
  }
  function setDefinition(value,target) {
    const encoded = encodeURIComponent(value);
    if (view.state.readOnly || decodeDefinition(encoded) === null) return false;
    const opening = `<span class="md-definition" data-definition="${encoded}">`;
    if (target.existing) {
      const existing = definitions(view.state).find(item => item.from === target.from);
      if (!existing || existing.definition !== target.definition || existing.text !== target.text) return false;
      const changes = view.state.changes({from:existing.from,to:existing.start,insert:opening});
      view.dispatch({changes,selection:view.state.selection.map(changes),userEvent:'input',annotations:isolateHistory.of('full')});
    } else {
      const {from,to,text} = target;
      if (from < 0 || to <= from || to > view.state.doc.length || view.state.doc.sliceString(from,to) !== text) return false;
      view.dispatch({changes:{from,to,insert:opening+text+'</span>'},selection:EditorSelection.single(from+opening.length,from+opening.length+text.length),
        userEvent:'input',annotations:isolateHistory.of('full')});
    }
    view.focus(); return true;
  }
  function removeDefinition(target) {
    if (view.state.readOnly) return false;
    const existing = definitions(view.state).find(item => item.from === target.from);
    if (!existing || existing.definition !== target.definition || existing.text !== target.text) return false;
    const changes = view.state.changes([{from:existing.from,to:existing.start,insert:''},{from:existing.end,to:existing.to,insert:''}]);
    view.dispatch({changes,selection:view.state.selection.map(changes),userEvent:'input',annotations:isolateHistory.of('full')});
    view.focus(); return true;
  }
  function hyperlinkTarget() {
    const {from,to} = view.state.selection.main;
    let existing = null;
    syntaxTree(view.state).iterate({from,to,enter(node) {
      const link = hyperlinkNode(view.state,node);
      if (link && link.from <= from && link.to >= to) existing = link;
    }});
    if (existing) return existing;
    if (!selectionCanLink()) return null;
    const text = view.state.doc.sliceString(from,to);
    return {from,to,text,source:text,existing:false};
  }
  function changeHyperlink(target,url = null) {
    if (view.state.readOnly || !target || view.state.doc.sliceString(target.from,target.to) !== target.source) return false;
    const safe = url === null ? null : safeHyperlink(url);
    if (url !== null && !safe) return false;
    const label = target.existing ? target.text : target.text.replace(/\\[\[\]]|[\[\]]/g, value => value.length === 1 ? '\\'+value : value);
    const destination = safe?.replace(/[()\\<>]/g, value => '%'+value.charCodeAt(0).toString(16).toUpperCase());
    const insert = safe ? `[${label}](${destination})` : target.text;
    const start = target.from + (safe ? 1 : 0);
    view.dispatch({changes:{from:target.from,to:target.to,insert},selection:EditorSelection.single(start,start+(safe ? label.length : target.text.length)),
      userEvent:'input',annotations:isolateHistory.of('full')});
    view.focus(); return true;
  }
  function selectionCanLink() {
    const {from,to,empty} = view.state.selection.main;
    if (view.state.readOnly || empty || !view.state.doc.sliceString(from,to).trim() || /\n\s*\n/.test(view.state.doc.sliceString(from,to))) return false;
    let allowed = true;
    syntaxTree(view.state).iterate({from,to,enter(node) {
      if (['Link','Image','InlineCode','FencedCode','CodeBlock'].includes(node.name) && node.from < to && node.to > from) allowed = false;
    }});
    return allowed;
  }
  return {
    view, format, insertAnswer, insertTemplate,
    selectionCanDefine, getSelectedDefinition: selectedDefinition, setDefinition, removeDefinition,
    getDefinitions: () => definitions(view.state),
    getHyperlinkTarget: hyperlinkTarget,
    setHyperlink: (url,target) => changeHyperlink(target,url),
    removeHyperlink: target => changeHyperlink(target),
    selectionCanFormat,
    selectionIsUnderlined: () => !!selectionFormatNode('Underline'),
    applyTextColor: color => TEXT_COLORS.includes(color) && styleSelection('TextColor',`<span class="md-text-${color}">`,'</span>'),
    setReadOnly: value => view.dispatch({effects: editing.reconfigure([EditorState.readOnly.of(value), EditorView.editable.of(!value)])}),
    getSource: () => view.state.doc.toString(),
    getPassageLinks: () => passageLinks(view.state),
    revealPassageLink(id) {
      const link = passageLinks(view.state).find(link => link.id === id); if (!link) return false;
      view.dispatch({selection: EditorSelection.single(link.start,link.end), effects: EditorView.scrollIntoView(link.start,{y:'center'}), annotations: Transaction.addToHistory.of(false)});
      view.focus(); return true;
    },
    selectionCanLink,
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
