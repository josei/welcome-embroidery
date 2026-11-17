import {test,expect} from '@playwright/test';

// Bold and Italic are off for a single-line font, and the panel says why next to the buttons. A registry font turns them on and removes the note.
const openFresh=async(page,query='')=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/'+query);
 if(await page.locator('#restoreDialog[open]').count())await page.locator('#restoreNo').click();
 if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
 await page.locator('#new').click();
 if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
 await expect(page.locator('.object-row')).toHaveCount(0);
};
const addText=async page=>{
 await page.locator('#letter').click();
 await page.locator('#letteringText').fill('HI');
 await page.locator('#letteringText').press('Tab');
};
const usePacifico=async page=>{
 await page.locator('#fontButton').click();
 await page.locator('#fontSearch').fill('pacifico');
 await page.locator('#fontSearch').press('Enter');
 await expect(page.locator('#fontPanel')).toBeHidden();
 await expect(page.locator('#font')).not.toHaveValue('welcome-mono/1');
};

test('single-line font explains why bold and italic are off (English)', async ({page})=>{
 await openFresh(page);
 await addText(page);
 await expect(page.locator('#textBold')).toBeDisabled();
 await expect(page.locator('.style-hint')).toHaveText('Bold and italic need an outline or satin font. This font is single-line: choose another under Font.');
 await page.locator('#textBold').evaluate(el=>el.parentElement.scrollIntoView({block:'center'}));
 await page.screenshot({path:'test-results/613-en-single-line.png'});
 await usePacifico(page);
 await expect(page.locator('#textBold')).toBeEnabled();
 await expect(page.locator('.style-hint')).toHaveCount(0);
 await page.locator('#textBold').evaluate(el=>el.parentElement.scrollIntoView({block:'center'}));
 await page.screenshot({path:'test-results/613-en-available.png'});
});

test('single-line font explains why bold and italic are off (Spanish)', async ({page})=>{
 await openFresh(page,'?lang=es');
 await addText(page);
 await expect(page.locator('#textBold')).toBeDisabled();
 await expect(page.locator('.style-hint')).toHaveText('La negrita y la cursiva necesitan una fuente de contorno o de satén. Esta fuente es de una sola línea: elige otra en Fuente.');
 await page.locator('#textBold').evaluate(el=>el.parentElement.scrollIntoView({block:'center'}));
 await page.screenshot({path:'test-results/613-es-single-line.png'});
 await usePacifico(page);
 await expect(page.locator('#textBold')).toBeEnabled();
 await expect(page.locator('.style-hint')).toHaveCount(0);
 await page.locator('#textBold').evaluate(el=>el.parentElement.scrollIntoView({block:'center'}));
 await page.screenshot({path:'test-results/613-es-available.png'});
});
