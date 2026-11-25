import {test,expect} from '@playwright/test';

// A standing check across widths. At every viewport below, in English and Spanish, the page never scrolls sideways
// on the first screen or with a sheet, the menu or a dialog open, and no two visible controls have intersecting boxes. The
// number of visible controls outside the window is reported (split into "inside a scrolling container" and "not") but not
// asserted, so the count can be read as a trend. The touch-target size check is not part of this spec.

// The one place the viewport list lives. Add or change a size here and nowhere else. `cover` marks the sizes that also get
// the covered-control and text-overflow checks, both with nothing selected and with a rectangle selected.
const VIEWPORTS=[
 {name:'320x568 portrait',width:320,height:568},
 {name:'568x320 landscape',width:568,height:320},
 {name:'360x740 portrait',width:360,height:740},
 {name:'740x360 landscape',width:740,height:360},
 {name:'375x667 portrait',width:375,height:667,cover:true},
 {name:'667x375 landscape',width:667,height:375,cover:true},
 {name:'390x844 portrait',width:390,height:844,cover:true},
 {name:'844x390 landscape',width:844,height:390},
 {name:'414x896 portrait',width:414,height:896},
 {name:'896x414 landscape',width:896,height:414},
 {name:'768x1024 portrait',width:768,height:1024,cover:true},
 {name:'1024x768 landscape',width:1024,height:768,cover:true},
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
 // Skip links sit off screen until focused, by design, so they are not checked for position or cover.
 const isVisible=e=>{
  const cs=getComputedStyle(e);
  if(cs.visibility==='hidden'||cs.display==='none'||e.closest('.sr-only')||e.matches('a.skip-link'))return false;
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
 // The part of a control that is drawn: its box cut to every clipping ancestor (a rail or list that scrolls hides what is past its edge).
 const drawnRect=e=>{
  let r=e.getBoundingClientRect();
  for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){
   const cs=getComputedStyle(p);
   if(!/(hidden|auto|scroll|clip)/.test(cs.overflowX+cs.overflowY))continue;
   const q=p.getBoundingClientRect();
   r={left:Math.max(r.left,q.left),top:Math.max(r.top,q.top),right:Math.min(r.right,q.right),bottom:Math.min(r.bottom,q.bottom)};
  }
  return r;
 };
 const shown=[...(document.querySelector(scope)||document).querySelectorAll(CONTROL)].filter(isVisible);
 const controls=shown.filter(e=>!covered(e)&&drawnRect(e).right-drawnRect(e).left>0&&drawnRect(e).bottom-drawnRect(e).top>0);
 // Every visible control, not only the uncovered ones: 25 points (5 by 5) across its drawn part, inside the window. A point whose
 // topmost element is neither the control nor one of its descendants means something sits on the control. Points that fall in
 // a rounded corner outside the painted shape are skipped, since nothing of the control is drawn there.
 const name=e=>`${e.tagName.toLowerCase()}${e.id?'#'+e.id:''} "${(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,24)}"`;
 const outsidePainted=(x,y,box,cs)=>{
  const w=box.right-box.left,h=box.bottom-box.top;
  const [tl,tr,br,bl]=['borderTopLeftRadius','borderTopRightRadius','borderBottomRightRadius','borderBottomLeftRadius'].map(k=>Math.min(parseFloat(cs[k])||0,w/2,h/2));
  const corners=[
   [tl,box.left+tl,box.top+tl,x<box.left+tl&&y<box.top+tl],
   [tr,box.right-tr,box.top+tr,x>box.right-tr&&y<box.top+tr],
   [br,box.right-br,box.bottom-br,x>box.right-br&&y>box.bottom-br],
   [bl,box.left+bl,box.bottom-bl,x<box.left+bl&&y>box.bottom-bl]];
  return corners.some(([rad,cx,cy,inCorner])=>rad>0&&inCorner&&Math.hypot(x-cx,y-cy)>rad);
 };
 const coverFailures=[];
 for(const e of shown){
  const r=drawnRect(e);
  const box=e.getBoundingClientRect(),cs=getComputedStyle(e);
  const x0=Math.max(r.left,0),x1=Math.min(r.right,innerWidth),y0=Math.max(r.top,0),y1=Math.min(r.bottom,innerHeight);
  if(x1<=x0||y1<=y0)continue;
  let cover=null;
  for(let i=0;i<5&&!cover;i++)for(let j=0;j<5&&!cover;j++){
   const x=x0+(x1-x0)*(i+0.5)/5,y=y0+(y1-y0)*(j+0.5)/5;
   if(outsidePainted(x,y,box,cs))continue;
   const top=document.elementFromPoint(x,y);
   if(top&&top!==e&&!e.contains(top))cover=top;
  }
  if(cover)coverFailures.push(`${name(e)} is covered by ${name(cover)}`);
 }
 const hits=[];
 for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
  const a=controls[i],b=controls[j];
  if(a.contains(b)||b.contains(a))continue;
  const A=drawnRect(a),B=drawnRect(b);
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
 return {overflow:document.documentElement.scrollWidth-innerWidth,hits,coverFailures,offscreenInScroller:inside,offscreenOther:outside};
};

