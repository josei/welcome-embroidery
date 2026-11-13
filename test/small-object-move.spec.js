import {test,expect} from '@playwright/test';

// A resize handle's hit area is 44 px square, the touch target. On a small object at low zoom that square reaches over the
// object's body: the starter design's leaf is about 62 by 39 px at 81 %, so its centre sits inside the bottom-centre
// handle's square and a drag from the centre used to resize from that handle. A press on the body now moves the object, by
// touch and by mouse alike, while a press on a corner or edge handle keeps resizing it.

const LEAF='leaf';

// Selects the leaf from the layers list, which needs the desktop layout, then leaves the page at a given width and height.
async function openLeaf(page,width,height){
 await page.setViewportSize({width:1280,height:900});
 await page.goto('/');
 await page.locator(`.object-row[data-id="${LEAF}"]`).click();
 await expect(page.locator('.sel-handle').first()).toBeAttached();
 await page.setViewportSize({width,height});
 const shape=page.locator(`#shapes [data-id="${LEAF}"]`);
 await expect(shape).toBeVisible();
 return shape;
}

// A wheel notch of n px scales the view by exp(-n × 0.0016), so the notch that lands on a percentage is its log.
const notchFor=percent=>Math.round(-Math.log(percent/100)/0.0016);

// A view change redraws the canvas and replaces its nodes, and a box measured in that window comes back empty, so
// wait for the node to be measurable again instead of reading it once.
async function elementBox(element){
 for(let i=0;i<40;i++){
  const b=await element.boundingBox();
  if(b&&b.width>0)return b;
  await new Promise(r=>setTimeout(r,25));
 }
 throw new Error('the element is not on screen');
}

const box=elementBox;
const centreOf=async element=>{
 const b=await box(element);
 return {x:b.x+b.width/2,y:b.y+b.height/2};
};

// Back to 100 %, then one notch at the leaf's centre, so the drag happens at the percentage it is measured at.
async function zoomTo(page,shape,percent){
 await page.locator('#zoomPct').click();
 const {x,y}=await centreOf(shape);
 await page.mouse.move(x,y);
 await page.mouse.wheel(0,notchFor(percent));
 await expect(page.locator('#zoomPct')).toHaveText(`${percent}%`);
 return {x,y};
}

async function touchDrag(page,x,y,dx,dy){
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x,y}]});
 for(let i=1;i<=6;i++)
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:x+dx*i/6,y:y+dy*i/6}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}

// The object moved: its box shifted on screen and kept its size.
function expectMoved(before,after,dx,dy){
 expect(after.x-before.x,`x moves by about ${dx} px`).toBeGreaterThan(dx/2);
 expect(after.y-before.y,`y moves by about ${dy} px`).toBeGreaterThan(dy/2);
 expect(Math.abs(after.width-before.width),'width unchanged').toBeLessThan(1.5);
 expect(Math.abs(after.height-before.height),'height unchanged').toBeLessThan(1.5);
}

test.describe('a drag on the body of a small object moves it at low zoom',()=>{
 test.use({hasTouch:true,viewport:{width:768,height:1024}});
 test.skip(({browserName})=>browserName!=='chromium','touch points are dispatched through a Chromium CDP session');

 test('tablet touch drag from the leaf centre at 81% moves it',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const shape=await openLeaf(page,768,1024);
  const {x,y}=await zoomTo(page,shape,81);
  const before=await box(shape);
  await touchDrag(page,x,y,36,18);
  expectMoved(before,await box(shape),36,18);
  await expect(page.locator('#undo')).toHaveAttribute('aria-label','Undo move');
  expect(errors).toEqual([]);
 });

 test('tablet mouse drag from the leaf centre at 81% moves it',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const shape=await openLeaf(page,768,1024);
  const {x,y}=await zoomTo(page,shape,81);
  const before=await box(shape);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+36,y+18,{steps:6});await page.mouse.up();
  expectMoved(before,await box(shape),36,18);
  await expect(page.locator('#undo')).toHaveAttribute('aria-label','Undo move');
  expect(errors).toEqual([]);
 });

 test('a touch drag from the bottom-centre edge handle still resizes at 81%',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const shape=await openLeaf(page,768,1024);
  await zoomTo(page,shape,81);
  const before=await box(shape);
  const handle=page.locator('.sel-handle[data-handle="s"]'),hb=await box(handle);
  await touchDrag(page,hb.x+hb.width/2,hb.y+hb.height/2,0,24);
  const after=await box(shape);
  expect(after.height,'the bottom handle grows the object').toBeGreaterThan(before.height+10);
  expect(Math.abs(after.x-before.x),'the anchored side stays put').toBeLessThan(1.5);
  await expect(page.locator('#undo')).toHaveAttribute('aria-label','Undo change');
  expect(errors).toEqual([]);
 });

 test('a mouse drag from a corner handle still resizes at 81%',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const shape=await openLeaf(page,768,1024);
  await zoomTo(page,shape,81);
  const before=await box(shape);
  const handle=page.locator('.sel-handle[data-handle="se"]'),hb=await box(handle);
  const x=hb.x+hb.width/2,y=hb.y+hb.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+24,y+24,{steps:6});await page.mouse.up();
  const after=await box(shape);
  expect(after.width,'the corner handle widens the object').toBeGreaterThan(before.width+10);
  expect(after.height,'the corner handle heightens the object').toBeGreaterThan(before.height+10);
  await expect(page.locator('#undo')).toHaveAttribute('aria-label','Undo change');
  expect(errors).toEqual([]);
 });
});

test.describe('a touch drag on the body of a small object moves it on a phone',()=>{
 test.use({hasTouch:true,viewport:{width:390,height:844}});
 test.skip(({browserName})=>browserName!=='chromium','touch points are dispatched through a Chromium CDP session');

 test('phone drag from the leaf centre at 63% moves it',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const shape=await openLeaf(page,390,844);
  const {x,y}=await zoomTo(page,shape,63);
  const before=await box(shape);
  await touchDrag(page,x,y,30,12);
  expectMoved(before,await box(shape),30,12);
  await expect(page.locator('#undo')).toHaveAttribute('aria-label','Undo move');
  expect(errors).toEqual([]);
 });
});
