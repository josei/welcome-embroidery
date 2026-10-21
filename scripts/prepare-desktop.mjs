import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const stage='src-tauri/resources/welcome';
await fs.rm(stage,{recursive:true,force:true});
await fs.mkdir(stage,{recursive:true});
for(const file of ['index.html','styles.css','server.js','server-relay.js','server-fonts.js','server-render.js','package.json','package-lock.json','LICENSE','THIRD_PARTY_NOTICES.md','LICENSE-THIRD-PARTY-pystitch.txt','LICENSE-THIRD-PARTY-polygon-clipping.txt'])await fs.copyFile(file,`${stage}/${file}`);
for(const dir of ['src','fonts'])await fs.cp(dir,`${stage}/${dir}`,{recursive:true});
execFileSync('npm',['ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund'],{cwd:stage,stdio:'inherit'});
console.log(`Staged the local Welcome server with production dependencies in ${stage}/.`);
