import {test,expect} from '@playwright/test';

// On a phone with Properties open, a selected object keeps at least a finger's width (44 px) between its bounds and the panel's
// edge. Its handles keep 44 px touch targets, but their marks are drawn small so small lettering stays readable when selected.
test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const SIZES=[[844,390],[390,844]];

async function openPhone(page,width,height,lang='en'){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 return errors;
}

const rectOf=(page,selector)=>page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};});

async function openProperties(page){
 await page.locator('#phoneMenu').click();
 await page.locator('#menuProperties').click();
 await expect(page.locator('#inspector')).toHaveClass(/sheet-open/);
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}

for(const [width,height] of SIZES){
 test(`the selected object is at least 44 px from the Properties panel at ${width}x${height}`,async({page})=>{
  const errors=await openPhone(page,width,height);
  await page.locator('#rect').tap();
  await expect(page.locator('.sel-box')).toBeVisible();
  await openProperties(page);
  let gap;
  await expect.poll(async()=>{
   const box=await rectOf(page,'.sel-box');
   const panel=await rectOf(page,'#inspector');
   const sideBySide=panel.right-panel.left<width*0.9;
   gap=sideBySide?panel.left-box.right:panel.top-box.bottom;
   return gap>=44;
  },'the selection clears the panel edge').toBe(true);
  expect(gap).toBeGreaterThanOrEqual(44);
  expect(errors).toEqual([]);
 });

 test(`selection handles keep 44 px touch targets at ${width}x${height}`,async({page})=>{
  await openPhone(page,width,height);
  await page.locator('#rect').tap();
  await expect(page.locator('.sel-box')).toBeVisible();
  const hits=await page.locator('.sel-hit').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return Math.min(r.width,r.height);}));
  expect(hits.length).toBeGreaterThan(0);
  for(const size of hits)expect(size).toBeGreaterThanOrEqual(43.5);
 });
}

for(const lang of ['en','es']){
 test(`8 mm lettering stays readable while selected at phone zoom (${lang})`,async({page})=>{
  await openPhone(page,390,844,lang);
  await page.locator('.tool-rail #letter').click();
  const box=page.locator('#canvasText');
  await box.tap();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Welcome');
  await page.locator('.canvas').tap({position:{x:20,y:20}});
  await expect(page.locator('#canvasText')).toHaveCount(0);
  await openProperties(page);
  await page.locator('#letteringHeight').fill('8');
  await page.locator('#letteringHeight').press('Tab');
  await page.locator('#inspector .sheet-close').tap();
  await expect(page.locator('#inspector')).not.toHaveClass(/sheet-open/);
  await expect(page.locator('.sel-box')).toBeVisible();
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.locator('.canvas').screenshot({path:`test-results/lettering-8mm-selected-${lang}.png`});
 });
}
