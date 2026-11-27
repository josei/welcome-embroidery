import {test,expect} from '@playwright/test';

// On a phone the Menu's Issues row selects the object with the sewing tip, and its warning text shows in the Properties sheet. The
// issues chip under the design name counts the issues and opens Messages.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// Restores a design with one square placed past the 400 mm hoop, from the autosave the editor offers back.
async function openSquareOutsideHoop(page, lang){
 const {initialDocument,applyOperations}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=400;doc.name='Probe';doc.revision=1;
 applyOperations(doc,[{op:'add_shape',id:'s0',kind:'rect',x:300,y:0,width:20,height:15.1,thread:'#cc3333',stitch:'fill'}]);
 await page.goto(`/?lang=${lang}`);
 await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
 await page.goto(`/?lang=${lang}`);
 await page.locator('#restoreYes').click();
 await expect(page.locator('.object-row')).toHaveCount(1);
}

test('390x844 es: the Menu Issues row opens the sewing tip with its warning text visible', async({page})=>{
 page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:390,height:844});
 await openSquareOutsideHoop(page,'es');
 await page.locator('#phoneMenu').click();
 await page.locator('#menuIssues').click();
 await expect(page.locator('#inspector')).toHaveClass(/sheet-open/);
 await expect(page.locator('#sewTips')).toBeVisible();
 await expect(page.locator('#sewTips')).toContainText('Rectángulo sale del bastidor de 400×400 mm.');
});

test('390x844 es: the status line issues chip counts the issue and opens Messages', async({page})=>{
 page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:390,height:844});
 await openSquareOutsideHoop(page,'es');
 const chip=page.locator('#issuesBtn');
 await expect(chip).toHaveText('1');
 await expect(page.locator('button#issuesBtn')).toHaveCount(1);
 await chip.click();
 await expect(page.locator('#messagesDialog[open]')).toHaveCount(1);
 await page.keyboard.press('Escape');
 await expect(page.locator('#inspector')).not.toHaveClass(/sheet-open/);
});
