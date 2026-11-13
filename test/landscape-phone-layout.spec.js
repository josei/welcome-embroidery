import {test,expect} from '@playwright/test';

// At 844x390 landscape the page never scrolls, every visible
// control is at least 44x44, the Layers header stays within two lines, and the regions (top bar, tool rail, canvas, status line,
// right-edge sheets) do not overlap each other or the canvas controls. Desktop at 1280 px is not affected.
const LANDSCAPE=[844,390];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEditor(page,width,height,lang){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await expect(page.locator('.tool-rail')).toBeVisible();
 return errors;
}

// Every visible, enabled-or-not control whose box is smaller than 44 px on either side.
const smallControls=page=>page.evaluate(()=>{
 const out=[];
 for(const e of document.querySelectorAll('button,input,select,textarea,summary,a')){
  const cs=getComputedStyle(e);
  if(cs.display==='none'||cs.visibility==='hidden'||e.closest('[hidden],.sr-only')) continue;
  const r=e.getBoundingClientRect();
  if(r.width<=0||r.height<=0) continue;
  if(r.bottom<=0||r.top>=innerHeight||r.right<=0||r.left>=innerWidth) continue; // off screen (skip link)
  if(Math.min(r.width,r.height)<44) out.push(`${e.tagName}#${e.id} ${Math.round(r.width)}x${Math.round(r.height)}`);
 }
 return out;
});

// Boxes of the fixed regions, in CSS px.
const regions=page=>page.evaluate(()=>{
 const b=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom};};
 return {top:b('.top'),rail:b('.tool-rail'),canvas:b('.layout main>.canvas'),footer:b('.layout main>footer'),
  sheet:b('#layersSheet.sheet-open')||b('#inspector.sheet-open')||b('#moreToolsSheet.sheet-open')};
});

const overlaps=(a,b)=>a&&b&&Math.min(a.r,b.r)-Math.max(a.l,b.l)>0.5&&Math.min(a.b,b.b)-Math.max(a.t,b.t)>0.5;

for(const lang of ['en','es']){
 test(`the landscape page never scrolls at 844x390 (${lang})`,async({page})=>{
  const errors=await openEditor(page,...LANDSCAPE,lang);
  const d=await page.evaluate(()=>({sh:document.documentElement.scrollHeight,ih:innerHeight,sw:document.documentElement.scrollWidth,iw:innerWidth}));
  expect(d.sh).toBe(d.ih);
  expect(d.sw).toBe(d.iw);
  expect(errors).toEqual([]);
 });

 test(`every visible control is at least 44x44 with Layers and Properties open (${lang})`,async({page})=>{
  await openEditor(page,...LANDSCAPE,lang);
  expect(await smallControls(page),'closed').toEqual([]);
  await page.locator('#layersBtn').click();
  await expect(page.locator('#layersSheet')).toHaveClass(/sheet-open/);
  expect(await smallControls(page),'Layers open').toEqual([]);
  await page.locator('#propertiesBtn').click();
  await expect(page.locator('#inspector')).toHaveClass(/sheet-open/);
  expect(await smallControls(page),'Properties open').toEqual([]);
 });

 test(`the Layers header wraps to at most two lines (${lang})`,async({page})=>{
  await openEditor(page,...LANDSCAPE,lang);
  await page.locator('#layersBtn').click();
  const lines=await page.evaluate(()=>{
   const h=document.querySelector('.layers-head');const r=h.getBoundingClientRect();
   const lh=parseFloat(getComputedStyle(h).lineHeight)||parseFloat(getComputedStyle(h).fontSize)*1.3;
   return Math.round(r.height/lh);
  });
  expect(lines).toBeLessThanOrEqual(2);
 });

 test(`no overlap between the top bar, tool rail, canvas controls and status line (${lang})`,async({page})=>{
  await openEditor(page,...LANDSCAPE,lang);
  const R=await regions(page);
  expect(overlaps(R.top,R.rail)).toBe(false);
  expect(overlaps(R.top,R.canvas)).toBe(false);
  expect(overlaps(R.rail,R.footer)).toBe(false);
  expect(overlaps(R.footer,R.canvas)).toBe(false);
  const controls=await page.evaluate(()=>{
   const c=document.querySelector('.layout main>.canvas').getBoundingClientRect();
   const f=document.querySelector('.layout main>footer').getBoundingClientRect();
   const rail=document.querySelector('.tool-rail').getBoundingClientRect();
   const hits=[];
   for(const e of document.querySelectorAll('.canvas .zoombar button,.canvas .floating button,.sheet-bar button,.top button')){
    const r=e.getBoundingClientRect();if(r.width<=0)continue;
    if(Math.min(r.right,rail.right)>Math.max(r.left,rail.left)&&Math.min(r.bottom,rail.bottom)>Math.max(r.top,rail.top)) hits.push('rail '+e.id);
    if(r.bottom>f.top+0.5&&!e.closest('footer')&&!e.closest('.sheet-bar')) hits.push('footer '+e.id);
   }
   return hits;
  });
  expect(controls).toEqual([]);
 });

 test(`Layers opens as a 320 px right-edge sheet clear of the rail (${lang})`,async({page})=>{
  await openEditor(page,...LANDSCAPE,lang);
  await page.locator('#layersBtn').click();
  const R=await regions(page);
  expect(Math.round(R.sheet.r-R.sheet.l)).toBe(320);
  expect(R.sheet.r).toBeCloseTo(844,0);
  expect(overlaps(R.rail,R.sheet)).toBe(false);
 });

 test(`Properties opens as a 320 px right-edge sheet clear of the rail (${lang})`,async({page})=>{
  await openEditor(page,...LANDSCAPE,lang);
  await page.locator('#propertiesBtn').click();
  const R=await regions(page);
  expect(Math.round(R.sheet.r-R.sheet.l)).toBe(320);
  expect(R.sheet.r).toBeCloseTo(844,0);
  expect(R.sheet.t).toBeGreaterThanOrEqual(44);
  expect(overlaps(R.rail,R.sheet)).toBe(false);
 });
}

