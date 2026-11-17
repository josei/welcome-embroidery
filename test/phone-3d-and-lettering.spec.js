import {test,expect} from '@playwright/test';

// On a phone, the 3D view is painted down to the playback bar, the handles of small lettering leave its letters clear,
// and the lettering save hint stays off the lettering in portrait.
test.use({hasTouch:true});

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openView(page,width,height,view){
 page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto('/');
 if(view==='preview'){
  if(await page.locator('#phoneMenu').isVisible()){await page.locator('#phoneMenu').click();await page.locator('#menuView-preview').click();}
  else await page.locator('[data-view=preview]').click();
  await expect(page.locator('#play')).toBeVisible();
  await page.waitForTimeout(1500);
 }
}

// Counts the rows in the bottom 20 px of the 3D canvas that are not painted on screen. The screenshot is decoded in the
// page, so the check reads what the user sees rather than the canvas's own buffer.
async function unpaintedBottomRows(page){
 const png=(await page.screenshot()).toString('base64');
 const box=await page.locator('#preview3d').boundingBox();
 return page.evaluate(async([data,x,y,w,h])=>{
  const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();
  const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
  const bottom=Math.floor(y+h),left=Math.round(x+w*0.1),width=Math.round(w*0.8);let blank=0;
  for(let row=bottom-20;row<bottom;row++){
   const d=ctx.getImageData(left,row,width,1).data;let painted=false;
   for(let i=3;i<d.length;i+=4)if(d[i]>0){painted=true;break;}
   if(!painted)blank++;
  }
  return blank;
 },[png,box.x,box.y,box.width,box.height]);
}

for(const [width,height] of [[390,844],[844,390]]) test(`the 3D view is painted down to the playback bar at ${width}x${height}`,async({page})=>{
 await openView(page,width,height,'preview');
 expect(await unpaintedBottomRows(page),'rows in the bottom 20 px of the 3D view left unpainted').toBe(0);
});

// Lettering at 8 mm and 79% zoom is 24 px tall on screen: its top and bottom handles reach over the glyphs unless they sit outside.
async function handleCoverage(page){
 return page.evaluate(()=>{
  const box=document.querySelector('.sel-box').getBoundingClientRect();
  const cx=box.x+box.width/2,cy=box.y+box.height/2;
  const covering=[...document.querySelectorAll('.sel-hit,.sel-handle')].filter(e=>{
   const b=e.getBoundingClientRect();return b.left<=cx&&b.right>=cx&&b.top<=cy&&b.bottom>=cy;
  }).map(e=>e.getAttribute('data-handle')||e.getAttribute('data-hit'));
  return {height:box.height,covering,rotate:document.querySelectorAll('[data-handle=rot]').length};
 });
}

async function placeBloom(page){
 await openView(page,390,844,'design');
 await page.locator('.tool-rail #letter').tap();
 await expect(page.locator('#canvasText')).toBeVisible();
 await page.locator('#canvasText').tap();
 await page.keyboard.press('Control+A');
 await page.keyboard.type('Bloom');
 await page.locator('.canvas').tap({position:{x:20,y:20}});
 await expect(page.locator('#canvasText')).toHaveCount(0);
}

test('no resize handle covers 8 mm lettering at 79% on a phone, and the rotate knob stays',async({page})=>{
 await placeBloom(page);
 await expect(page.locator('#zoomPct')).toHaveText('79%');
 const r=await handleCoverage(page);
 expect(r.covering,'handles over the lettering centre').toEqual([]);
 expect(r.rotate,'rotate knob is still drawn').toBeGreaterThan(0);
});

test('no resize handle covers lettering whose box is 30 to 44 px tall on a phone',async({page})=>{
 await placeBloom(page);
 // Zoom in until the 8 mm box is in the band where the top and bottom handles are shown and would reach the centre.
 for(let i=0;i<6;i++){
  const r=await handleCoverage(page);
  if(r.height>=30)break;
  await page.locator('#zoomIn').tap();
  await page.waitForTimeout(150);
 }
 const r=await handleCoverage(page);
 expect(r.height,'box height in the band').toBeGreaterThanOrEqual(30);
 expect(r.height,'box height in the band').toBeLessThanOrEqual(44);
 expect(r.covering,'handles over the lettering centre').toEqual([]);
 expect(r.rotate,'rotate knob is still drawn').toBeGreaterThan(0);
});

for(const lang of ['en','es']) test(`the lettering save hint does not cover new lettering at 390x844 (${lang})`,async({page})=>{
 page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:390,height:844});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.locator('.tool-rail #letter').tap();
 await expect(page.locator('#canvasText')).toBeVisible();
 await page.locator('#canvasText').tap();
 await page.keyboard.press('Control+A');
 await page.keyboard.type('Bloom');
 const hint=await page.locator('#canvasTextHint').boundingBox();
 // The design already on the canvas (the sample flower and script) is what the hint must not cover, as well as the new lettering.
 const parts=await page.locator('#shapes [data-id]').evaluateAll(els=>els.map(e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};}).filter(b=>b.width&&b.height));
 const text=await page.locator('#canvasText').boundingBox();
 for(const b of [...parts,text]){
  const overlap=hint.x<b.x+b.width&&hint.x+hint.width>b.x&&hint.y<b.y+b.height&&hint.y+hint.height>b.y;
  expect(overlap,'hint does not sit over the design or the new lettering').toBe(false);
 }
 const zoom=await page.locator('.zoombar').boundingBox();
 expect(hint.y+hint.height,'hint sits above the zoom bar').toBeLessThanOrEqual(zoom.y);
});
