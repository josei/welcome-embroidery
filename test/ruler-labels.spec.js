import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

// Ruler labels are drawn on a canvas, so their size is read from the drawing calls rather than from CSS. The floor is
// 11 px on every screen size: the same ruler on phone, tablet and desktop. The screenshots go to the artifacts folder
// of the turn when ARTIFACTS is set.

// Records the font each ruler canvas draws its labels with, before the app paints them.
const recordRulerFonts=page=>page.addInitScript(()=>{
 window.__rulerFonts=[];
 const fillText=CanvasRenderingContext2D.prototype.fillText;
 CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){
  const id=this.canvas?.id;
  if(id==='rulerTop'||id==='rulerLeft')window.__rulerFonts.push({id,font:this.font,text:String(text)});
  return fillText.call(this,text,x,y,...rest);
 };
});

const openEditor=async(page,width,height)=>{
 page.on('dialog',d=>d.accept().catch(()=>{}));
 await page.setViewportSize({width,height});
 await page.goto('/');
 await expect(page.locator('header.top #name')).toBeVisible();
 await page.waitForFunction(()=>window.__rulerFonts?.length>0);
 await page.evaluate(()=>document.fonts.ready);
};

for(const [width,height] of [[768,1024],[1280,800]]){
 test(`ruler labels are at least 11px at ${width}x${height}`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await recordRulerFonts(page);
  await openEditor(page,width,height);
  const labels=await page.evaluate(()=>window.__rulerFonts);
  for(const id of ['rulerTop','rulerLeft']){
   const drawn=labels.filter(l=>l.id===id&&/^-?[\d.]+$/.test(l.text));
   expect(drawn.length,`${id} draws number labels`).toBeGreaterThan(0);
   const sizes=drawn.map(l=>parseFloat(l.font));
   expect(Math.min(...sizes),`${id} label font size`).toBeGreaterThanOrEqual(11);
  }
  expect(errors).toEqual([]);
 });
}

const SCREENS=[[390,844],[844,390],[768,1024],[1280,800]];
const ARTIFACTS=process.env.ARTIFACTS||'';

test('the ruler screenshots at phone, tablet and desktop sizes are written to the artifacts folder',async({browser})=>{
 test.skip(!ARTIFACTS,'set ARTIFACTS to a folder to write the screenshots');
 mkdirSync(ARTIFACTS,{recursive:true});
 for(const [width,height] of SCREENS){
  // A fresh context per screen, so one size's saved design or restored document never changes the next.
  const context=await browser.newContext({viewport:{width,height}});
  const page=await context.newPage();
  await page.addInitScript(()=>{delete window.showSaveFilePicker;});
  await page.goto('/');
  await expect(page.locator('header.top #name')).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  await page.screenshot({path:`${ARTIFACTS}/ruler-${width}x${height}.png`});
  await context.close();
 }
});
