import {test,expect} from '@playwright/test';

// While a lettering box is open, exactly one tool tile reads as selected: Text. The phone dock and the tablet tool row both
// show it this way.
test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const SIZES=[[390,844],[768,1024]];
for(const [width,height] of SIZES){
 test(`only the Text tile is selected while lettering is typed at ${width}×${height}`,async({page})=>{
  await page.setViewportSize({width,height});
  await page.goto('/?lang=es');
  await expect(page.locator('#art')).toBeVisible();
  await page.locator('#letter').tap();
  await page.keyboard.type('HI');
  await expect(page.locator('.canvas textarea').first()).toBeVisible();
  const selected=await page.locator('.tool-rail button[aria-pressed=true], .tool-rail .chrome-tile[aria-pressed=true], .phone-dock button[aria-pressed=true], .phone-dock .chrome-tile[aria-pressed=true]')
   .evaluateAll(els=>els.map(el=>el.id));
  expect(selected).toEqual(['letter']);
  await expect(page.locator('.tool-rail .active-tool, .phone-dock .active-tool, .phone-dock .is-selected, .tool-rail .is-selected')).toHaveCount(1);
 });
}
