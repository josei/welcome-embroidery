import {test,expect} from '@playwright/test';

// The phone editor's chrome is two bars under the canvas (beside it in landscape), built from one tile. With nothing selected the
// context bar holds Hand, Hoop and All with the zoom stepper; with an object selected it holds Several, Duplicate, Delete and
// Properties with one zoom tile. The dock holds the five drawing tools. In Stitches view the playback bar takes the context
// bar's place. Every bar is found from the DOM (role toolbar, or a positioned element outside the art that holds a button), so
// a bar that is added later is checked too.

const SIZES=[[360,640],[390,844],[844,390],[768,1024]];
// The 768 px portrait tablet, which keeps its tool rail on the canvas's left edge rather than in a bar under the canvas.
const isTabletPortrait=(width,height)=>width>600&&width<=1024&&height>width;
const LANGS=['es','en'];
const CASES=['nothing selected','object selected','stitches','typing lettering'];

test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function open(page,width,height,lang){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('#art')).toBeVisible();
 return errors;
}

// A portrait tablet has no phone context bar: its selection bar holds the same Duplicate, and its view switch the Stitches view.
async function arrange(page,name,width,height){
 const tablet=isTabletPortrait(width,height);
 if(name==='object selected'||name==='typing lettering'){ await page.locator('#rect').tap(); await expect(page.locator('#barDuplicate')).toBeVisible(); }
 if(name==='stitches'&&tablet){ await page.locator('[data-view=stitches]').tap(); await expect(page.locator('#play')).toBeVisible(); }
 else if(name==='stitches'){ await page.locator('#phoneMenu').tap(); await page.locator('#menuView-stitches').tap(); await expect(page.locator('.phone-playback')).toBeVisible(); }
 if(name==='typing lettering'){ await page.locator('#letter').tap(); await page.keyboard.type('HI'); }
 // A tap leaves the pointer over the tile it hit, which would show its hover fill; the rest state is measured with the pointer away.
 await page.mouse.move(0,0);
 await page.waitForTimeout(250);
}