// Runs in the page: every overflowing control, with the control definition of test/label-fit.spec.js (sr-only text and
// width-1 icon labels are ignored; inline elements have no clientWidth to clip).
function findOverflows(){
 const regions=[...document.querySelectorAll('header.top, .floating, .tool-rail, .layout > aside, footer')];
 const seen=new Set();
 const out=[];
 for(const region of regions){
  for(const el of region.querySelectorAll('*')){
   if(seen.has(el))continue;
   seen.add(el);
   if(el.closest('.sr-only'))continue;
   if(el.closest('[hidden], dialog:not([open])'))continue;
   const ownText=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
   if(!ownText)continue;
   const cs=getComputedStyle(el);
   if(cs.display==='none'||cs.display==='inline'||cs.visibility==='hidden')continue;
   const r=el.getBoundingClientRect();
   if(r.width===0||r.height===0)continue;
   if(el.classList.contains('icon-label')&&Math.round(r.width)===1)continue;
   if(el.scrollWidth<=el.clientWidth)continue;
   const label=el.id?`#${el.id}`:el.tagName.toLowerCase()+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\s+/).join('.'):'');
   out.push({label,text:el.textContent.trim().replace(/\s+/g,' ').slice(0,60),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth});
  }
 }
 return out;
}
// Overflows that are clipping by design, as listed in test/label-fit.spec.js.
const OVERFLOW_EXCEPTIONS=['span.row-name'];

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

  // Layers and Properties sheets, at phone sizes, open from the Menu. A portrait tablet leaves them out of the Menu.
  const sheetsInMenu=await page.locator('#menuLayers').count()>0;
  if(sheetsInMenu&&await open(page,page.locator('#phoneMenu'))){
   await page.locator('#menuLayers').click();
   await check(page,testInfo,'Layers sheet','aside.sheet-open');
   // Properties sheet: select an object so Properties has its full set of controls, then open it from the selection bar.
   await page.locator('.object-row').first().click().catch(()=>{});
   await page.locator('#barProperties').click();
   await check(page,testInfo,'Properties sheet','aside.sheet-open');
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

// The covered-control and text-overflow checks at the sizes marked `cover`, in English and Spanish, first with nothing
// selected and then with one rectangle drawn and selected (the same way test/label-fit.spec.js selects it).
for(const {name,width,height} of VIEWPORTS.filter(v=>v.cover)) for(const lang of LOCALES) for(const selected of [false,true]){
 test(`controls are not covered and labels fit at ${name} (${lang}) ${selected?'with a rectangle selected':'with nothing selected'}`,async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.setViewportSize({width,height});
  await page.goto(lang==='en'?'/':`/?lang=${lang}`);
  await expect(page.locator('header.top')).toBeVisible();
  if(selected){
   await page.locator('#rect').click();
   await expect(page.locator('#remove')).toBeEnabled();
  }
  const m=await page.evaluate(measure,'body');
  const overflows=(await page.evaluate(findOverflows)).filter(o=>!OVERFLOW_EXCEPTIONS.includes(o.label));
  expect(m.coverFailures,'visible controls covered by another element').toEqual([]);
  expect(m.hits,'overlapping controls').toEqual([]);
  expect(overflows.map(o=>`${o.label} "${o.text}": scrollWidth ${o.scrollWidth} > clientWidth ${o.clientWidth}`),'text overflowing its control').toEqual([]);
  expect(errors,'page errors').toEqual([]);
 });
}
