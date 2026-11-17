import {test,expect} from '@playwright/test';

// The Stitches view and the Export card fit a landscape phone (844x390) and a tablet in portrait (820x1180): the hoop, the zoom
// bar and the Messages pill are all on screen without overlapping, the zoom bar is the one row used at other sizes with All,
// Messages has a margin from the bottom edge, and the Export Download button is in view.
const LANDSCAPE=[844,390],TABLET=[820,1180];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEditor(page,[width,height],lang){
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await expect(page.locator('.tool-rail')).toBeVisible();
}

async function openStitches(page,size,lang){
 const label=lang==='en'?'Stitches':'Puntadas';
 if(size===TABLET) await page.locator('.canvas-views button').filter({hasText:label}).first().click();
 else{
  await page.locator('#phoneMenu').click();
  await page.locator('#phoneMenuList button, #phoneMenuList [role=menuitem]').filter({hasText:label}).first().click();
 }
 await expect(page.locator('.layout main:not(.design-view)')).toHaveCount(1);
 await page.waitForTimeout(300);
}

const box=(page,selector)=>page.evaluate(s=>{
 const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();
 return {l:r.left,t:r.top,r:r.right,b:r.bottom};
},selector);

const overlaps=(a,b)=>a&&b&&Math.min(a.r,b.r)-Math.max(a.l,b.l)>0.5&&Math.min(a.b,b.b)-Math.max(a.t,b.t)>0.5;

for(const lang of ['en','es']){
 test(`landscape Stitches: the hoop sits inside the canvas, clear of the zoom bar (${lang})`,async({page})=>{
  await openEditor(page,LANDSCAPE,lang);
  await openStitches(page,LANDSCAPE,lang);
  const canvas=await box(page,'.layout main:not(.design-view) .canvas'),hoop=await box(page,'#hoopOuter'),zoom=await box(page,'.canvas .zoombar');
  expect(hoop.t).toBeGreaterThanOrEqual(canvas.t);
  expect(hoop.b).toBeLessThanOrEqual(canvas.b);
  expect(hoop.l).toBeGreaterThanOrEqual(canvas.l);
  expect(hoop.r).toBeLessThanOrEqual(canvas.r);
  expect(overlaps(zoom,hoop)).toBe(false);
  expect(zoom.b).toBeLessThanOrEqual(canvas.b);
  await page.screenshot({path:`test-results/landscape-stitches-${lang}.png`});
 });

 test(`landscape Stitches: the zoom bar is one row with All, clear of the top bar (${lang})`,async({page})=>{
  await openEditor(page,LANDSCAPE,lang);
  await openStitches(page,LANDSCAPE,lang);
  const zoom=await box(page,'.canvas .zoombar'),all=await box(page,'.canvas .zoombar #zoomAll'),top=await box(page,'.top');
  expect(zoom.t).toBeGreaterThanOrEqual(top.b);
  expect(Math.abs(all.t-(await box(page,'.canvas .zoombar #zoomOut')).t)).toBeLessThan(1);
  expect(all.r).toBeLessThanOrEqual(zoom.r);
  expect(zoom.r-zoom.l).toBeGreaterThan(zoom.b-zoom.t);
 });

 for(const [name,size] of [['landscape',LANDSCAPE],['tablet',TABLET]]){
  test(`Messages keeps a margin from the bottom edge at ${name} size in Stitches (${lang})`,async({page})=>{
   await openEditor(page,size,lang);
   await openStitches(page,size,lang);
   const msg=await box(page,'#messagesBtn'),footer=await box(page,'.layout main:not(.design-view)>footer');
   expect(footer.b-msg.b).toBeGreaterThanOrEqual(6);
   expect(msg.b).toBeLessThanOrEqual(footer.b);
   await page.screenshot({path:`test-results/${name}-stitches-${lang}.png`});
  });
 }

 test(`Export at 844x390: the Download button is in view with the other controls (${lang})`,async({page})=>{
  await openEditor(page,LANDSCAPE,lang);
  await page.locator('#export').click();
  const download=page.locator('#download'),cancel=page.locator('#exportDialog .dialog-actions button').last();
  await expect(download).toBeVisible();
  const d=await box(page,'#download');
  expect(d.t).toBeGreaterThanOrEqual(0);
  expect(d.b).toBeLessThanOrEqual(LANDSCAPE[1]);
  const c=await cancel.boundingBox();
  expect(c.y+c.height).toBeLessThanOrEqual(LANDSCAPE[1]);
  await page.locator('#exportDialog form').evaluate(f=>{f.scrollTop=f.scrollHeight;});
  const after=await box(page,'#download');
  expect(after.b).toBeLessThanOrEqual(LANDSCAPE[1]);
  await page.screenshot({path:`test-results/landscape-export-${lang}.png`});
 });
}
