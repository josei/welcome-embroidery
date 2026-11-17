import {test,expect} from '@playwright/test';

// The simulation timeline's colour-change markers, at tablet portrait, phone portrait and desktop, in English and Spanish.
// Each marker's centre must be the element a tap lands on, no two markers may overlap by more than half their width, and no
// label may show a bare hex code. A cluster of changes is one marker that seeks to the first change in it.
const SIZES=[[768,1024],[390,844],[1440,900]];

// A short first thread, then a long run in a colour the palette does not name, then four short runs at the very end so their
// colour changes fall a few stitches apart and share one marker. The unnamed colour's change stands alone near the start, so
// its marker must read "Thread 2" rather than its hex code.
async function clusterDocument(){
 const {initialDocument,applyOperations,validateDocument}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=400;doc.name='Clusters';doc.revision=1;
 applyOperations(doc,[
  {op:'add_path',id:'first',x:0,y:-160,points:[[-6,0],[6,0]],thread:'#cc3333',stitch:'run'},
  {op:'add_path',id:'long',x:0,y:-60,points:[[-180,0],[180,0]],thread:'#b5614f',stitch:'satin',satinWidth:5},
  {op:'add_path',id:'a',x:0,y:60,points:[[-6,0],[6,0]],thread:'#33aacc',stitch:'run'},
  {op:'add_path',id:'b',x:0,y:70,points:[[-6,0],[6,0]],thread:'#33cc77',stitch:'run'},
  {op:'add_path',id:'c',x:0,y:80,points:[[-6,0],[6,0]],thread:'#ddbb22',stitch:'run'},
  {op:'add_path',id:'d',x:0,y:90,points:[[-6,0],[6,0]],thread:'#2f6fc4',stitch:'run'},
 ]);
 validateDocument(doc);
 return doc;
}

async function openStitches(page,width,height,lang){
 const doc=await clusterDocument();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
 await page.reload();
 await page.locator('#restoreYes').click();
 await expect(page.locator('.object-row')).toHaveCount(6);
 // The view switch shows on wide screens; phones and tablets in portrait reach Stitches through the Menu.
 if(await page.locator('[data-view=stitches]').isVisible()){await page.locator('[data-view=stitches]').click();}
 else{await page.locator('#phoneMenu').click();await page.locator('#menuView-stitches').click();}
 await expect(page.locator('#play')).toBeVisible();
 await expect(page.locator('#playbackSummary')).not.toHaveText('',{timeout:60000});
 return errors;
}

const markerBoxes=page=>page.evaluate(()=>[...document.querySelectorAll('.timeline-marker')].map(e=>{
 const r=e.getBoundingClientRect(),c={x:r.left+r.width/2,y:r.top+r.height/2};
 const hit=document.elementFromPoint(c.x,c.y);
 return {l:r.left,r:r.right,w:r.width,hitOwn:Boolean(hit&&hit.closest('.timeline-marker')===e),label:e.getAttribute('aria-label'),index:Number(e.dataset.index)};
}));

for(const [w,h] of SIZES) for(const lang of ['en','es']){
 test(`colour-change markers can be hit and do not overlap at ${w}x${h} (${lang})`,async({page})=>{
  test.setTimeout(120000);
  const errors=await openStitches(page,w,h,lang);
  const markers=await markerBoxes(page);
  expect(markers.length,'the clustered changes produce markers').toBeGreaterThan(0);
  expect(markers.length,'the four close changes share a marker, so there are fewer markers than changes').toBeLessThan(6);
  for(const m of markers) expect(m.hitOwn,`the centre of the marker at ${Math.round(m.l)} is hit`).toBe(true);
  for(let i=1;i<markers.length;i++){
   const overlap=Math.min(markers[i-1].r,markers[i].r)-Math.max(markers[i-1].l,markers[i].l);
   expect(overlap,`markers ${i-1} and ${i} overlap by ${overlap.toFixed(1)} px`).toBeLessThanOrEqual(markers[i].w/2);
  }
  for(const m of markers) expect(m.label,`label "${m.label}" has no hex code`).not.toMatch(/#/);
  await page.screenshot({path:`test-results/timeline-markers-${w}x${h}-${lang}.png`,clip:await page.locator('.playback-bar').boundingBox()});
  expect(errors).toEqual([]);
 });
}

test('a cluster of colour changes is one marker that selects the first change',async({page})=>{
 test.setTimeout(120000);
 const errors=await openStitches(page,1440,900,'en');
 const markers=await markerBoxes(page);
 const groups=await page.evaluate(()=>[...document.querySelectorAll('.timeline-marker')].map(e=>e.dataset.index));
 const cluster=await page.evaluate(()=>[...document.querySelectorAll('.timeline-marker')].map(e=>e.getAttribute('aria-label')));
 expect(cluster.some(l=>/color changes from/.test(l)),'one marker stands for several changes').toBe(true);
 const first=markers.findIndex(m=>/color changes from/.test(m.label));
 await page.locator('.timeline-marker').nth(first).click();
 await expect(page.locator('#seek')).toHaveValue(groups[first]);
 expect(errors).toEqual([]);
});

test('a thread with no palette name is labelled by its place in the plan',async({page})=>{
 test.setTimeout(120000);
 const errors=await openStitches(page,1440,900,'en');
 const labels=await page.evaluate(()=>[...document.querySelectorAll('.timeline-marker')].map(e=>e.getAttribute('aria-label')));
 expect(labels.join(' | ')).toContain('Thread 2');
 expect(errors).toEqual([]);
});
