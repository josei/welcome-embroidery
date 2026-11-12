import {test,expect} from '@playwright/test';

// Issue #455 (from audit #449): portrait tablets (601-1024 px wide) keep the tools on the canvas's left edge and open Properties as a
// drawer on the right, in its own column. The drawer never covers the canvas, the canvas keeps at least 60% of the width with the drawer
// open, and the drawer closes with its Close button or a tap on the canvas. Desktop at 1024x768 keeps its three columns.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const boxOf=(page,sel)=>page.locator(sel).first().evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};});
const visibleBox=async(page,sel)=>{const l=page.locator(sel).first();if(!(await l.isVisible()))return null;return boxOf(page,sel);};
const intersects=(a,b)=>a.left<b.right-0.5&&b.left<a.right-0.5&&a.top<b.bottom-0.5&&b.top<a.bottom-0.5;

for(const [w,h] of [[768,1024],[820,1180]]){
 for(const lang of ['en','es']){
  test(`Properties is a right drawer beside the canvas at ${w}x${h} in ${lang}`,async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setViewportSize({width:w,height:h});
   await page.goto(`/?lang=${lang}`);
   await expect(page.locator('.canvas')).toBeVisible();
   // A portrait tablet starts with the drawer closed and the object list showing; Properties opens it.
   await expect(page.locator('#inspector')).toBeHidden();
   await expect(page.locator('#objects')).toBeVisible();
   await page.locator('.inspector-toggle').click();
   // Drawer open: it sits in its own column to the right of the canvas.
   await expect(page.locator('#inspector')).toBeVisible();
   const canvas=await boxOf(page,'.canvas');
   const drawer=await boxOf(page,'#inspector');
   expect(canvas.width,'canvas width with the drawer open').toBeGreaterThanOrEqual(0.6*w);
   expect(intersects(canvas,drawer),'canvas and drawer boxes intersect').toBe(false);
   expect(drawer.left,'drawer is on the right').toBeGreaterThanOrEqual(canvas.right-0.5);
   // Tools stay on the left edge of the canvas.
   const rail=await boxOf(page,'.tool-rail');
   expect(rail.left-canvas.left,'tool rail distance from the canvas left edge').toBeLessThan(24);
   // Close with the drawer's Close button: the object list comes back and the canvas takes the full width.
   await page.locator('.drawer-close').click();
   await expect(page.locator('#inspector')).toBeHidden();
   await expect(page.locator('#objects')).toBeVisible();
   const closedCanvas=await boxOf(page,'.canvas');
   expect(closedCanvas.width).toBeGreaterThan(canvas.width);
   // Reopen from the Properties button, then close by tapping an empty part of the canvas.
   await page.locator('.inspector-toggle').click();
   await expect(page.locator('#inspector')).toBeVisible();
   const art=await boxOf(page,'.canvas');
   await page.mouse.click(art.left+art.width*0.6,art.top+art.height*0.85);
   await expect(page.locator('#inspector')).toBeHidden();
   expect(errors).toEqual([]);
  });

  test(`no overflow or overlap and 44px targets at ${w}x${h} in ${lang}`,async({page})=>{
   await page.setViewportSize({width:w,height:h});
   await page.goto(`/?lang=${lang}`);
   await expect(page.locator('.canvas')).toBeVisible();
   const o=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth}));
   expect(o.sw,'no horizontal overflow').toBeLessThanOrEqual(o.iw);
   const sizes=await page.evaluate(()=>[...document.querySelectorAll('.tool-rail .icon-button, .drawer-close, .inspector-toggle, .sheet-close')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0}).map(e=>({id:e.id||e.className,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
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
 expect(await page.locator('.drawer-close').isVisible()).toBe(false);
});
