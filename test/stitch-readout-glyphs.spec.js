import {test,expect} from '@playwright/test';

// On a phone and a tablet the Stitches view's readouts are icons and numbers. Each readout has its own glyph, so colours used,
// colour changes, trims, thread length and stitch count never read as one another, and none borrows the glyph of a control.

test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function seedTwoColours(page,lang){
 const {initialDocument,applyOperations}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=400;doc.name='Probe';doc.revision=1;
 applyOperations(doc,[
  {op:'add_shape',id:'s0',kind:'rect',x:0,y:0,width:20,height:15.1,thread:'#cc3333',stitch:'fill'},
  {op:'add_shape',id:'s1',kind:'rect',x:30,y:0,width:20,height:15.1,thread:'#2255aa',stitch:'fill'},
 ]);
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.locator('#restoreYes').click();
 await expect(page.locator('.object-row')).toHaveCount(2);
 await expect(page.locator('#count')).toContainText(/\d/);
}

const iconsIn=(page,sel)=>page.locator(`${sel} .figure use`).evaluateAll(us=>us.map(u=>u.getAttribute('href')));

for(const [width,height] of [[390,844],[768,1024]]) test(`${width}x${height} es: each Stitches readout has its own glyph`,async({page})=>{
 await page.setViewportSize({width,height});
 await seedTwoColours(page,'es');
 if(width<600){await page.locator('#phoneMenu').click();await page.locator('#menuView-stitches').click();}
 else await page.locator('[data-view=stitches]').click();
 await expect(page.locator('#play')).toBeVisible();
 await expect(page.locator('#playbackSummary')).not.toBeEmpty();
 await expect(page.locator('#playbackSummary .figure')).toHaveCount(3);
 const summary=await iconsIn(page,'#playbackSummary');
 const layers=await iconsIn(page,'.layers-count');
 const count=await iconsIn(page,'#playbackStitches');
 const used=[...summary,...layers,...count];
 expect(new Set(used).size,`readout glyphs ${used.join(' ')}`).toBe(used.length);
 expect(layers[1]).not.toBe(summary[0]);
 for(const href of used) expect(href).not.toBe('#i-run');
 await expect(page.locator('#playbackStitches')).not.toContainText('---');
 await page.screenshot({path:`test-results/stitches-readouts-es-${width}x${height}.png`});
});

// Seeds a design of two squares: outside the hoop when `outside` is set, or two overlapping squares (sewing tips only) when not.
async function seedDesign(page,{outside,overlap}){
 const {initialDocument,applyOperations,validateDocument}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=400;doc.name='Probe';doc.revision=1;
 const second=overlap?{x:0,y:0,thread:'#cc3333'}:{x:outside?300:30,y:0,thread:'#2255aa'};
 applyOperations(doc,[
  {op:'add_shape',id:'s0',kind:'rect',x:0,y:0,width:20,height:15.1,thread:'#cc3333',stitch:'fill'},
  {op:'add_shape',id:'s1',kind:'rect',x:second.x,y:second.y,width:20,height:15.1,thread:second.thread,stitch:'fill'},
 ]);
 validateDocument(doc);
 await page.goto('/?lang=es');
 await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
 await page.goto('/?lang=es');
 await page.locator('#restoreYes').click();
 await expect(page.locator('.object-row')).toHaveCount(2);
}

async function openStitches(page,width){
 if(width<600){await page.locator('#phoneMenu').click();await page.locator('#menuView-stitches').click();}
 else await page.locator('[data-view=stitches]').click();
}

for(const [width,height] of [[390,844],[768,1024]]) {
 test(`${width}x${height} es: over the hoop, Stitches view keeps one count and the chip carries the warning triangle`,async({page})=>{
  page.on('dialog',d=>d.accept());
  await page.setViewportSize({width,height});
  await seedDesign(page,{outside:true});
  await openStitches(page,width);
  await expect(page.locator('#playbackStitches')).toContainText(/\d/);
  await expect(page.locator('#count')).toBeEmpty();
  const chip=page.locator('#issuesBtn');
  await expect(chip).toBeVisible();
  await expect(chip.locator('svg use')).toHaveAttribute('href','#i-issues');
  await expect(chip).toHaveAttribute('aria-label',/aviso|problema/i);
  const box=await chip.boundingBox();
  expect(box.x+box.width,'chip inside the screen').toBeLessThanOrEqual(width);
  expect(box.y+box.height,'chip inside the screen').toBeLessThanOrEqual(height);
 });

 test(`${width}x${height} es: with only sewing tips, the chip shows a lightbulb and stays inside the screen`,async({page})=>{
  await page.setViewportSize({width,height});
  await seedDesign(page,{overlap:true});
  await openStitches(page,width);
  const chip=page.locator('#issuesBtn');
  await expect(chip).toBeVisible();
  await expect(chip.locator('svg use')).toHaveAttribute('href','#i-tip');
  const box=await chip.boundingBox();
  expect(box.x+box.width,'chip inside the screen').toBeLessThanOrEqual(width);
  expect(box.y+box.height,'chip inside the screen').toBeLessThanOrEqual(height);
  expect(box.height,'chip keeps its height').toBeGreaterThanOrEqual(20);
 });
}
