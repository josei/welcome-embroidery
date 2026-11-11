import {test,expect} from '@playwright/test';

// Issue #451 (from audit #449): the standing overflow and overlap check. At each width and locale the page never scrolls sideways,
// and the visible boxes in the top bar do not overlap. Checked on the first screen, and again with Layers and Properties open.
// 768x1024 is the tablet width that scrolled sideways in Spanish (the top bar's name and save status squeezed the row 11 px too wide).
const viewports=[[768,1024],[820,1180],[1024,768]];
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
  });

  test(`no sideways scroll with Layers and Properties open at ${w}x${h} in ${lang}`,async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.setViewportSize({width:w,height:h});
   await page.goto(`/?lang=${lang}`);
   await page.locator('#new').click();
   if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
   // Layers is the object list, always open at this width. Selecting an object opens Properties in the inspector.
   await expect(page.locator('#objects')).toBeVisible();
   await page.locator('#rect').click();
   await expect(page.locator('#stats')).toBeVisible();
   const o=await overflowOf(page);
   expect(o.scrollWidth,`scrollWidth with Layers and Properties open at ${w}x${h} ${lang}: ${o.out.join('; ')}`).toBeLessThanOrEqual(o.innerWidth);
   expect(await topBarOverlaps(page),'top-bar boxes overlap').toEqual([]);
   expect(errors).toEqual([]);
  });
 }
}
