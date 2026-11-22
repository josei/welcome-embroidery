import {test,expect} from '@playwright/test';

// An object past the hoop names how far it overruns. The distance uses the decimal separator of the UI language: a comma
// in Spanish, a point in English. It shows in the status count's text, the issues chip's tooltip, and on a phone the
// count's accessible name.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// Restores a design whose one rectangle runs 120.2 mm past a 400 mm hoop, from the autosave the editor offers back.
async function openOverrunDesign(page, lang){
 const {initialDocument,applyOperations}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=400;doc.name='Probe';doc.revision=1;
 applyOperations(doc,[{op:'add_shape',id:'s0',kind:'rect',x:300,y:0,width:20,height:15.1,thread:'#cc3333',stitch:'fill'}]);
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
 await page.reload();
 await page.locator('#restoreYes').click();
 await expect(page.locator('.object-row')).toHaveCount(1);
}

const CASES=[
 ['es',/sobrepasa el bastidor en 120,2 mm/],
 ['en',/extends 120\.2 mm past the hoop/],
];

for(const [lang,sentence] of CASES){
 test(`${lang}: the over-hoop sentence shows 120.2 mm with the ${lang} decimal separator on the desktop`,async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await openOverrunDesign(page,lang);
  await expect(page.locator('#count')).toHaveText(sentence);
  await expect(page.locator('#issuesBtn')).toHaveAttribute('title',sentence);
 });

 test(`${lang}: the over-hoop count's accessible name shows 120.2 mm on a phone`,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await openOverrunDesign(page,lang);
  await expect(page.locator('#count .figure')).toHaveAttribute('aria-label',sentence);
  await expect(page.locator('#issuesBtn')).toHaveAttribute('title',sentence);
 });
}
