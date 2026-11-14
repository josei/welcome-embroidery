import {test,expect} from '@playwright/test';

// On a phone held upright the playback bar takes two rows: Reset and Play with the time and stitch readout beside them on the
// first, and the timeline across the bar's whole width on the second. The timeline used to be a 160 px column squeezed beside
// the readout, so its right end, the last colour-change markers and the last stitches sat past the screen edge where a drag
// could not reach them. These checks drag the handle to the screen edge and read the result.
// Stitches and 3D both show the bar, in English and Spanish.
const PHONE=[390,844];

// A design whose last colour change is at 97.9 % of 5 870 stitches, so a marker sits close to the timeline's right end.
async function probeDocument(){
 const {initialDocument,applyOperations,validateDocument}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=400;doc.name='Probe';doc.revision=1;
 applyOperations(doc,[
  {op:'add_path',id:'s0',x:0,y:-20,points:[[-185,0],[185,0]],thread:'#cc3333',stitch:'satin',satinWidth:5},
  {op:'add_path',id:'s1',x:0,y:0,points:[[-185,0],[185,0]],thread:'#33aacc',stitch:'satin',satinWidth:4},
  {op:'add_path',id:'s2',x:0,y:20,points:[[-8,0],[8,0]],thread:'#33cc77',stitch:'satin',satinWidth:4},
 ]);
 validateDocument(doc);
 return doc;
}

// Opens a design in the given view (stitches or preview/3D) at the given size, through the Menu on a phone and the view
// switch on wider screens.
async function openView(page,width,height,lang,view){
 const doc=await probeDocument();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
 await page.reload();
 await page.locator('#restoreYes').click();
 await expect(page.locator('.object-row')).toHaveCount(3);
 const menu=page.locator('#phoneMenu');
 if(await menu.isVisible()){await menu.click();await page.locator(`#menuView-${view}`).click();}
 else await page.locator(`[data-view=${view}]`).click();
 await expect(page.locator('#play')).toBeVisible();
 // The plan compiles a moment after the view opens; until it lands the bar has nothing to scrub.
 await expect(page.locator('#playbackSummary')).not.toHaveText('',{timeout:60000});
 return errors;
}

// The boxes that make up the bar, its children's overflow, and the page's own scroll width.
const geometry=page=>page.evaluate(()=>{
 const box=e=>{const r=e.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width,h:r.height};};
 const phone=document.querySelector('.phone-playback');
 const inner=document.querySelector('.playback-bar');
 const track=document.querySelector('.playback-track');
 return {
  phone:phone?{...box(phone),scrollWidth:phone.scrollWidth,clientWidth:phone.clientWidth}:null,
  inner:{...box(inner),scrollWidth:inner.scrollWidth,clientWidth:inner.clientWidth},
  track:box(track),
  markers:[...document.querySelectorAll('.timeline-marker')].map(box),
  reset:box(document.querySelector('#resetPlayback')),
  play:box(document.querySelector('#play')),
  timeScroll:{scrollWidth:document.querySelector('#playbackTime').scrollWidth,clientWidth:document.querySelector('#playbackTime').clientWidth},
  stitchesScroll:{scrollWidth:document.querySelector('#playbackStitches').scrollWidth,clientWidth:document.querySelector('#playbackStitches').clientWidth},
  footer:box(document.querySelector('.layout main>footer')),
  viewport:{w:innerWidth,h:innerHeight},
  pageScroll:{scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth},
 };
});

// The stitch readout's text at the very end of the design, read before the drag: the total the readout must show when the
// handle reaches the end.
async function readoutAtEnd(page){
 return page.evaluate(async()=>{
  const seek=document.querySelector('#seek');
  seek.value=seek.max;seek.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  return document.querySelector('#playbackStitches').textContent;
 });
}

// Drags the handle from the start of the timeline to the right edge of the screen (phones) or of the timeline, then reports
// the seek value and the readout.
async function dragToEnd(page,toX){
 const seek=await page.locator('#seek').boundingBox();
 const y=seek.y+seek.height/2,start=seek.x+2;
 const end=toX??seek.x+seek.width-1;
 await page.mouse.move(start,y);await page.mouse.down();
 for(let x=start+30;x<end;x+=30)await page.mouse.move(x,y);
 await page.mouse.move(end,y);await page.mouse.up();
 await page.waitForTimeout(100);
 return page.evaluate(()=>({
  value:Number(document.querySelector('#seek').value),
  max:Number(document.querySelector('#seek').max),
  stitches:document.querySelector('#playbackStitches').textContent,
 }));
}

const linesOf=(page,selector)=>page.evaluate(sel=>{
 const e=document.querySelector(sel);const cs=getComputedStyle(e);
 const lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.2;
 return Math.round(e.getBoundingClientRect().height/lh);
},selector);

