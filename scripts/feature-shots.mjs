import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {pinnedMachineFixture} from '../test/fixture-archive.js';
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
  'beads': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('bead');await p.locator('button[data-view="stitches"]').click();},
  'bling': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('bling');},
  'bling-hexagon': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('bling');await p.locator('#blingShape').selectOption('hexagon');await p.locator('button[data-view="stitches"]').click();},
  'sequin-twin': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('sequin');await p.locator('#sequinTwin').check();await p.locator('button[data-view="stitches"]').click();},
  'stone-turn': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('bling');await p.locator('#blingShape').selectOption('hexagon');await p.locator('button[data-view="stitches"]').click();},
  'bling-one-ring': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('bling');await p.locator('#blingRings').selectOption('1');await p.locator('button[data-view="stitches"]').click();},
  'fill-laydown': async p=>{await p.locator('#path').click();const m=await p.evaluate(()=>{const c=document.querySelector('#art').getScreenCTM();return {a:c.a,d:c.d,e:c.e,f:c.f};});for(const [x,y] of [[-25,-15],[25,-15],[25,15],[-25,15],[-25,-15]]){const q={x:m.a*x+m.e,y:m.d*y+m.f};await p.mouse.click(q.x,q.y);}await p.keyboard.press('Enter');await p.locator('#type').selectOption('fill');await p.locator('#underlayType').selectOption('laydown');await p.locator('button[data-view="stitches"]').click();},
  'fabric-towel': async p=>{await p.locator('#path').click();const m=await p.evaluate(()=>{const c=document.querySelector('#art').getScreenCTM();return {a:c.a,d:c.d,e:c.e,f:c.f};});for(const [x,y] of [[-25,-15],[25,-15],[25,15],[-25,15],[-25,-15]]){const q={x:m.a*x+m.e,y:m.d*y+m.f};await p.mouse.click(q.x,q.y);}await p.keyboard.press('Enter');await p.locator('#type').selectOption('fill');await p.locator('#secDoc').evaluate(d=>{d.open=true;});await p.locator('#fabric').selectOption('towel');await p.locator('button[data-view="stitches"]').click();},
  'redwork-outline': async p=>{await p.locator('#path').click();const m=await p.evaluate(()=>{const c=document.querySelector('#art').getScreenCTM();return {a:c.a,d:c.d,e:c.e,f:c.f};});for(const [x,y] of [[-25,-15],[25,-15],[25,15],[-25,15],[-25,-15]]){const q={x:m.a*x+m.e,y:m.d*y+m.f};await p.mouse.click(q.x,q.y);}await p.keyboard.press('Enter');await p.locator('details:has(#redworkOutline)').evaluate(d=>{d.open=true;});await p.locator('#redworkOutline').click();await p.locator('button[data-view="stitches"]').click();},
  'satin-end-inset': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('satin');await p.locator('#endInset').fill('1.5');await p.locator('#endInset').press('Tab');await p.locator('button[data-view="stitches"]').click();},
  'sequin-fill': async p=>{await p.locator('#path').click();const m=await p.evaluate(()=>{const c=document.querySelector('#art').getScreenCTM();return {a:c.a,d:c.d,e:c.e,f:c.f};});for(const [x,y] of [[-25,-15],[25,-15],[25,15],[-25,15],[-25,-15]]){const q={x:m.a*x+m.e,y:m.d*y+m.f};await p.mouse.click(q.x,q.y);}await p.keyboard.press('Enter');await p.locator('#type').selectOption('fill');await p.locator('#fillMethod').selectOption('sequin');await p.locator('button[data-view="stitches"]').click();},
  'satin-pull': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('satin');await p.locator('#pullRight').fill('1.5');await p.locator('#pullRight').press('Tab');await p.locator('button[data-view="stitches"]').click();},
  'bead-twin': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('bead');await p.locator('#beadShape').selectOption('dot');await p.locator('#beadTwin').check();await p.locator('button[data-view="stitches"]').click();},
  'bead-dot': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('bead');await p.locator('#beadShape').selectOption('dot');await p.locator('button[data-view="stitches"]').click();},
  'bling-heart': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('bling');await p.locator('#blingShape').selectOption('heart');await p.locator('button[data-view="stitches"]').click();},
  'bling-star': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('bling');await p.locator('#blingShape').selectOption('star');await p.locator('button[data-view="stitches"]').click();},
  'bling-oval': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('bling');await p.locator('#blingShape').selectOption('oval');await p.locator('button[data-view="stitches"]').click();},
  'bling-square': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('bling');await p.locator('#blingShape').selectOption('square');},
  'motif-loops-leaf': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('motif');await p.locator('#motifShape').selectOption('leaf');},
  'motif-pairs-taper': async p=>{await drawPath(p,line);await p.locator('#type').selectOption('motif');await p.locator('#motifPair').check();await p.locator('#satinWidthEnd').fill('8');await p.locator('#satinWidthEnd').press('Tab');},
  'motif-fill': async p=>{await drawShape(p,[[-20,-20],[20,-20],[20,20],[-20,20]]);await p.locator('#fillMethod').selectOption('motif');},
  'motif-path-warp': async p=>{await drawPath(p,[[-40,0],[0,12],[40,0]]);await p.locator('#type').selectOption('motif');await p.locator('#motifWarp').selectOption('along');await p.locator('button[data-view="stitches"]').click();},
  'motif-fill-warp':async p=>{await drawShape(p,[[-20,-20],[20,-20],[20,20],[-20,20]]);await p.locator('#fillMethod').selectOption('motif');await p.locator('#motifWarp').selectOption('x');},
  'redwork': async p=>{await drawPath(p,[[-30,-10],[-10,10],[10,-10],[30,10]]);await p.locator('#runStyle').selectOption('redwork');},
  'buttonhole': async p=>{await drawPath(p,[[-20,0],[20,0]]);await p.locator('#type').selectOption('satin');await p.locator('#satinButtonhole').check();},
  'raised-satin': async p=>{await drawPath(p,[[-20,0],[20,0]]);await p.locator('#type').selectOption('satin');await p.locator('#satinRaised').check();},
  'batch-sew': async p=>{await p.locator('#rect').click();await p.locator('#secArray summary').click();await p.locator('#arrCount').fill('400');await p.locator('#arrCount').press('Tab');await p.locator('#batchFormat').selectOption('sew');},
  'batch-formats': async p=>{await p.locator('#rect').click();await p.locator('#secArray summary').click();await p.locator('#arrCount').fill('400');await p.locator('#arrCount').press('Tab');await p.locator('#batchFormat').selectOption('vp3');},
  'batch-plan': async p=>{await p.locator('#rect').click();await p.locator('#secArray summary').click();await p.locator('#arrCount').fill('400');await p.locator('#arrCount').press('Tab');},
  'export-pes6': async p=>{await p.locator('#rect').click();await p.locator('#export').click();await p.locator('#format').selectOption('pes6');},
  'thread-worksheet': async p=>{await p.locator('#rect').click();await p.locator('#thread').selectOption('#d9897e');await p.locator('#ellipse').click();await p.locator('#thread').selectOption('#527461');await p.locator('#secPlan summary').click();await p.locator('#secPlan').scrollIntoViewIfNeeded();},
  'import-sew': async p=>{const f=pinnedMachineFixture('sew');await p.locator('#machineFile').setInputFiles({name:'sample.sew',mimeType:'application/octet-stream',buffer:Buffer.from(f.bytes)});await p.locator('button[data-view="stitches"]').click();},
  'import-pec': async p=>{const f=pinnedMachineFixture('pec');await p.locator('#machineFile').setInputFiles({name:'sample.pec',mimeType:'application/octet-stream',buffer:Buffer.from(f.bytes)});await p.locator('button[data-view="stitches"]').click();},
  'import-exp': async p=>{const f=pinnedMachineFixture('exp');await p.locator('#machineFile').setInputFiles({name:'sample.exp',mimeType:'application/octet-stream',buffer:Buffer.from(f.bytes)});await p.locator('button[data-view="stitches"]').click();},
  'batch-imported': async p=>{const f=pinnedMachineFixture('jef');await p.locator('#machineFile').setInputFiles({name:'sample.jef',mimeType:'application/octet-stream',buffer:Buffer.from(f.bytes)});await p.locator('#secArray summary').click();await p.locator('#arrCount').fill('3');await p.locator('#arrCount').press('Tab');},
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
