import assert from 'node:assert/strict';
import test from 'node:test';
import {EditorState, EditorSelection} from '@codemirror/state';
import {markdown} from '@codemirror/lang-markdown';
import {syntaxTree} from '@codemirror/language';
import {Table, Strikethrough} from '@lezer/markdown';
import {formattingChange, renderEditorMarkdown, textFormatting} from '../frontend/note-editor.js';

const red = '<span class="md-text-red">', blue = '<span class="md-text-dark-blue">';
const definition = '<span class="md-definition" data-definition="A%20definition">';
const styles = {
  color:['TextColor',red,'</span>'], blue:['TextColor',blue,'</span>'],
  underline:['Underline','<u>','</u>'], bold:['StrongEmphasis','**','**'], italic:['Emphasis','*','*']
};
function state(source,from = 0,to = source.length) {
  return EditorState.create({doc:source,selection:EditorSelection.single(from,to),
    extensions:markdown({extensions:[Table,Strikethrough,textFormatting]})});
}
function apply(source,kind,from = 0,to = source.length) {
  const before = state(source,from,to), change = formattingChange(before,...styles[kind]);
  return change ? before.update(change).state : before;
}
function assertBalanced(source,rendered = false) {
  const stack = [];
  const pattern = rendered ? /<(\/?)(span|u|strong|em|s|a|code|p)\b[^>]*>/g : /<(\/?)(span|u)\b[^>]*>/g;
  for (const tag of source.matchAll(pattern)) {
    const name = tag[2];
    if (tag[1]) assert.equal(stack.pop(),name,`Crossed tags: ${source}`);
    else stack.push(name);
  }
  assert.deepEqual(stack,[],`Unclosed tags: ${source}`);
}

test('color and underline nest in both orders and survive repeated formatting', () => {
  for (const first of ['color','underline']) {
    const second = first === 'color' ? 'underline' : 'color';
    let current = apply('Colored words',first);
    current = current.update(formattingChange(current,...styles[second])).state;
    assertBalanced(current.doc.toString());
    assert.match(renderEditorMarkdown(current.doc.toString()),/<(?:u|span)[^>]*><(?:u|span)[^>]*>Colored words/);
    current = current.update(formattingChange(current,...styles.blue)).state;
    assertBalanced(current.doc.toString());
    assert.equal((current.doc.toString().match(/md-text-/g)||[]).length,1);
    current = current.update(formattingChange(current,...styles.underline)).state;
    assertBalanced(current.doc.toString());
    assert.ok(!current.doc.toString().includes('<u>'));
  }
});

test('hidden opening/closing tags are never partially wrapped', () => {
  const source = `${red}colored words</span> then plain`;
  for (let from = 0; from < source.length; from++) {
    for (let to = from+1; to <= source.length; to++) {
      for (const kind of ['underline','bold','italic','blue']) {
        const result = apply(source,kind,from,to).doc.toString();
        assertBalanced(result);
        // Source tags and attributes stay intact, even for source-mode
        // selections beginning or ending in the middle of a tag.
        assert.equal(result.replace(/<span class="md-text-(?:red|dark-blue)">|<\/span>|<\/?u>|\*/g,''),'colored words then plain');
      }
    }
  }
});

test('partial selections crossing adjacent and nested containers preserve text', () => {
  const samples = [
    `${red}one two</span> three`,
    `one ${red}two three</span>`,
    `${red}<u>one two</u></span> ${blue}three four</span>`,
    `${definition}one ${red}two</span></span> three`,
    `[one ${red}two</span>](https://example.com) three`,
    `**one ${red}two</span>** three`,
    `*one ${red}two</span>* three`,
    `~~one ${red}two</span>~~ three`
  ];
  for (const source of samples) {
    const from = source.indexOf('two')+1, to = source.indexOf('three')+3;
    for (const kind of Object.keys(styles)) {
      const result = apply(source,kind,from,to).doc.toString();
      assertBalanced(result);
      assert.equal(renderEditorMarkdown(result).replace(/<[^>]*>|\n/g,''),'one two three'+(source.includes('four')?' four':''),`${kind}: ${result}`);
    }
  }
});

test('full-node and body-only selections toggle underline and replace color', () => {
  for (const source of [`<u>${red}words</span></u>`,`${red}<u>words</u></span>`]) {
    const start = source.indexOf('words'), end = start+5;
    for (const [from,to] of [[0,source.length],[start,end],[start,source.length],[0,end]]) {
      assert.equal(apply(source,'underline',from,to).doc.toString(),`${red}words</span>`);
      const colored = apply(source,'blue',from,to).doc.toString();
      assertBalanced(colored);
      assert.equal((colored.match(/md-text-/g)||[]).length,1);
      assert.ok(colored.includes('md-text-dark-blue'));
    }
  }
});

test('paragraph/list prefixes and code literals remain intact', () => {
  const source = `# Title\n\n- ${red}First</span> finding\n- Second finding`;
  const result = apply(source,'underline').doc.toString();
  assertBalanced(result);
  assert.ok(result.startsWith('# <u>Title</u>\n\n- <u>'));
  assert.ok(result.includes('\n- <u>Second finding</u>'));
  const code = '`<span class="md-text-red">literal</span>`';
  assert.equal(apply(code,'underline',5,20).doc.toString(),code);
  assert.equal(apply('```html\n'+code+'\n```','color').doc.toString(),'```html\n'+code+'\n```');
  assert.equal(apply(code,'underline').doc.toString(),`<u>${code}</u>`);
});

test('mixed formatting stays balanced through repeated arbitrary selections', () => {
  let seed = 73;
  const random = max => { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; return seed % max; };
  for (let trial = 0; trial < 100; trial++) {
    let source = `${definition}one ${red}two</span></span> and <u>three</u> four`;
    for (let action = 0; action < 12; action++) {
      const from = random(source.length), to = from+1+random(source.length-from);
      source = apply(source,Object.keys(styles)[random(5)],from,to).doc.toString();
      assertBalanced(source);
      assertBalanced(renderEditorMarkdown(source),true);
    }
  }
});

test('pasted crossed or unmatched tags render literally without emitting crossed HTML', () => {
  for (const source of [
    `${red}<u>word</span></u>`, `<u>${red}word</u></span>`,
    `${red}**word</span> more**`, `**${red}word** more</span>`,
    `${red}unclosed`, '</span>orphan', `${red}<u></span></u>`
  ]) {
    const html = renderEditorMarkdown(source);
    assertBalanced(html,true);
    if (!source.includes('**')) assert.ok(html.includes('&lt;'),html);
    // Lezer must retain mismatched custom delimiters as literal HTML nodes.
    const parsed = syntaxTree(state(source)).toString();
    if (source.includes('<u>')) assert.ok(parsed.includes('HTMLTag'),parsed);
  }
});