for(const lang of ['en','es']) for(const view of ['stitches','preview']){
 test(`the phone playback bar and its timeline stay inside 390x844, ${view} view (${lang})`,async({page})=>{
  test.setTimeout(120000);
  const errors=await openView(page,...PHONE,lang,view);
  const g=await geometry(page);
  expect(g.phone,'the phone playback bar is the one on screen').not.toBeNull();
  expect(g.phone.scrollWidth,`the bar does not clip its children: ${g.phone.scrollWidth} over ${g.phone.clientWidth}`).toBeLessThanOrEqual(g.phone.clientWidth);
  expect(g.inner.scrollWidth,`the bar's content fits: ${g.inner.scrollWidth} over ${g.inner.clientWidth}`).toBeLessThanOrEqual(g.inner.clientWidth);
  expect(g.track.r,'timeline right edge').toBeLessThanOrEqual(390);
  expect(g.track.l,'timeline left edge').toBeGreaterThanOrEqual(0);
  expect(g.track.r-g.track.l,'timeline width').toBeGreaterThan(160);
  expect(g.markers.length,'colour changes have a marker').toBeGreaterThan(1);
  for(const m of g.markers){
   expect(m.l,`marker at ${Math.round(m.l)} inside the timeline`).toBeGreaterThanOrEqual(g.track.l);
   expect(m.r,`marker at ${Math.round(m.r)} inside the timeline`).toBeLessThanOrEqual(g.track.r);
  }
  expect(g.pageScroll.scrollWidth,'no horizontal page scroll').toBe(g.pageScroll.clientWidth);
  expect(g.viewport.w).toBe(390);
  expect(errors).toEqual([]);
 });

 test(`dragging the timeline to the screen edge reaches the last stitch, ${view} view (${lang})`,async({page})=>{
  test.setTimeout(120000);
  const errors=await openView(page,...PHONE,lang,view);
  const total=await readoutAtEnd(page);
  const end=await dragToEnd(page,389);
  expect(end.max,'the design has stitches to scrub').toBeGreaterThan(1000);
  expect(end.value,`the handle reached ${end.value} of ${end.max}`).toBe(end.max);
  expect(end.stitches,`the readout shows the total "${total}"`).toBe(total);
  expect(errors).toEqual([]);
 });

 test(`reset and play keep a 44x44 box and playing advances the playhead, ${view} view (${lang})`,async({page})=>{
  test.setTimeout(120000);
  const errors=await openView(page,...PHONE,lang,view);
  const g=await geometry(page);
  for(const c of [g.reset,g.play]) expect(Math.round(c.w)>=44&&Math.round(c.h)>=44,`${Math.round(c.w)}x${Math.round(c.h)}`).toBe(true);
  const seekValue=()=>page.evaluate(()=>Number(document.querySelector('#seek').value));
  await page.locator('#play').click();
  await expect(page.locator('#play')).toHaveClass(/playing/);
  const before=await seekValue();
  await page.waitForTimeout(300);
  expect(await seekValue(),'the playhead advanced').not.toBe(before);
  await page.locator('#play').click();
  await expect(page.locator('#play')).not.toHaveClass(/playing/);
  await page.locator('#resetPlayback').click();
  await expect(page.locator('#seek')).toHaveValue('0',{timeout:10000});
  expect(errors).toEqual([]);
 });

 test(`the status line stays clear of the playback bar and the labels stay on one line, ${view} view (${lang})`,async({page})=>{
  test.setTimeout(120000);
  const errors=await openView(page,...PHONE,lang,view);
  const g=await geometry(page);
  expect(g.phone.b,'the playback bar ends above the status line').toBeLessThanOrEqual(g.footer.t);
  expect(g.timeScroll.scrollWidth,`time readout "${await page.locator('#playbackTime').textContent()}"`).toBeLessThanOrEqual(g.timeScroll.clientWidth);
  expect(g.stitchesScroll.scrollWidth,`stitch readout "${await page.locator('#playbackStitches').textContent()}"`).toBeLessThanOrEqual(g.stitchesScroll.clientWidth);
  expect(await linesOf(page,'#playbackTime'),'time readout on one line').toBe(1);
  expect(await linesOf(page,'#playbackStitches'),'stitch readout on one line').toBe(1);
  expect(errors).toEqual([]);
 });
}

// The landscape phone and the desktop keep their own bar: reset, play and a scrub to the end still work there.
for(const [w,h] of [[844,390],[1440,900]]) for(const lang of ['en','es']){
 test(`the playback bar resets, plays and scrubs to the end at ${w}x${h} (${lang})`,async({page})=>{
  test.setTimeout(120000);
  const errors=await openView(page,w,h,lang,'stitches');
  const g=await geometry(page);
  expect(g.track.r,'timeline right edge').toBeLessThanOrEqual(w);
  for(const m of g.markers){
   expect(m.l).toBeGreaterThanOrEqual(g.track.l);
   expect(m.r).toBeLessThanOrEqual(g.track.r);
  }
  const total=await readoutAtEnd(page);
  const end=await dragToEnd(page);
  expect(end.value).toBe(end.max);
  expect(end.stitches).toBe(total);
  await page.locator('#resetPlayback').click();
  await expect(page.locator('#seek')).toHaveValue('0',{timeout:10000});
  await page.locator('#play').click();
  await expect.poll(()=>page.evaluate(()=>Number(document.querySelector('#seek').value)),{timeout:10000}).toBeGreaterThan(0);
  expect(errors).toEqual([]);
 });
}
