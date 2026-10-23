// Decode Welcome's SEW export with pyembroidery: every planned needle and jump position must appear in order, and the colour blocks must agree.
// PYEMBROIDERY_PYTHON=/path/to/venv/bin/python node scripts/verify-sew.mjs
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {initialDocument,applyOperations,compile,encode} from '../src/engine.js';
const python=process.env.PYEMBROIDERY_PYTHON||'python3',dir=mkdtempSync(path.join(tmpdir(),'sew-'));
const d=initialDocument();d.objects=[];d.settings.trims=true;
applyOperations(d,[{op:'add_shape',id:'a',kind:'rect',x:-30,y:-20,width:24,height:14,thread:'#527461',stitch:'fill'},{op:'add_path',id:'b',x:0,y:0,points:[[-30,10],[0,10],[30,10]],thread:'#d9897e',stitch:'run'},{op:'add_shape',id:'c',kind:'ellipse',x:8,y:-22,width:20,height:20,thread:'#d3ad61',stitch:'fill'}]);
const plan=compile(d),file=path.join(dir,'design.sew');writeFileSync(file,encode(plan,'sew','#527461',110,d));
const py=spawnSync(python,['-I','-c',`import sys,json,pyembroidery as pe
p=pe.read(sys.argv[1])
pos=[(round(x),round(y)) for x,y,c in p.stitches if c&0xff==pe.STITCH or c&0xff==pe.JUMP]
print(json.dumps({"points":pos,"threads":len(p.threadlist),"colorChanges":p.count_stitch_commands(pe.COLOR_CHANGE)}))`,file]);
if(py.status!==0)throw Error(py.stderr.toString());
const r=JSON.parse(py.stdout.toString());
// Zero-length moves and trims leave no record, and long moves are split into 12.7 mm records, so compare the distinct planned points in order.
const planned=plan.stitches.filter(s=>s.cmd!=='end'&&s.cmd!=='trim').map(s=>[Math.round(s.x*10),Math.round(s.y*10)]).filter((p,i,a)=>i===0||p[0]!==a[i-1][0]||p[1]!==a[i-1][1]);
let next=0;for(const [x,y] of r.points)if(next<planned.length&&planned[next][0]===x&&planned[next][1]===y)next++;
const samePath=next===planned.length;
const decoded=r.points;
const colours=new Set(plan.stitches.filter(s=>s.cmd!=='end').map(s=>s.thread)).size,blocksOk=r.threads===colours&&r.colorChanges===colours-1;
console.log({points:decoded.length,planned:planned.length,matched:next,threads:r.threads,colorChanges:r.colorChanges,samePath,blocksOk});
if(!samePath||!blocksOk)process.exitCode=1;
