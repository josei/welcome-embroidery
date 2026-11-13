import {test,expect} from '@playwright/test';

// On a portrait tablet (768x1024) the Stitches view puts the playback bar on a row of its own above the status line. The
// play button then sits clear of the zoom bar, the stitch label beside it is read whole, the Messages button stays inside
// the window, and every control in that bar is a 44 px touch target. The design below sews 2,687 stitches, so the label
// reads "Stitch 2,687 of 2,687" (the long status this layout has to hold).

const WIDTH=768,HEIGHT=1024;

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// A zig-zag path plus a short run, which compile to 2,687 stitches.
async function openStitches(page,lang){
 const {initialDocument,applyOperations,validateDocument}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=400;doc.name='Probe';doc.revision=1;
 const zigzag=[];for(let i=0;i<=107;i++)zigzag.push([-150+i*(300/107),i%2?30:-30]);
 applyOperations(doc,[
  {op:'add_path',id:'s0',x:0,y:0,name:'Drawn path',points:zigzag,thread:'#cc3333',stitch:'running',stitchLength:1.4},
  {op:'add_path',id:'s1',x:0,y:0,name:'Short run',points:[[-40,-60],[-16,-60]],thread:'#cc3333',stitch:'running',stitchLength:1.4},
 ]);
 validateDocument(doc);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:WIDTH,height:HEIGHT});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
 await page.reload();
 await page.locator('#restoreYes').click();
 await expect(page.locator('.object-row')).toHaveCount(2);
 // The top bar's view switch shows on wide screens; phones reach Stitches through the Menu.
 if(await page.locator('[data-view=stitches]').isVisible()){
  await page.locator('[data-view=stitches]').click();
 }else{
  await page.locator('#phoneMenu').click();await page.locator('#menuView-stitches').click();
 }
 await expect(page.locator('#play')).toBeVisible();
 await expect(page.locator('#playbackStitches')).toHaveText(/2[.,]687/);
 return errors;
}

// Visible boxes, in CSS px, of the two bars and the status row's texts.
const boxes=page=>page.evaluate(()=>{
 const box=e=>{if(!e)return null;const r=e.getBoundingClientRect();return r.width>0&&r.height>0?{l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}:null;};
 return {
  play:box(document.querySelector('#play')),
  zoom:box(document.querySelector('.canvas .zoombar')),
  stitches:box(document.querySelector('#playbackStitches')),
  messages:box(document.querySelector('#messagesBtn')),
  viewport:{w:innerWidth,h:innerHeight},
 };
});

const intersects=(a,b)=>Math.min(a.r,b.r)-Math.max(a.l,b.l)>0.5&&Math.min(a.b,b.b)-Math.max(a.t,b.t)>0.5;

for(const lang of ['en','es']){
 const where=`768x1024 ${lang}`;

 test(`the zoom bar does not cover the play button (${where})`,async({page})=>{
  const errors=await openStitches(page,lang);
  const {play,zoom}=await boxes(page);
  expect(play).not.toBeNull();
  expect(zoom).not.toBeNull();
  expect(intersects(play,zoom),'the play button and the zoom bar overlap').toBe(false);
  // The play button is on the playback row, below the canvas's bottom edge where the zoom bar sits.
  expect(play.t).toBeGreaterThanOrEqual(zoom.b);
  expect(errors).toEqual([]);
 });

 test(`the stitch label is read whole (${where})`,async({page})=>{
  await openStitches(page,lang);
  const label=await page.locator('#playbackStitches').evaluate(e=>({text:e.textContent.trim(),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}));
  expect(label.text.length,'a long label is under test').toBeGreaterThan(18);
  expect(label.text.match(/2[.,]687/g),'the label names the full stitch count twice').toHaveLength(2);
  expect(label.scrollWidth,`"${label.text}" is cut off`).toBeLessThanOrEqual(label.clientWidth+0.5);
  const time=await page.locator('#playbackTime').evaluate(e=>({text:e.textContent.trim(),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}));
  expect(time.scrollWidth,`"${time.text}" is cut off`).toBeLessThanOrEqual(time.clientWidth+0.5);
 });

 test(`the Messages button is inside the window (${where})`,async({page})=>{
  await openStitches(page,lang);
  const {messages,viewport}=await boxes(page);
  expect(messages).not.toBeNull();
  expect(messages.l).toBeGreaterThanOrEqual(0);
  expect(messages.t).toBeGreaterThanOrEqual(0);
  expect(messages.r).toBeLessThanOrEqual(viewport.w);
  expect(messages.b).toBeLessThanOrEqual(viewport.h);
 });

 test(`every control in the playback bar is 44 px (${where})`,async({page})=>{
  await openStitches(page,lang);
  const small=await page.evaluate(()=>[...document.querySelectorAll('#resetPlayback,#play,#messagesBtn,.canvas .zoombar button')]
   .filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).display!=='none'&&(r.width<43.5||r.height<43.5);})
   .map(e=>`${e.id||e.className} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
  expect(small).toEqual([]);
 });
}
