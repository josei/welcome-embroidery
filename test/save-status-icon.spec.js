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
  // The 44 px touch target can overhang the bar's 1 px bottom border by half a pixel at the landscape height.
  expect(status.top,'the status is within the bar').toBeGreaterThanOrEqual(bar.top-1);
  expect(status.bottom,'the status is within the bar').toBeLessThanOrEqual(bar.bottom+1);
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

// The icon sits inside the design name field, after the name's text, and keeps 8 px from Export. It is checked in both
// languages at every phone and tablet size the top bar supports.
const WORDS={en:{autosaved:'Autosaved in this browser'},es:{autosaved:'Autoguardado en este navegador'}};

for(const [w,h] of [[390,844],[844,390],[768,1024]])
 for(const lang of ['en','es'])
  test(`${w} x ${h} ${lang}: the status icon is in the name's row and at least 8 px from Export`,async({page})=>{
   await page.setViewportSize({width:w,height:h});
   await page.goto(`/?lang=${lang}`);
   await expect(page.locator('.canvas')).toBeVisible();
   await page.locator('#rect').click();
   await expect(page.locator('#unsavedMark')).toBeVisible();
   const status=await box(page,'#unsavedMark');
   const field=await box(page,'.top .name-field');
   const exportBox=await box(page,'#export');
   expect(status.top,'the icon starts within the name row').toBeGreaterThanOrEqual(field.top);
   expect(status.bottom,'the icon ends within the name row').toBeLessThanOrEqual(field.bottom);
   expect(status.left,'the icon starts inside the name field').toBeGreaterThanOrEqual(field.left);
   expect(exportBox.left-status.right,'the gap from the icon to Export').toBeGreaterThanOrEqual(8);
  });

for(const [state,setup] of [
 ['autosaved',async()=>{}],
 ['saved',async page=>{await page.keyboard.press('ControlOrMeta+s');await expect(page.locator('#savedStatus')).toBeVisible();}],
 ['unsaved',async page=>{await page.keyboard.press('ControlOrMeta+s');await expect(page.locator('#savedStatus')).toBeVisible();await page.locator('#rect').click();}],
])
 test(`390 x 844 es: the ${state} icon is captured`,async({page})=>{
  await page.addInitScript(FAKE_FILE_PICKER);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?lang=es');
  await expect(page.locator('.canvas')).toBeVisible();
  await page.locator('#rect').click();
  await setup(page);
  await expect(page.locator('.top .save-status')).toBeVisible();
  await page.locator('.top .name-field').hover();
  await page.screenshot({path:`test-results/save-status-${state}-390x844-es.png`});
 });

test('390 x 844 es: tapping the status icon shows its words in a toast',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?lang=es');
 await expect(page.locator('.canvas')).toBeVisible();
 await page.locator('#rect').click();
 await page.locator('#unsavedMark').click();
 await expect(page.locator('.toast-item',{hasText:WORDS.es.autosaved})).toBeVisible();
});

test('390 x 844 en: a 60-character design name ends in an ellipsis and the icon stays visible',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?lang=en');
 await expect(page.locator('.canvas')).toBeVisible();
 const name='Birthday sampler for twins with a long border and stitching.';
 expect(name.length).toBe(60);
 await page.locator('#name').fill(name);
 await page.locator('#name').press('Enter');
 await page.locator('#rect').click();
 await expect(page.locator('#unsavedMark')).toBeVisible();
 const cut=await page.locator('#name').evaluate(e=>({overflow:getComputedStyle(e).textOverflow,wider:e.scrollWidth>e.clientWidth,right:e.getBoundingClientRect().right}));
 expect(cut.overflow,'the name is cut with an ellipsis').toBe('ellipsis');
 expect(cut.wider,'the name is wider than its box, so the ellipsis shows').toBe(true);
 const status=await box(page,'#unsavedMark');
 const field=await box(page,'.top .name-field');
 expect(status.left,'the icon sits after the text, inside the field\'s padding').toBeGreaterThanOrEqual(cut.right-50);
 await expect(page.locator('#unsavedMark')).toBeVisible();
 await page.screenshot({path:'test-results/save-status-long-name-390x844-en.png'});
});
