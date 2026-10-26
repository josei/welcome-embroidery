import {initialDocument,applyOperations,compile,encode} from '../src/engine.js';
const size=Number(process.argv[2]||12);
const doc=initialDocument();doc.objects=[];doc.hoop=400;
const cols=10,step=size+4,ops=[];
for(let i=0;i<100;i++){const c=i%cols,r=Math.floor(i/cols);ops.push({op:'add_shape',id:`s${i}`,kind:'rect',x:-(cols*step)/2+c*step,y:-(cols*step)/2+r*step,width:size,height:size,thread:'#527461',stitch:'fill'});}
applyOperations(doc,ops);
const t0=performance.now();const plan=compile(doc);const compileMs=performance.now()-t0;
const t1=performance.now();const bytes=encode(plan,'jef','#527461',400,doc);const encodeMs=performance.now()-t1;
console.log(JSON.stringify({objects:doc.objects.length,stitches:plan.count,compileMs:Math.round(compileMs),encodeMs:Math.round(encodeMs),jefBytes:bytes.length,heapMiB:Math.round(process.memoryUsage().heapUsed/1048576)}));
