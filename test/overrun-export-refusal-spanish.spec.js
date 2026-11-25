import {test,expect} from '@playwright/test';

// The export dialog says why a design past the hoop cannot be exported. In Spanish that reason reads with the comma
// decimal of the interface language, the same as the status line: "Flor sobrepasa el bastidor en 86,5 mm."
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// Restores a design whose one rectangle, named Wildflower, runs 86.5 mm past a 267.4 by 200 mm hoop.
async function openOverrunDesign(page){
 const {initialDocument,applyOperations}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=267.4;doc.hoopH=200;doc.name='Probe';doc.revision=1;
 applyOperations(doc,[{op:'add_shape',id:'s0',kind:'rect',x:200,y:0,width:20,height:15.1,thread:'#cc3333',stitch:'fill'}]);
 doc.objects[0].name='Wildflower';
 await page.goto('/?lang=es');
 await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
 await page.reload();
 await page.locator('#restoreYes').click();
 await expect(page.locator('.object-row')).toHaveCount(1);
}

test('the export dialog gives the past-the-hoop reason with a comma in Spanish',async({page})=>{
 await openOverrunDesign(page);
 await page.locator('#export').click();
 await expect(page.locator('#exportError')).toContainText('Flor silvestre sobrepasa el bastidor en 86,5 mm.');
 await expect(page.locator('#exportError')).not.toContainText('86.5');
});
