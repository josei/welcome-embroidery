import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

// On a phone the issues chip is a top-bar button, and on a tablet an indicator in the status row beside the count. It has the
// same glyph size and text colour, nothing outside the row, and no outline. Its states differ without hover: no issues hides
// it, one issue shows the glyph with 1, and several show the glyph with their count.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// Restores a design with the given squares placed past the 400 mm hoop, from the autosave the editor offers back. With no
// squares past the hoop, one square sits inside it.
async function openDesign(page, lang, outside){
 const {initialDocument,applyOperations}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=400;doc.name='Probe';doc.revision=1;
 const xs=outside?Array.from({length:outside},(_,i)=>300+i*25):[0];
 applyOperations(doc,xs.map((x,i)=>({op:'add_shape',id:'s'+i,kind:'rect',x,y:0,width:20,height:15.1,thread:'#cc3333',stitch:'fill'})));
 await page.goto(`/?lang=${lang}`);
 await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
 await page.goto(`/?lang=${lang}`);
 await page.locator('#restoreYes').click();
 await expect(page.locator('.object-row')).toHaveCount(xs.length);
}

const sizes=[[360,640],[390,844],[844,390],[768,1024]];
for(const lang of ['es','en']) for(const [w,h] of sizes) test(`${w}x${h} ${lang}: the issues chip is inside the viewport with its count, glyph and names`,async({page})=>{
 page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:w,height:h});
 const dir='walk-screenshots/issue-chip';mkdirSync(dir,{recursive:true});
 const shot=name=>page.screenshot({path:`${dir}/${w}x${h}-${lang}-${name}.png`});
 const chip=page.locator('#issuesBtn');
 const inside=async()=>{const b=await chip.boundingBox();expect(b,'chip is laid out').not.toBeNull();expect(b.y,'top edge inside the viewport').toBeGreaterThanOrEqual(0);expect(b.y+b.height,'bottom edge inside the viewport').toBeLessThanOrEqual(h);expect(b.x+b.width,'right edge inside the viewport').toBeLessThanOrEqual(w);};

 // No issues: the chip is hidden.
 await openDesign(page,lang,0);
 await expect(chip).toBeHidden();
 await shot('none');

 // One issue: the glyph with 1, inside the status row.
 await page.evaluate(()=>localStorage.clear());
 await openDesign(page,lang,1);
 await expect(chip).toBeVisible();
 await expect(chip).toHaveText('1');
 await inside();
 await expect(chip.locator('svg use')).toHaveAttribute('href',/#i-(tip|issues)/);
 await expect(chip).toHaveAttribute('aria-label',/\S/);
 await expect(chip).toHaveAttribute('title',/\S/);
 await shot('one');

 // Several issues: the same glyph with the count.
 await page.evaluate(()=>localStorage.clear());
 await openDesign(page,lang,3);
 await expect(chip).toHaveText('3');
 await inside();
 await shot('several');
});
