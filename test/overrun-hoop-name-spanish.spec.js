import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

// On a phone in Spanish, an object past the hoop is named in the UI language: the count's accessible name and tooltip, and
// the Properties summary, read "Flor silvestre sobrepasa el bastidor en 86,5 mm." The visible count keeps only the figure.
// Screenshots of the status line and the Properties summary at 390 by 844 are written to the test-results folder.
const SHOTS=process.env.OVERRUN_SHOTS||'test-results/overrun-hoop-name-spanish';

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

test('an object past the hoop is named in Spanish on a 390 by 844 phone: status line and Properties summary',async({page})=>{
 mkdirSync(SHOTS,{recursive:true});
 await page.setViewportSize({width:390,height:844});
 await openOverrunDesign(page);
 const figure=page.locator('#count .figure');
 const sentence='Flor silvestre sobrepasa el bastidor en 86,5 mm.';
 await expect(figure).toHaveAttribute('aria-label',new RegExp('Flor silvestre.*86,5 mm'));
 await expect(figure).toHaveAttribute('title',new RegExp('Flor silvestre.*86,5 mm'));
 await expect(figure).not.toHaveAttribute('aria-label',/Wildflower/);
 // The visible text is the stitch count alone: the sentence is only in the accessible name.
 const visible=await figure.locator('span[aria-hidden="true"]').innerText();
 expect(visible.trim()).toMatch(/^[\d.,]+$/);
 expect(visible).not.toContain('bastidor');
 await page.locator('footer').screenshot({path:`${SHOTS}/status-line-390x844-es.png`});

 await page.locator('#phoneMenu').click();
 await page.screenshot({path:`${SHOTS}/menu-390x844-es.png`});
 await page.locator('#menuProperties').click();
 await expect(page.locator('#inspector')).toHaveClass(/sheet-open/);
 const stats=page.locator('#stats');
 await expect(stats).toContainText(sentence);
 await expect(stats).not.toContainText('Wildflower');
 await stats.screenshot({path:`${SHOTS}/properties-summary-390x844-es.png`});
 await page.screenshot({path:`${SHOTS}/properties-sheet-390x844-es.png`});
});
