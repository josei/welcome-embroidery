import {test,expect} from '@playwright/test';

// On a phone, the 3D view is painted to its bottom edge, the handles of small lettering leave its letters clear,
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

// Compares the bottom 30 rows of the 3D canvas as they appear on screen with the same rows read back from its WebGL
// buffer. A band the page background shows through differs from the buffer, so this fails when the canvas is not painted
// to its edge. The camera is held still with a pointer press (a drag stops the turntable spinning) and the hint is hidden,
// since it sits over those rows.
async function bottomRowsMismatch(page){
 await page.addStyleTag({content:'#previewHint{visibility:hidden!important}'});
 const box=await page.locator('#preview3d').boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.down();
 await page.waitForTimeout(400);
 const png=(await page.screenshot()).toString('base64');
 const result=await page.evaluate(async([data,x,y,w,h])=>{
  const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();
  const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
  const gl=document.querySelector('#preview3d').getContext('webgl2');
  const W=gl.drawingBufferWidth,rows=30;
  const px=new Uint8Array(W*rows*4);
  gl.readPixels(0,0,W,rows,gl.RGBA,gl.UNSIGNED_BYTE,px);
  const screenBottom=Math.floor(y+h);
  let badRows=0;
  for(let r=0;r<rows;r++){
   const sy=screenBottom-1-r;
   const row=ctx.getImageData(Math.floor(x),sy,Math.ceil(w),1).data;
   let off=0,n=0;
   for(let col=0;col<W;col+=2){
    const sx=Math.floor(x+(col+0.5)*w/W)-Math.floor(x);
    const b=(r*W+col)*4,s=sx*4;n++;
    if(Math.abs(row[s]-px[b])>8||Math.abs(row[s+1]-px[b+1])>8||Math.abs(row[s+2]-px[b+2])>8)off++;
   }
   if(off>n*0.1)badRows++;
  }
  return {badRows};
 },[png,box.x,box.y,box.width,box.height]);
 await page.mouse.up();
 return result;
}

for(const [w,h] of [[844,390],[390,844]]) for(const lang of ['en','es']) test(`the 3D view is painted down to its bottom edge at ${w}x${h} (${lang})`,async({page})=>{
 page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:w,height:h});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 if(await page.locator('#phoneMenu').isVisible()){await page.locator('#phoneMenu').click();await page.locator('#menuView-preview').click();}
 else await page.locator('[data-view=preview]').click();
 await expect(page.locator('#preview3d')).toHaveAttribute('data-instances',/^[1-9]\d*$/,{timeout:8000});
 const views=lang==='en'?['Front ¾','Close-up','Turntable','Loupe 8×']:['Frontal ¾','Primer plano','Giro','Lupa 8×'];
 for(const name of views){
  await page.locator('#previewView button',{hasText:name}).click();
  await page.waitForTimeout(600);
  const r=await bottomRowsMismatch(page);
  expect(r.badRows,`${name}: bottom rows of the 3D view that differ from its WebGL buffer`).toBe(0);
 }
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
 await page.locator('#letter').tap();
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
  // Zoom in from the stepper, or from the % tile's menu when the lettering leaves an object selected.
  if(await page.locator('#zoomIn').isVisible()) await page.locator('#zoomIn').tap();
  else {await page.locator('#zoomPct').tap();await page.locator('[role=menuitem]').filter({hasText:/^(Zoom in|Acercar)$/}).tap();}
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
 await page.locator('#letter').tap();
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
 const zoom=await page.locator('.context-bar').boundingBox();
 expect(hint.y+hint.height,'hint sits above the zoom bar').toBeLessThanOrEqual(zoom.y);
});
