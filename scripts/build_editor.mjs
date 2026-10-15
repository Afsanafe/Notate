// Build the offline editor and collect notices for every bundled dependency.
import {build} from 'esbuild';
import {readFile, writeFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

const result = await build({
  entryPoints: ['frontend/note-editor.js'], bundle: true, format: 'esm',
  minify: true, target: 'es2020', outfile: 'notate/static/vendor/note-editor.js',
  legalComments: 'external', metafile: true, logLevel: 'info'
});
const packages = new Set();
for (const input of Object.keys(result.metafile.inputs)) {
  const parts = input.split('/');
  if (parts[0] === 'node_modules') packages.add(parts.slice(0, parts[1].startsWith('@') ? 3 : 2).join('/'));
}
const notices = ['Notate Markdown editor: bundled dependency licenses.\n'];
for (const directory of [...packages].sort()) {
  const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  const licenseFile = (await readdir(directory)).find(name => /^licen[cs]e(?:[-.].*)?$/i.test(name));
  if (!licenseFile) throw new Error(`Missing license for ${pkg.name}`);
  notices.push(`${pkg.name} ${pkg.version}\n${'='.repeat(72)}\n${await readFile(path.join(directory, licenseFile), 'utf8')}`);
}
await writeFile('notate/static/vendor/EDITOR-LICENSES.txt', notices.join('\n\n'));

// Version the module dependency as well as the entry point: a cached editor
// bundle can otherwise prevent a newer app from importing its named exports.
const revision = async file => createHash('sha256').update(await readFile(file)).digest('hex').slice(0,16);
const writeChanged = async (file, content) => {
  if (await readFile(file, 'utf8') !== content) await writeFile(file, content);
};
const appFile = 'notate/static/app.js';
const appSource = await readFile(appFile, 'utf8');
const dependency = /(from ['"]\.\/vendor\/note-editor\.js)(?:\?v=[a-f0-9]+)?(['"])/;
if (!dependency.test(appSource)) throw new Error('Cannot find the app editor import to version it.');
const editorRevision = await revision('notate/static/vendor/note-editor.js');
await writeChanged(appFile, appSource.replace(dependency, `$1?v=${editorRevision}$2`));
const assets = ['app.js', 'style.css', 'vendor/pdf_viewer.css'];
const versions = new Map(await Promise.all(assets.map(async asset => [`/static/${asset}`, await revision(`notate/static/${asset}`)])));
const indexFile = 'notate/static/index.html';
const indexSource = await readFile(indexFile, 'utf8');
await writeChanged(indexFile, indexSource.replace(
  /(\/static\/(?:app\.js|style\.css|vendor\/pdf_viewer\.css))(?:\?v=[a-f0-9]+)?(?=")/g,
  (_, asset) => `${asset}?v=${versions.get(asset)}`
));
