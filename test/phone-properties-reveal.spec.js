import {test,expect} from '@playwright/test';

// On a phone, opening Properties covers the lower part of the canvas. The selected object is brought into the part still visible
// above the panel, the panel's Close button stays in view while the panel scrolls, and an object dragged to the bottom stops above
// the zoom bar and the selection bar.
const PHONES=[[390,844],[844,390]];

test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openPhone(page,width,height){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto('/?lang=en');
 return errors;
}

const rectOf=(page,selector)=>page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};});

async function openProperties(page){
 await page.locator('#phoneMenu').click();
 await page.locator('#menuProperties').click();
 await expect(page.locator('#inspector')).toHaveClass(/sheet-open/);
 // The reveal waits a frame and then the canvas animates nothing, so one more frame settles the view.
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}

for(const [width,height] of PHONES){
 test(`the selected object stays above the Properties panel at ${width}x${height}`,async({page})=>{
  const errors=await openPhone(page,width,height);
  await page.locator('#rect').tap();
  await expect(page.locator('.sel-box')).toBeVisible();
  await openProperties(page);
  // The visible part of the canvas is above the panel (portrait) or left of it (landscape). The wait accepts a sample and the
  // checks read that same sample, so a redraw between two reads cannot fail them.
  let sample;
  await expect.poll(async()=>{
    const canvas=await rectOf(page,'.canvas');
    const sheet=await rectOf(page,'#inspector');
    const frame=await rectOf(page,'.sel-box');
    const bottomSheet=sheet.right-sheet.left>=(canvas.right-canvas.left)*0.9;
    const part={
      left:canvas.left,top:canvas.top,
      right:bottomSheet?canvas.right:Math.min(canvas.right,sheet.left),
      bottom:bottomSheet?Math.min(canvas.bottom,sheet.top):canvas.bottom,
    };
    sample={frame,part};
    return frame.left>=part.left&&frame.top>=part.top&&frame.right<=part.right&&frame.bottom<=part.bottom;
  }).toBe(true);
  const {frame,part}=sample;
  expect(frame.left,'frame left edge is in view').toBeGreaterThanOrEqual(part.left);
  expect(frame.top,'frame top edge is in view').toBeGreaterThanOrEqual(part.top);
  expect(frame.right,'frame right edge is in view').toBeLessThanOrEqual(part.right);
  expect(frame.bottom,'frame bottom edge is in view').toBeLessThanOrEqual(part.bottom);
  expect(errors).toEqual([]);
 });

 test(`the Properties Close button stays in view while the panel scrolls at ${width}x${height}`,async({page})=>{
  await openPhone(page,width,height);
  await page.locator('#rect').tap();
  await openProperties(page);
  await page.locator('#inspector').evaluate(e=>{e.scrollTop=e.scrollHeight;});
  const panel=await rectOf(page,'#inspector');
  const close=await rectOf(page,'#inspector .close-control');
  const scrolled=await page.locator('#inspector').evaluate(e=>e.scrollTop);
  expect(scrolled,'the panel really scrolled').toBeGreaterThan(0);
  expect(close.top).toBeGreaterThanOrEqual(panel.top);
  expect(close.bottom).toBeLessThanOrEqual(panel.bottom);
 });
}

for(const [width,height] of PHONES){
 test(`an object dragged to the bottom edge stops above the zoom bar and selection bar at ${width}x${height}`,async({page})=>{
  const errors=await openPhone(page,width,height);
  await page.locator('#rect').tap();
  await expect(page.locator('.sel-box')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>matchMedia('(pointer: coarse)').matches),'a touch screen is coarse-pointer').toBe(true);
  const box=await rectOf(page,'.sel-box');
  const x=(box.left+box.right)/2,y=(box.top+box.bottom)/2;
  await page.mouse.move(x,y);
  await page.mouse.down();
  for(let i=1;i<=20;i++)await page.mouse.move(x,y+i*(height-y-4)/20);
  await page.mouse.up();
  const frame=await rectOf(page,'.sel-box');
  const obstacles=[];
  for(const sel of ['.zoombar','.phone-selection']){
   const count=await page.locator(sel).count();
   for(let i=0;i<count;i++){
    const r=await page.locator(sel).nth(i).evaluate(e=>{const b=e.getBoundingClientRect();return b.width&&b.height?{left:b.left,top:b.top,right:b.right,bottom:b.bottom}:null;});
    if(r)obstacles.push(r);
   }
  }
  expect(obstacles.length,'a zoom bar or selection bar is shown').toBeGreaterThan(0);
  const canvas=await rectOf(page,'.canvas');
  expect(frame.bottom,'frame bottom stays on the canvas').toBeLessThanOrEqual(canvas.bottom+0.5);
  // The handles hang past the frame, so every handle must also be on the canvas and clear of the bars.
  const handles=await page.locator('.sel-handle').evaluateAll(els=>els.map(e=>{const b=e.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom};}));
  expect(handles.length,'selection handles are shown').toBeGreaterThan(0);
  for(const h of handles){
   expect(h.bottom,'a handle stays on the canvas').toBeLessThanOrEqual(canvas.bottom+0.5);
   for(const o of obstacles){
    const overlaps=h.left<o.right&&h.right>o.left&&h.top<o.bottom&&h.bottom>o.top;
    expect(overlaps,'a handle does not overlap a bar').toBe(false);
   }
  }
  for(const o of obstacles){
   const overlaps=frame.left<o.right&&frame.right>o.left&&frame.top<o.bottom&&frame.bottom>o.top;
   expect(overlaps,'frame does not overlap a bar').toBe(false);
  }
  expect(errors).toEqual([]);
 });
}
