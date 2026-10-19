// Compare Welcome's DST output with pinned pystitch: needle coordinates must equal pystitch's decode of the matching JEF, and colour/trim counts must agree.
// PYSTITCH_SRC=/path/to/pystitch/src node scripts/verify-dst.mjs
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {initialDocument,applyOperations,compile,encode} from '../src/engine.js';
const src=process.env.PYSTITCH_SRC||'/tmp/welcom-supervisor/pystitch/src',dir=mkdtempSync(path.join(tmpdir(),'dst-'));
const d=initialDocument();d.objects=[];d.settings.trims=true;d.settings.ties=true;
applyOperations(d,[{op:'add_path',id:'a',x:0,y:0,points:[[-30,0],[-10,0]],thread:'#527461'},{op:'add_shape',id:'r',kind:'rect',x:5,y:-10,width:20,height:15,thread:'#d9897e'},{op:'add_path',id:'s',x:0,y:0,points:[[-30,20],[0,35],[30,20]],smooth:true,stitch:'satin',satinWidth:6,thread:'#d3ad61'},{op:'add_text',id:'t',text:'DST',x:-12,y:-30,height:8,thread:'#527461'}]);
const plan=compile(d);writeFileSync(path.join(dir,'a.dst'),encode(plan,'dst','#527461',110,d));writeFileSync(path.join(dir,'a.jef'),encode(plan,'jef','#527461',110,d));
const py=spawnSync('python3',['-I','-c',`import sys,json;sys.path.insert(0,${JSON.stringify(src)});import pystitch
a=pystitch.read(sys.argv[1]);b=pystitch.read(sys.argv[2])
n=lambda p:[(round(x),round(y)) for x,y,c in p.stitches if c&0xff==pystitch.STITCH]
print(json.dumps({"same":n(a)==n(b),"needles":len(n(a)),"colors":[a.count_color_changes(),b.count_color_changes()],"trims":[a.count_stitch_commands(pystitch.TRIM),b.count_stitch_commands(pystitch.TRIM)]}))`,path.join(dir,'a.dst'),path.join(dir,'a.jef')]);
if(py.status!==0)throw Error(py.stderr.toString());const r=JSON.parse(py.stdout.toString());console.log(r);
if(!r.same||r.colors[0]!==r.colors[1]||r.trims[0]!==r.trims[1])process.exitCode=1;
