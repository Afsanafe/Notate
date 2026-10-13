// Build the offline editor and collect notices for every bundled dependency.
import {build} from 'esbuild';
import {readFile, writeFile, readdir} from 'node:fs/promises';
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
