// In-browser compile benchmark: the same fixtures as scripts/bench-compile.mjs, run through the app's real stitch worker (src/worker.js).
// Usage: npm run bench:browser [--runs=5] [--sizes=12,34]   (PW_BROWSER=webkit for the WebKit engine)
// On macOS 14 the WebKit build is frozen and newer Playwright clients cannot open a page in it. Use an older client and that build:
//   PW_BROWSER=webkit PW_DRIVER=/path/to/playwright-core/index.mjs WEBKIT_EXECUTABLE=/path/to/webkit/pw_run.sh npm run bench:browser
// Measures round trips from the page (compile, and compile + JEF encode), the longest main-thread gap while the worker is busy, and JS heap where the browser reports it.
import {execFileSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const [k,v='1']=a.replace(/^--/,'').split('=');return [k,v];}));
const runs=Number(args.runs||5),sizes=String(args.sizes||'12,34').split(',').map(Number);
const port=Number(process.env.BENCH_PORT||18791),base=`http://127.0.0.1:${port}`;
const engineName=process.env.PW_BROWSER||'chromium';
const {chromium,webkit}=process.env.PW_DRIVER?await import(process.env.PW_DRIVER):await import('playwright');
execFileSync(process.execPath,[path.join(root,'scripts/build-static.mjs')],{cwd:root,stdio:'inherit'});
const server=spawn(process.execPath,[path.join(root,'scripts/serve-dist.mjs')],{cwd:root,env:{...process.env,HOST:'127.0.0.1',PORT:String(port)},stdio:['ignore','inherit','inherit']});
try{
 for(let i=0;;i++){try{if((await fetch(`${base}/health`)).ok)break;}catch{}if(i>100)throw Error('static server did not start');await new Promise(r=>setTimeout(r,100));}
 const launcher=engineName==='webkit'?webkit:chromium;
 const browser=await launcher.launch(engineName==='webkit'&&process.env.WEBKIT_EXECUTABLE?{executablePath:process.env.WEBKIT_EXECUTABLE}:{});
 const page=await browser.newPage();
 await page.goto(`${base}/health`);
 const results=await page.evaluate(async({sizes,runs})=>{
  const {initialDocument,applyOperations}=await import('/src/engine.js');
  const heap=()=>performance.memory?.usedJSHeapSize??null;
  const median=xs=>{const s=[...xs].sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
  const worker=new Worker('/src/worker.js',{type:'module'});
  const pending=new Map();let seq=0;
  worker.onmessage=e=>{const cb=pending.get(e.data.id);if(cb){pending.delete(e.data.id);cb(e.data);}};
  const call=msg=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,r=>r.ok?resolve(r):reject(Error(r.error)));worker.postMessage({...msg,id,generation:1});});
  // Same 100 filled squares as scripts/bench-compile.mjs, so stitch counts can be compared with the Node baseline.
  const buildDoc=size=>{
   const doc=initialDocument();doc.objects=[];doc.hoop=400;
   const cols=10,step=size+4,ops=[];
   for(let i=0;i<100;i++){const c=i%cols,r=Math.floor(i/cols);ops.push({op:'add_shape',id:`s${i}`,kind:'rect',x:-(cols*step)/2+c*step,y:-(cols*step)/2+r*step,width:size,height:size,thread:'#527461',stitch:'fill'});}
   applyOperations(doc,ops);return doc;
  };
  const out=[];
  for(const size of sizes){
   const doc=buildDoc(size);
   const compileMs=[],exportMs=[],gaps=[];let stitches=0,bytes=0,heapMiB=null;
   // Warm-up: first call loads the worker module and the compile code paths.
   await call({type:'compile',document:doc});
   for(let r=0;r<runs;r++){
    // A 5 ms timer measures main-thread gaps while the worker is busy; a worker design keeps these short.
    let last=performance.now(),maxGap=0;
    const tick=setInterval(()=>{const now=performance.now();maxGap=Math.max(maxGap,now-last);last=now;},5);
    const t0=performance.now();const res=await call({type:'compile',document:doc});const t1=performance.now();
    clearInterval(tick);
    compileMs.push(t1-t0);gaps.push(maxGap);stitches=res.plan.count;
    const t2=performance.now();const exp=await call({type:'export',document:doc,format:'jef',color:'#527461'});const t3=performance.now();
    exportMs.push(t3-t2);bytes=exp.bytes.byteLength;const h=heap();heapMiB=h===null?null:Math.round(h/1048576);
   }
   out.push({size,objects:doc.objects.length,stitches,compileMs:Math.round(median(compileMs)),exportMs:Math.round(median(exportMs)),maxMainGapMs:Math.round(Math.max(...gaps)),jefBytes:bytes,heapMiB});
  }
  worker.terminate();
  return out;
 },{sizes,runs});
 await browser.close();
 const info={engine:engineName,runs,hardware:`${process.platform} ${process.arch}`,node:process.version};
 console.log(JSON.stringify({...info,results}));
 for(const r of results)console.log(`${r.size} mm: ${r.stitches} stitches, compile ${r.compileMs} ms, compile+JEF ${r.exportMs} ms, longest main-thread gap ${r.maxMainGapMs} ms, heap ${r.heapMiB??'n/a'} MiB`);
}finally{server.kill();}
