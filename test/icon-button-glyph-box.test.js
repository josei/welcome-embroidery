// Every icon button draws its glyph in one box, owned by the base `.icon-button` rule.
// Other rules may size the button (width, height) but must not set its padding or display,
// because a second box model is what pushed glyphs off centre.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Flat list of [selector, declarations] for every rule without nesting. The stylesheet has no
// @media-nested rule bodies that would break this, since each rule's body is a plain declaration list.
function rules(source) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(source))) {
    const selector = m[1].trim().replace(/^@[^{]*$/, '').trim();
    if (!selector) continue;
    const decls = m[2].split(';').map((d) => d.trim()).filter(Boolean);
    out.push({selector, decls});
  }
  return out;
}

// Pseudo-elements such as tooltip bubbles are not the button's glyph box, so they are not checked.
function targetsButtonElement(selector) {
  return selector.split(',').some((part) => /\.icon-button(?![\w-])/.test(part) && !/::/.test(part));
}

test('only the base .icon-button rule sets padding or display on an icon button', () => {
  const offenders = [];
  for (const {selector, decls} of rules(css)) {
    if (!targetsButtonElement(selector)) continue;
    if (selector === '.icon-button') continue;
    for (const d of decls) {
      if (/^(padding|display)\s*:/.test(d)) offenders.push(`${selector} { ${d} }`);
    }
  }
  assert.deepEqual(offenders, [], 'move these into the base .icon-button rule, or drop them');
});

test('the base .icon-button rule owns padding and the glyph box', () => {
  const base = rules(css).find((r) => r.selector === '.icon-button');
  assert.ok(base, 'base .icon-button rule exists');
  assert.ok(base.decls.includes('padding:0'), 'base rule sets padding to 0');
  assert.ok(base.decls.some((d) => /^display:inline-flex$/.test(d)), 'base rule lays the glyph out in a box');
  assert.ok(base.decls.includes('justify-content:center') && base.decls.includes('align-items:center'),
    'base rule centres the glyph on both axes');
});
