import {test,expect} from '@playwright/test';

// Issue #467: at a phone (390x844, touch) with the stitch preview open at 466 stitches, the status and playback readouts are not
// clipped in English or Spanish. Each readout's text fits its box (no sideways overflow), the thread length stays visible in Spanish,
// and the full status line is in the DOM. Each language gets a fresh browser context, because the compiled counts of a restored
// design are kept per page.
const READOUTS=['count','playbackProgress','playbackStitches','playbackTime','playbackSummary','messagesBtn'];

test('phone readouts are not clipped at 390x844 with 466 stitches, in English and Spanish',async({browser})=>{
 test.setTimeout(120000);
 const {initialDocument,applyOperations}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=400;doc.name='Probe';doc.revision=1;
 // A 20 x 15.1 mm fill compiles to 466 stitches.
 applyOperations(doc,[{op:'add_shape',id:'s0',kind:'rect',x:0,y:0,width:20,height:15.1,thread:'#cc3333',stitch:'fill'}]);
 for(const lang of ['en','es']){
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await ctx.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(lang==='en'?'/':`/?lang=${lang}`);
  await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
  await page.goto(lang==='en'?'/':`/?lang=${lang}`);
  await page.locator('#restoreYes').click();await expect(page.locator('.object-row')).toHaveCount(1);
  // Issue #457: at phone portrait the 2D, Stitches and 3D tabs leave the canvas, so the view is chosen from the Menu's View section.
  await page.locator('#phoneMenu').click();await page.locator('#menuView-stitches').click();await expect(page.locator('#play')).toBeVisible();
  await expect(page.locator('#playbackStitches')).toContainText('466');
  await page.waitForTimeout(300);

  const boxes=await page.evaluate(ids=>ids.map(id=>{
   const e=document.getElementById(id);
   if(!e||e.hidden||getComputedStyle(e).display==='none')return {id,shown:false};
   return {id,shown:true,text:e.textContent,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth};
  }),READOUTS);

  for(const b of boxes) if(b.shown) expect(b.scrollWidth,`${b.id} is not clipped (${lang}): "${b.text}"`).toBeLessThanOrEqual(b.clientWidth);

  if(lang==='es') expect(boxes.find(b=>b.id==='count').text,'status line in Spanish').toContain('466 puntadas · listo para bordar');

  // The thread length is visible: the summary's text has a non-empty box inside the 390 px viewport.
  const thread=await page.evaluate(()=>{
   const e=document.getElementById('playbackSummary');const r=document.createRange();r.selectNodeContents(e);
   const q=[...r.getClientRects()].filter(x=>x.width>0&&x.height>0);
   const m=e.textContent.match(/[\d.]+ m (de hilo|thread)/);
   return {text:e.textContent,m:m?m[0]:null,rects:q.map(x=>({left:x.left,right:x.right}))};
  });
  expect(thread.m,`thread length in summary (${lang}): "${thread.text}"`).not.toBeNull();
  for(const q of thread.rects) expect(q.left>=0&&q.right<=390,`summary text inside the viewport (${lang})`).toBe(true);
  expect(errors).toEqual([]);
  await ctx.close();
 }
});
