import {test,expect} from '@playwright/test';

// On a phone or tablet the design count is a glyph, with its number when there is a plan. No sentence is visible in the
// status run: the sentence is the glyph's accessible name and tooltip, and each state has its own glyph, so the state reads
// without hover.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// Restores a design from the autosave the editor offers back. With no shapes the count has no plan to number.
async function openDesign(page, lang, shapes){
 const {initialDocument,applyOperations}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=400;doc.name='Probe';doc.revision=1;
 if(shapes) applyOperations(doc,[{op:'add_shape',id:'s0',kind:'rect',x:shapes.x,y:0,width:20,height:15.1,thread:'#cc3333',stitch:'fill'}]);
 await page.goto(`/?lang=${lang}`);
 await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
 await page.goto(`/?lang=${lang}`);
 await page.locator('#restoreYes').click();
 if(shapes) await expect(page.locator('.object-row')).toHaveCount(1);
}

// The text a reader sees in the count: every text node, ignoring the accessible name the glyph carries.
const visibleText=page=>page.locator('#count').evaluate(el=>el.textContent.trim());

for(const lang of ['es','en']) for(const [w,h] of [[390,844],[844,390],[768,1024],[360,640]]){
 test(`${w}x${h} ${lang}: the design count shows a glyph and no sentence, and its states differ by glyph`,async({page})=>{
  page.on('dialog',d=>d.accept());
  await page.setViewportSize({width:w,height:h});

  // Nothing to sew yet: a dash, and no words.
  await openDesign(page, lang, null);
  await expect(page.locator('#count svg use')).toHaveAttribute('href','#i-idle');
  expect(await visibleText(page),'no visible words when nothing is to sew').toBe('');
  expect(await page.locator('#count .figure').getAttribute('aria-label'),'the sentence is the accessible name').not.toBe('');

  // Inside the hoop: the run mark and the stitch count.
  await page.evaluate(()=>localStorage.clear());
  await openDesign(page, lang, {x:0});
  const ready=page.locator('#count');
  await expect(ready.locator('svg use')).toHaveAttribute('href','#i-run');
  expect(await visibleText(page),'the count is digits only').toMatch(/^[\d.,\s ]+$/);
  await expect(ready.locator('.figure')).toHaveAttribute('title',/\S/);
  await expect(ready.locator('.figure')).toHaveAttribute('aria-label',lang==='es'?/listo para bordar/:/Ready to sew/);

  // Past the hoop: the error mark, in the warning colour, still no words.
  await page.evaluate(()=>localStorage.clear());
  await openDesign(page, lang, {x:300});
  await expect(page.locator('#count')).toHaveClass(/error/);
  await expect(page.locator('#count svg use')).toHaveAttribute('href','#i-error');
  expect(await visibleText(page),'no visible words past the hoop').toMatch(/^[\d.,\s ]+$/);
 });
}
