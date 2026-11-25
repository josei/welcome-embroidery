import {test,expect} from '@playwright/test';

// On a phone the Layers sheet scrolls as a whole. When its rows run past the bottom edge, the edge fades (data-more="true"),
// so the cut-off row reads as more to reach by scrolling; once the list is read to its end, the fade goes.

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 page.on('dialog',d=>d.accept());
});

const SIZES=[[360,640],[844,390]];

async function openLayers(page,lang,w,h){
 await page.setViewportSize({width:w,height:h});
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('header.top')).toBeVisible();
 if(await page.locator('#restoreDialog[open]').count())await page.locator('#restoreNo').click();
 if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
 await page.locator('#phoneMenu').click();
 await page.locator('#menuLayers').click();
 await expect(page.locator('#layersSheet.sheet-open')).toBeVisible();
 await expect(page.locator('#layersSheet[data-more]')).toHaveCount(1);
}

// Geometry of the visible rows inside the phone sheet, relative to the sheet's visible box.
function layout(){
 const sheet=document.getElementById('layersSheet');
 const sb=sheet.getBoundingClientRect();
 const rows=[...sheet.querySelectorAll('.object-row')].filter(r=>r.offsetParent);
 return {
  sheetBottom:Math.round(sb.bottom),
  more:sheet.dataset.more,
  scrollable:sheet.scrollHeight>sheet.clientHeight,
  rows:rows.map(r=>{
   const b=r.getBoundingClientRect();
   return {top:Math.round(b.top),bottom:Math.round(b.bottom),height:Math.round(b.height),
    name:r.querySelector('.row-text')?.textContent||''};
  }),
  controls:[...sheet.querySelectorAll('.row-eye,.row-lock')].filter(c=>c.offsetParent).map(c=>{
   const b=c.getBoundingClientRect();return {w:Math.round(b.width),h:Math.round(b.height),inView:b.right<=sb.right&&b.left>=sb.left};
  }),
 };
}

for(const [w,h] of SIZES){
 for(const lang of ['en','es']){
  test(`Layers sheet shows a scroll cue and reaches every row at ${w}x${h} in ${lang}`,async({page})=>{
   test.setTimeout(120000);
   await openLayers(page,lang,w,h);
   await expect.poll(()=>page.evaluate(()=>document.getElementById("layersSheet").dataset.more)).toBe("true");
   const start=await page.evaluate(layout);
   expect(start.rows.length,'rows').toBe(5);
   expect(start.scrollable,'list is taller than the sheet').toBe(true);
   expect(start.more,'cue shown at rest').toBe('true');
   await page.screenshot({path:`test-results/layers-${lang}-${w}x${h}-top.png`});

   // Every row can be scrolled to: the last row ends inside the sheet's visible box once the sheet is at its end.
   await page.locator('#layersSheet').evaluate(e=>{e.scrollTop=e.scrollHeight;});
   await expect.poll(()=>page.evaluate(()=>document.getElementById("layersSheet").dataset.more)).toBe("false");
   const end=await page.evaluate(layout);
   expect(end.more,'cue cleared at the end').toBe('false');
   const last=end.rows.at(-1);
   expect(last.bottom,'last row reachable').toBeLessThanOrEqual(end.sheetBottom);
   await page.screenshot({path:`test-results/layers-${lang}-${w}x${h}-end.png`});

   // Rows keep one line of height and eye and lock are full touch targets.
   const heights=new Set(end.rows.map(r=>r.height));
   expect(heights.size,'row heights are uniform').toBe(1);
   for(const c of end.controls){
    expect(c.w,'eye/lock width').toBeGreaterThanOrEqual(44);
    expect(c.h,'eye/lock height').toBeGreaterThanOrEqual(44);
   }
  });
 }
}
