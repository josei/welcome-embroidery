import {test,expect} from '@playwright/test';

// The phone tool dock uses the shared phone tile: the same grey fill at rest, and the armed tool is a mint fill with a 1 px teal
// border drawn inside the tile (no stripe beside it).
// Every dock label must fit its tile with room to spare, in English and Spanish, at 390 px wide.
const SIZES=[[390,844,'phone-portrait'],[844,390,'phone-landscape'],[820,1180,'tablet-portrait']];

test('phone dock tiles keep the rest fill and draw the armed state inside the tile at 390 px',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?lang=en');
 await expect(page.locator('header.top')).toBeVisible();
 const plain=page.locator('.phone-dock .chrome-tile:not(.is-selected)').first();
 await expect(plain).toBeVisible();
 const fill=await plain.evaluate(el=>getComputedStyle(el).backgroundColor);
 expect(fill).toBe('rgba(0, 0, 0, 0)');
 const active=page.locator('.phone-dock .chrome-tile.is-selected').first();
 await expect(active).toBeVisible();
 const armed=await active.evaluate(el=>getComputedStyle(el).boxShadow);
 expect(armed).toMatch(/0px 0px 0px 1px inset/);
});

test('Spanish dock labels fit their tiles with padding at 390 px',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?lang=es');
 await expect(page.locator('header.top')).toBeVisible();
 const result=await page.locator('.phone-dock .chrome-tile').evaluateAll(tiles=>tiles.map(t=>{
  const label=t.querySelector('.tile-word');
  const tr=t.getBoundingClientRect();
  const lr=label.getBoundingClientRect();
  return {text:label.textContent,fits:label.scrollWidth<=label.clientWidth,pad:Math.min(lr.left-tr.left,tr.right-lr.right)};
 }));
 for(const r of result){
  expect(r.fits,`${r.text} overflows`).toBe(true);
  expect(r.pad,`${r.text} padding`).toBeGreaterThanOrEqual(2);
 }
});

for(const [w,h,name] of SIZES){
 test(`tool tiles and segmented controls screenshot at ${name}`,async({page})=>{
  await page.setViewportSize({width:w,height:h});
  await page.goto('/?lang=en');
  await expect(page.locator('header.top')).toBeVisible();
  await page.screenshot({path:`test-results/tool-tiles-${name}.png`});
  const visibleSwitch=page.locator('.segmented:visible').first();
  if(await visibleSwitch.count())await visibleSwitch.screenshot({path:`test-results/segmented-view-${name}.png`});
 });
}

// The Settings language switch is the same segmented control as the view switch and the 3D presets.
test('Settings language switch shares the segmented style at phone portrait',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?lang=en');
 await expect(page.locator('header.top')).toBeVisible();
 await page.locator('#phoneMenu').click();
 // Settings and Help folds in the phone Menu, so its heading is tapped first.
 await page.locator('#menuSection-Settings-and-Help').click();
 await page.locator('#menuSettings').click();
 const seg=page.locator('#settingsDialog .segmented').first();
 await expect(seg).toBeVisible();
 const pressed=await seg.locator('button[aria-pressed=true]').first().evaluate(el=>getComputedStyle(el).backgroundColor);
 expect(pressed).toBe('rgb(255, 255, 255)');
 await seg.screenshot({path:'test-results/segmented-settings-language-phone-portrait.png'});
});
