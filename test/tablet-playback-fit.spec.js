import {test,expect} from '@playwright/test';

// On a tablet the thread summary under the seek track ("9 color changes · 0 trims · 4.0 m thread") reads on one line in both
// orientations and both languages, so nothing is cut off. The Spanish labels at 1024x768 are the widest case.

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 page.on('dialog',d=>d.accept());
});

async function openStitchesWithDrawing(page,width,height,lang){
 await page.setViewportSize({width,height});
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('header.top')).toBeVisible();
 if(await page.locator('#restoreDialog[open]').count())await page.locator('#restoreNo').click();
 if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
 await page.locator('#rect').click();
 const c=await page.locator('.canvas').boundingBox();
 await page.mouse.move(c.x+c.width*0.3,c.y+c.height*0.3);
 await page.mouse.down();
 await page.mouse.move(c.x+c.width*0.6,c.y+c.height*0.6,{steps:5});
 await page.mouse.up();
 await expect(page.locator('.object-row').first()).toBeVisible();
 if(await page.locator('[data-view=stitches]').isVisible())await page.locator('[data-view=stitches]').click();
 await expect(page.locator('#playbackSummary')).not.toHaveText('',{timeout:30000});
}

function summaryMetrics(){
 const s=document.getElementById('playbackSummary');
 const cs=getComputedStyle(s);
 const lineHeight=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.2;
 return {
  text:s.textContent,
  lines:Math.round(s.getBoundingClientRect().height/lineHeight),
  clipped:s.scrollWidth>s.clientWidth,
 };
}

const SIZES=[[768,1024],[1024,768]];
for(const [w,h] of SIZES){
 for(const lang of ['en','es']){
  test(`the thread summary is on one line and not cut off at ${w}x${h} in ${lang}`,async({page})=>{
   test.setTimeout(120000);
   await openStitchesWithDrawing(page,w,h,lang);
   const m=await page.evaluate(summaryMetrics);
   expect(m.clipped,`summary "${m.text}" is cut off`).toBe(false);
   expect(m.lines,`summary "${m.text}" lines`).toBe(1);
  });
 }
}
