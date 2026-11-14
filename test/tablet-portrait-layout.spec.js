import {test,expect} from '@playwright/test';

// Tablet portrait at 768x1024 has a 56 px top bar, a 64 px icon-only tool rail, the canvas, and one 300 px
// right-hand column holding Layers above Properties. Both panels are open at once, as the desktop shows them, and
// there is no tab strip or collapse chevron to tap. The 2D / Stitches / 3D switch is the desktop's control in the
// desktop's place over the canvas. The page never scrolls, every control is 44 px or more, the tool rail shows no
// text labels, and the inspector never overlaps the canvas. Desktop at 1280 px is unchanged.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const rect=(page,sel)=>page.locator(sel).first().evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};});
const intersects=(a,b)=>a.left<b.right-0.5&&b.left<a.right-0.5&&a.top<b.bottom-0.5&&b.top<a.bottom-0.5;

// The view-mode switch's buttons: their sprite symbol (when one is drawn), their accessible name and their label.
const viewButtons=page=>page.locator('.canvas-views button[data-view]').evaluateAll(btns=>btns.map(b=>({
 symbol:b.querySelector('use')?.getAttribute('href')??null,
 name:b.getAttribute('aria-label')||b.textContent.trim(),
 label:b.textContent.trim(),
})));

for(const lang of ['en','es']){
 test(`tablet portrait 768x1024 ${lang}: page does not scroll, targets 44px, rail is icon-only`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:768,height:1024});
  await page.goto(`/?lang=${lang}`);
  await expect(page.locator('.canvas')).toBeVisible();
  const doc=await page.evaluate(()=>({sh:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,ih:innerHeight,iw:innerWidth}));
  expect(doc.sh,'scrollHeight === innerHeight').toBe(doc.ih);
  expect(doc.sw,'scrollWidth === innerWidth').toBe(doc.iw);
  // The top bar, tool rail, canvas switch, both inspector panels and the status line hold 44 px targets.
  const small=await page.evaluate(()=>{const sel='.top button, .top input, .tool-rail button, .canvas .floating button, .canvas .zoombar button, .canvas .canvas-views button, .layers-head button, #layersSheet button, #inspector button, #inspector input:not([type=checkbox]):not(.sr-only), #inspector select:not(.sr-only)';
   return [...document.querySelectorAll(sel)].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).display!=='none'&&(r.width<43.5||r.height<43.5)}).map(e=>(e.id||e.className||e.tagName)+' '+Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height));});
  expect(small,'controls under 44x44').toEqual([]);
  const labels=await page.evaluate(()=>[...document.querySelectorAll('.tool-rail .rail-label')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.textContent));
  expect(labels,'the tool rail shows no text labels').toEqual([]);
  const rail=await rect(page,'.tool-rail');
  expect(Math.round(rail.width)).toBe(64);
  expect(errors).toEqual([]);
 });

 test(`tablet portrait 768x1024 ${lang}: Layers and Properties share the right column, always open`,async({page})=>{
  await page.setViewportSize({width:768,height:1024});
  await page.goto(`/?lang=${lang}`);
  await expect(page.locator('.canvas')).toBeVisible();
  const top=await rect(page,'.top');
  expect(Math.round(top.height)).toBe(56);
  const status=await rect(page,'.layout main>footer');
  // The status line is 44 px so its Messages button is a 44 px target.
  expect(Math.round(status.height)).toBe(44);
  const canvas=await rect(page,'.canvas');
  const rail=await rect(page,'.tool-rail');
  const art=await rect(page,'#art');
  expect(intersects(art,rail),'rail and drawing area overlap').toBe(false);
  expect(Math.abs(rail.left-canvas.left),'rail sits on the canvas left edge').toBeLessThan(1);
  // Both panels show without a tap, in one column on the right, Layers above Properties.
  const layers=await rect(page,'#layersSheet');
  const properties=await rect(page,'#inspector');
  expect(Math.round(layers.width)).toBe(300);
  expect(intersects(canvas,layers),'inspector overlaps canvas (Layers)').toBe(false);
  expect(intersects(canvas,properties),'inspector overlaps canvas (Properties)').toBe(false);
  expect(Math.abs(layers.left-properties.left),'panels share the column left edge').toBeLessThan(1);
  expect(Math.abs(layers.right-properties.right),'panels share the column right edge').toBeLessThan(1);
  expect(layers.bottom,'Layers ends above Properties').toBeLessThanOrEqual(properties.top+0.5);
  expect(layers.left,'the column sits on the canvas right edge').toBeGreaterThanOrEqual(canvas.right-0.5);
  expect(await page.locator('#objects').isVisible(),'the object list is visible').toBe(true);
  expect(await page.locator('#stats').isVisible(),'the Properties body is visible').toBe(true);
  // Both panel headings name their panel, as on the desktop.
  await expect(page.locator('#layersSheet .layers-head h2')).toHaveText(lang==='es'?'Capas':'Layers');
  await expect(page.locator('#inspector .sheet-title')).toHaveText(lang==='es'?'Propiedades':'Properties');
  // No tab strip and no chevron toggle anywhere.
  expect(await page.locator('.inspector-tabs, .inspector-tab, .inspector-collapse').count(),'no tab strip or collapse chevron').toBe(0);
  // Zoom control floats inside the canvas, bottom-right.
  const zoom=await rect(page,'.canvas .zoombar');
  expect(zoom.right).toBeLessThanOrEqual(canvas.right+0.5);
  expect(zoom.bottom).toBeLessThanOrEqual(canvas.bottom+0.5);
 });

 test(`tablet portrait 768x1024 ${lang}: view switch is the desktop's control`,async({page})=>{
  await page.setViewportSize({width:1280,height:800});
  await page.goto(`/?lang=${lang}`);
  const desktop=await viewButtons(page);
  expect(desktop.length,'desktop view buttons').toBe(3);
  await page.setViewportSize({width:768,height:1024});
  const tablet=await viewButtons(page);
  expect(tablet.map(v=>v.symbol),'same sprite symbol for every view').toEqual(desktop.map(v=>v.symbol));
  expect(tablet.map(v=>v.name),'same accessible name for every view').toEqual(desktop.map(v=>v.name));
  expect(tablet.map(v=>v.label),'same label for every view').toEqual(desktop.map(v=>v.label));
  // The tablet shows no second segmented control with a different label set.
  const groups=await page.locator('.segmented').evaluateAll(gs=>gs.filter(g=>{
   const r=g.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(g).display!=='none';
  }).map(g=>[...g.querySelectorAll('button')].map(b=>b.textContent.trim())));
  expect(groups.length,'an on-screen view control on the tablet').toBe(1);
  expect(groups[0]).toEqual(desktop.map(v=>v.label));
  expect(await page.locator('.canvas-views').isVisible(),'the switch sits over the canvas, as on the desktop').toBe(true);
 });
}

test('desktop layout at 1280x800 keeps its three columns',async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/?lang=en');
 await expect(page.locator('#objects')).toBeVisible();
 const cols=await page.evaluate(()=>getComputedStyle(document.querySelector('.layout')).gridTemplateColumns);
 // The desktop grid is 256 px, a flexible centre, and 256 px.
 expect(cols).toBe('256px 768px 256px');
 expect(await page.locator('.tool-rail').isVisible()).toBe(true);
 expect(Math.round((await rect(page,'.canvas')).left)).toBeGreaterThan(200);
});
