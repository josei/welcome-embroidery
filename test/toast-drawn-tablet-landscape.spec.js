import {test,expect} from '@playwright/test';

// A confirmation toast must be drawn, not merely reported as visible. At a tablet in portrait and a phone in landscape the
// status line is short, and the toast used to sit wholly outside its clipping box. The check compares the pixels in the
// toast's box with and without the toast: identical pixels mean nothing was drawn.
const SIZES=[[768,1024],[667,375],[375,667],[390,844],[1024,768]];

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 page.on('dialog',d=>d.accept());
});

async function addRectangle(page,width,height,lang){
 await page.setViewportSize({width,height});
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('header.top')).toBeVisible();
 if(await page.locator('#restoreDialog[open]').count())await page.locator('#restoreNo').click();
 if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
 await page.locator('#rect').click();
 await expect(page.locator('#toast .toast-item').first()).toBeVisible();
}

// The toast's box, clipped to the viewport, as a clip rectangle for a screenshot.
async function toastClip(page){
 const box=await page.locator('#toast .toast-item').first().boundingBox();
 expect(box,'toast box').not.toBeNull();
 const vp=page.viewportSize();
 const x=Math.max(0,box.x),y=Math.max(0,box.y);
 const right=Math.min(vp.width,box.x+box.width),bottom=Math.min(vp.height,box.y+box.height);
 expect(right-x,'toast has width on screen').toBeGreaterThan(0);
 expect(bottom-y,'toast has height on screen').toBeGreaterThan(0);
 return {x,y,width:right-x,height:bottom-y};
}

for(const [width,height] of SIZES) for(const lang of ['en','es']){
 test(`the confirmation toast is drawn at ${width}x${height} (${lang})`,async({page})=>{
  await addRectangle(page,width,height,lang);
  const toast=page.locator('#toast .toast-item').first();
  await expect(toast).toBeVisible();
  const clip=await toastClip(page);
  const shown=await page.screenshot({clip});
  await page.addStyleTag({content:'#toast{visibility:hidden!important}'});
  const hidden=await page.screenshot({clip});
  expect(shown.equals(hidden),`toast pixels differ from the empty area at ${width}x${height}`).toBe(false);
 });
}

// At the tablet and landscape sizes the toast must not cover the zoom bar, the selection bar or a form field. Each is checked by its
// visible boxes. Phone portrait keeps its own toast placement, so it is not checked here.
for(const [width,height] of [[768,1024],[667,375]]) for(const lang of ['en','es']){
 test(`the confirmation toast covers no zoom, selection or field control at ${width}x${height} (${lang})`,async({page})=>{
  await addRectangle(page,width,height,lang);
  const toast=await toastClip(page);
  const covered=await page.evaluate(([x,y,w,h])=>{
   const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
   const sel='.zoombar button,.floating button,.floating input,.floating select,input:not([type=hidden]),select,textarea,#toast .toast-action,#toast [data-close-control]';
   return [...document.querySelectorAll(sel)].filter(visible).filter(e=>{
    const r=e.getBoundingClientRect();
    return Math.min(x+w,r.right)>Math.max(x,r.left)&&Math.min(y+h,r.bottom)>Math.max(y,r.top);
   }).map(e=>e.id||e.className||e.tagName);
  },[toast.x,toast.y,toast.width,toast.height]);
  expect(covered,`controls under the toast at ${width}x${height}`).toEqual([]);
 });
}
