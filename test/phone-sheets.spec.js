import {test,expect} from '@playwright/test';

// Issue #441: at phone widths (600 px and narrower) Layers and Properties open as bottom sheets from the buttons under the canvas
// (and from each other's headers). The canvas stays visible above an open sheet, no control in a sheet overlaps another, and the
// page does not scroll sideways, at 375 by 667 in English and Spanish, and at 390 by 844.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const sheetOf=page=>page.locator('.layout>aside.sheet-open');

// The visible part of the canvas above the open sheet, as a share of the viewport height.
const canvasShare=page=>page.evaluate(()=>{
 const c=document.querySelector('main .canvas').getBoundingClientRect();
 const sheet=document.querySelector('.layout>aside.sheet-open');
 const sheetTop=sheet?sheet.getBoundingClientRect().top:innerHeight;
 const visible=Math.max(0,Math.min(c.bottom,sheetTop)-Math.max(c.top,0));
 return visible/innerHeight;
});

// Controls inside a sheet whose boxes overlap (screen-reader-only fields and nested elements are not drawn, so they are skipped).
const overlappingControls=sheet=>sheet.evaluate(root=>{
 const drawn=[...root.querySelectorAll('button,input,select,textarea,summary,label,h2,h3,h4,span,p,output,a,div')].filter(e=>{
  if(e.tagName==='DIV'&&e.children.length)return false;
  const r=e.getBoundingClientRect(),cs=getComputedStyle(e);
  return r.width>2&&r.height>2&&cs.visibility!=='hidden'&&cs.display!=='none'&&!e.closest('.sr-only');
 });
 const hits=[];
 for(let i=0;i<drawn.length;i++)for(let j=i+1;j<drawn.length;j++){
  const a=drawn[i],b=drawn[j];
  if(a.contains(b)||b.contains(a))continue;
  const A=a.getBoundingClientRect(),B=b.getBoundingClientRect();
  const ox=Math.min(A.right,B.right)-Math.max(A.left,B.left),oy=Math.min(A.bottom,B.bottom)-Math.max(A.top,B.top);
  if(ox>1&&oy>1)hits.push(`${a.tagName} "${(a.textContent||'').trim().slice(0,24)}" / ${b.tagName} "${(b.textContent||'').trim().slice(0,24)}"`);
 }
 return hits;
});

for(const [width,height] of [[375,667],[390,844]]){
 test(`Layers and Properties open as bottom sheets at ${width}x${height}`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width,height});
  await page.goto('/?lang=en');
  const layersBtn=page.locator('.sheet-bar button').nth(0), propsBtn=page.locator('.sheet-bar button').nth(1);
  // Closed to start: no sheet, and the canvas has the screen.
  await expect(sheetOf(page)).toHaveCount(0);
  expect(await canvasShare(page)).toBeGreaterThan(0.5);
  // Layers opens as a sheet anchored to the bottom edge.
  await layersBtn.click();
  const layers=page.locator('#layersSheet');
  await expect(layers).toHaveClass(/sheet-open/);
  await expect(layersBtn).toHaveAttribute('aria-expanded','true');
  // The Properties button in the Layers header reports Properties closed, not the desktop inspector state.
  await expect(page.locator('.layers-head .inspector-toggle')).toHaveAttribute('aria-expanded','false');
  let box=await layers.boundingBox();
  expect(Math.round(box.y+box.height),'Layers sheet bottom edge').toBe(height);
  expect(await canvasShare(page),'canvas visible above Layers').toBeGreaterThanOrEqual(0.3);
  expect(await overlappingControls(layers),'no overlapping controls in Layers').toEqual([]);
  // Properties opens from the Properties button in the Layers sheet, and that closes Layers.
  await page.locator('.layers-head .inspector-toggle').click();
  const inspector=page.locator('#inspector');
  await expect(inspector).toHaveClass(/sheet-open/);
  await expect(layers).not.toHaveClass(/sheet-open/);
  await expect(layers).toBeHidden();
  await expect(propsBtn).toHaveAttribute('aria-expanded','true');
  box=await inspector.boundingBox();
  expect(Math.round(box.y+box.height),'Properties sheet bottom edge').toBe(height);
  expect(await canvasShare(page),'canvas visible above Properties').toBeGreaterThanOrEqual(0.3);
  expect(await overlappingControls(inspector),'no overlapping controls in Properties').toEqual([]);
  // The Close control is at least 24 px and reachable, and it closes the sheet.
  const close=inspector.locator('.sheet-close');
  const closeBox=await close.boundingBox();
  expect(closeBox.width,'close width').toBeGreaterThanOrEqual(24);
  expect(closeBox.height,'close height').toBeGreaterThanOrEqual(24);
  expect(closeBox.y+closeBox.height,'close inside the viewport').toBeLessThanOrEqual(height);
  await close.click();
  await expect(sheetOf(page)).toHaveCount(0);
  await expect(propsBtn).toHaveAttribute('aria-expanded','false');
  // Properties from the bar, then Layers from the Properties header; the Layers close button closes it too.
  await propsBtn.click();
  await expect(inspector).toHaveClass(/sheet-open/);
  await inspector.locator('.sheet-switch').click();
  await expect(layers).toHaveClass(/sheet-open/);
  await expect(inspector).not.toHaveClass(/sheet-open/);
  const layersClose=layers.locator('.sheet-close');
  const layersCloseBox=await layersClose.boundingBox();
  expect(layersCloseBox.width).toBeGreaterThanOrEqual(24);
  expect(layersCloseBox.height).toBeGreaterThanOrEqual(24);
  await layersClose.click();
  await expect(sheetOf(page)).toHaveCount(0);
  expect(errors).toEqual([]);
 });
}

for(const lang of ['en','es']){
 test(`no horizontal page overflow with a sheet open at 375x667 (${lang})`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:375,height:667});
  await page.goto(`/?lang=${lang}`);
  // Select an object so Properties shows its full set of controls, then open each sheet in turn.
  await page.locator('.sheet-bar button').nth(0).click();
  await page.locator('.object-row').first().click();
  for(const open of [async()=>{},async()=>{await page.locator('.layers-head .inspector-toggle').click();}]){
   await open();
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
   expect(overflow,`page overflow in ${lang}`).toBeLessThanOrEqual(0);
   const sheet=sheetOf(page);
   expect(await sheet.evaluate(e=>e.scrollWidth-e.clientWidth),`sheet overflow in ${lang}`).toBeLessThanOrEqual(0);
   expect(await overlappingControls(sheet),`overlaps in ${lang}`).toEqual([]);
  }
  expect(errors).toEqual([]);
 });
}
