import {test,expect} from '@playwright/test';

// The Properties panel draws the blend's From and To fields side by side, each with its label above the field. A label that shared
// the left column with its field would run over the field, so the geometry is checked directly, in both UI languages.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// Geometry of both fields, their label text, and every input in the blend range.
const measureBlend=()=>{
 // The text of a label, without the input that follows it.
 const labelTextBox=label=>{
  const node=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
  const range=document.createRange();
  range.selectNodeContents(node);
  const r=range.getBoundingClientRect();
  return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
 };
 const fieldBox=el=>{
  const r=el.getBoundingClientRect();
  return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
 };
 const out={columns:[],inputs:[],labels:[]};
 const columns=getComputedStyle(document.getElementById('blendRange')).gridTemplateColumns.split(' ').map(parseFloat);
 const box=document.getElementById('blendRange').getBoundingClientRect();
 let x=box.left;
 for(const w of columns){out.columns.push({left:x,right:x+w});x+=w+8;}
 for(const id of ['blendStart','blendEnd']){
  const input=document.getElementById(id);
  const label=input.closest('label');
  out.labels.push({id,text:labelTextBox(label),label:fieldBox(label)});
  out.inputs.push({id,...fieldBox(input)});
 }
 for(const input of document.querySelectorAll('#blendRange input'))out.inputs.push({id:input.id||'(input)',...fieldBox(input)});
 // A standard single-value row elsewhere in the inspector: the label and field the new row must match.
 const candidate=['spacing','stitchLength','angle'].map(id=>document.getElementById(id)?.closest('label')).find(l=>l&&l.offsetParent)||
  [...document.querySelectorAll('#inspector label:not(.block)')].find(l=>
   !l.closest('#blendRange,#blendPaletteRow,.corner-radii,.xywh,.underlay-details')&&l.offsetParent&&l.querySelector(':scope>input, :scope>select'));
 if(candidate){
  const cLabel=getComputedStyle(candidate),cField=getComputedStyle(candidate.querySelector(':scope>input, :scope>select'));
  out.reference={
   label:{fontSize:cLabel.fontSize,fontFamily:cLabel.fontFamily,fontWeight:cLabel.fontWeight,padding:cLabel.padding,color:cLabel.color},
   field:{fontSize:cField.fontSize,fontFamily:cField.fontFamily,padding:cField.padding,borderRadius:cField.borderRadius},
  };
 }
 const startLabel=getComputedStyle(document.getElementById('blendStart').closest('label'));
 const startField=getComputedStyle(document.getElementById('blendStart'));
 out.blend={
  label:{fontSize:startLabel.fontSize,fontFamily:startLabel.fontFamily,fontWeight:startLabel.fontWeight,padding:startLabel.padding,color:startLabel.color},
  field:{fontSize:startField.fontSize,fontFamily:startField.fontFamily,padding:startField.padding,borderRadius:startField.borderRadius},
 };
 return out;
};

// Adds one rectangle, which the editor leaves selected, so Properties has an object to show.
async function addRectangle(page){
 if(await page.locator('#restoreDialog[open]').count())await page.locator('#restoreNo').click();
 if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
 await expect(page.locator('.canvas')).toBeVisible();
 await page.locator('#rect').click();
 await expect(page.locator('.object-row.selected')).toHaveCount(1);
}

// Brings the Properties inspector on screen: always visible beside the canvas on desktop and tablet portrait, a tab on a tablet, and a
// sheet opened from the Menu (portrait phone) or the Properties button (landscape phone).
async function openProperties(page){
 if(await page.locator('.inspector-tab[data-tab=properties]').isVisible()){
  await page.locator('.inspector-tab[data-tab=properties]').click();
 }else if(await page.locator('#phoneMenu').isVisible()){
  await page.locator('#phoneMenu').click();
  await page.locator('#menuProperties').click();
  await expect(page.locator('#inspector.sheet-open')).toBeVisible();
 }else if(await page.locator('#propertiesBtn').isVisible()){
  await page.locator('#propertiesBtn').click();
  await expect(page.locator('#inspector.sheet-open')).toBeVisible();
 }
}

// Picks a second thread, which is what makes the blend range appear, then waits for its fields.
async function showBlendRange(page){
 await addRectangle(page);
 await openProperties(page);
 await page.locator('#blendThread').selectOption('#527461');
 await expect(page.locator('#blendRange')).toBeVisible();
 await expect(page.locator('#blendStart')).toBeVisible();
}

for(const lang of ['en','es']){
 test(`blend From and To labels sit above their own fields at 1440x900 (${lang})`,async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto(`/?lang=${lang}`);
  await showBlendRange(page);
  const m=await page.evaluate(measureBlend);
  expect(m.columns.length,'blend range columns').toBe(2);
  for(const [k,label] of m.labels.entries()){
   const own=m.inputs[k];
   // The text sits above its own field, not on it.
   expect(label.text.bottom,`${label.id}: label text above its field`).toBeLessThanOrEqual(own.top+0.5);
   const overlaps=(a,b)=>a.left<b.right-0.5&&a.right>b.left+0.5&&a.top<b.bottom-0.5&&a.bottom>b.top+0.5;
   for(const input of m.inputs)expect(overlaps(label.text,input),`${label.id}: label text clear of ${input.id}`).toBe(false);
   // The text stays inside the label's column.
   const column=m.columns[k];
   expect(label.text.left,`${label.id}: text starts inside its column`).toBeGreaterThanOrEqual(column.left-0.5);
   expect(label.text.right,`${label.id}: text ends inside its column`).toBeLessThanOrEqual(column.right+0.5);
   // And so does the field.
   expect(own.left,`${label.id}: field starts inside its column`).toBeGreaterThanOrEqual(column.left-0.5);
   expect(own.right,`${label.id}: field ends inside its column`).toBeLessThanOrEqual(column.right+0.5);
  }
  expect(m.reference,`${lang}: a standard Properties row to compare with`).not.toBeNull();
  expect(m.blend,`${lang}: label and field styles match the other rows`).toEqual(m.reference);
 });
}

// Phone and tablet show the blend fields in a sheet, a docked inspector or a tab; the fields there are touch targets like the rest.
const SIZES=[[390,844],[844,390],[768,1024]];
for(const [w,h] of SIZES){
 test(`blend range fields are at least 44 px tall at ${w}x${h}`,async({page})=>{
  await page.setViewportSize({width:w,height:h});
  await page.goto('/?lang=en');
  await showBlendRange(page);
  const heights=await page.locator('#blendRange input').evaluateAll(ins=>ins.filter(i=>i.offsetParent).map(i=>({id:i.id,h:i.getBoundingClientRect().height})));
  expect(heights.length,`${w}x${h}: blend fields shown`).toBe(3);
  const small=heights.filter(f=>f.h<44);
  expect(small,`${w}x${h}: blend fields under 44 px tall`).toEqual([]);
 });
}
