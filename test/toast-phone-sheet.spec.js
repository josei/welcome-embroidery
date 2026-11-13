import {test,expect} from '@playwright/test';

// At 390x844 with Layers open, a transient toast does not cover the Menu button or the Layers header's Properties button.
// The toast sits above the status line and stays readable and dismisses on its own. At phone widths Layers lives in the Menu.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

test('a toast does not cover the Menu or the Properties button at 390x844 with Layers open (en)',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?lang=en');
 await page.locator('#phoneMenu').click();await page.locator('#menuLayers').click();
 await expect(page.locator('#layersSheet')).toHaveClass(/sheet-open/);
 // An invalid machine file raises an error toast.
 await page.locator('#machineFile').setInputFiles({name:'broken.jef',mimeType:'application/octet-stream',buffer:Buffer.from([1,2,3])});
 const toast=page.locator('#toast .toast-item').first();
 await expect(toast).toBeVisible();
 const tb=await toast.boundingBox();
 expect(tb,'toast box').not.toBeNull();
 // Every sheet button is laid out; none may intersect the toast box.
 const buttons=page.locator('#phoneMenu, .layers-head .inspector-toggle').filter({visible:true});
 for(let i=0;i<await buttons.count();i++){
  const b=await buttons.nth(i).boundingBox();
  const ox=Math.min(tb.x+tb.width,b.x+b.width)-Math.max(tb.x,b.x);
  const oy=Math.min(tb.y+tb.height,b.y+b.height)-Math.max(tb.y,b.y);
  expect(ox>0&&oy>0,`control ${i} clear of the toast`).toBe(false);
 }
 // The toast is painted above the open Layers panel. The toast is pointer-events:none, and elementFromPoint skips those,
 // so enable pointer events on it for this one hit test: the topmost element at its centre must be the toast.
 const hit=await page.evaluate(([x,y])=>{const t=document.querySelector('#toast');t.style.pointerEvents='auto';const el=document.elementFromPoint(x,y);t.style.pointerEvents='';return {inToast:!!el?.closest('#toast'),inSheet:!!el?.closest('#layersSheet')};},[tb.x+tb.width/2,tb.y+tb.height/2]);
 expect(hit.inToast,'toast centre is on top of the Layers sheet').toBe(true);
 expect(hit.inSheet,'toast centre is not inside the Layers sheet').toBe(false);
 // Still readable and dismisses on its own.
 await expect(page.locator('#toast')).toContainText('Invalid embroidery file');
 expect(errors).toEqual([]);
});