// Every bar on the phone, as the DOM shows it: role toolbar, or a positioned element outside the art that holds a button. The header
// is excluded (it is the top bar), and so are the open sheets, dialogs, menus and the toast, which are not bars.
async function bars(page){
 return page.evaluate(()=>{
  const visible=el=>{const cs=getComputedStyle(el);const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none';};
  const found=new Set(document.querySelectorAll('[role=toolbar]'));
  for(const el of document.querySelectorAll('body *')){
   const pos=getComputedStyle(el).position;
   // A portrait tablet's footer is the bar that holds the stitch playback, so it is a bar too.
   if(((pos==='fixed'||pos==='absolute'||pos==='sticky')||el.matches('.layout main>footer'))&&el.querySelector('button')) found.add(el);
  }
  const excluded='#art,header,#toast,dialog,aside,[role=menu],.zoom-menu,#tooltip,.canvas-views,#preview3d';
  const canvas=document.querySelector('.canvas').getBoundingClientRect();
  const main=document.querySelector('.layout main').getBoundingClientRect();
  return [...found].filter(el=>visible(el)&&!el.matches('.layout,main')&&!el.closest(excluded)&&(!el.closest('.canvas')||el.matches('.tool-rail,[role=toolbar]')))
   .map(el=>{const r=el.getBoundingClientRect();const cs=getComputedStyle(el);
    return {id:el.id,cls:String(el.className),role:el.getAttribute('role'),x:r.x,y:r.y,w:r.width,h:r.height,
     bg:cs.backgroundColor,border:`${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
     inCanvas:!!el.closest('.canvas'),canvasBottom:canvas.bottom,canvasL:canvas.left,canvasR:canvas.right,canvasT:canvas.top,mainW:main.width,
     tiles:[...el.querySelectorAll('.chrome-tile')].map(t=>{const b=t.getBoundingClientRect();const s=getComputedStyle(t);
       const word=t.querySelector('.tile-word');const w=word?word.getBoundingClientRect():null;
       return {id:t.id,hover:t.matches(':hover'),h:b.height,radius:s.borderRadius,bg:s.backgroundColor,selected:t.classList.contains('is-selected')||t.getAttribute('aria-pressed')==='true'||t.getAttribute('aria-expanded')==='true',
        shadow:s.boxShadow,fontSize:word?parseFloat(getComputedStyle(word).fontSize):null,
        wordFits:word?word.scrollWidth<=word.clientWidth+0.5&&w.height<=parseFloat(getComputedStyle(word).fontSize)*2:true,
        label:t.getAttribute('aria-label')};})};
   });
 });
}

// On a portrait tablet the playback bar is the footer's bar, so its text is bar text and is skipped as bar text is on every size.
async function chromeText(page,tablet){
 return page.evaluate(tablet=>{
  const out=[];const skip='script,style,#art,.canvas,#toast,[role=toolbar],'+(tablet?'.playback-bar,':'')+'header,dialog,aside,.sr-only,.skip-link,#tooltip,[hidden]';
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  for(let n=walker.nextNode();n;n=walker.nextNode()){
   const text=n.textContent.trim();if(!text)continue;
   const parent=n.parentElement;if(!parent||parent.closest(skip))continue;
   const cs=getComputedStyle(parent);const r=parent.getBoundingClientRect();
   if(cs.display==='none'||cs.visibility==='hidden'||r.width===0)continue;
   out.push(text);
  }
  return out;
 },tablet);
}

for(const lang of LANGS) for(const [width,height] of SIZES) for(const name of CASES){
 test(`phone chrome bars at ${width}x${height} ${lang}: ${name}`,async({page})=>{
  const errors=await open(page,width,height,lang);
  await arrange(page,name,width,height);
  const list=await bars(page);
  const landscape=width>height;
  const tablet=isTabletPortrait(width,height);
  const stitches=name==='stitches';

  // 1. At most two bars, below the canvas (beside it in landscape), each spanning its column, with one height, background and top border.
  // On a portrait tablet the tool rail and zoom bar float over the canvas by design, so "spans its column" does not apply to them,
  // and "inside the canvas" means inside the canvas rectangle. Every other bar rule (height, background, border) applies to all bars.
  const floating=b=>isTabletPortrait(width,height)&&b.inCanvas;
  expect(list.filter(b=>!floating(b)).length,'at most two bars besides the top bar').toBeLessThanOrEqual(2);
  const strip=list.filter(b=>!b.cls.includes('landscape-rail')&&!floating(b));
  for(const b of strip){
   expect(b.inCanvas,'a bar under the canvas is not inside it').toBe(false);
   expect(Math.abs(b.w-b.mainW),`${b.id||b.role} spans its column`).toBeLessThanOrEqual(1);
  }
  for(const b of list.filter(floating)){
   const inside=b.x>=b.canvasL-1&&b.x+b.w<=b.canvasR+1&&b.y>=b.canvasT-1&&b.y+b.h<=b.canvasBottom+1;
   expect(inside,`${b.id||b.cls} sits inside the canvas rectangle`).toBe(true);
  }
  const barRules=list.filter(b=>!b.cls.includes('landscape-rail'));
  // A tool rail is a column the height of the canvas, with a divider on its inner side, so the height and top-border rules
  // compare the horizontal bars only. The background rule still covers every bar.
  const rows=barRules.filter(b=>b.w>b.h);
  if(barRules.length){
   if(!stitches){
    expect(new Set(rows.map(b=>b.h)).size,'bars share one height').toBe(1);
   } else {
    for(const b of rows) expect(b.h,'the playback bar stays within the two-row height').toBeLessThanOrEqual(110);
   }
   expect(new Set(barRules.map(b=>b.bg)).size,'bars share one background').toBe(1);
   expect(rows.every(b=>/\dpx \S+ \S/.test(b.border)),'each bar has a computed top border').toBe(true);
   expect(new Set(rows.map(b=>b.border)).size,'bars share one top border').toBe(1);
  }

  // 2. Every tile in a bar has the same height, radius and fill (the selected one aside, which has its own state), and its label is
  //    at least 11 px and does not clip or wrap.
  const tiles=list.flatMap(b=>b.tiles);
  // The tile under the pointer shows its hover fill, so the rest state is compared over the tiles that are neither selected nor hovered.
  const rest=tiles.filter(t=>!t.selected&&!t.hover);
  if(rest.length){
   expect(new Set(rest.map(t=>t.h)).size,'tiles share one height').toBe(1);
   expect(new Set(rest.map(t=>t.radius)).size,'tiles share one radius').toBe(1);
   expect(new Set(rest.map(t=>t.bg)).size,'tiles share one fill at rest').toBe(1);
  }
  for(const t of tiles){
   if(t.fontSize!==null) expect(t.fontSize,`${t.label} label is at least 11 px`).toBeGreaterThanOrEqual(11);
   expect(t.wordFits,`${t.label} label fits its tile on one line`).toBe(true);
   expect(t.label,'every tile keeps its full name').toBeTruthy();
  }

  // 3. No chrome text outside the top bar and the bars; the status indicator is a child of the top bar.
  expect(await chromeText(page,tablet),'chrome text outside the top bar and bars').toEqual([]);
  await expect(page.locator('header.top .top-status #count')).toHaveCount(1);

  // 4. No bar overlaps the hoop after Fit hoop.
  // A portrait tablet's zoom bar has the Fit hoop button itself, so it needs no menu.
  if(name==='nothing selected'||(tablet&&(name==='object selected'||name==='typing lettering'))){
   await page.locator('#zoomFit').tap();
  } else if(name==='object selected'||name==='typing lettering'){
   await page.locator('#zoomPct').tap();
   await page.locator('[role=menuitem]').filter({hasText:/^(Fit hoop|Ajustar bastidor)$/}).tap();
  }
  if(name==='nothing selected'||name==='object selected'){
   const hoop=await page.locator('#hoopOuter').evaluate(el=>{const r=el.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom};});
   for(const bar of await bars(page)){
    const overlaps=bar.x<hoop.r&&bar.x+bar.w>hoop.l&&bar.y<hoop.b&&bar.y+bar.h>hoop.t;
    expect(overlaps,`${bar.id||bar.cls} does not cover the hoop`).toBe(false);
   }
  }

  // 5. Exactly one tile is in the selected state, and its state is drawn inside the tile (an inset shadow, not a stripe beside it).
  const selected=(await bars(page)).flatMap(b=>b.tiles).filter(t=>t.selected).map(t=>({id:t.id,shadow:t.shadow}));
  // A portrait tablet's tool rail is the desktop's icon rail, not chrome tiles, and marks its armed tool with the active-tool class.
  // That tool is counted with the tiles, so the count still says exactly one, and its state is drawn inside the button too.
  const railSelected=tablet?await page.locator('.tool-rail .active-tool').evaluateAll(els=>els.map(el=>({id:el.id,shadow:getComputedStyle(el).boxShadow}))):[];
  const all=[...selected,...railSelected];
  // A landscape phone's rail is hidden in Stitches view, as it always was, so no tool tile is there to be selected.
  expect(all.map(t=>t.id),'exactly one tile is selected').toHaveLength(landscape&&stitches?0:1);
  for(const t of all) expect(t.shadow,'the selected state is an inset border').toContain('inset');

  expect(errors).toEqual([]);
 });
}
