import {test,expect} from '@playwright/test';

// At tablet portrait the Layers heading stays at the top of its column while the list scrolls beneath it, and the selection bar
// sits in the free space above the hoop rather than over its top-right corner.
test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

test('the Layers heading stays pinned while the list scrolls at tablet portrait', async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:768,height:1024});
 await page.goto('/');
 for(let i=0;i<4;i++) await page.locator('#rect').click();
 await page.locator('#objects').evaluate(e=>{e.scrollTop=e.scrollHeight;});
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const {scrolled,head,top,list}=await page.evaluate(()=>({
  scrolled:document.querySelector('#objects').scrollTop,
  head:document.querySelector('#layersSheet .layers-head').getBoundingClientRect().top,
  top:document.querySelector('#layersSheet').getBoundingClientRect().top,
  list:document.querySelector('#objects').getBoundingClientRect().top,
 }));
 expect(scrolled,'the list scrolled').toBeGreaterThan(0);
 expect(head-top,'the heading sits at the top of the Layers column').toBeLessThanOrEqual(2);
 expect(list,'the list starts below the heading').toBeGreaterThanOrEqual(head+30);
 expect(errors).toEqual([]);
});

test('the selection bar sits above the hoop, clear of its top-right corner, at tablet portrait', async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:768,height:1024});
 await page.goto('/');
 await page.locator('#rect').click();
 await expect(page.locator('.canvas .floating')).toBeVisible();
 const {bar,hoop}=await page.evaluate(()=>{
  const r=e=>{const b=document.querySelector(e).getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};};
  return {bar:r('.canvas .floating'),hoop:r('#hoopOuter')};
 });
 const clear=bar.bottom<=hoop.top||bar.top>=hoop.bottom||bar.right<=hoop.left||bar.left>=hoop.right;
 expect(clear,'the selection bar does not overlap the hoop').toBe(true);
 expect(errors).toEqual([]);
});
