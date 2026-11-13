import {test,expect} from '@playwright/test';

// No button, input, select or tab in the inspector or the status line is smaller than
// 44x44 CSS px. Measured at 768x1024 (tablet portrait), in English and Spanish, and at the phone sizes 390x844 and 844x390 so the phone
// sheets stay covered. The visible glyph may stay small; the element's box is the hit area, so it must be 44 px or more.
const SIZES=[[768,1024],[390,844],[844,390]];

test.setTimeout(240000);
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// Every visible control in the inspector (Layers and Properties panels, and the tab strip and collapse button) and the status line.
const measure=page=>page.evaluate(()=>{
 const sel='button,input:not([type=hidden]),select,textarea,[role=tab],summary,a[href]';
 const roots=['#layersSheet','#inspector','.inspector-tabs','.layout main>footer'].map(s=>document.querySelector(s)).filter(Boolean);
 const out=[];const seen=new Set();
 for(const root of roots){
  for(const e of root.querySelectorAll(sel)){
   if(seen.has(e))continue;seen.add(e);
   if(e.closest('.sr-only,[hidden],[inert]'))continue;
   const cs=getComputedStyle(e);
   if(cs.visibility==='hidden'||cs.display==='none')continue;
   const r=e.getBoundingClientRect();
   if(r.width<=1||r.height<=1)continue;
   if(r.right<=0||r.bottom<=0||r.left>=innerWidth||r.top>=innerHeight)continue;
   // An inspector panel that is not the active tab has no visible box; skip anything under a hidden panel.
   const label=(e.getAttribute('aria-label')||e.textContent||e.id||e.className||e.tagName).trim().replace(/\s+/g,' ').slice(0,40);
   out.push({name:`${e.tagName.toLowerCase()}#${e.id||''} "${label}"`,w:Math.round(r.width*10)/10,h:Math.round(r.height*10)/10});
  }
 }
 return out;
});

const smallStatus=async(page,where,label)=>{
 const list=await measure(page);
 const bad=list.filter(c=>c.w<44||c.h<44).map(c=>`${c.name} ${c.w}x${c.h}`);
 expect(bad,`${where} ${label}: controls under 44x44`).toEqual([]);
};

for(const [w,h] of SIZES){
 for(const lang of ['en','es']){
  test(`inspector and status line controls are 44 px at ${w}x${h} (${lang})`,async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.setViewportSize({width:w,height:h});
   await page.goto(`/?lang=${lang}`);
   await expect(page.locator('.canvas')).toBeVisible();
   const where=`${w}x${h} ${lang}`;
   const small=async(label)=>{
    const list=await measure(page);
    expect(list.length,`${where} ${label}: controls found`).toBeGreaterThan(0);
    const bad=list.filter(c=>c.w<44||c.h<44).map(c=>`${c.name} ${c.w}x${c.h}`);
    expect(bad,`${where} ${label}: controls under 44x44`).toEqual([]);
   };
   // Phones keep the inspector in closed sheets, so only the status line is on screen at first. Tablets show the inspector at once.
   const tablet=w>600&&h>w;
   if(tablet)await small('first screen');
   else await smallStatus(page,where,'first screen');
   await page.locator('#rect').click({timeout:5000}).catch(()=>{});
   if(!tablet){
    // Phone sheets: a portrait phone opens them from the Menu, a phone with a dock button from the status line. Each sheet is checked in
    // a new browser context, so the autosave of the first page cannot open its restore dialog over the sheet. A layout with the
    // inspector always on screen (844 px wide landscape) has no sheet to open and is checked as it is.
    const portrait=await page.evaluate(()=>matchMedia('(max-width:600px) and (orientation:portrait)').matches);
    for(const sheet of ['layers','properties']){
     const ctx=await page.context().browser().newContext({viewport:{width:w,height:h}});
     const pg=await ctx.newPage();
     await pg.addInitScript(()=>{delete window.showSaveFilePicker;});
     pg.on('dialog',d=>d.accept());
     await pg.goto(`/?lang=${lang}`);
     await expect(pg.locator('.canvas')).toBeVisible();
     await pg.locator('#rect').click({timeout:5000}).catch(()=>{});
     const btn=portrait?'#phoneMenu':(sheet==='layers'?'#layersBtn':'#propertiesBtn');
     if(portrait||await pg.locator(btn).isVisible()){
      await pg.locator(btn).click({timeout:5000});
      if(portrait)await pg.locator(sheet==='layers'?'#menuLayers':'#menuProperties').click({timeout:5000});
      await expect(pg.locator('.layout>aside.panel.sheet-open')).toBeVisible();
     }
     const list=await measure(pg);
     const bad=list.filter(c=>c.w<44||c.h<44).map(c=>`${c.name} ${c.w}x${c.h}`);
     expect(bad,`${where} ${sheet}: controls under 44x44`).toEqual([]);
     await ctx.close();
     if(!portrait)break;
    }
   }else{
    await small('object selected');
    await page.locator('.inspector-tab[data-tab=properties]').click({timeout:5000});
    await small('properties tab');
   }
   expect(errors).toEqual([]);
  });
 }
}

// Each disclosure row in the Properties panel (Document stitch settings, Reference image, Thread plan and the rest) is a summary
// element. They show only with nothing selected, so this test opens the Properties tab on a clean canvas before measuring.
const disclosureRows=page=>page.evaluate(()=>[...document.querySelectorAll('#inspector summary')]
 .filter(e=>!e.closest('.sr-only,[hidden],[inert]'))
 .map(e=>({name:e.textContent.trim().replace(/\s+/g,' ').slice(0,40),r:e.getBoundingClientRect()}))
 .filter(c=>c.r.width>1&&c.r.height>1)
 .map(c=>({name:c.name,w:Math.round(c.r.width*10)/10,h:Math.round(c.r.height*10)/10})));

for(const lang of ['en','es']){
 test(`tablet property disclosure rows are at least 44 px tall (768x1024, ${lang})`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.setViewportSize({width:768,height:1024});
  await page.goto(`/?lang=${lang}`);
  await expect(page.locator('.canvas')).toBeVisible();
  await page.locator('.inspector-tab[data-tab=properties]').click({timeout:5000});
  const rows=await disclosureRows(page);
  expect(rows.length,`768x1024 ${lang}: disclosure rows found`).toBeGreaterThanOrEqual(3);
  const bad=rows.filter(c=>c.w<44||c.h<44).map(c=>`${c.name} ${c.w}x${c.h}`);
  expect(bad,`768x1024 ${lang}: disclosure rows under 44x44`).toEqual([]);
  expect(errors).toEqual([]);
 });
}
