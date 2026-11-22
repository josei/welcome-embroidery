import {test,expect} from '@playwright/test';

// On a phone or tablet the save status is an icon inside the top bar, beside the design name. It takes no row of its own, so
// the canvas starts at the bar's bottom edge. Each state has its own glyph, and the words stay as the icon's accessible name
// and tooltip. Desktop keeps the text line.

const FAKE_FILE_PICKER=()=>{
 window.showSaveFilePicker=async()=>({name:'badge.welcome',createWritable:async()=>({write:async()=>{},close:async()=>{}})});
};

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const box=(page,sel)=>page.locator(sel).first().evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};});

// The glyph the status shows: the symbol its icon points at, and whether the icon is drawn at a readable size.
async function glyph(page,sel){
 return page.locator(`${sel} svg use`).evaluate(u=>{
  const svg=u.closest('svg');
  const r=svg.getBoundingClientRect();
  return {symbol:u.getAttribute('href'),width:r.width,height:r.height,visible:getComputedStyle(svg).display!=='none'&&r.width>=16};
 });
}

for(const [w,h] of [[390,844],[844,390],[768,1024]])
 test(`${w} x ${h}: the canvas starts at the top bar's bottom edge, with no status row between them`,async({page})=>{
  await page.setViewportSize({width:w,height:h});
  await page.goto('/?lang=en');
  await expect(page.locator('.canvas')).toBeVisible();
  await page.locator('#rect').click();
  await expect(page.locator('#unsavedMark')).toBeVisible();
  const bar=await box(page,'header.top');
  const canvas=await box(page,'.canvas');
  expect(canvas.top,'the canvas top equals the bar bottom').toBeCloseTo(bar.bottom,0);
  const inBar=await page.locator('#unsavedMark').evaluate(e=>!!e.closest('header.top'));
  expect(inBar,'the status sits inside the top bar').toBe(true);
  const status=await box(page,'#unsavedMark');
  expect(status.top,'the status is within the bar').toBeGreaterThanOrEqual(bar.top);
  expect(status.bottom,'the status is within the bar').toBeLessThanOrEqual(bar.bottom);
 });

test('390 x 844 es: the autosaved state is an icon, not words, and keeps its Spanish name and tooltip',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?lang=es');
 await expect(page.locator('.canvas')).toBeVisible();
 await page.locator('#rect').click();
 const status=page.locator('#unsavedMark');
 await expect(status).toBeVisible();
 expect(await status.evaluate(e=>e.textContent.trim()),'the bar shows no words').toBe('');
 expect(await status.getAttribute('aria-label')).toBe('Autoguardado en este navegador');
 expect(await status.getAttribute('title')).toBe('Autoguardado en este navegador');
 expect((await glyph(page,'#unsavedMark')).symbol).toBe('#i-status-autosaved');
 expect((await glyph(page,'#unsavedMark')).visible,'the autosaved icon is drawn').toBe(true);
 await page.screenshot({path:'test-results/save-status-icon-390x844-es-autosaved.png'});
});

test('the idle, autosaved, saved and unsaved states each show their own visible glyph on a tablet',async({page})=>{
 await page.addInitScript(FAKE_FILE_PICKER);
 await page.setViewportSize({width:768,height:1024});
 await page.goto('/?lang=en');
 await expect(page.locator('.canvas')).toBeVisible();

 await expect(page.locator('#idleStatus')).toBeVisible();
 const idle=await glyph(page,'#idleStatus');
 expect(idle.visible,'the idle icon is drawn').toBe(true);
 expect(idle.symbol).toBe('#i-status-autosaved');

 await page.locator('#rect').click();
 await expect(page.locator('#unsavedMark')).toHaveText('');
 const autosaved=await glyph(page,'#unsavedMark');
 expect(autosaved.visible,'the autosaved icon is drawn').toBe(true);

 await page.locator('#save').click();
 await expect(page.locator('#savedStatus')).toBeVisible();
 const saved=await glyph(page,'#savedStatus');
 expect(saved.visible,'the saved icon is drawn').toBe(true);
 const savedColour=await page.locator('#savedStatus').evaluate(e=>getComputedStyle(e).color);

 await page.locator('#rect').click();
 await expect(page.locator('#unsavedMark')).toHaveClass(/\bunsaved\b/);
 const unsaved=await glyph(page,'#unsavedMark');
 expect(unsaved.visible,'the unsaved icon is drawn').toBe(true);

 const symbols=[autosaved.symbol,saved.symbol,unsaved.symbol];
 expect(new Set(symbols).size,'autosaved, saved and unsaved use three different glyphs').toBe(3);
 expect(idle.symbol).toBe(autosaved.symbol);

 const colour=await page.locator('#unsavedMark').evaluate(e=>getComputedStyle(e).color);
 expect(colour,'the unsaved state is tinted differently from the saved one').not.toBe(savedColour);
 await page.screenshot({path:'test-results/save-status-icon-768x1024-en-unsaved.png'});
});

test('1280 x 800 en: desktop keeps the save status as its text line',async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/?lang=en');
 await expect(page.locator('.canvas')).toBeVisible();
 await page.locator('#rect').click();
 const status=page.locator('#unsavedMark');
 await expect(status).toHaveText('Autosaved in this browser');
 expect(await status.evaluate(e=>e.querySelector('svg')===null),'desktop shows no icon in the status').toBe(true);
 await page.screenshot({path:'test-results/save-status-icon-1280x800-en.png'});
});
