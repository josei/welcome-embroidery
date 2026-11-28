import {test,expect} from '@playwright/test';

// The stitch playback controls and the status text never overlap, and the status text stays inside the viewport, at the
// landscape phone size and the portrait sizes. The playback controls keep 44 px touch targets.
const SIZES=[[844,390],[390,844],[768,1024]];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// A design with one path named "Drawn path" that runs past a 100 mm hoop, so the status line carries its message.
async function openStitches(page,width,height,lang,{overrun=false}={}){
 const {initialDocument,applyOperations,validateDocument}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=overrun?100:400;doc.name='Probe';doc.revision=1;
 applyOperations(doc,[{op:'add_path',id:'s0',x:0,y:0,name:'Drawn path',points:[[-190,0],[190,0]],thread:'#cc3333',stitch:'satin',satinWidth:4}]);validateDocument(doc);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
 await page.reload();
 await page.locator('#restoreYes').click();
 await expect(page.locator('.object-row')).toHaveCount(1);
 // The view switch shows on wide screens; phones reach Stitches through the Menu.
 if(await page.locator('[data-view=stitches]').isVisible()){
  await page.locator('[data-view=stitches]').click();
 }else{
  await page.locator('#phoneMenu').click();await page.locator('#menuView-stitches').click();
 }
 await expect(page.locator('#play')).toBeVisible();
 await expect(page.locator('#playbackStitches')).not.toHaveText('');
 return errors;
}

// Visible boxes of the playback controls and of the status text, in CSS px.
const boxes=page=>page.evaluate(()=>{
 const visible=e=>{if(!e)return null;const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden')return null;const r=e.getBoundingClientRect();return r.width>0&&r.height>0?{id:e.id||e.className,l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height,text:e.textContent.trim()}:null;};
 const pick=sel=>[...document.querySelectorAll(sel)].map(visible).filter(Boolean);
 return {
  controls:pick('#resetPlayback,#play,#seek,.playback-time,.playback-track,.playback-summary,.playback-bar .playback-control'),
  status:pick('#count,#playbackProgress,#issuesBtn,#messagesBtn'),
 };
});

const overlaps=(a,b)=>Math.min(a.r,b.r)-Math.max(a.l,b.l)>0.5&&Math.min(a.b,b.b)-Math.max(a.t,b.t)>0.5;

for(const [w,h] of SIZES) for(const lang of ['en','es']) for(const overrun of [false,true]){
 const label=`${w}x${h} ${lang}${overrun?' with an overrun status':''}`;
 test(`the playback controls and the status text do not overlap (${label})`,async({page})=>{
  const errors=await openStitches(page,w,h,lang,{overrun});
  const {controls,status}=await boxes(page);
  expect(controls.length).toBeGreaterThan(0);
  // The status slot is empty in the stitch view unless there is a message to show, so the overlap check needs one.
  if(overrun) expect(status.length).toBeGreaterThan(0);
  for(const c of controls) for(const s of status){
   expect(overlaps(c,s),`${c.id} "${c.text}" over ${s.id} "${s.text}"`).toBe(false);
  }
  expect(errors).toEqual([]);
 });

 test(`the status text's right edge is inside the viewport (${label})`,async({page})=>{
  await openStitches(page,w,h,lang,{overrun});
  const {status}=await boxes(page);
  for(const s of status) expect(s.r,`${s.id} "${s.text}"`).toBeLessThanOrEqual(w);
 });

 test(`the playback controls are at least 44 px (${label})`,async({page})=>{
  await openStitches(page,w,h,lang,{overrun});
  const small=await page.evaluate(()=>[...document.querySelectorAll('#resetPlayback,#play')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.width<44||r.height<44);}).map(e=>`${e.id} ${e.getBoundingClientRect().width}x${e.getBoundingClientRect().height}`));
  expect(small).toEqual([]);
 });
}

// A portrait tablet has no status row under the canvas: the count and the issues chip are in the top bar, and Messages is a Menu
// row. The playback row above holds the simulation's readouts, so nothing in the strip repeats the count.
const ONE_ROW=[[768,1024]];
for(const [w,h] of ONE_ROW) for(const lang of ['en','es']) {
 test(`the playback row holds the simulation and there is no Messages button (${w}x${h} ${lang})`,async({page})=>{
  await openStitches(page,w,h,lang);
  expect(await page.locator('#playbackProgress').isVisible()).toBe(false);
  await expect(page.locator('#messagesBtn')).toHaveCount(0);
  await expect(page.locator('#playbackStitches')).toBeVisible();
 });

 test(`the status text and the thread summary are not cut off (${w}x${h} ${lang})`,async({page})=>{
  await openStitches(page,w,h,lang);
  const cut=await page.evaluate(()=>[...document.querySelectorAll('#count,.playback-summary,#playbackStitches,#playbackTime')]
   .filter(e=>getComputedStyle(e).display!=='none'&&(e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1)).map(e=>`${e.id||e.className}: ${e.textContent}`));
  expect(cut).toEqual([]);
 });

 test(`the playback strip does not cover the hoop at the bottom edge (${w}x${h} ${lang})`,async({page})=>{
  await openStitches(page,w,h,lang);
  await page.getByRole('button',{name:lang==='es'?'Ajustar bastidor':'Fit hoop',exact:true}).first().click();
  const hit=await page.evaluate(()=>{
   const canvas=document.querySelector('.layout main>.canvas').getBoundingClientRect();
   const footer=document.querySelector('.layout main>footer').getBoundingClientRect();
   return {canvasBottom:canvas.bottom,footerTop:footer.top};
  });
  expect(hit.canvasBottom).toBeLessThanOrEqual(hit.footerTop+0.5);
 });
}
