import {test,expect} from '@playwright/test';

// The controls along the bottom of the canvas (the zoom bar, the colour timeline, the playback bar, the lettering caption,
// the toast, the status line and its Messages button) never cover one another and each sits fully inside the window, at
// the five sizes below, in English and Spanish. The Stitches view and the lettering box are both checked, since each adds
// its own row or caption.

const SIZES=[
 {name:'1024x768 landscape tablet',width:1024,height:768},
 {name:'768x1024 portrait tablet',width:768,height:1024},
 {name:'390x844 phone portrait',width:390,height:844},
 {name:'844x390 phone landscape',width:844,height:390},
 {name:'1440x900 desktop',width:1440,height:900},
];
const LOCALES=['en','es'];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// Two paths in two thread colours, so the Stitches view has a colour change and a timeline marker to place.
async function seedTwoColours(page,lang,width,height){
 const {initialDocument,applyOperations,validateDocument}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=400;doc.name='Probe';doc.revision=1;
 const zigzag=[];for(let i=0;i<=107;i++)zigzag.push([-150+i*(300/107),i%2?30:-30]);
 applyOperations(doc,[
  {op:'add_path',id:'s0',x:0,y:0,name:'Drawn path',points:zigzag,thread:'#cc3333',stitch:'running',stitchLength:1.4},
  {op:'add_path',id:'s1',x:0,y:0,name:'Short run',points:[[-40,-60],[-16,-60]],thread:'#3366cc',stitch:'running',stitchLength:1.4},
 ]);
 validateDocument(doc);
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
 await page.reload();
 await page.locator('#restoreYes').click();
 await expect(page.locator('.object-row')).toHaveCount(2);
}

async function openStitches(page){
 if(await page.locator('[data-view=stitches]').isVisible()){
  await page.locator('[data-view=stitches]').click();
 }else{
  await page.locator('#phoneMenu').click();await page.locator('#menuView-stitches').click();
 }
 await expect(page.locator('#play')).toBeVisible();
 await expect(page.locator('.timeline-marker')).toHaveCount(1);
 // Play and pause once, so the needle readout has a position to show.
 await page.locator('#play').click();
 await page.locator('#play').click();
}

// Runs in the page: the visible bottom-of-canvas items, their boxes, and the summary's line count.
const measure=()=>{
 const visible=e=>{if(!e)return false;const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden')return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
 const sel={
  zoom:'.canvas .zoombar',
  timeline:'.playback-slider',
  play:'#play',
  playbackTime:'#playbackTime',
  playbackStitches:'#playbackStitches',
  summary:'#playbackSummary',
  cursor:'#cursorPosition',
  needle:'#needlePosition',
  readout:'#measureReadout',
  count:'#count',
  playbackProgress:'#playbackProgress',
  messages:'#messagesBtn',
  hint:'#canvasTextHint',
  toast:'#toast .toast-item',
 };
 const items={};
 for(const [k,s] of Object.entries(sel)){
  const e=document.querySelector(s);
  if(visible(e)){const r=e.getBoundingClientRect();items[k]={l:r.left,t:r.top,r:r.right,b:r.bottom};}
 }
 for(const e of document.querySelectorAll('.timeline-marker')){
  if(!visible(e))continue;const r=e.getBoundingClientRect();
  (items.markers??=[]).push({l:r.left,t:r.top,r:r.right,b:r.bottom});
 }
 const summary=document.querySelector('#playbackSummary');
 const lineHeight=summary?parseFloat(getComputedStyle(summary).lineHeight)||parseFloat(getComputedStyle(summary).fontSize)*1.2:0;
 const summaryLines=summary&&visible(summary)?Math.round(summary.getBoundingClientRect().height/lineHeight):0;
 const text={};for(const s of ["#playbackSummary","#cursorPosition","#needlePosition","#playbackStitches","#messagesBtn"]){const e=document.querySelector(s);if(e&&visible(e))text[s]=e.textContent;}
 return {w:innerWidth,h:innerHeight,items,summaryLines,text};
};

// Pairs of visible items that overlap by more than 1 px, and items with any edge outside the window.
function check(m){
 const failures=[];
 const entries=Object.entries(m.items).flatMap(([k,v])=>Array.isArray(v)?v.map((b,i)=>[`${k}[${i}]`,b]):[[k,v]]);
 // The timeline is the track that holds its markers, so a marker is compared with the zoom bar and the other controls, not its track.
 const pairs=[];
 for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
  const [an,a]=entries[i],[bn,b]=entries[j];
  if(an==='timeline'||bn==='timeline')continue;
  const ox=Math.min(a.r,b.r)-Math.max(a.l,b.l),oy=Math.min(a.b,b.b)-Math.max(a.t,b.t);
  if(ox>1&&oy>1)pairs.push(`${an} / ${bn}`);
 }
 for(const [n,b] of entries){
  if(b.l<0||b.t<0||b.r>m.w||b.b>m.h)failures.push(`${n} outside the window (${Math.round(b.l)},${Math.round(b.t)})-(${Math.round(b.r)},${Math.round(b.b)})`);
 }
 return {pairs,failures};
}

for(const {name,width,height} of SIZES) for(const lang of LOCALES){
 test(`bottom controls do not overlap in Stitches view, ${name} (${lang})`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await seedTwoColours(page,lang,width,height);
  await openStitches(page);
  const m=await page.evaluate(measure);
  const {pairs,failures}=check(m);
  // The timeline is 8 px markers on a track; a marker must be at least 24 px across to be tapped, and the summary one line.
  const markers=m.items.markers??[];
  for(const b of markers)expect(Math.min(b.r-b.l,b.b-b.t),'colour-change marker size').toBeGreaterThanOrEqual(24);
  // The thread summary is one line everywhere except a portrait tablet, where it may wrap to two inside its row.
  expect(m.summaryLines,'summary lines').toBeLessThanOrEqual(width>height?1:2);
  expect(pairs,'overlapping controls').toEqual([]);
  expect(failures,'controls outside the window').toEqual([]);
  expect(errors).toEqual([]);
 });

 test(`bottom controls do not overlap with the lettering caption open, ${name} (${lang})`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await seedTwoColours(page,lang,width,height);
  await page.locator('.tool-rail #letter').click();
  await expect(page.locator('#canvasText')).toBeVisible();
  const m=await page.evaluate(measure);
  const {pairs,failures}=check(m);
  expect(pairs,'overlapping controls').toEqual([]);
  expect(failures,'controls outside the window').toEqual([]);
  expect(errors).toEqual([]);
 });
}

for(const {name,width,height} of SIZES) for(const lang of LOCALES){
 test(`bottom controls do not overlap with a toast showing, ${name} (${lang})`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await seedTwoColours(page,lang,width,height);
  await page.locator('#rect').click();
  await expect(page.locator('#toast .toast-item').first()).toBeVisible();
  const m=await page.evaluate(measure);
  const {pairs,failures}=check(m);
  expect(m.items.toast,'toast is measured').toBeDefined();
  expect(pairs,'overlapping controls').toEqual([]);
  expect(failures,'controls outside the window').toEqual([]);
  expect(errors).toEqual([]);
 });
}
