import {test,expect} from '@playwright/test';

// The add-to-selection toggle on the selection bar shows its word beside the plus-in-a-square glyph, so a first-time
// Spanish user can tell what it does. Its full name stays in aria-label and title. On phones the toggle sits in the
// selection bar and the Menu does not repeat the command, so the phone has one on-screen route to it.

test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const name={en:'Tap objects to add them to the selection',es:'Toca objetos para añadirlos a la selección'};

async function openWithSelection(page,width,height,lang){
 await page.setViewportSize({width,height});
 await page.goto(`/?lang=${lang}`);
 await page.locator('#rect').tap();
}

test('the add-to-selection toggle shows the word Varios in es-ES at 768x1024', async({page})=>{
 await openWithSelection(page,768,1024,'es');
 const toggle=page.locator('#selectToggle');
 await expect(toggle).toBeVisible();
 await expect(toggle.locator('.bar-word, .tile-word')).toHaveText('Varios');
 await expect(toggle.locator('.bar-word, .tile-word')).toBeVisible();
 expect(await toggle.locator('svg use').getAttribute('href'),'glyph unchanged').toBe('#i-select-add');
 await expect(toggle).toHaveAttribute('aria-label',name.es);
 await expect(toggle).toHaveAttribute('title',name.es);
 const bar=page.locator('.canvas .floating').first();
 const fits=await bar.evaluate(e=>e.scrollWidth<=e.clientWidth+1);
 expect(fits,'the bar does not overflow').toBe(true);
 const wordBox=await toggle.locator('.bar-word, .tile-word').boundingBox();
 const toggleBox=await toggle.boundingBox();
 expect(wordBox.height,'the word stays on one line').toBeLessThan(20);
 expect(wordBox.x+wordBox.width<=toggleBox.x+toggleBox.width+0.5,'the word stays inside the toggle').toBe(true);
});

test('the toggle keeps its glyph and full name with a word in es-ES at 1024x768', async({page})=>{
 await openWithSelection(page,1024,768,'es');
 const toggle=page.locator('#selectToggle');
 await expect(toggle.locator('.bar-word, .tile-word')).toHaveText('Varios');
 await expect(toggle).toHaveAttribute('aria-label',name.es);
});

test('the phone selection bar shows the toggle with its word Varios in es-ES at 390x844', async({page})=>{
 await openWithSelection(page,390,844,'es');
 const bar=page.locator('.context-bar');
 await expect(bar).toBeVisible();
 const toggle=bar.locator('#selectToggle');
 await expect(toggle.locator('.bar-word, .tile-word')).toHaveText('Varios');
 await expect(toggle).toHaveAttribute('aria-label',name.es);
 await expect(toggle).toHaveAttribute('title',name.es);
 expect(await bar.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'the phone bar does not overflow').toBe(true);
});

test('the phone Menu does not repeat the add-to-selection toggle in es-ES', async({page})=>{
 await openWithSelection(page,390,844,'es');
 await page.locator('#phoneMenu').click();
 await expect(page.locator('#phoneMenuList')).toBeVisible();
 await expect(page.locator('#menuSelectAdd')).toHaveCount(0);
});

test('the selection bar in es-ES at 844x390 shows the toggle with its word', async({page})=>{
 await openWithSelection(page,844,390,'es');
 const bar=page.locator('.context-bar');
 await expect(bar.locator('#selectToggle .bar-word, #selectToggle .tile-word')).toHaveText('Varios');
 expect(await bar.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'the landscape phone bar does not overflow').toBe(true);
});

test('the selection bar in es-ES at 390x844 is captured with an object selected', async({page})=>{
 await openWithSelection(page,390,844,'es');
 const bar=page.locator('.context-bar');
 await expect(bar).toBeVisible();
 await bar.screenshot({path:'test-results/phone-390x844-es-selection-bar.png'});
});
