import {test,expect} from '@playwright/test';

// On a phone, the empty-design canvas hint wraps to the screen width instead of running off both edges,
// in English and Spanish, and its full text stays in the DOM.
const PHONE=[390,844];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

for(const lang of ['en','es']) test(`the empty-design canvas hint fits a 390-wide phone and wraps to at most 3 lines (${lang})`,async({page})=>{
 page.on('dialog',d=>d.accept());
 // A fresh load opens a sample design, and New is hidden at phone widths: make the empty design at desktop width, then shrink.
 await page.setViewportSize({width:1280,height:800});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.locator('#new').click();
 if(await page.locator('#discardDialog[open]').count()) await page.locator('#discardDiscard').click();
 await expect(page.locator('.object-row')).toHaveCount(0);
 await page.setViewportSize({width:PHONE[0],height:PHONE[1]});
 const hint=page.locator('#canvasHint');
 await expect(hint).toBeVisible();
 const box=await hint.boundingBox();
 expect(box.x,'left edge inside the window').toBeGreaterThanOrEqual(0);
 expect(box.x+box.width,'right edge inside the window').toBeLessThanOrEqual(PHONE[0]);
 const lineHeight=parseFloat(await hint.evaluate(el=>getComputedStyle(el).lineHeight));
 const padding=await hint.evaluate(el=>{const s=getComputedStyle(el);return parseFloat(s.paddingTop)+parseFloat(s.paddingBottom);});
 expect(box.height-padding,'text lines fit in 3 line-heights').toBeLessThanOrEqual(3*lineHeight+1);
 const text=await hint.evaluate(el=>el.textContent.trim());
 expect(text.length).toBeGreaterThan(0);
 expect(await hint.evaluate(el=>getComputedStyle(el).textOverflow)).not.toBe('ellipsis');
 // Occlusion: the hint has pointer-events:none, so elementFromPoint returns what is painted beneath it at its centre
 // and corners. If that is tool chrome, the chrome covers the text a user is meant to read.
 const chrome='.tool-rail,.floating,.zoombar,#rulerLeft,#rulerTop,.ruler-corner';
 const points=[[0.5,0.5],[0.02,0.1],[0.98,0.1],[0.02,0.9],[0.98,0.9]];
 for(const [fx,fy] of points){
  const x=box.x+box.width*fx,y=box.y+box.height*fy;
  const under=await page.evaluate(([x,y,chrome])=>{const el=document.elementFromPoint(x,y);return el?(el.closest(chrome)?el.closest(chrome).className||el.closest(chrome).id:'none'):'null';},[x,y,chrome]);
  expect(under,`no tool chrome covers the hint at (${Math.round(x)},${Math.round(y)})`).toBe('none');
 }
});
