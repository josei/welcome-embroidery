import {test,expect} from '@playwright/test';

// The stitch count is shown once per view: in the Stitches and 3D views, only the playback readout names the count, at every size.
const SIZES=[[1440,900],[768,1024],[390,844]];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openDesign(page,width,height){
 const {initialDocument,applyOperations,validateDocument}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=400;doc.name='Probe';doc.revision=1;
 applyOperations(doc,[{op:'add_shape',id:'s0',kind:'rect',x:0,y:0,width:20,height:15.1,thread:'#cc3333',stitch:'fill'}]);validateDocument(doc);
 await page.setViewportSize({width,height});
 await page.goto('/');
 await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
 await page.reload();
 await page.locator('#restoreYes').click();
 await expect(page.locator('.object-row')).toHaveCount(1);
}

// Visible elements whose text names a stitch count (a number next to the word "stitch", in either language).
const countLabels=page=>page.evaluate(()=>[...document.querySelectorAll('#count,#playbackStitches,#playbackProgress,#playbackTime,#playbackSummary')]
 .filter(e=>{const cs=getComputedStyle(e);const r=e.getBoundingClientRect();return cs.display!=='none'&&r.width>0&&r.height>0;})
 .map(e=>(e.querySelector('[role=img]')?.getAttribute('aria-label')||e.textContent).trim()).filter(t=>/\d[\d,]*\s+(stitch|puntada)|(stitch|puntada)\w*\s+\d|\bof\s+[\d,]+/i.test(t)));

for(const [w,h] of SIZES) for(const view of ['stitches','preview']) {
 test(`the stitch count is named once in the ${view} view (${w}x${h})`,async({page})=>{
  await openDesign(page,w,h);
  if(await page.locator(`[data-view=${view}]`).isVisible()){
   await page.locator(`[data-view=${view}]`).click();
  }else{
   await page.locator('#phoneMenu').click();await page.locator(`#menuView-${view}`).click();
  }
  await expect(page.locator('#playbackStitches')).toContainText(/\d/);
  const labels=await countLabels(page);
  expect(labels,'elements naming the stitch count').toHaveLength(1);
 });
}
