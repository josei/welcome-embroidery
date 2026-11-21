import {test,expect} from '@playwright/test';

// The save status on a phone or tablet is a dot: its words are not shown, but stay as the strip's accessible name and tooltip.
// Desktop keeps the words.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const EXPECT_WORDS={en:'Autosaved in this browser',es:'Autoguardado en este navegador'};

for(const [w,h] of [[390,844],[844,390],[768,1024]])for(const lang of ['en','es']){
 test(`${w} x ${h} ${lang}: the save strip shows a dot and names the state in words`,async({page})=>{
  await page.setViewportSize({width:w,height:h});
  await page.goto(`/?lang=${lang}`);
  await expect(page.locator('.canvas')).toBeVisible();
  const strip=page.locator('.top .save-status').first();
  const text=await strip.evaluate(e=>e.textContent.trim());
  expect(text,'no words in the strip').toBe('');
  expect(await strip.getAttribute('aria-label')).toBe(EXPECT_WORDS[lang]);
  expect(await strip.getAttribute('title')).toBe(EXPECT_WORDS[lang]);
 });
}

test('1280 x 800 en: the save status keeps its words', async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/?lang=en');
 await expect(page.locator('.canvas')).toBeVisible();
 await expect(page.locator('.top .save-status').first()).toHaveText('Autosaved in this browser');
});
