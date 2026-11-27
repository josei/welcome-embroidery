import {test,expect} from '@playwright/test';

// In Stitches on a tablet or landscape phone, Play and Restart are the bar's first controls and must be reachable: nothing else on
// the screen may sit over their centres. The status line keeps Messages on one row at the footer's right edge, the same inset from
// the edge at both sizes, so the footer never grows a third line that would push the playback row up into the zoom bar.

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

  test(`the footer holds only the playback row on the landscape phone, at the window edge (${w}x${h} ${lang})`,async({page})=>{
   test.skip(w!==844,'tablet keeps the Messages status row (checked below)');
   test.setTimeout(120000);
   await openStitchesWithDrawing(page,w,h,lang);
   await expect(page.locator('#messagesBtn')).toHaveCount(0);
   const m=await page.evaluate(()=>{
    const footer=document.querySelector('.layout main:not(.design-view)>footer').getBoundingClientRect();
    const bar=document.querySelector('.playback-bar').getBoundingClientRect();
    return {barBottom:Math.round(bar.bottom),footerBottom:Math.round(footer.bottom),windowH:window.innerHeight};
   });
   expect(m.barBottom,'playback row bottom is at the window edge').toBeGreaterThanOrEqual(m.windowH-1);
   expect(m.footerBottom,'footer bottom is at the window edge').toBeGreaterThanOrEqual(m.windowH-1);
  });

  test(`Messages is on the status row, at the footer's right edge, at ${w}x${h} in ${lang}`,async({page})=>{
   test.skip(w!==768,'landscape phone has no footer Messages button');
   test.setTimeout(120000);
   await openStitchesWithDrawing(page,w,h,lang);
   const m=await page.evaluate(()=>{
    const footer=document.querySelector('.layout main:not(.design-view)>footer');
    const msg=document.getElementById('messagesBtn');
    const bar=document.querySelector('.playback-bar');
    const kids=[...footer.children].filter(k=>k.getBoundingClientRect().height>0&&!k.matches('#toast'));
    const f=footer.getBoundingClientRect(), mb=msg.getBoundingClientRect(), pb=bar.getBoundingClientRect();
    // Each status item sits on the status row, below the playback row, and none sits on a row of its own.
    const statusTops=kids.filter(k=>k!==bar).map(k=>Math.round(k.getBoundingClientRect().top));
    return {
     insetRight: Math.round(f.right-mb.right),
     msgBottomInset: Math.round(f.bottom-mb.bottom),
     msgTop: Math.round(mb.top),
     barBottom: Math.round(pb.bottom),
     statusTops,
     clipped: msg.scrollWidth>msg.clientWidth,
    };
   });
   expect(m.insetRight,'Messages distance from the footer right edge').toBe(8);
   expect(m.msgBottomInset,'Messages sits on the status row').toBeLessThanOrEqual(0);
   expect(m.msgTop,'Messages is below the playback row').toBeGreaterThanOrEqual(m.barBottom);
   expect(m.clipped,'Messages is cut off').toBe(false);
   expect(new Set(m.statusTops).size,`status items on more than one row: ${m.statusTops}`).toBeLessThanOrEqual(2);
   await page.screenshot({path:`test-results/status-row-${w}x${h}-${lang}.png`});
  });
 }
}
