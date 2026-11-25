import {test,expect} from '@playwright/test';

// The batch fit message names the hoop with the UI language's decimal separator: "267,4×200 mm" in Spanish and
// "267.4×200 mm" in English.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// Restores a design on a 267.4 by 200 mm hoop with one small rectangle, the autosave the editor offers back.
async function openDesignOnDecimalHoop(page, lang){
 const {initialDocument,applyOperations}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=267.4;doc.hoopH=200;doc.name='Probe';doc.revision=1;
 applyOperations(doc,[{op:'add_shape',id:'s0',kind:'rect',x:0,y:0,width:20,height:15.1,thread:'#cc3333',stitch:'fill'}]);
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
 await page.reload();
 await page.locator('#restoreYes').click();
 await expect(page.locator('.object-row')).toHaveCount(1);
 await page.locator('#secArray summary').click();
}

test('the batch fit message writes the hoop size with a comma in Spanish',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openDesignOnDecimalHoop(page,'es');
 await expect(page.locator('#batchInfo')).toContainText('bastidor de 267,4×200 mm');
 await expect(page.locator('#batchInfo')).not.toContainText('267.4');
});

test('the batch fit message keeps the dot in English',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openDesignOnDecimalHoop(page,'en');
 await expect(page.locator('#batchInfo')).toContainText('one 267.4×200 mm hoop');
});
