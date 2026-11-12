import {test,expect} from '@playwright/test';

// Issue #475 (part of #468, spec #470 section 1-3, 7): tablet portrait at 768x1024 has a 56 px top bar, a 64 px labelled tool rail,
// the canvas, and a 300 px collapsible inspector with Layers and Properties tabs. The page never scrolls, every control is 44 px or
// more, rail labels fit their 64 px column in Spanish, and the inspector never overlaps the canvas. Desktop at 1280 px is unchanged.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const rect=(page,sel)=>page.locator(sel).first().evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};});
const intersects=(a,b)=>a.left<b.right-0.5&&b.left<a.right-0.5&&a.top<b.bottom-0.5&&b.top<a.bottom-0.5;

for(const lang of ['en','es']){
 test(`tablet portrait 768x1024 ${lang}: page does not scroll, targets 44px, rail labels fit`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:768,height:1024});
  await page.goto(`/?lang=${lang}`);
  await expect(page.locator('.canvas')).toBeVisible();
  const doc=await page.evaluate(()=>({sh:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,ih:innerHeight,iw:innerWidth}));
  expect(doc.sh,'scrollHeight === innerHeight').toBe(doc.ih);
  expect(doc.sw,'scrollWidth === innerWidth').toBe(doc.iw);
  const small=await page.evaluate(()=>{const sel='.top button, .top input, .top .segmented button, .tool-rail button, .canvas .floating button, .canvas .zoombar button, .inspector-tabs button, .layers-head button, .drawer-close, .inspector-toggle';
   return [...document.querySelectorAll(sel)].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).display!=='none'&&(r.width<43.5||r.height<43.5)}).map(e=>(e.id||e.className||e.tagName)+' '+Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height));});
  expect(small,'controls under 44x44').toEqual([]);
  const labels=await page.evaluate(()=>[...document.querySelectorAll('.tool-rail .rail-label')].map(e=>({t:e.textContent,fits:e.scrollWidth<=e.clientWidth})));
  expect(labels.length).toBeGreaterThan(0);
  for(const l of labels) expect(l.fits,`rail label "${l.t}" fits 64px`).toBe(true);
  const rail=await rect(page,'.tool-rail');
  expect(Math.round(rail.width)).toBe(64);
  expect(errors).toEqual([]);
 });

 test(`tablet portrait 768x1024 ${lang}: inspector beside canvas, never overlapping`,async({page})=>{
  await page.setViewportSize({width:768,height:1024});
  await page.goto(`/?lang=${lang}`);
  await expect(page.locator('.canvas')).toBeVisible();
  const top=await rect(page,'.top');
  expect(Math.round(top.height)).toBe(56);
  const status=await rect(page,'.layout main>footer');
  // Issue #480: the status line is 44 px so its Messages button is a 44 px target.
  expect(Math.round(status.height)).toBe(44);
  const canvas=await rect(page,'.canvas');
  const rail=await rect(page,'.tool-rail');
  const art=await rect(page,'#art');
  expect(intersects(art,rail),'rail and drawing area overlap').toBe(false);
  expect(Math.abs(rail.left-canvas.left),'rail sits on the canvas left edge').toBeLessThan(1);
  // Inspector is open by default: Layers tab, then Properties tab.
  const insp=await rect(page,'#layersSheet');
  expect(Math.round(insp.width)).toBe(300);
  expect(intersects(canvas,insp),'inspector overlaps canvas').toBe(false);
  await page.locator('.inspector-tab[data-tab=properties]').click();
  await expect(page.locator('#inspector')).toBeVisible();
  const canvas2=await rect(page,'.canvas');
  const insp2=await rect(page,'#inspector');
  expect(intersects(canvas2,insp2),'inspector overlaps canvas (Properties)').toBe(false);
  // Collapsing the inspector gives the canvas its width back.
  await page.locator('.inspector-collapse').click();
  await expect(page.locator('#inspector')).toBeHidden();
  const canvas3=await rect(page,'.canvas');
  expect(canvas3.width).toBeGreaterThan(canvas2.width);
  // Zoom control floats inside the canvas, bottom-right.
  const zoom=await rect(page,'.canvas .zoombar');
  expect(zoom.right).toBeLessThanOrEqual(canvas3.right+0.5);
  expect(zoom.bottom).toBeLessThanOrEqual(canvas3.bottom+0.5);
 });
}

test('desktop layout at 1280x800 keeps its three columns',async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/?lang=en');
 await expect(page.locator('#objects')).toBeVisible();
 const cols=await page.evaluate(()=>getComputedStyle(document.querySelector('.layout')).gridTemplateColumns);
 // Measured on the branch before #475 and after it: the desktop grid is 256 px, a flexible centre, and 256 px.
 expect(cols).toBe('256px 768px 256px');
 expect(await page.locator('.tool-rail').isVisible()).toBe(true);
 expect(Math.round((await rect(page,'.canvas')).left)).toBeGreaterThan(200);
});
