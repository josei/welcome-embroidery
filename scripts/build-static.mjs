import fs from 'node:fs/promises';
const html=await fs.readFile('index.html','utf8'),css=await fs.readFile('styles.css','utf8');
const built=html.replace('<link rel="stylesheet" href="/styles.css">',`<style>\n${css}\n</style>`);
if(built===html)throw Error('Expected external stylesheet link was not found.');
await fs.rm('dist',{recursive:true,force:true});await fs.mkdir('dist',{recursive:true});
await fs.writeFile('dist/index.html',built);
for(const dir of ['src','fonts'])await fs.cp(dir,`dist/${dir}`,{recursive:true});
for(const file of ['LICENSE','THIRD_PARTY_NOTICES.md','LICENSE-THIRD-PARTY-pystitch.txt','LICENSE-THIRD-PARTY-polygon-clipping.txt'])await fs.copyFile(file,`dist/${file}`);
console.log('Built self-contained static asset tree in dist/ with embedded CSS, same-origin modules/worker/font assets, and license notices.');