// On a landscape phone the rail fills the window between the top bar and the status line, every cell is at
// least 44 px, and at rest the nine cells fit with no scroll. More tools is the last cell and opens the sheet with the tools that do not fit.
for(const lang of ['en','es']){
 test(`the rail fills the height below the top bar, fits without scrolling, and has no overlapping cells (${lang})`,async({page})=>{
  await openEditor(page,...LANDSCAPE,lang);
  const r=await page.evaluate(()=>{
   const rail=document.querySelector('.tool-rail');
   const rb=rail.getBoundingClientRect();
   const cells=[...rail.querySelectorAll(':scope>button')].filter(b=>getComputedStyle(b).display!=='none').map(b=>{const c=b.getBoundingClientRect();return {id:b.id,l:c.left,t:c.top,r:c.right,b:c.bottom,w:c.width,h:c.height};});
   return {top:rb.top,bottom:rb.bottom,sh:rail.scrollHeight,ch:rail.clientHeight,sw:rail.scrollWidth,cw:rail.clientWidth,cells,
    footerTop:document.querySelector('.layout main>footer').getBoundingClientRect().top,
    topBar:document.querySelector('.top').getBoundingClientRect().bottom};
  });
  expect(Math.round(r.top)).toBe(Math.round(r.topBar));
  expect(Math.round(r.bottom)).toBe(Math.round(r.footerTop));
  expect(r.sh).toBeLessThanOrEqual(r.ch);
  expect(r.sw).toBeLessThanOrEqual(r.cw);
  const ids=r.cells.map(c=>c.id);
  for(const id of ['layersBtn','propertiesBtn','select','rect','path','letter','line','measure','toolMore']) expect(ids).toContain(id);
  for(const c of r.cells){
   expect(Math.min(c.w,c.h),c.id).toBeGreaterThanOrEqual(44);
   expect(c.t,c.id).toBeGreaterThanOrEqual(r.top-0.5);
   expect(c.b,c.id).toBeLessThanOrEqual(r.bottom+0.5);
  }
  for(let i=0;i<r.cells.length;i++) for(let j=i+1;j<r.cells.length;j++){
   const a=r.cells[i],b=r.cells[j];
   const hit=Math.min(a.r,b.r)-Math.max(a.l,b.l)>0.5&&Math.min(a.b,b.b)-Math.max(a.t,b.t)>0.5;
   expect(hit,`${a.id} and ${b.id}`).toBe(false);
  }
  expect(await smallControls(page)).toEqual([]);
 });

 test(`More tools opens the sheet with the tools the rail leaves out (${lang})`,async({page})=>{
  await openEditor(page,...LANDSCAPE,lang);
  await expect(page.locator('#toolMore')).toHaveAttribute('aria-expanded','false');
  await page.locator('#toolMore').click();
  const sheet=page.locator('#moreToolsSheet');
  await expect(sheet).toHaveClass(/sheet-open/);
  await expect(page.locator('#toolMore')).toHaveAttribute('aria-expanded','true');
  for(const id of ['ellipse','polygon','star','traceBtn','photoStitch','pen']){
   const el=sheet.locator(`#${id}`);
   if(await el.count()) await expect(el.first()).toBeVisible();
  }
  for(const id of ['ellipse','polygon','star','traceBtn','pen']) await expect(sheet.locator(`#${id}`)).toHaveCount(1);
  const R=await regions(page);
  expect(overlaps(R.rail,R.sheet)).toBe(false);
  expect(await smallControls(page),'More tools open').toEqual([]);
  // Pressing More tools again closes the sheet (togglePhoneSheet). Tap-outside dismissal in landscape is not checked here.
  await page.locator('#toolMore').click();
  await expect(page.locator('#toolMore')).toHaveAttribute('aria-expanded','false');
  await expect(sheet).not.toHaveClass(/sheet-open/);
 });
}

