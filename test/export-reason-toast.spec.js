import {test,expect} from '@playwright/test';

// A blank design explains why Export is dimmed. On a phone (600 px and narrower) the sentence is not drawn under the
// bar: a tap on the dimmed Export shows it as a toast. On a tablet and the desktop the caption stays where it was.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const REASON='Añade un objeto para exportar';

async function openBlankDesign(page,width,height){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto('/?lang=es');
 // #new is in the top bar on tablets and desktops only; a phone starts it from the Menu's File section.
 if(await page.locator('#new').isVisible()) await page.locator('#new').click();
 else{await page.locator('#phoneMenu').click();if(await page.locator('#menuSection-File[aria-expanded="false"]').count())await page.locator('#menuSection-File').click();await page.locator('#menuNew').click();}
 if(await page.locator('#discardDialog[open]').count()) await page.locator('#discardDiscard').click();
 await expect(page.locator('#export')).toHaveAttribute('aria-disabled','true');
 return errors;
}

// Whether the reason is drawn: its box has real size and it is not clipped away.
const reasonDrawn=page=>page.locator('#exportReason').evaluate(e=>{
 const s=getComputedStyle(e),b=e.getBoundingClientRect();
 return s.display!=='none'&&s.visibility!=='hidden'&&b.width>1&&b.height>1;
});

test('a blank design at 390x844 draws no reason under the bar',async({page})=>{
 const errors=await openBlankDesign(page,390,844);
 expect(await reasonDrawn(page),'reason drawn on a phone').toBe(false);
 const bar=await page.locator('.top').boundingBox();
 const sentenceBelowBar=await page.evaluate(([text,bottom])=>[...document.querySelectorAll('body *')]
  .filter(el=>el.children.length===0&&el.textContent.trim()===text)
  .some(el=>{const b=el.getBoundingClientRect();const s=getComputedStyle(el);return b.width>1&&b.height>1&&s.visibility!=='hidden'&&s.display!=='none'&&b.top>=bottom-1;}),
  [REASON,bar.y+bar.height]);
 expect(sentenceBelowBar,'sentence drawn under the bar').toBe(false);
 // The dimmed button keeps its aria-disabled state and its link to the reason for screen readers.
 await expect(page.locator('#export')).toHaveAttribute('aria-disabled','true');
 await expect(page.locator('#exportReason')).toHaveText(REASON);
 expect(errors).toEqual([]);
});

test('tapping a blank design\'s Export at 390x844 shows the reason as a toast',async({page})=>{
 const errors=await openBlankDesign(page,390,844);
 await expect(page.locator('#toast')).toHaveText('');
 // The button is aria-disabled, which Playwright treats as not clickable; a finger still taps it, so the tap is forced.
 await page.locator('#export').click({force:true});
 await expect(page.locator('#toast .toast-item')).toHaveText(REASON);
 await expect(page.locator('#exportDialog[open]')).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('a blank design at 768x1024 keeps its reason out of sight and shows no toast on tap',async({page})=>{
 const errors=await openBlankDesign(page,768,1024);
 // The tablet bar has never drawn the caption (it is screen-reader text only); that is unchanged.
 expect(await reasonDrawn(page),'caption drawn on a tablet').toBe(false);
 await expect(page.locator('#exportReason')).toHaveText(REASON);
 await page.locator('#export').click({force:true});
 await expect(page.locator('#toast .toast-item')).toHaveCount(0);
 await expect(page.locator('#exportDialog[open]')).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('a blank design at 390x844 in Spanish, Export dimmed (screenshot)',async({page})=>{
 const errors=await openBlankDesign(page,390,844);
 await page.screenshot({path:'test-results/export-reason-blank-390-es.png'});
 await page.locator('#export').click({force:true});
 await expect(page.locator('#toast .toast-item')).toHaveText(REASON);
 await page.screenshot({path:'test-results/export-reason-toast-390-es.png'});
 expect(errors).toEqual([]);
});
