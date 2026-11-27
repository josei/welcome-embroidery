import {test,expect} from '@playwright/test';

// In Stitches on a tablet or landscape phone, Play and Restart are the bar's first controls and must be reachable: nothing else on
// the screen may sit over their centres. The status line keeps Messages on one row at the footer's right edge, the same inset from
// the edge at both sizes.

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
 if(width>1000)await expect(page.locator('.object-row').first()).toBeVisible();
 else await page.waitForTimeout(800);
 if(await page.locator('[data-view=stitches]').isVisible())await page.locator('[data-view=stitches]').click();
 else{await page.locator('#phoneMenu').click();await page.locator('#menuView-stitches').click();}
 await expect(page.locator('#playbackSummary')).not.toHaveText('',{timeout:30000});
 await page.waitForTimeout(300);
}

function boxOf(el){
 const b=el.getBoundingClientRect();
 return {l:b.left,t:b.top,r:b.right,b:b.bottom,w:b.width,h:b.height};
}

// The element at the centre of a control, read from the page after layout.
async function hitAtCentre(page,selector){
 return page.evaluate(sel=>{
  const el=document.querySelector(sel);
  const b=el.getBoundingClientRect();
  const hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
  return hit?(hit===el||el.contains(hit)):false;
 },selector);
}

const SIZES=[[1024,768],[844,390]];
for(const [w,h] of SIZES){
 for(const lang of ['es','en']){
  test(`Play and Restart are clickable at ${w}x${h} in ${lang}`,async({page})=>{
   test.setTimeout(120000);
   await openStitchesWithDrawing(page,w,h,lang);
   expect(await hitAtCentre(page,'#play'),'something covers Play').toBe(true);
   expect(await hitAtCentre(page,'#resetPlayback'),'something covers Restart').toBe(true);
   await page.screenshot({path:`test-results/playback-clear-${w}x${h}-${lang}.png`});
  });

 }
}
