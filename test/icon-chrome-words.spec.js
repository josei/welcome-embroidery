import {test,expect} from '@playwright/test';

// On a phone and a tablet the status line, the playback readouts, the 3D hint and pull switch, and the Layers header carry
// icons and numbers, not sentences. Each figure keeps its full sentence as its accessible name and tooltip. These checks
// run at the phone and tablet sizes in both languages.

test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const VIEWPORTS=[[390,844],[844,390],[768,1024]];
const AREAS=['#count','#playbackSummary','#playbackStitches','#previewHint','#previewPull','.layers-count'];

async function seed(page,lang){
 const {initialDocument,applyOperations}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=400;doc.name='Probe';doc.revision=1;
 applyOperations(doc,[{op:'add_shape',id:'s0',kind:'rect',x:0,y:0,width:20,height:15.1,thread:'#cc3333',stitch:'fill'}]);
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.locator('#restoreYes').click();
 await expect(page.locator('.object-row')).toHaveCount(1);
 await expect(page.locator('#count')).toContainText(/\d/);
 await page.waitForTimeout(300);
}

// The visible text of each listed area, and every icon-only control inside it that has no visible words.
const readAreas=page=>page.evaluate(sels=>sels.map(sel=>[...document.querySelectorAll(sel)].filter(e=>{
 const r=e.getBoundingClientRect();const cs=getComputedStyle(e);
 return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&!e.closest('[hidden]');
}).map(e=>({sel,text:e.textContent.replace(/\s+/g,' ').trim(),
 controls:[...e.querySelectorAll('[role=img],button,input')].map(c=>({tag:c.tagName,name:c.getAttribute('aria-label')||'',title:c.getAttribute('title')||''}))})))
,AREAS);

for(const [width,height] of VIEWPORTS) for(const lang of ['en','es']) {
 test(`${width}x${height} ${lang}: the status, playback and Layers readouts are at most two words`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width,height});
  await seed(page,lang);
  const areas=(await readAreas(page)).flat();
  for(const a of areas){
   const words=a.text.split(' ').filter(Boolean);
   expect(words.length,`${a.sel} reads "${a.text}"`).toBeLessThanOrEqual(2);
  }
  expect(errors).toEqual([]);
 });
}

for(const lang of ['en','es']) test(`390x844 ${lang}: every icon-only control in the readouts has a name and a tooltip`,async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await seed(page,lang);
 const areas=(await readAreas(page)).flat();
 for(const a of areas) for(const c of a.controls){
  expect(c.name,`${a.sel} ${c.tag} aria-label`).not.toBe('');
  expect(c.title,`${a.sel} ${c.tag} title`).not.toBe('');
  expect(c.name,`${a.sel} ${c.tag} keeps its full sentence`).toBe(c.title);
 }
});

test('390x844 es: the status figure and the 3D hint keep their sentences as names',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await seed(page,'es');
 await expect(page.locator('#count .figure')).toHaveAttribute('aria-label',/puntadas · listo para bordar/);
 await page.locator('#phoneMenu').tap();
 await page.locator('#menuView-preview').tap();
 await expect(page.locator('#preview3d')).toHaveAttribute('data-instances',/^[1-9]\d*$/,{timeout:8000});
 await expect(page.locator('#previewHint')).toHaveAttribute('aria-label','Arrastra para orbitar · pellizca · doble toque para restablecer');
 await expect(page.locator('#showPull')).toHaveAttribute('aria-label','Mostrar la tracción de la tela');
});

test('390x844 es: the phone bar and the 3D view are shown as icons',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await seed(page,'es');
 await page.screenshot({path:'test-results/phone-bar-es-390x844.png',fullPage:false});
 await page.locator('#phoneMenu').click();
 await page.locator('#menuView-preview').click();
 await expect(page.locator('#preview3d')).toHaveAttribute('data-instances',/^[1-9]\d*$/,{timeout:8000});
 await page.waitForTimeout(400);
 await page.screenshot({path:'test-results/3d-view-es-390x844.png',fullPage:false});
});
