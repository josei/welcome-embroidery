import {test,expect} from '@playwright/test';

// At the desktop width, every stitch-type card in Properties must show its whole label inside the card:
// the rendered text may not be wider than the card, nor reach past its padding. Spanish labels are the longest.

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 page.on('dialog',d=>d.accept());
});

// Draws one rectangle and selects it, so the Properties panel shows its stitch type.
async function drawAndSelect(page,lang){
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('header.top')).toBeVisible();
 if(await page.locator('#restoreDialog[open]').count())await page.locator('#restoreNo').click();
 if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
 await page.locator('#rect').click();
 const c=await page.locator('.canvas').boundingBox();
 await page.mouse.move(c.x+c.width*0.3,c.y+c.height*0.3);
 await page.mouse.down();
 await page.mouse.move(c.x+c.width*0.6,c.y+c.height*0.6,{steps:5});
 await page.mouse.up();
 await expect(page.locator('#remove')).toBeEnabled();
 await page.locator('.object-row').first().click();
 await expect(page.locator('#type')).toBeAttached();
 await expect(page.locator('.icon-seg.labelled button').first()).toBeVisible();
}

// Measures each visible stitch-type card: the width of its rendered text against the card's inner box.
function measureCards(){
 return [...document.querySelectorAll('.icon-seg.labelled button')].filter(b=>b.offsetParent).map(b=>{
  const label=b.querySelector('span');
  const box=b.getBoundingClientRect();
  const cs=getComputedStyle(b);
  const inner={
   left:box.left+parseFloat(cs.borderLeftWidth)+parseFloat(cs.paddingLeft),
   right:box.right-parseFloat(cs.borderRightWidth)-parseFloat(cs.paddingRight),
  };
  const range=document.createRange();
  range.selectNodeContents(label);
  const text=range.getBoundingClientRect();
  return {
   label:label.textContent,
   textWidth:Math.ceil(text.width),
   boxWidth:Math.floor(inner.right-inner.left),
   fits:text.left>=inner.left-0.5&&text.right<=inner.right+0.5,
   scrollFits:label.scrollWidth<=label.clientWidth,
  };
 });
}

for(const lang of ['en','es']){
 test(`stitch-type labels fit inside their cards in ${lang} at 1440px`,async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await drawAndSelect(page,lang);
  const cards=await page.evaluate(measureCards);
  expect(cards.length,'stitch-type cards').toBeGreaterThan(0);
  const broken=cards.filter(c=>!c.fits||!c.scrollFits).map(c=>`"${c.label}" (${c.textWidth}px text, ${c.boxWidth}px box)`);
  expect(broken,`stitch-type labels wider than their cards in ${lang}`).toEqual([]);
  if(lang==='es'){
   await page.locator('.icon-seg.labelled').first().scrollIntoViewIfNeeded();
   await page.locator('.icon-seg.labelled').first().screenshot({path:'test-results/stitch-type-es-1440.png'});
  }
 });
}

// Every other text in Properties (field labels, select values, section headings) must also fit its box.
// Text inside a select is measured with canvas, because a select's text cannot be ranged. A native select
// draws its arrow inside the right padding, so the room it needs is reserved on top of the text width.
// Elements that truncate on purpose (text-overflow: ellipsis, such as Layers row names) are skipped.
function measurePanelText(){
 const out=[];
 const ellipsised=el=>{for(let e=el;e&&e!==document.body;e=e.parentElement){if(getComputedStyle(e).textOverflow==='ellipsis')return true;}return false;};
 // Every sidebar is a .panel (Layers and Properties are separate asides), so walk all of them.
 for(const panel of document.querySelectorAll('.panel')){
  const walker=document.createTreeWalker(panel,NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())){
   const t=node.textContent.trim();
   if(!t)continue;
   const el=node.parentElement;
   if(!el)continue;
   if(!el.getClientRects().length)continue;
   if(el.closest('select')){
    const sel=el.closest('select');
    if(!sel.offsetParent)continue;
    const cs=getComputedStyle(sel);
    const ctx=document.createElement('canvas').getContext('2d');
    ctx.font=`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const shown=sel.options[sel.selectedIndex];
    if(!shown)continue;
    const boxWidth=sel.getBoundingClientRect().width-parseFloat(cs.borderLeftWidth)-parseFloat(cs.borderRightWidth);
    const need=Math.ceil(ctx.measureText(shown.text).width)+parseFloat(cs.paddingLeft)+20;
    if(need>boxWidth)out.push(`select ${sel.id||sel.name}: "${shown.text}" (needs ${need}px, box ${Math.floor(boxWidth)}px)`);
    continue;
   }
   if(ellipsised(el))continue;
   // The box is the nearest control or container that draws the edge (a button,
   // label, select, or anything with a border or horizontal padding). A plain
   // block span inside a button must not count as its own box, or it would
   // always fit its own text.
   const drawsEdge=e=>{
    if(['BUTTON','LABEL','SELECT','INPUT'].includes(e.tagName))return true;
    const s=getComputedStyle(e);
    return parseFloat(s.borderLeftWidth)>0||parseFloat(s.borderRightWidth)>0||parseFloat(s.paddingLeft)>0||parseFloat(s.paddingRight)>0;
   };
   let box=el;
   while(box!==panel&&!drawsEdge(box))box=box.parentElement;
   const cs=getComputedStyle(box);
   const r=document.createRange();
   r.selectNodeContents(node);
   const text=r.getBoundingClientRect();
   const bb=box.getBoundingClientRect();
   const left=bb.left+parseFloat(cs.borderLeftWidth)+parseFloat(cs.paddingLeft);
   const right=bb.right-parseFloat(cs.borderRightWidth)-parseFloat(cs.paddingRight);
   if(text.left<left-0.5||text.right>right+0.5)out.push(`"${t}" (${Math.ceil(text.width)}px text, ${Math.floor(right-left)}px box)`);
  }
 }
 return out;
}

for(const lang of ['en','es']){
 test(`Properties text fits its box in ${lang} at 1440px`,async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await drawAndSelect(page,lang);
  const broken=await page.evaluate(measurePanelText);
  expect(broken,`Properties text wider than its box in ${lang}`).toEqual([]);
 });
}