test('desktop at 1280x800 is not a landscape phone layout',async({page})=>{
 await openEditor(page,1280,800,'en');
 const r=await page.evaluate(()=>getComputedStyle(document.querySelector('.tool-rail')).position);
 expect(r).not.toBe('fixed');
});

// Landscape phone Menu and sheet details, checked together.
test('the landscape Menu is a 320 px column, and each label starts within 16 px of its icon (en)',async({page})=>{
 await openEditor(page,...LANDSCAPE,'en');
 await page.locator('#phoneMenu').click();
 const list=page.locator('#phoneMenuList');
 await expect(list).toBeVisible();
 const box=await list.boundingBox();
 expect(box.width).toBeLessThanOrEqual(390);
 const gaps=await list.locator('[role="menuitem"]').evaluateAll(els=>els.map(e=>{
  const icon=e.querySelector('.menu-icon').getBoundingClientRect(), label=e.querySelector(':scope > span').getBoundingClientRect();
  return label.left-icon.right;
 }));
 for(const g of gaps) expect(g).toBeLessThanOrEqual(16);
});

test('the More tools chevron is the topmost element at its centre, with no tool showing behind it',async({page})=>{
 await openEditor(page,...LANDSCAPE,'en');
 const r=await page.evaluate(()=>{
  const m=document.querySelector('#toolMore').getBoundingClientRect();
  const rail=document.querySelector('.tool-rail').getBoundingClientRect();
  const hit=document.elementFromPoint(m.left+m.width/2,m.top+m.height/2);
  // The part of each rail child that is actually drawn: inside the rail's box, and not under the chevron.
  const peeking=[...document.querySelectorAll('.tool-rail>button')].filter(b=>{
   if(b.id==='toolMore') return false; // More is the cell that covers the rest; it is not a tool behind itself
   const c=b.getBoundingClientRect();
   const top=Math.max(c.top,rail.top), bottom=Math.min(c.bottom,rail.bottom);
   return bottom>top && Math.min(c.right,m.right)>Math.max(c.left,m.left) && Math.min(bottom,m.bottom)>Math.max(top,m.top);
  }).map(b=>b.id);
  return {hit:hit.id,peeking};
 });
 expect(r.hit).toBe('toolMore');
 expect(r.peeking).toEqual([]);
});

test('a Spanish layer row summary stays one line high at 768x1024',async({page})=>{
 await page.setViewportSize({width:768,height:1024});
 await page.goto('/?lang=es');
 await expect(page.locator('.object-row').first()).toBeVisible();
 const heights=await page.locator('.object-row .row-tag').evaluateAll(els=>els.map(e=>{
  const lh=parseFloat(getComputedStyle(e).lineHeight)||parseFloat(getComputedStyle(e).fontSize)*1.2;
  return Math.round(e.getBoundingClientRect().height/lh);
 }));
 expect(heights.length).toBeGreaterThan(0);
 for(const h of heights) expect(h).toBe(1);
});

// A landscape right sheet closes on a tap on the canvas outside it. The scrim covers that area while
// the sheet is open, is hidden from assistive tech (aria-hidden), and a tap on it closes the sheet. Run with a fine pointer, as on the
// desktop-sized check of the sheet layout (the scrim used to show only with a coarse pointer).
const CANVAS_TAPS=[[200,150],[300,250],[420,120]];
for(const [opener,sheetId] of [['#layersBtn','#layersSheet'],['#propertiesBtn','#inspector']]){
 test(`a tap on the canvas outside the landscape ${opener.slice(1)} sheet closes it (en)`,async({page})=>{
  await openEditor(page,...LANDSCAPE,'en');
  for(const [x,y] of CANVAS_TAPS){
   await page.locator(opener).click();
   await expect(page.locator(sheetId)).toHaveClass(/sheet-open/);
   const scrim=page.locator('.sheet-scrim');
   await expect(scrim).toBeVisible();
   await expect(scrim).toHaveAttribute('aria-hidden','true');
   await page.mouse.click(x,y);
   await expect(page.locator(`.layout>${sheetId}.sheet-open`)).toHaveCount(0);
   await expect(scrim).toHaveCount(0);
  }
 });
}

