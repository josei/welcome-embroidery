import {test,expect} from '@playwright/test';

// Portrait tablets (601-1024 px wide) keep Layers and Properties in one right-hand column, never over the canvas.
// Both are open at once, as the desktop shows them, with no tab strip and no chevron. Each panel scrolls inside
// itself, the page never scrolls, and every control is 44 px or more. Desktop at 1024x768 keeps its three columns.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const boxOf=(page,sel)=>page.locator(sel).first().evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};});
const intersects=(a,b)=>a.left<b.right-0.5&&b.left<a.right-0.5&&a.top<b.bottom-0.5&&b.top<a.bottom-0.5;

for(const [w,h] of [[768,1024],[820,1180]]){
 for(const lang of ['en','es']){
  test(`Layers and Properties are one right column beside the canvas at ${w}x${h} in ${lang}`,async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setViewportSize({width:w,height:h});
   await page.goto(`/?lang=${lang}`);
   await expect(page.locator('.canvas')).toBeVisible();
   const canvas=await boxOf(page,'.canvas');
   const layers=await boxOf(page,'#layersSheet');
   const properties=await boxOf(page,'#inspector');
   // Both panels show without a tap.
   expect(await page.locator('#objects').isVisible(),'the object list is visible').toBe(true);
   expect(await page.locator('#stats').isVisible(),'the Properties body is visible').toBe(true);
   expect(canvas.width,'canvas width with the inspector column open').toBeGreaterThanOrEqual(0.6*w);
   expect(intersects(canvas,layers),'canvas and Layers boxes intersect').toBe(false);
   expect(intersects(canvas,properties),'canvas and Properties boxes intersect').toBe(false);
   expect(layers.left,'the column is on the right').toBeGreaterThanOrEqual(canvas.right-0.5);
   expect(Math.abs(layers.left-properties.left),'panels share a left edge').toBeLessThan(1);
   expect(Math.abs(layers.right-properties.right),'panels share a right edge').toBeLessThan(1);
   expect(layers.bottom,'Layers ends above Properties').toBeLessThanOrEqual(properties.top+0.5);
   expect(Math.round(properties.width)).toBe(300);
   // No tab strip and no chevron toggle.
   expect(await page.locator('.inspector-tabs, .inspector-tab, .inspector-collapse').count(),'no tab strip or collapse chevron').toBe(0);
   // Each panel scrolls inside itself, and the page does not scroll at all.
   const doc=await page.evaluate(()=>({sh:document.documentElement.scrollHeight,ih:innerHeight,sw:document.documentElement.scrollWidth,iw:innerWidth}));
   expect(doc.sh,'scrollHeight === innerHeight').toBe(doc.ih);
   expect(doc.sw,'scrollWidth === innerWidth').toBe(doc.iw);
   const scrollers=await page.evaluate(()=>['#layersSheet','#inspector'].map(s=>getComputedStyle(document.querySelector(s)).overflowY));
   expect(scrollers,'panels scroll inside themselves').toEqual(['auto','auto']);
   expect(errors).toEqual([]);
  });

  test(`no overflow and 44px targets at ${w}x${h} in ${lang}`,async({page})=>{
   await page.setViewportSize({width:w,height:h});
   await page.goto(`/?lang=${lang}`);
   await expect(page.locator('.canvas')).toBeVisible();
   const o=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth}));
   expect(o.sw,'no horizontal overflow').toBeLessThanOrEqual(o.iw);
   const sizes=await page.evaluate(()=>[...document.querySelectorAll('.tool-rail .icon-button, #layersSheet button:not(.sr-only), #inspector button:not(.sr-only)')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).display!=='none'}).map(e=>({id:e.id||e.className,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
   expect(sizes.length).toBeGreaterThan(0);
   for(const s of sizes){expect(s.w,`${s.id} width`).toBeGreaterThanOrEqual(44);expect(s.h,`${s.id} height`).toBeGreaterThanOrEqual(44);}
  });
 }
}

test('desktop layout at 1024x768 keeps its three columns',async({page})=>{
 await page.setViewportSize({width:1024,height:768});
 await page.goto('/?lang=en');
 await expect(page.locator('#objects')).toBeVisible();
 const objects=await boxOf(page,'#objects');
 const canvas=await boxOf(page,'.canvas');
 const inspector=await boxOf(page,'#inspector');
 expect(Math.round(objects.left)).toBe(16);
 expect(Math.round(canvas.left)).toBe(208);
 expect(Math.round(inspector.width)).toBe(300);
 expect(inspector.left).toBeGreaterThanOrEqual(canvas.right-0.5);
 expect(await page.locator('.inspector-tabs, .inspector-collapse').count()).toBe(0);
});
