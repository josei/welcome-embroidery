import {test,expect} from '@playwright/test';

// The phone top bar is one row of 44 px controls: Menu, Undo, Redo, the design name, the issues button when the design has
// issues, and Export. The design name field is one 44 px control with two lines inside it: the name with its save mark, and
// under them the stitch count. The count and the save mark are indicators, drawn inside the name field; the issues button is a
// top-bar icon button like Undo. Checked at 320x640, 360x640, 390x844 and 844x390, in Spanish and English, with no issues,
// with issues, while the design compiles, and while the name is being typed.

const SIZES=[[320,640],[360,640],[390,844],[844,390]];
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// Restores a design with `outside` squares past a 400 mm hoop (none: one square inside it), from the autosave the editor offers back.
async function openDesign(page,lang,outside){
 const {initialDocument,applyOperations}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=400;doc.name=lang==='es'?'Diseño sin título':'Untitled design';doc.revision=1;
 const xs=outside?Array.from({length:outside},(_,i)=>300+i*25):[0];
 applyOperations(doc,xs.map((x,i)=>({op:'add_shape',id:'s'+i,kind:'rect',x,y:0,width:20,height:15.1,thread:'#cc3333',stitch:'fill'})));
 await page.goto(`/?lang=${lang}`);
 await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
 await page.goto(`/?lang=${lang}`);
 await page.locator('#restoreYes').click();
 await expect(page.locator('.object-row')).toHaveCount(xs.length);
}

// Every visible control in the top bar, with its box and the drawn style the bar's buttons share.
const barControls=page=>page.locator('header.top').evaluate(top=>{
 const bar=top.getBoundingClientRect();
 const out=[];
 for(const e of top.querySelectorAll('button,input,[role=button]')){
  const r=e.getBoundingClientRect(),s=getComputedStyle(e);
  if(r.width<1||r.height<1||s.display==='none'||s.visibility==='hidden'||e.closest('[hidden]'))continue;
  out.push({id:e.id||e.className,x:r.x,y:r.y,w:r.width,h:r.height,cy:r.y+r.height/2,radius:s.borderTopLeftRadius});
 }
 return {bar:{top:bar.top,bottom:bar.bottom,left:bar.left,right:bar.right},out};
});

async function checkBar(page,where){
 const {bar,out}=await barControls(page);
 const ids=out.map(c=>c.id);
 for(const id of ['phoneMenu','undo','redo','name','export']) expect(ids,`${where}: ${id} is in the bar`).toContain(id);
 for(const c of out){
  // The shared 44 px touch size, with no exception for the name or the issues button.
  expect(c.w,`${where}: ${c.id} is 44 px wide or more`).toBeGreaterThanOrEqual(44);
  expect(Math.round(c.h),`${where}: ${c.id} is 44 px tall`).toBe(44);
  // Inside the bar: nothing pokes out of its top or bottom edge, or off the screen.
  expect(c.y,`${where}: ${c.id} top inside the bar`).toBeGreaterThanOrEqual(bar.top-0.01);
  expect(c.y+c.h,`${where}: ${c.id} bottom inside the bar`).toBeLessThanOrEqual(bar.bottom+0.01);
  expect(c.x+c.w,`${where}: ${c.id} inside the screen`).toBeLessThanOrEqual(bar.right+0.01);
 }
 // One row: every control is centred on the same line.
 const cys=out.map(c=>c.cy);
 expect(Math.max(...cys)-Math.min(...cys),`${where}: one row of controls`).toBeLessThanOrEqual(1);
 // No two controls overlap.
 const sorted=[...out].sort((a,b)=>a.x-b.x);
 for(let i=1;i<sorted.length;i++) expect(sorted[i].x,`${where}: ${sorted[i].id} clear of ${sorted[i-1].id}`).toBeGreaterThanOrEqual(sorted[i-1].x+sorted[i-1].w-0.5);
 // The issues button, when shown, is drawn as Undo is: same size and radius.
 const undo=out.find(c=>c.id==='undo'),issues=out.find(c=>c.id==='issuesBtn'||String(c.id).includes('issues'));
 if(issues){expect(issues.w).toBe(undo.w);expect(issues.h).toBe(undo.h);expect(issues.radius).toBe(undo.radius);}
}

// The stitch count is an indicator inside the name field, under the name, painted on top of the input and not clipped.
async function checkStatusLine(page,where){
 const r=await page.evaluate(()=>{
  const box=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
  const count=document.querySelector('#count');
  const line=count.closest('.top-status');
  // The line passes taps through to the input; turn that off for a moment to see what is painted on top at its centre.
  const was=line.style.pointerEvents;line.style.pointerEvents='auto';
  const c=count.getBoundingClientRect();
  const hit=c.width>0?document.elementFromPoint(c.x+c.width/2,c.y+c.height/2):null;
  line.style.pointerEvents=was;
  return {name:box('#name'),count:box('#count'),mark:box('.top .save-status'),onTop:!!hit&&(hit===count||count.contains(hit)||line.contains(hit)),
   clipped:count.scrollWidth>count.clientWidth+1,inside:!!document.querySelector('#name')?.parentElement?.contains(count)};
 });
 expect(r.inside,`${where}: the count is inside the name field`).toBe(true);
 expect(r.count.w,`${where}: the count is drawn`).toBeGreaterThan(0);
 expect(r.onTop,`${where}: nothing paints over the count`).toBe(true);
 expect(r.clipped,`${where}: the count is not clipped`).toBe(false);
 expect(r.count.y,`${where}: the count is inside the name field's box`).toBeGreaterThanOrEqual(r.name.y-0.5);
 expect(r.count.y+r.count.h,`${where}: the count is inside the name field's box`).toBeLessThanOrEqual(r.name.y+r.name.h+0.5);
 expect(r.count.y,`${where}: the count is under the save mark, on its own line`).toBeGreaterThanOrEqual(r.mark.y+r.mark.h-2);
}

for(const lang of ['es','en']) for(const [w,h] of SIZES){
 test(`${w}x${h} ${lang}: the top bar is one row of 44 px controls with the count inside the name field`,async({page})=>{
  page.on('dialog',d=>d.accept());
  await page.setViewportSize({width:w,height:h});
  await openDesign(page,lang,0);
  await expect(page.locator('#count .figure')).toHaveAttribute('aria-label',/\d/);
  await checkBar(page,'no issues');
  await checkStatusLine(page,'no issues');
  await expect(page.locator('#issuesBtn')).toBeHidden();

  // While the design compiles the count keeps its place and the bar keeps its shape.
  await page.locator('#rect:visible').first().click();
  await checkBar(page,'compiling');

  // With issues: the issues button joins the row and opens Messages.
  await page.evaluate(()=>localStorage.clear());
  await openDesign(page,lang,3);
  await expect(page.locator('#issuesBtn')).toBeVisible();
  await expect(page.locator('#issuesBtn')).toHaveText('3');
  await expect(page.locator('#issuesBtn')).toHaveAttribute('aria-label',/\S/);
  await expect(page.locator('#issuesBtn')).toHaveAttribute('title',/\S/);
  await checkBar(page,'issues');
  await checkStatusLine(page,'issues');

  // A tap on the count renames: it lands on the name field.
  const c=await page.locator('#count').boundingBox();
  await page.mouse.click(c.x+c.width/2,c.y+c.height/2);
  await expect(page.locator('#name')).toBeFocused();
  await checkBar(page,'renaming');
 });
}