test('the landscape scrim covers the canvas beside an open sheet and closes it when tapped',async({page})=>{
 await openEditor(page,...LANDSCAPE,'en');
 await page.locator('#layersBtn').click();
 await expect(page.locator('#layersSheet')).toHaveClass(/sheet-open/);
 const box=await page.locator('.sheet-scrim').boundingBox();
 expect(box.x).toBe(104);
 expect(box.x+box.width).toBeCloseTo(LANDSCAPE[0],0);
 await page.locator('.sheet-scrim').click({position:{x:200,y:150}});
 await expect(page.locator('.layout>#layersSheet.sheet-open')).toHaveCount(0);
});

// The phone playback counter and the landscape layer row each stay on one line.
// A satin-stitched rectangle restored from the autosave gives a Layers row ("satin · N stitches") and a compiled count to read.
async function openSatinDesign(page,width,height,lang){
 const {initialDocument,applyOperations,validateDocument}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=400;doc.name='Probe';doc.revision=1;
 applyOperations(doc,[{op:'add_path',id:'s0',x:0,y:0,points:[[-190,0],[190,0]],thread:'#cc3333',stitch:'satin',satinWidth:4}]);validateDocument(doc);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
 await page.reload();
 await page.locator('#restoreYes').click();
 await expect(page.locator('.object-row')).toHaveCount(1);
 return errors;
}

// Lines of text in an element: its box height over its line height (1 for a single line).
const linesOf=(page,selector)=>page.evaluate(sel=>{
 const e=document.querySelector(sel);const cs=getComputedStyle(e);
 const lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.2;
 return Math.round(e.getBoundingClientRect().height/lh);
},selector);

for(const [w,h] of [[390,844]]) for(const lang of ['en','es']) for(const view of ['stitches','preview']){
 test(`the portrait playback counter is one line, ${view} view (${lang})`,async({page})=>{
  test.setTimeout(120000);
  const errors=await openSatinDesign(page,w,h,lang);
  await page.locator('#phoneMenu').click();await page.locator(`#menuView-${view}`).click();
  await expect(page.locator('#play')).toBeVisible();
  await expect(page.locator('#playbackStitches')).toBeVisible();
  // A long satin gives a four-digit total (over 3,000), so the label is near its widest.
  await expect(page.locator('#playbackStitches')).toHaveText(/\d,\d{3}$/);
  expect(await linesOf(page,'#playbackStitches'),`counter: "${await page.locator('#playbackStitches').textContent()}"`).toBe(1);
  // The dock clips overflow, so the counter's right edge must sit inside the viewport.
  expect(await page.locator('#playbackStitches').evaluate(e=>e.getBoundingClientRect().right<=window.innerWidth),`counter clipped: "${await page.locator('#playbackStitches').textContent()}"`).toBe(true);
  expect(errors).toEqual([]);
 });
}

for(const lang of ['en','es']){
 test(`a landscape Layers row is one line for "satin · stitches" at 844x390 (${lang})`,async({page})=>{
  test.setTimeout(120000);
  await openSatinDesign(page,...LANDSCAPE,lang);
  await page.locator('#layersBtn').click();
  await expect(page.locator('#layersSheet')).toHaveClass(/sheet-open/);
  const row=page.locator('.object-row .row-tag').first();
  await expect(row).toBeVisible();
  expect(await linesOf(page,'.object-row .row-tag'),`row: "${await row.textContent()}"`).toBe(1);
  // One line but cut with an ellipsis would still hide words, so the whole label must fit its box.
  expect(await row.evaluate(e=>e.scrollWidth<=e.clientWidth),`row clipped: "${await row.textContent()}"`).toBe(true);
 });
}

// The canvas gets more than half of the 390 px height, so the header, rail and status line do not take most of the screen.
for(const lang of ['en','es']){
 test(`the canvas takes at least half the height at 844x390 (${lang})`,async({page})=>{
  await openEditor(page,...LANDSCAPE,lang);
  const canvas=await page.locator('.layout main>.canvas').boundingBox();
  expect(canvas.height/LANDSCAPE[1]).toBeGreaterThanOrEqual(0.5);
 });
}
