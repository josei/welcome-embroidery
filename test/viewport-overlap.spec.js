import {test,expect} from '@playwright/test';

// Issue #452: a standing check across widths. At every viewport below, in English and Spanish, the page never scrolls sideways
// on the first screen or with a sheet, the menu or a dialog open, and no two visible controls have intersecting boxes. The
// number of visible controls outside the window is reported (split into "inside a scrolling container" and "not") but not
// asserted, so the count can be read as a trend. The touch-target size check is not part of this spec.

// The one place the viewport list lives. Add or change a size here and nowhere else.
const VIEWPORTS=[
 {name:'320x568 portrait',width:320,height:568},
 {name:'568x320 landscape',width:568,height:320},
 {name:'360x740 portrait',width:360,height:740},
 {name:'740x360 landscape',width:740,height:360},
 {name:'375x667 portrait',width:375,height:667},
 {name:'667x375 landscape',width:667,height:375},
 {name:'390x844 portrait',width:390,height:844},
 {name:'844x390 landscape',width:844,height:390},
 {name:'414x896 portrait',width:414,height:896},
 {name:'896x414 landscape',width:896,height:414},
 {name:'768x1024 portrait',width:768,height:1024},
 {name:'1024x768 landscape',width:1024,height:768},
 {name:'820x1180 portrait',width:820,height:1180},
 {name:'1180x820 landscape',width:1180,height:820},
];
const LOCALES=['en','es'];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// Controls the check looks at. A closed dialog, a hidden sheet and sr-only text are not drawn, so they are skipped.

// Runs inside the page: the visible controls that intersect another visible control (a control inside its own parent is ignored),
// and the count of visible controls outside the window, split by whether a scrolling ancestor clips them.
const measure=scope=>{
 const CONTROL='button,input,select,textarea,summary,a,[role="menuitem"]';
 const isVisible=e=>{
  const cs=getComputedStyle(e);
  if(cs.visibility==='hidden'||cs.display==='none'||e.closest('.sr-only'))return false;
  if(!e.getClientRects().length)return false;
  const r=e.getBoundingClientRect();
  return r.width>0&&r.height>0;
 };
 const scrollingAncestor=e=>{
  for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){
   const cs=getComputedStyle(p);
   if(/(auto|scroll)/.test(cs.overflowX+cs.overflowY)&&(p.scrollWidth>p.clientWidth||p.scrollHeight>p.clientHeight))return true;
  }
  return false;
 };
 // A control covered by an open sheet or dialog is not on top, so it is not counted in an overlap.
 const covered=e=>{const r=e.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;if(cx<0||cy<0||cx>innerWidth||cy>innerHeight)return false;const top=document.elementFromPoint(cx,cy);return !top||!(top===e||e.contains(top));};
 const controls=[...(document.querySelector(scope)||document).querySelectorAll(CONTROL)].filter(e=>isVisible(e)&&!covered(e));
 const hits=[];
 for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
  const a=controls[i],b=controls[j];
  if(a.contains(b)||b.contains(a))continue;
  const A=a.getBoundingClientRect(),B=b.getBoundingClientRect();
  const ox=Math.min(A.right,B.right)-Math.max(A.left,B.left),oy=Math.min(A.bottom,B.bottom)-Math.max(A.top,B.top);
  if(ox>1&&oy>1)hits.push(`${a.tagName}#${a.id||''} "${(a.textContent||a.getAttribute('aria-label')||'').trim().slice(0,24)}" / ${b.tagName}#${b.id||''} "${(b.textContent||b.getAttribute('aria-label')||'').trim().slice(0,24)}"`);
 }
 let inside=0,outside=0;
 for(const e of controls){
  const r=e.getBoundingClientRect();
  const off=r.right<=0||r.bottom<=0||r.left>=innerWidth||r.top>=innerHeight;
  if(!off&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight)continue;
  if(scrollingAncestor(e))inside++;else outside++;
 }
 return {overflow:document.documentElement.scrollWidth-innerWidth,hits,offscreenInScroller:inside,offscreenOther:outside};
};

// Asserts the per-state checks and records the off-screen counts on the test report. While a popup is open, the overlap check
// covers the popup itself: a menu or dialog is meant to sit over the page, so the page controls under it are not compared.
async function check(page,testInfo,state,scope='body'){
 const m=await page.evaluate(measure,scope);
 testInfo.annotations.push({type:'offscreen',description:`${state}: inside a scrolling container ${m.offscreenInScroller}, not ${m.offscreenOther}`});
 expect(m.overflow,`${state}: horizontal overflow (scrollWidth - innerWidth)`).toBeLessThanOrEqual(0);
 expect(m.hits,`${state}: overlapping controls`).toEqual([]);
}

// Opens a state if the control for it is on screen at this size; returns false when the state does not apply.
async function open(page,locator){
 if(!(await locator.count())||!(await locator.first().isVisible()))return false;
 await locator.first().click();
 return true;
}

for(const {name,width,height} of VIEWPORTS) for(const lang of LOCALES){
 test(`no overflow or overlap at ${name} (${lang})`,async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.setViewportSize({width,height});
  await page.goto(lang==='en'?'/':`/?lang=${lang}`);
  await check(page,testInfo,'first screen');

  // Layers sheet, when this size shows the sheet buttons (phone widths).
  if(await open(page,page.locator('.sheet-bar button'))){
   await check(page,testInfo,'Layers sheet','aside.sheet-open');
   // Properties sheet: select an object so Properties has its full set of controls, then open it.
   await page.locator('.object-row').first().click().catch(()=>{});
   if(await open(page,page.locator('.layers-head .inspector-toggle'))) await check(page,testInfo,'Properties sheet','aside.sheet-open');
   await page.keyboard.press('Escape');
  }

  // Menu, when this size shows the top-bar menu (phone widths).
  if(await open(page,page.locator('#phoneMenu'))){
   await check(page,testInfo,'menu open','.file-menu-list');
   await page.keyboard.press('Escape');
  }

  // A dialog: the command palette opens with K from outside a field.
  await page.locator('body').click({position:{x:1,y:1}}).catch(()=>{});
  await page.keyboard.press('k');
  if(await page.locator('#commandPalette[open]').count()){
   await check(page,testInfo,'dialog open','#commandPalette[open]');
   await page.keyboard.press('Escape');
  }

  expect(errors,'page errors').toEqual([]);
 });
}
