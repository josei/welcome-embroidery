import {test,expect} from '@playwright/test';

// The Properties toggle in the Layers header is the sliders icon alone, the same glyph the desktop inspector and the Menu use.
// Its name stays "Properties" (or "Propiedades") for screen readers and its tooltip. The expanded state shows as the pressed tint.
// The toggle renders only where the inspector folds below the canvas (the 1024-1100 px band); at phone and portrait-tablet sizes
// it is hidden by layout, so those sizes are checked on the markup alone. The Layers sheet heading stays words.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const names={en:'Properties',es:'Propiedades'};
const hiddenSizes=[[390,844],[844,390],[768,1024]];

for(const [w,h] of hiddenSizes) for(const lang of ['en','es']) test(`Properties toggle markup is an icon with its word as label at ${w}x${h} (${lang})`,async({page})=>{
 await page.setViewportSize({width:w,height:h});
 await page.goto(`/?lang=${lang}`);
 const toggle=page.locator('.layers-head .inspector-toggle');
 expect(await toggle.count()).toBe(1);
 expect(await toggle.evaluate(e=>e.textContent.trim()),'no visible text').toBe('');
 expect(await toggle.locator('svg use').getAttribute('href'),'sliders icon').toBe('#i-sliders');
 expect(await toggle.getAttribute('aria-label')).toBe(names[lang]);
 expect(await toggle.getAttribute('title')).toBe(names[lang]);
});

for(const lang of ['en','es']) test(`Properties toggle is an icon with its name at 1024x768 (${lang})`,async({page})=>{
 await page.setViewportSize({width:1024,height:768});
 await page.goto(`/?lang=${lang}`);
 const toggle=page.getByRole('button',{name:names[lang],exact:true});
 await expect(toggle).toBeVisible();
 expect(await toggle.evaluate(e=>e.textContent.trim()),'no visible text').toBe('');
 expect(await toggle.locator('svg use').getAttribute('href')).toBe('#i-sliders');
 await expect(toggle).toHaveAttribute('aria-expanded','true');
 await expect(toggle).toHaveAttribute('aria-pressed','true');
 const headingText=(await page.locator('.layers-head h2').textContent())?.trim();
 expect(headingText,'Layers heading stays as words').toBeTruthy();
});

for(const lang of ['en','es']) test(`expanded Properties toggle is pressed and folds the inspector at 1024x768 (${lang})`,async({page})=>{
 await page.setViewportSize({width:1024,height:768});
 await page.goto(`/?lang=${lang}`);
 const toggle=page.locator('.layers-head .inspector-toggle');
 const pressed=await toggle.evaluate(e=>getComputedStyle(e).backgroundColor);
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-expanded','false');
 await expect(toggle).toHaveAttribute('aria-pressed','false');
 expect(await toggle.evaluate(e=>getComputedStyle(e).backgroundColor)).not.toBe(pressed);
});
