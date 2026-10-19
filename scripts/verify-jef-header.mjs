// Compare Welcome's JEF header (bytes 24..115: counts, hoop code, extents, hoop-edge distances) with pinned pystitch's JefWriter for the same decoded design.
// PYSTITCH_SRC=/path/to/pystitch/src node scripts/verify-jef-header.mjs
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {initialDocument,applyOperations,compile,encode} from '../src/engine.js';
const src=process.env.PYSTITCH_SRC||'/tmp/welcom-supervisor/pystitch/src',dir=mkdtempSync(path.join(tmpdir(),'jefhdr-'));
const sizes=[[20,20],[45,30],[90,80],[115,105],[100,90],[130,60]];let bad=0;
for(const [w,h] of sizes){const doc=initialDocument();doc.objects=[];doc.hoop=400;doc.settings.compensation=0;applyOperations(doc,[{op:'add_shape',id:'r',kind:'rect',x:-w/2,y:-h/2,width:w,height:h,stitch:'run'}]);
 const bytes=encode(compile(doc),'jef','#527461',400,doc),file=path.join(dir,`w${w}x${h}.jef`),ref=path.join(dir,`ref${w}x${h}.jef`);writeFileSync(file,bytes);
 const py=spawnSync('python3',['-I','-c',`import sys;sys.path.insert(0,${JSON.stringify(src)});import pystitch;p=pystitch.read(sys.argv[1]);pystitch.write_jef(p,sys.argv[2])`,file,ref]);if(py.status!==0)throw Error(py.stderr.toString());
 const a=Buffer.from(bytes),b=readFileSync(ref);const same=a.subarray(24,116).equals(b.subarray(24,116));if(!same)bad++;console.log(`${w}x${h} mm hoop code ${a.readUInt32LE(32)} vs ${b.readUInt32LE(32)} header ${same?'identical':'DIFFERS'}`);}
if(bad)process.exitCode=1;
