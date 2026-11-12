import {test,expect} from '@playwright/test';

// Issue #451 (from audit #449): the standing overflow and overlap check. At each width and locale the page never scrolls sideways,
// and the visible boxes in the top bar do not overlap. Checked on the first screen, and again with Layers and Properties open.
// 768x1024 is the tablet width that scrolled sideways in Spanish (the top bar's name and save status squeezed the row 11 px too wide).
const viewports=[[768,1024],[820,1180],[1024,768],[390,844],[844,390]];
const locales=['es','en'];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// Every visible element's box stays inside the window, and the page cannot scroll sideways.
const overflowOf=page=>page.evaluate(()=>{
 const W=window.innerWidth;
 const out=[];
 for(const e of document.querySelectorAll('body *')){
  if(e.closest('[hidden],[aria-hidden=true]')&&e.getBoundingClientRect().width===0)continue;
  const r=e.getBoundingClientRect();
  if(r.width>0&&r.height>0&&r.right>W+0.5)out.push(`${e.tagName}#${e.id}.${e.className?.baseVal??e.className} right=${Math.round(r.right)}`);
 }
 return {scrollWidth:document.documentElement.scrollWidth,innerWidth:W,out:out.slice(0,10)};
});

// Visible top-bar children sit side by side: no two boxes share the same space. The unsaved dot is left out: it is placed on the
// name's edge by design (the name's margin takes it), so it always touches the name field.
const topBarOverlaps=page=>page.evaluate(()=>{
 const kids=[...document.querySelectorAll('header.top > *')].filter(e=>!e.classList.contains('sr-only')&&!e.classList.contains('unsaved-marker')&&!['file','machineFile'].includes(e.id));
 const boxes=kids.map(e=>({name:e.id||e.className,r:e.getBoundingClientRect()})).filter(b=>b.r.width>0&&b.r.height>0).sort((a,b)=>a.r.left-b.r.left);
 const bad=[];
 for(let i=1;i<boxes.length;i++){
  const p=boxes[i-1],c=boxes[i];
  if(c.r.left<p.r.right-0.5)bad.push(`${p.name} overlaps ${c.name}`);
 }
 return bad;
});

// Issue #487 (spec #470 sections 1 and 6): on a tablet the page never scrolls. Only the canvas and the inspector body scroll, so the
// document is exactly one window tall and wide, and a scroll request leaves it at the top. Every inspector section (Stitch too) sits
// inside the inspector's own scroll range, so it can be reached by scrolling the inspector body. Checked on portrait tablets (#475 layout);
// a landscape tablet keeps its three columns and is not part of this rule yet.
const expectNoPageScroll=async(page,where,w,h)=>{
 if(!(w>600&&w<=1024&&h>w))return;
 const m=await page.evaluate(()=>{
  const ins=document.querySelector('#inspector');
  window.scrollTo(0,600);
  // Scroll the inspector body to its end: the Stitch section's last edge must then sit inside the inspector's box.
  ins.scrollTop=ins.scrollHeight;
  const stitch=document.querySelector('#secStitch');
  const bottom=stitch&&!stitch.hidden?stitch.getBoundingClientRect().bottom:null;
  return {sh:document.documentElement.scrollHeight,ih:innerHeight,sw:document.documentElement.scrollWidth,iw:innerWidth,
   scrollY:window.scrollY,stitchBottom:bottom,insBottom:ins.getBoundingClientRect().bottom};
 });
 expect(m.sh,`scrollHeight with ${where}`).toBe(m.ih);
 expect(m.sw,`scrollWidth with ${where}`).toBe(m.iw);
 expect(m.scrollY,`scrollY after scrollTo(0,600) with ${where}`).toBe(0);
 if(m.stitchBottom!==null)expect(m.stitchBottom,`Stitch section cannot be scrolled into the inspector with ${where}`).toBeLessThanOrEqual(m.insBottom+0.5);
};

for(const [w,h] of viewports){
 for(const lang of locales){
  test(`no sideways scroll or top-bar overlap at ${w}x${h} in ${lang}`,async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setViewportSize({width:w,height:h});
   await page.goto(`/?lang=${lang}`);
   await expect(page.locator('header.top #name')).toBeVisible();
   const o=await overflowOf(page);
   expect(o.scrollWidth,`first screen scrollWidth at ${w}x${h} ${lang}: ${o.out.join('; ')}`).toBeLessThanOrEqual(o.innerWidth);
   expect(await topBarOverlaps(page),'top-bar boxes overlap').toEqual([]);
   expect(errors).toEqual([]);
   await expectNoPageScroll(page,`first screen at ${w}x${h} ${lang}`,w,h);
  });

  test(`no sideways scroll with Layers and Properties open at ${w}x${h} in ${lang}`,async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.setViewportSize({width:w,height:h});
   await page.goto(`/?lang=${lang}`);
   // A portrait tablet keeps New design in the Menu (#475), so the top bar's New button is used only where it is shown.
   if(await page.locator('#new').isVisible())await page.locator('#new').click();else{await page.locator('#phoneMenu').click();await page.locator('#menuNew').click();}
   if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
   // Layers is the object list, always open at this width. On a phone it is a sheet: a portrait phone opens it from the Menu,
   // a landscape phone from its rail button (#473, #474).
   const portrait=await page.evaluate(()=>matchMedia('(max-width:600px) and (orientation:portrait)').matches);
   const openSheet=async sheet=>{
    if(portrait){await page.locator('#phoneMenu').click();await page.locator(sheet==='layers'?'#menuLayers':'#menuProperties').click();}
    else if(await page.locator(sheet==='layers'?'#layersBtn':'#propertiesBtn').isVisible())await page.locator(sheet==='layers'?'#layersBtn':'#propertiesBtn').click();
   };
   // The Add rectangle button is in the dock, under an open sheet, so it is pressed first.
   await page.locator('#rect').click();
   if(portrait||await page.locator('#layersBtn').isVisible())await openSheet('layers');
   await expect(page.locator('#objects')).toBeVisible();
   // A portrait tablet folds Properties away when it starts (#455): open it from the Properties button, which swaps with the object list.
   if(await page.locator('.inspector-tab[data-tab=properties]').isVisible())await page.locator('.inspector-tab[data-tab=properties]').click();
   // On a phone, selecting an object may already have opened Properties; if not, open it from its sheet.
   else if(!(await page.locator('#stats').isVisible()))await openSheet('properties');
   await expect(page.locator('#stats')).toBeVisible();
   const o=await overflowOf(page);
   expect(o.scrollWidth,`scrollWidth with Layers and Properties open at ${w}x${h} ${lang}: ${o.out.join('; ')}`).toBeLessThanOrEqual(o.innerWidth);
   expect(await topBarOverlaps(page),'top-bar boxes overlap').toEqual([]);
   expect(errors).toEqual([]);
   await expectNoPageScroll(page,`Layers and Properties open at ${w}x${h} ${lang}`,w,h);
  });
 }
}
