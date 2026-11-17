import {test,expect} from '@playwright/test';

// The Fill pattern picker is the same tile grid as Stitch type: labelled cards with a picture, three across.
// Its labels are unique, and none repeats a Stitch type label, so each name in the inspector means one control.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const SIZES=[[1440,900],[768,1024],[390,844]];
for(const [width,height] of SIZES) for(const lang of ['en','es']){
 test(`Fill pattern uses the Stitch type tile grid at ${width}x${height} (${lang})`,async({page})=>{
  page.on('dialog',d=>d.accept());
  await page.setViewportSize({width,height});
  await page.goto(lang==='en'?'/':`/?lang=${lang}`);
  await page.locator('#rect').click();
  if(width<=600){
   await page.locator('#phoneMenu').click();
   await page.locator('#menuProperties').click();
   await expect(page.locator('#inspector')).toHaveClass(/sheet-open/);
  }
  await page.locator('#type').selectOption('fill');

  // Looked up by the control they belong to, because the group name is translated in Spanish.
  const fill=page.locator('.icon-seg[data-select="fillMethod"]');
  const type=page.locator('.icon-seg[data-select="type"]');
  await expect(fill).toHaveClass(/labelled/);
  await expect(type).toHaveClass(/labelled/);
  await expect(fill.locator('button .stitch-thumb')).toHaveCount(10);
  const columns=g=>g.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(await columns(fill)).toBe(3);
  expect(await columns(type)).toBe(await columns(fill));

  if(width<=768){
   const boxes=await fill.locator('button').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return [r.width,r.height];}));
   for(const [w,h] of boxes){expect(w).toBeGreaterThanOrEqual(44);expect(h).toBeGreaterThanOrEqual(44);}
  }
 });
}

test('Every Fill pattern label is unique and none repeats a Stitch type label',async({page})=>{
 await page.goto('/');
 await page.locator('#rect').click();
 await page.locator('#type').selectOption('fill');
 const names=async select=>page.locator(`.icon-seg[data-select="${select}"] [role=radio]`).evaluateAll(rs=>rs.map(r=>r.getAttribute('aria-label')));
 const fill=await names('fillMethod');
 const stitch=await names('type');
 expect(fill.length).toBe(10);
 expect(new Set(fill).size).toBe(fill.length);
 for(const label of fill) expect(stitch).not.toContain(label);
});

test('Selecting a Fill pattern tile chooses that pattern and presses it',async({page})=>{
 await page.goto('/');
 await page.locator('#rect').click();
 await page.locator('#type').selectOption('fill');
 const group=page.locator('.icon-seg[data-select="fillMethod"]');
 await group.getByRole('radio',{name:'Loop fill'}).click();
 await expect(page.locator('#fillMethod')).toHaveValue('motif');
 await expect(group.getByRole('radio',{name:'Loop fill'})).toHaveAttribute('aria-pressed','true');
});
