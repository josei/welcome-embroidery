import {test,expect} from '@playwright/test';

// Small lettering stays readable under its selection frame on a touch screen: the handles sit on the frame rather than over
// its middle, the lettering box hides the drawing it edits, and the rotate knob stays clear of the save strip.
test.use({hasTouch:true});

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function addSmallLettering(page,width,height){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto('/');
 await page.locator('.tool-rail #letter').tap();
 const box=page.locator('#canvasText');
 await expect(box,'text box opens').toBeVisible();
 await box.tap();
 await page.keyboard.press('Control+A');
 await page.keyboard.type('ANA');
 await expect(box).toHaveValue('ANA');
 await page.locator('.canvas').tap({position:{x:20,y:20}});
 await expect(page.locator('#canvasText'),'box closes after a tap outside').toHaveCount(0);
 return errors;
}

test('no handle centre falls inside the frame of small lettering on a phone (390x844)',async({page})=>{
 const errors=await addSmallLettering(page,390,844);
 // Compared in the canvas's own units, where the frame is the polygon's points and each handle's centre is its rectangle's middle.
 const {frame,centres}=await page.evaluate(()=>{
  const pts=document.querySelector('.sel-box').getAttribute('points').trim().split(/\s+/).map(p=>p.split(',').map(Number));
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  return {
   frame:{x0:Math.min(...xs),y0:Math.min(...ys),x1:Math.max(...xs),y1:Math.max(...ys)},
   centres:[...document.querySelectorAll('.sel-handle[data-handle]:not(.sel-rotate)')].map(h=>({
    name:h.dataset.handle,x:Number(h.getAttribute('x'))+Number(h.getAttribute('width'))/2,y:Number(h.getAttribute('y'))+Number(h.getAttribute('height'))/2})),
  };
 });
 expect(centres.length,'the selected lettering has its handles').toBeGreaterThan(0);
 for(const c of centres){
  const inside=c.x>frame.x0&&c.x<frame.x1&&c.y>frame.y0&&c.y<frame.y1;
  expect(inside,`the ${c.name} handle's centre is not over the lettering`).toBe(false);
 }
 expect(errors).toEqual([]);
});

test('the lettering box hides the drawing it edits, and the handles are off while it is open (390x844)',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('.tool-rail #letter').tap();
 await expect(page.locator('#canvasText'),'text box opens').toBeVisible();
 const id=await page.locator('#shapes [data-id]').last().getAttribute('data-id');
 const shown=await page.locator(`#shapes [data-id="${id}"]`).evaluate(e=>getComputedStyle(e).visibility);
 expect(shown,'the object under the box is hidden').toBe('hidden');
 await expect(page.locator('.sel-handle'),'no handles are drawn over the box').toHaveCount(0);
});

test('the rotate knob does not intersect the save strip on a landscape phone (844x390)',async({page})=>{
 await addSmallLettering(page,844,390);
 const knob=page.locator('.sel-rotate');
 await expect(knob).toBeAttached();
 const kb=await knob.boundingBox();
 const bar=await page.locator('.top').boundingBox();
 const margin=await page.locator('.top').evaluate(e=>parseFloat(getComputedStyle(e).marginBottom)||0);
 const stripTop=bar.y+bar.height,stripBottom=stripTop+margin;
 const hits=kb.y<stripBottom&&kb.y+kb.height>stripTop;
 expect(hits,'rotate knob is clear of the save strip').toBe(false);
});
