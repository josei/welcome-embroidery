// Decode Welcome's PES v6 export with pyembroidery and check each thread's description: it must be the colour's hex, in thread order, with the right colour.
// PYEMBROIDERY_PYTHON=/path/to/venv/bin/python node scripts/verify-pes6-names.mjs
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {initialDocument,applyOperations,compile,encode} from '../src/engine.js';
const python=process.env.PYEMBROIDERY_PYTHON||'python3',dir=mkdtempSync(path.join(tmpdir(),'pes6-'));
const d=initialDocument();d.objects=[];
applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:-30,y:-20,width:24,height:14,thread:'#C0392B',stitch:'fill'},{op:'add_shape',id:'b',kind:'rect',x:0,y:0,width:20,height:10,thread:'#2471a3',stitch:'fill'}]);
const plan=compile(d),file=path.join(dir,'design.pes');writeFileSync(file,encode(plan,'pes6','#527461',110,d));
const py=spawnSync(python,['-I','-c',`import sys,json,pyembroidery as pe
p=pe.read(sys.argv[1])
print(json.dumps([[t.description,t.color] for t in p.threadlist]))`,file]);
if(py.status!==0)throw Error(py.stderr.toString());
const got=JSON.parse(py.stdout.toString());
const want=['#c0392b','#2471a3'];
const ok=got.length===want.length&&got.every(([desc],i)=>desc===want[i]);
console.log({threads:got,ok});
if(!ok)process.exitCode=1;
