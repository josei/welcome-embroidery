import {test,expect} from '@playwright/test';

// The 1024-1100px band has its own column widths: the Layers column is 240 px and the inspector 280 px.
// Widths just outside the band keep their own columns (208 px below it, 256 px above it).
// At 1024x768, 1100x800 and 1180x800, in English and Spanish, one rectangle is drawn and then:
// layer names do not overflow, the stats line sits in one or two lines, the Properties button stays clear of the ruler,
// and the design name is whole or ends in an ellipsis.

const firstColumn=page=>page.locator('.layout').evaluate(e=>parseFloat(getComputedStyle(e).gridTemplateColumns.split(' ')[0]));

const widths=[[1023,208],[1024,240],[1100,240],[1101,256]];
for(const [w,col] of widths){
 test(`left column is ${col}px at ${w}px wide`,async({page})=>{
  await page.setViewportSize({width:w,height:800});
  await page.goto('/?lang=en');
  expect(await firstColumn(page)).toBe(col);
 });
}

const cases=[[1024,768,'en'],[1024,768,'es'],[1100,800,'en'],[1100,800,'es'],[1180,800,'en'],[1180,800,'es']];
for(const [w,h,lang] of cases){
 test(`band layout fits at ${w}x${h} in ${lang}`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.addInitScript(()=>{delete window.showSaveFilePicker;});
  await page.setViewportSize({width:w,height:h});
  await page.goto(`/?lang=${lang}`);
  await page.locator('#new').click();
  if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
  await page.locator('#rect').click();
  await expect(page.locator('#objects .object-row').first()).toBeVisible();

  const m=await page.evaluate(()=>{
    const box=e=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,h:r.height};};
    const names=[...document.querySelectorAll('#objects .row-name, #objects .row-kind')].map(e=>({text:e.textContent.trim(),over:e.scrollWidth-e.clientWidth}));
    const head=document.querySelector('.layers-head');
    const stats=[...head.querySelectorAll('span')].map(e=>({text:e.textContent.trim(),fs:parseFloat(getComputedStyle(e).fontSize),h:e.getBoundingClientRect().height}));
    const btn=head.querySelector('.inspector-toggle');
    const ruler=document.querySelector('#rulerTop');
    const canvasBox=box(document.querySelector('.canvas'));
    const name=document.querySelector('header.top #name');
    const shownName=document.querySelector('header.top .name-field');
    // The name is drawn by the field's overlay, which shows an ellipsis; the input itself is transparent.
    const nameEllipsis=getComputedStyle(shownName,'::after').textOverflow==='ellipsis';
    return {names,stats,btn:btn?box(btn):null,btnDisplay:btn?getComputedStyle(btn).display:null,canvasLeft:canvasBox.l,
      rulerBox:ruler?box(ruler):null,nameOver:nameEllipsis?0:name.scrollWidth-name.clientWidth};
  });
  test.info().attach('band-measurements',{body:JSON.stringify({w,h,lang,...m},null,1),contentType:'application/json'});

  for(const n of m.names) expect(n.over,`"${n.text}" does not overflow its box`).toBeLessThanOrEqual(0);
  for(const s of m.stats) expect(s.h,`stats "${s.text}" takes at most two lines`).toBeLessThanOrEqual(s.fs*1.5*2+1);
  if(m.btnDisplay!=='none' && m.btn) {
    expect(m.btn.r,'Properties button stays inside the Layers column').toBeLessThanOrEqual(m.canvasLeft);
    expect(m.rulerBox,'top ruler is on the page').not.toBeNull();
    expect(m.btn.l>=m.rulerBox.r||m.btn.b<=m.rulerBox.t||m.btn.r<=m.rulerBox.l||m.btn.t>=m.rulerBox.b,'Properties button does not overlap the top ruler').toBeTruthy();
  }
  expect(m.nameOver,'design name is whole or ends in an ellipsis').toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
 });
}
