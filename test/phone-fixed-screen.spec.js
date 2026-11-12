import {test,expect} from '@playwright/test';

// Issue #471 (part of #468, spec section 1, 2 and 6): at phone portrait (390x844) the screen is one fixed layout. The page never
// scrolls; the top bar is 52 px; the canvas fills the rest and is the only pannable part; the contextual bar (52 px) shows only with a
// selection; the tool dock is 56 px; the status line is 28 px; the zoom buttons are a vertical stack inside the canvas's bottom right.
// Every visible control is at least 44x44 CSS px, and no two of the screen's regions overlap. The screenshots go to the artifacts
// folder of the turn when ARTIFACTS is set (see the issue report).
const SCREEN=[390,844];
const ARTIFACTS=process.env.ARTIFACTS||'';

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEditor(page,lang){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept().catch(()=>{}));
 await page.setViewportSize({width:SCREEN[0],height:SCREEN[1]});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await expect(page.locator('header.top #name')).toBeVisible();
 return errors;
}

// The screen's regions as boxes, and every visible control inside them with its size.
const regions=page=>page.evaluate(()=>{
 const box=e=>{const r=e.getBoundingClientRect();return {x:r.left,y:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height};};
 const shown=e=>{const cs=getComputedStyle(e);return cs.display!=='none'&&cs.visibility!=='hidden'&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;};
 const out={};
 const name={top:'header.top',canvas:'.layout main>.canvas',zoom:'.canvas .zoombar',bar:'.layout main>.floating',playback:'.layout main>.phone-playback',dock:'.layout main>.tool-rail',status:'.layout main>footer'};
 for(const [k,s] of Object.entries(name)){const e=document.querySelector(s);out[k]=e&&shown(e)?box(e):null;}
 const controls=[];
 for(const k of ['top','zoom','bar','playback','dock','status']){
  const e=document.querySelector(name[k]);
  if(!e||!shown(e))continue;
  for(const c of e.querySelectorAll('button,input,select,textarea,a,[role="button"]')){
   if(c.closest('.sr-only')||!shown(c))continue;
   const r=c.getBoundingClientRect();
   controls.push({region:k,id:c.id||c.className||c.tagName,w:r.width,h:r.height});
  }
 }
 out.controls=controls;
 return out;
});

const overlapping=(a,b)=>Math.min(a.r,b.r)-Math.max(a.x,b.x)>0.5&&Math.min(a.b,b.b)-Math.max(a.y,b.y)>0.5;

