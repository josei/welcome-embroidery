import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const stage='src-tauri/resources/welcome';
await fs.rm(stage,{recursive:true,force:true});
await fs.mkdir(stage,{recursive:true});
for(const file of ['index.html','styles.css','server.js','server-relay.js','server-fonts.js','server-render.js','package.json','package-lock.json','LICENSE','THIRD_PARTY_NOTICES.md','LICENSE-THIRD-PARTY-pystitch.txt','LICENSE-THIRD-PARTY-polygon-clipping.txt'])await fs.copyFile(file,`${stage}/${file}`);
for(const dir of ['src','fonts'])await fs.cp(dir,`${stage}/${dir}`,{recursive:true});
// On Windows npm is npm.cmd, which only runs through a shell; the arguments are fixed, so the shell is safe here.
execFileSync(process.platform==='win32'?'npm.cmd':'npm',['ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund'],{cwd:stage,stdio:'inherit',shell:process.platform==='win32'});
const runtime=`${stage}/runtime`;
await fs.mkdir(runtime,{recursive:true});
const nodeName=process.platform==='win32'?'node.exe':'node';
await fs.copyFile(process.execPath,`${runtime}/${nodeName}`);
await fs.chmod(`${runtime}/${nodeName}`,0o755);
await fs.writeFile(`${runtime}/NODE-NOTICE.txt`,`Bundled Node.js ${process.version} (${process.platform}-${process.arch}).\nNode.js is distributed under the MIT licence; see https://github.com/nodejs/node/blob/main/LICENSE and the notices in the Node.js release for ${process.version}.\n`);
console.log(`Staged the local Welcome server with production dependencies in ${stage}/.`);
