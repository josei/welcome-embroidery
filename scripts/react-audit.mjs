// Counts how far the editor is from using React the right way, one count per check of the definition.
// Prints each count with its target. Exits 1 if a count rises above its baseline, so progress only goes one way.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const walk = dir => fs.readdirSync(path.join(root, dir), {withFileTypes: true}).flatMap(e => {
 const rel = path.join(dir, e.name);
 if (e.isDirectory()) return rel === 'src/vendor' ? [] : walk(rel);
 return /\.(m?js|ts|tsx)$/.test(e.name) ? [rel] : [];
});
const count = (text, re) => (text.match(re) || []).length;

const app = read('src/app.js');
const shell = fs.existsSync(path.join(root, 'src/shell.html')) ? read('src/shell.html') : '';
const sources = walk('src');
const markup = sources.map(f => read(f)).join('\n');
const tsconfig = read('tsconfig.json');

const checks = [
 {id: '1', name: 'placeholders (data-react-panel markers, transitional: reported, not ratcheted)', now: count(shell, /data-react-panel=/g), target: 0, baseline: Infinity},
 {id: '1', name: 'shell.html present', now: fs.existsSync(path.join(root, 'src/shell.html')) ? 1 : 0, target: 0, baseline: 1},
 {id: '2', name: 'raw HTML injection (dangerouslySetInnerHTML files)', now: sources.filter(f => read(f).includes('dangerouslySetInnerHTML')).length, target: 0, baseline: 1},
 {id: '3', name: 'DOM lookups in app.js', now: count(app, /\$\(|document\.querySelector/g), target: 0, baseline: 661},
 {id: '3', name: 'direct DOM writes in app.js', now: count(app, /\$\([^)]*\)\.(textContent|innerHTML|hidden|disabled|value|title|onclick|onchange|oninput|onpointerdown)\s*=|classList\.(toggle|add|remove)|setAttribute\(/g), target: 0, baseline: 602},
 {id: '4', name: 'addEventListener calls in app.js', now: count(app, /addEventListener\(/g), target: 0, baseline: 44},
 {id: '4', name: 'onclick assignments in app.js', now: count(app, /\.onclick\s*=/g), target: 0, baseline: 92},
 {id: '5', name: 'store reads and writes in app.js (reported, not ratcheted)', now: count(app, /selState\(\)|setSelection\(|interactionNow\(\)|setInteraction\(|clipboardNow\(\)|setClipboard\(|documentNow\(\)|setDocument\(|pathDraftNow\(\)|setPathDraft\(/g), target: 0, baseline: Infinity},
 {id: '5', name: 'state references in app.js (selected, doc, multi, selNode)', now: ['selected', 'doc', 'multi', 'selNode'].reduce((n, name) => n + count(app, new RegExp(`(?<![A-Za-z0-9_$.])${name}(?![A-Za-z0-9_$])`, 'g')), 0), target: 0, baseline: 461},
 {id: '6', name: 'JavaScript files not type-checked', now: count(tsconfig, /"checkJs": false/g) ? sources.filter(f => f.endsWith('.js')).length : 0, target: 0, baseline: 25},
 {id: '7', name: 'source files over 500 lines', now: sources.filter(f => read(f).split('\n').length > 500).length, target: 0, baseline: 3},
 {id: '7', name: 'lines over 160 characters', now: markup.split('\n').filter(l => l.length > 160).length, target: 0, baseline: 1155},
];

let regressed = false;
console.log('check                                                      now  target  baseline');
for (const c of checks) {
 const mark = c.now > c.baseline ? ' REGRESSED' : c.now <= c.target ? ' done' : '';
 if (c.now > c.baseline) regressed = true;
 console.log(`${c.id} ${c.name.padEnd(56)} ${String(c.now).padStart(5)} ${String(c.target).padStart(7)} ${String(c.baseline).padStart(9)}${mark}`);
}
const open = checks.filter(c => c.now > c.target).length;
console.log(open === 0 ? '\nAll checks at target.' : `\n${open} of ${checks.length} checks still above target.`);
process.exitCode = regressed ? 1 : 0;
