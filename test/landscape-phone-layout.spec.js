import {test,expect} from '@playwright/test';

// Issue #472 (spec docs/mobile-editor-design.md sections 1, 2 and 6): at 844x390 landscape the page never scrolls, every visible
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
  sheet:b('#layersSheet.sheet-open')||b('#inspector.sheet-open')};
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
  await page.locator('.sheet-bar button').nth(0).click();
  await expect(page.locator('#layersSheet')).toHaveClass(/sheet-open/);
  expect(await smallControls(page),'Layers open').toEqual([]);
  await page.locator('.sheet-bar button').nth(1).click();
  await expect(page.locator('#inspector')).toHaveClass(/sheet-open/);
  expect(await smallControls(page),'Properties open').toEqual([]);
 });

 test(`the Layers header wraps to at most two lines (${lang})`,async({page})=>{
  await openEditor(page,...LANDSCAPE,lang);
  await page.locator('.sheet-bar button').nth(0).click();
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
  await page.locator('.sheet-bar button').nth(0).click();
  const R=await regions(page);
  expect(Math.round(R.sheet.r-R.sheet.l)).toBe(320);
  expect(R.sheet.r).toBeCloseTo(844,0);
  expect(overlaps(R.rail,R.sheet)).toBe(false);
 });
}

for(const lang of ['en','es']){
 test(`every tool is reachable from the rail or More tools (${lang})`,async({page})=>{
  await openEditor(page,...LANDSCAPE,lang);
  const more=page.locator('#toolMore');
  await expect(more).toBeVisible();
  // The rail scrolls inside itself. Pressing More tools pages through it; across the pages every tool is fully visible at least once.
  const inView=()=>page.evaluate(()=>{
   const rail=document.querySelector('.tool-rail').getBoundingClientRect();
   return [...document.querySelectorAll('.tool-rail button')].map(b=>{const r=b.getBoundingClientRect();return r.top>=rail.top-0.5&&r.bottom<=rail.bottom+0.5;});
  });
  const seen=(await inView()).map(()=>false);
  const note=async()=>(await inView()).forEach((v,i)=>{if(v)seen[i]=true;});
  await note();
  for(let n=0;n<4&&seen.some(v=>!v);n++){
   await more.click();
   await page.waitForTimeout(150);
   await note();
  }
  expect(seen.filter(v=>!v)).toEqual([]);
  // Pressing on past the last page goes back to the top of the rail.
  for(let n=0;n<5&&(await more.getAttribute('aria-expanded'))==='true';n++){await more.click();await page.waitForTimeout(150);}
  await expect(more).toHaveAttribute('aria-expanded','false');
  expect(await page.evaluate(()=>document.querySelector('.tool-rail').scrollTop)).toBe(0);
 });
}

test('desktop at 1280x800 is not a landscape phone layout',async({page})=>{
 await openEditor(page,1280,800,'en');
 const r=await page.evaluate(()=>getComputedStyle(document.querySelector('.tool-rail')).position);
 expect(r).not.toBe('fixed');
});
