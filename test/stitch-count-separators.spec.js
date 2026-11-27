import {test,expect} from '@playwright/test';

// Every stitch count the editor shows uses the UI language's thousands separator: "1.102" in Spanish, "1,102" in English.
// The Layers rows and the status run both come from the same formatter the phone status figure uses.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// Restores a design with one large filled rectangle, so its compiled count is well past a thousand.
async function openDesignWithManyStitches(page, lang){
 const {initialDocument,applyOperations}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.name='Probe';doc.revision=1;
 applyOperations(doc,[{op:'add_shape',id:'s0',kind:'rect',x:0,y:0,width:80,height:60,thread:'#cc3333',stitch:'fill'}]);
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
 await page.reload();
 await page.locator('#restoreYes').click();
 await expect(page.locator('.object-row')).toHaveCount(1);
}

const SIZES=[[1440,900],[768,1024],[390,844]];
const LANGS=[['es',/\d\.\d{3}\b/,/\d,\d{3}\b/],['en',/\d,\d{3}\b/,/\d\.\d{3}\b/]];

for(const [width,height] of SIZES) for(const [lang,right,wrong] of LANGS){
 test(`stitch counts group with the ${lang} separator at ${width}x${height}`,async({page})=>{
  await page.setViewportSize({width,height});
  await openDesignWithManyStitches(page,lang);
  // Opening Layers: on a phone it sits in the Menu, elsewhere it is already drawn.
  if(width<768){
   await page.locator('#phoneMenu').click();
   await page.locator('#menuLayers').click();
  }
  const rowTag=page.locator('.object-row .row-tag').first();
  await expect(rowTag).toBeVisible();
  await expect(rowTag).toContainText(right);
  await expect(rowTag).not.toContainText(wrong);
  // The status run: the sentence (its accessible name on a phone, the text on the desktop) carries the count.
  const status=page.locator('#count .figure, #count').first();
  const statusText=(await page.locator('#count').getAttribute('aria-label'))||(await page.locator('#count').textContent())||'';
  expect(statusText,'the status count is written with grouping').toMatch(/\d[.,]\d{3}/);
  expect(statusText).not.toMatch(wrong);
  await expect(status).toBeVisible();
 });
}
