// Read Welcome's EDR (binary thread colour list) export with pyembroidery: the colours must come back in order of first use, each once.
// PYEMBROIDERY_PYTHON=/path/to/venv/bin/python node scripts/verify-edr.mjs
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {initialDocument,applyOperations,compile,encode} from '../src/engine.js';
const python=process.env.PYEMBROIDERY_PYTHON||'python3',dir=mkdtempSync(path.join(tmpdir(),'edr-'));
const d=initialDocument();d.objects=[];
applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:-30,y:-20,width:24,height:14,thread:'#C0392B',stitch:'fill'},{op:'add_shape',id:'b',kind:'rect',x:0,y:0,width:20,height:10,thread:'#2471a3',stitch:'fill'},{op:'add_shape',id:'c',kind:'rect',x:30,y:0,width:6,height:6,thread:'#C0392B',stitch:'fill'}]);
const file=path.join(dir,'design.edr');writeFileSync(file,encode(compile(d),'edr','#527461',110,d));
const py=spawnSync(python,['-I','-c',`import sys,json,pyembroidery as pe
p=pe.read(sys.argv[1])
print(json.dumps([[t.red,t.green,t.blue] for t in [type('T',(),{'red':c>>16&255,'green':c>>8&255,'blue':c&255}) for c in [t.color for t in p.threadlist]]]))`,file]);
if(py.status!==0)throw Error(py.stderr.toString());
const got=JSON.parse(py.stdout.toString());
const want=[[192,57,43],[36,113,163]];
const ok=JSON.stringify(got)===JSON.stringify(want);
console.log({colours:got,ok});
if(!ok)process.exitCode=1;
