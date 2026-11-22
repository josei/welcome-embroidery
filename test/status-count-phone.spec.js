import {test,expect} from '@playwright/test';

// On a phone or tablet an object past the hoop turns the design count red and keeps the sentence out of the bar: the
// count is an icon and its number, the issues chip beside it shows the warning count, and no status text wraps or clips.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// Restores a design with one square, placed outside the 400 mm hoop or inside it, from the autosave the editor offers back.
async function openDesign(page, lang, outside){
 const {initialDocument,applyOperations}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=400;doc.name='Probe';doc.revision=1;
 applyOperations(doc,[{op:'add_shape',id:'s0',kind:'rect',x:outside?300:0,y:0,width:20,height:15.1,thread:'#cc3333',stitch:'fill'}]);
 await page.goto(`/?lang=${lang}`);
 await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
 await page.goto(`/?lang=${lang}`);
 await page.locator('#restoreYes').click();
 await expect(page.locator('.object-row')).toHaveCount(1);
}

async function showStitchView(page){
 const tab=page.locator('button[data-view="stitches"]');
 if(await tab.isVisible()) return tab.click();
 await page.locator('#phoneMenu').click();
 await page.locator('#menuView-stitches').click();
}

// maxHeight is the most a status control may be tall: the count sits on one 34 px line, and the issues chip is a 44 px target.
async function assertFits(locator,maxHeight=34){
 const box=await locator.evaluate(el=>({sw:el.scrollWidth,cw:el.clientWidth,h:el.getBoundingClientRect().height}));
 expect(box.sw,'no horizontal clipping').toBeLessThanOrEqual(box.cw+1);
 expect(box.h,'one line tall').toBeLessThanOrEqual(maxHeight);
}

for(const lang of ['es','en']) for(const [w,h] of [[390,844],[844,390],[768,1024]]){
 test(`${w}x${h} ${lang}: an object past the hoop shows the count with a needle and the chip with a warning triangle`,async({page})=>{
  page.on('dialog',d=>d.accept());
  await page.setViewportSize({width:w,height:h});
  await openDesign(page, lang, true);
  const count=page.locator('#count');
  await expect(count).toHaveClass(/count-figure error/);
  await expect(count.locator('svg use')).toHaveAttribute('href','#i-needle');
  const label=await count.locator('.figure').getAttribute('aria-label');
  expect(label).toMatch(lang==='es'?/sobrepasa/:/past the hoop/);
  const chip=page.locator('#issuesBtn');
  await expect(chip).toBeVisible();
  await expect(chip.locator('svg use')).toHaveAttribute('href','#i-issues');
  expect((await chip.textContent()).trim()).toMatch(/^\d+$/);
  await assertFits(count);
  await assertFits(chip,44);
  await showStitchView(page);
  // In Stitches view the playback bar names the count, so the status count stays empty over the hoop.
  await expect(count).toBeEmpty();
  await expect(chip.locator('svg use')).toHaveAttribute('href','#i-issues');
  // The chip keeps the stitch view's 44 px touch target, and it is a pill, not an upright capsule.
  const box=await chip.boundingBox();
  expect(box.height,'chip is one line at the touch target').toBeLessThanOrEqual(44);
  expect(box.width,'chip is wider than it is tall').toBeGreaterThanOrEqual(48);
 });
}

test('390x844 es: a design inside the hoop shows the count without the warning colour or chip', async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openDesign(page, 'es', false);
 await expect(page.locator('#count')).toHaveClass(/count-figure/);
 await expect(page.locator('#count')).not.toHaveClass(/error/);
 await expect(page.locator('#issuesBtn')).toBeHidden();
});
