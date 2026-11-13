import {test,expect} from '@playwright/test';

// At phone portrait More tools is a panel of the product, not a native-style sheet: it has the panel header with a
// Close button, no grab handle, and it dims the canvas behind it. Its tiles use the desktop icon-button style.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openPanel(page,lang){
 await page.setViewportSize({width:390,height:844});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.locator('#toolMore').click();
 await expect(page.locator('#moreToolsSheet')).toHaveClass(/sheet-open/);
}

for(const lang of ['en','es']) test(`More tools renders the panel header and a Close button, with no grab handle (${lang})`,async({page})=>{
 await openPanel(page,lang);
 const panel=page.locator('#moreToolsSheet');
 await expect(panel.locator('.sheet-head h2.sheet-title')).toBeVisible();
 await expect(panel.locator('#moreToolsClose')).toBeVisible();
 await expect(panel.locator('.sheet-grip')).toHaveCount(0);
});

test('More tools dims the canvas behind it and Close dismisses it at 390x844',async({page})=>{
 await openPanel(page,'en');
 const scrim=page.locator('.sheet-scrim');
 await expect(scrim).toBeVisible();
 const bg=await scrim.evaluate(el=>getComputedStyle(el).backgroundColor);
 expect(bg,'scrim is a translucent dark fill').toMatch(/^rgba\(29, 41, 37, 0\.2/);
 await page.locator('#moreToolsClose').click();
 await expect(page.locator('#moreToolsSheet')).not.toHaveClass(/sheet-open/);
});

test('More tools tiles are the desktop tool-row buttons, with the same colours',async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/');
 const desk=page.locator('.tool-row .icon-button:not(.active-tool)').first();
 const deskStyle=await desk.evaluate(el=>{const c=getComputedStyle(el);return {bg:c.backgroundColor,color:c.color,radius:c.borderTopLeftRadius};});
 await page.setViewportSize({width:390,height:844});
 await page.locator('#toolMore').click();
 await expect(page.locator('#moreToolsSheet')).toHaveClass(/sheet-open/);
 const tiles=page.locator('#moreToolsSheet .more-grid .icon-button');
 await expect(tiles).toHaveCount(8);
 for(const tile of await tiles.all()){
  await expect(tile.locator('.rail-label')).toBeVisible();
  const tileStyle=await tile.evaluate(el=>{const c=getComputedStyle(el);return {bg:c.backgroundColor,color:c.color,radius:c.borderTopLeftRadius};});
  expect(tileStyle.bg).toBe(deskStyle.bg);
  expect(tileStyle.color).toBe(deskStyle.color);
  expect(tileStyle.radius).toBe(deskStyle.radius);
 }
});

test('Layers and Properties sheets share the More tools panel corners',async({page})=>{
 await openPanel(page,'en');
 const moreRadius=await page.locator('#moreToolsSheet').evaluate(el=>getComputedStyle(el).borderTopLeftRadius);
 await page.locator('#moreLayers').click();
 await expect(page.locator('#layersSheet')).toHaveClass(/sheet-open/);
 const layersRadius=await page.locator('#layersSheet').evaluate(el=>getComputedStyle(el).borderTopLeftRadius);
 expect(layersRadius).toBe(moreRadius);
 expect(moreRadius).toBe('0px');
});

for(const lang of ['en','es']) test(`More tools panel screenshot at 390x844 (${lang})`,async({page})=>{
 await openPanel(page,lang);
 await page.screenshot({path:`test-results/more-tools-${lang}.png`});
});
