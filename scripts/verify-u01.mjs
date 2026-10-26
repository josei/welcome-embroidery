// Decode Welcome's U01 (Barudan) export with pyembroidery: every planned needle and jump position must appear in order, and the colour changes and trims must agree.
// PYEMBROIDERY_PYTHON=/path/to/venv/bin/python node scripts/verify-u01.mjs
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {initialDocument,applyOperations,compile,encode} from '../src/engine.js';
const python=process.env.PYEMBROIDERY_PYTHON||'python3',dir=mkdtempSync(path.join(tmpdir(),'u01-'));
const d=initialDocument();d.objects=[];d.settings.trims=true;
applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:-30,y:-20,width:24,height:14,thread:'#527461',stitch:'fill'},{op:'add_path',id:'b',x:0,y:0,points:[[-30,10],[0,10],[30,10]],thread:'#d9897e',stitch:'run'},{op:'add_shape',id:'c',kind:'ellipse',x:30,y:-20,width:18,height:12,thread:'#2471a3',stitch:'fill'}]);
const plan=compile(d),file=path.join(dir,'design.u01');writeFileSync(file,encode(plan,'u01','#527461',110,d));
const py=spawnSync(python,['-I','-c',`import sys,json,pyembroidery as pe
p=pe.read(sys.argv[1])
pos=[(round(x),round(y)) for x,y,c in p.stitches if c&0xff in (pe.STITCH,pe.JUMP)]
print(json.dumps({"points":pos,"threads":len(p.threadlist),"needleChanges":p.count_stitch_commands(pe.NEEDLE_SET),"trims":p.count_stitch_commands(pe.TRIM)}))`,file]);
if(py.status!==0)throw Error(py.stderr.toString());
const r=JSON.parse(py.stdout.toString());
// Zero-length moves leave no record, and long moves are split into 12.7 mm records, so compare the distinct planned points in order.
const planned=plan.stitches.filter(s=>s.cmd!=='end'&&s.cmd!=='trim').map(s=>[Math.round(s.x*10),Math.round(s.y*10)]).filter((p,i,a)=>i===0||p[0]!==a[i-1][0]||p[1]!==a[i-1][1]);
let next=0;for(const [x,y] of r.points)if(next<planned.length&&planned[next][0]===x&&planned[next][1]===y)next++;
const samePath=next===planned.length;
const blocks=new Set(plan.stitches.filter(s=>s.cmd!=='end').map(s=>s.thread)).size;
const colourChanges=plan.stitches.filter(s=>s.cmd==='color').length,trimsPlanned=plan.stitches.filter(s=>s.cmd==='trim').length;
const changesOk=r.needleChanges===colourChanges,trimsOk=r.trims===trimsPlanned;
console.log({points:r.points.length,planned:planned.length,matched:next,blocks,needleChanges:r.needleChanges,colourChanges,trims:r.trims,trimsPlanned,samePath,changesOk,trimsOk});
if(!samePath||!changesOk||!trimsOk)process.exitCode=1;
