import {test,expect} from '@playwright/test';

// The hoop commands are in the command palette, and a search for a hoop word finds them in both languages. On a touch screen
// (phone or tablet) the palette rows carry no keycaps, because there is no keyboard to press them with.
const PHONE=[390,844], DESKTOP=[1280,800];

async function openPalette(page,[width,height],lang){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.keyboard.press('Escape');
 await page.evaluate(()=>document.activeElement?.blur());
 await page.keyboard.press(process.platform==='darwin'?'Meta+k':'Control+k');
 await expect(page.locator('#commandPalette')).toBeVisible();
 return errors;
}

const rowsFor=page=>page.locator('#commandPalette .palette-row');

for(const lang of ['en','es']) for(const query of ['bastidor','bas','hoop']) test(`searching "${query}" finds the hoop commands (${lang})`,async({page})=>{
 await openPalette(page,DESKTOP,lang);
 await page.locator('#paletteInput').fill(query);
 await expect(rowsFor(page).filter({hasText:/bastidor|hoop/i})).not.toHaveCount(0);
 const labels=await rowsFor(page).allInnerTexts();
 const expected=lang==='es'?['Ajustar bastidor','Girar el bastidor']:['Fit hoop','Rotate hoop'];
 for(const label of expected) expect(labels.some(text=>text.includes(label)),`${label} is listed for "${query}"`).toBe(true);
});

for(const lang of ['en','es']) test(`the palette on a 390x844 phone shows no keycaps (${lang})`,async({page})=>{
 await openPalette(page,PHONE,lang);
 await page.locator('#paletteInput').fill('');
 await expect(rowsFor(page).first()).toBeVisible();
 expect(await page.locator('#commandPalette .palette-row kbd').count()).toBe(0);
});

test('the palette on a 768x1024 tablet shows no keycaps',async({page})=>{
 await openPalette(page,[768,1024],'en');
 await page.locator('#paletteInput').fill('');
 await expect(rowsFor(page).first()).toBeVisible();
 expect(await page.locator('#commandPalette .palette-row kbd').count()).toBe(0);
});

test('the palette on a desktop still shows keycaps for commands that have a key',async({page})=>{
 await openPalette(page,DESKTOP,'en');
 await page.locator('#paletteInput').fill('copy');
 await expect(rowsFor(page).first()).toBeVisible();
 expect(await page.locator('#commandPalette .palette-row kbd').count()).toBeGreaterThan(0);
});
