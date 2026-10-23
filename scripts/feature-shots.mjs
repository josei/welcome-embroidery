import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
const base=process.argv[2]||'http://127.0.0.1:8790/';
const out='design/progress/features';mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
async function fresh(){
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  page.on('dialog',d=>d.accept());
  await page.goto(base,{waitUntil:'networkidle',timeout:60000});
  await page.locator('#new').click();
  return page;
}
async function drawPath(page,pts){
  await page.locator('#path').click();
  const m=await page.evaluate(()=>{const c=document.querySelector('#art').getScreenCTM();return {a:c.a,d:c.d,e:c.e,f:c.f};});
  for(const [x,y] of pts){const q={x:m.a*x+m.e,y:m.d*y+m.f};await page.mouse.click(q.x,q.y);}
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
}
async function drawShape(page,pts){
  await page.locator('#path').click();
  const m=await page.evaluate(()=>{const c=document.querySelector('#art').getScreenCTM();return {a:c.a,d:c.d,e:c.e,f:c.f};});
  for(const [x,y] of pts){const q={x:m.a*x+m.e,y:m.d*y+m.f};await page.mouse.click(q.x,q.y);}
  const f={x:m.a*pts[0][0]+m.e,y:m.d*pts[0][1]+m.f};await page.mouse.click(f.x,f.y);
  await page.waitForTimeout(300);
}
const line=[[-30,-10],[0,10],[30,-10]];
const cases={
  'sequins': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('sequin');},
  'beads': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('bead');},
  'bling': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('bling');},
  'bling-square': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('bling');await p.locator('#blingShape').selectOption('square');},
  'motif-loops-leaf': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('motif');await p.locator('#motifShape').selectOption('leaf');},
  'motif-pairs-taper': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('motif');await p.locator('#motifPair').check();await p.locator('#satinWidthEnd').fill('8');await p.locator('#satinWidthEnd').press('Tab');},
  'motif-fill': async p=>{await drawShape(p,[[-20,-20],[20,-20],[20,20],[-20,20]]);await p.locator('#fillMethod').selectOption('motif');},
  'motif-fill-warp': async p=>{await drawShape(p,[[-20,-20],[20,-20],[20,20],[-20,20]]);await p.locator('#fillMethod').selectOption('motif');await p.locator('#motifWarp').selectOption('x');},
  'redwork': async p=>{await drawPath(p,[[-30,-10],[-10,10],[10,-10],[30,10]]);await p.locator('#runStyle').selectOption('redwork');},
  'buttonhole': async p=>{await drawPath(p,[[-20,0],[20,0]]);await p.locator('#type').selectOption('satin');await p.locator('#satinButtonhole').check();},
  'raised-satin': async p=>{await drawPath(p,[[-20,0],[20,0]]);await p.locator('#type').selectOption('satin');await p.locator('#satinRaised').check();},
  'batch-plan': async p=>{await p.locator('#rect').click();await p.locator('#secArray summary').click();await p.locator('#arrCount').fill('400');await p.locator('#arrCount').press('Tab');},
  'export-pes6': async p=>{await p.locator('#rect').click();await p.locator('#export').click();await p.locator('#format').selectOption('pes6');},
  'export-sew': async p=>{await p.locator('#rect').click();await p.locator('#export').click();await p.locator('#format').selectOption('sew');},
};
const done=[];
// ONLY=export-sew,redwork re-shoots just the named features (the others keep their existing PNGs).
const only=process.env.ONLY?new Set(process.env.ONLY.split(',')):null;
for(const [name,setup] of Object.entries(cases)){
  if(only&&!only.has(name))continue;
  const page=await fresh();
  try{await setup(page);await page.waitForTimeout(800);await page.screenshot({path:path.join(out,`${name}.png`)});done.push(name);}
  catch(e){console.log('skipped',name,String(e.message).split('\n')[0]);}
  await page.close();
}
await browser.close();
console.log('feature shots:',done.join(', '));