for(const lang of ['en','es']){
 test(`the page never scrolls at 390x844 (${lang})`,async({page})=>{
  const errors=await openEditor(page,lang);
  const s=await page.evaluate(()=>({sh:document.documentElement.scrollHeight,ih:innerHeight,sw:document.documentElement.scrollWidth,iw:innerWidth}));
  expect(s.sh,'scrollHeight equals innerHeight').toBe(s.ih);
  expect(s.sw,'scrollWidth equals innerWidth').toBe(s.iw);
  expect(errors).toEqual([]);
 });

 test(`the regions have the spec heights and the controls are at least 44x44 at 390x844 (${lang})`,async({page})=>{
  const errors=await openEditor(page,lang);
  const g=await regions(page);
  expect(Math.round(g.top.h),'top bar height').toBe(52);
  expect(Math.round(g.dock.h),'tool dock height').toBe(56);
  expect(Math.round(g.status.h),'status line height').toBe(28);
  expect(Math.round(g.canvas.h),'canvas fills the rest').toBe(SCREEN[1]-52-56-28);
  expect(g.bar,'contextual bar is hidden without a selection').toBeNull();
  const small=g.controls.filter(c=>c.w<44||c.h<44).map(c=>`${c.region}:${c.id} ${Math.round(c.w)}x${Math.round(c.h)}`);
  expect(small,'controls under 44x44').toEqual([]);
  expect(errors).toEqual([]);
 });

 test(`no two regions overlap at 390x844, with a selection too (${lang})`,async({page})=>{
  const errors=await openEditor(page,lang);
  await page.locator('#rect').click();
  await expect(page.locator('.layout main>.floating')).toBeVisible();
  const g=await regions(page);
  const boxes=[['top',g.top],['zoom',g.zoom],['bar',g.bar],['playback',g.playback],['dock',g.dock],['status',g.status]].filter(([,b])=>b);
  const bad=[];
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(overlapping(boxes[i][1],boxes[j][1]))bad.push(`${boxes[i][0]} / ${boxes[j][0]}`);
  expect(bad,'overlapping regions').toEqual([]);
  // The regions stack: top bar, canvas, contextual bar, dock, status line, with no gap or overlap between them.
  expect(Math.round(g.top.b),'canvas starts under the top bar').toBe(Math.round(g.canvas.y));
  expect(Math.round(g.canvas.b),'the contextual bar starts under the canvas').toBe(Math.round(g.bar.y));
  expect(Math.round(g.bar.b),'the dock starts under the contextual bar').toBe(Math.round(g.dock.y));
  expect(Math.round(g.dock.b),'the status line starts under the dock').toBe(Math.round(g.status.y));
  const small=g.controls.filter(c=>c.w<44||c.h<44).map(c=>`${c.region}:${c.id}`);
  expect(small,'controls under 44x44 with a selection').toEqual([]);
  expect(errors).toEqual([]);
 });

 test(`the zoom buttons are a vertical stack at the canvas's bottom right at 390x844 (${lang})`,async({page})=>{
  await openEditor(page,lang);
  const g=await regions(page);
  const ids=['zoomIn','zoomOut','zoomFit'];
  const boxes=await Promise.all(ids.map(id=>page.locator(`#${id}`).boundingBox()));
  for(let i=1;i<3;i++){expect(Math.abs(boxes[i].x-boxes[0].x),'stacked in one column').toBeLessThan(1);expect(boxes[i].y,'stacked downward').toBeGreaterThan(boxes[i-1].y);}
  expect(boxes[2].x+boxes[2].width,'right edge 12 px from the canvas').toBeCloseTo(g.canvas.r-12,0);
  expect(boxes[2].y+boxes[2].height,'bottom edge 12 px from the canvas').toBeCloseTo(g.canvas.b-12,0);
 });
}

test('the Menu holds grid, snap, the sheets and Messages at 390x844 (en)',async({page})=>{
 const errors=await openEditor(page,'en');
 await page.locator('#phoneMenu').click();
 for(const id of ['menuSave','menuGrid','menuSnap','menuSnapObjects','menuLayers','menuProperties','menuMessages']){
  await expect(page.locator(`#${id}`),`${id} in the Menu`).toBeVisible();
 }
 await page.locator('#menuLayers').click();
 await expect(page.locator('#layersSheet')).toHaveClass(/sheet-open/);
 expect(errors).toEqual([]);
});

test('the portrait screenshots (EN and ES) are written to the artifacts folder',async({browser})=>{
 test.skip(!ARTIFACTS,'set ARTIFACTS to a folder to write the screenshots');
 for(const lang of ['en','es']){
  // A fresh context per language, so no saved design from the other run brings up the restore dialog.
  const context=await browser.newContext();
  const page=await context.newPage();
  await page.addInitScript(()=>{delete window.showSaveFilePicker;});
  await openEditor(page,lang);
  await page.screenshot({path:`${ARTIFACTS}/phone-portrait-${lang}.png`});
  // Selected state: add a rectangle and pick it in the Layers sheet.
  await page.locator('#rect').click();
  await page.locator('#phoneMenu').click();
  await page.locator('#menuLayers').click();
  await page.locator('.object-line').first().click();
  // Opening the Menu closes the sheet (spec section 4); toggling the Menu shut leaves the selection on the canvas.
  await page.locator('#phoneMenu').click();
  await page.locator('#phoneMenu').click();
  await expect(page.locator('.layout main>.floating')).toBeVisible();
  await page.screenshot({path:`${ARTIFACTS}/phone-portrait-selected-${lang}.png`});
  // Menu open.
  await page.locator('#phoneMenu').click();
  await page.screenshot({path:`${ARTIFACTS}/phone-portrait-menu-${lang}.png`});
  await context.close();
 }
});
