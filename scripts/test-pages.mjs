import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const site='_site';
const read=file=>fs.readFile(path.join(site,file),'utf8');
const landing=await read('index.html');
assert.match(landing,/href="app\/"/,'landing page links to the editor relatively');
assert.doesNotMatch(landing,/(href|src)="\//,'landing page has no root-absolute links');
const editor=await read('app/index.html');
assert.match(editor,/<meta name="welcome-static" content="true">/,'static build marks itself');
assert.match(editor,/src="src\/app\.js"/,'editor module is relative');
assert.doesNotMatch(editor,/(href|src)="\/[^"]/,'editor has no root-absolute asset links');
for(const file of ['src/app.js','src/worker.js','src/fontui.js','src/agent.js']){
 const code=await read(`app/${file}`);
 assert.doesNotMatch(code,/['"`]\/(src|fonts)\//,`${file} has no root-absolute module or font path`);
 assert.doesNotMatch(code,/fetch\('\/'\+/,`${file} fetches fonts relative to its module`);
}
for(const file of ['logo.svg','assets/editor.png','.nojekyll','app/THIRD_PARTY_NOTICES.md','app/fonts/neon_blinking/LICENSE'])
 await fs.access(path.join(site,file));
console.log('GitHub Pages site: landing page and relative editor paths are correct.');
