import {test,expect} from '@playwright/test';

// Issue #208 (from audit #162, finding 9): at narrow widths the top bar stays on one row with its controls whole, and every
// panel header lines up with the body it heads, at 1920, 1024 and 760px.
const newDesign=async page=>{await page.locator('#new').click();if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();};

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

for(const width of [1920,1024,760]){
 test(`panel headers line up with their bodies at ${width}px`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.setViewportSize({width,height:900});
  await page.goto('/');await newDesign(page);await page.locator('#rect').click();
  // A header and the body it heads share the same left and right edges, so their padding lines up. Edges are compared rather
  // than padding values, because a heading may take its inset from its panel instead of from itself.
  const edges=loc=>loc.evaluate(e=>{const r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.right)];});
  const expectAligned=async(head,body,name)=>{
   await expect(head,`${name} is visible`).toBeVisible();
   expect(await edges(head),`${name} left and right edges`).toEqual(await edges(body));
  };
  // The object list heading and the list below it.
  await expectAligned(page.locator('.layers-head'),page.locator('#objects'),`layers head at ${width}px`);
  // The inspector: its heading and the Sewing order fold line up with the inspector's body text.
  await expectAligned(page.locator('#selected'),page.locator('#stats'),`inspector heading at ${width}px`);
  await expectAligned(page.locator('#secOrder > summary'),page.locator('#stats'),`sewing order header at ${width}px`);
  expect(errors).toEqual([]);
 });
}

test('the top bar stays on one row at 760px and the title gives way first',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:760,height:900});
 await page.goto('/');await newDesign(page);
 // A long name and an unsaved design: the title is the element that gives way, and the unsaved marker stays visible.
 await page.locator('header.top #name').fill('A very long embroidery design name that keeps going');
 await page.locator('header.top #name').press('Enter');
 await page.locator('header.top #name').blur();
 const bar=page.locator('header.top');
 const info=await bar.evaluate(top=>{
  // The visually hidden page title (sr-only) is not part of the visible row.
  const kids=[...top.children].filter(e=>!e.classList.contains('sr-only')&&e.getBoundingClientRect().width>0);
  return {tops:kids.map(e=>e.getBoundingClientRect().top),height:top.getBoundingClientRect().height,overflow:top.scrollWidth-top.clientWidth};
 });
 // One row: every visible child sits on the same line (a wrapped row would sit lower).
 for(const t of info.tops) expect(Math.abs(t-info.tops[0]),'child top within the bar row').toBeLessThan(12);
 expect(info.height,'bar height is one row').toBeLessThanOrEqual(58);
 expect(info.overflow,'no horizontal overflow').toBeLessThanOrEqual(0);
 // The title is the element that gives way, and it shows an ellipsis rather than clipping the text.
 const title=await page.locator('header.top #name').evaluate(e=>getComputedStyle(e).textOverflow);
 expect(title,'title text-overflow').toBe('ellipsis');
 // The shown title (drawn while the field is not focused) ends in an ellipsis: its text is clipped, not cut mid-word.
 const shownTitle=await page.locator('header.top .name-field').evaluate(e=>{const a=getComputedStyle(e,'::after');return {content:a.content,overflow:a.textOverflow,clipped:a.overflow==='hidden'};});
 expect(shownTitle.overflow,'shown title ellipsis').toBe('ellipsis');
 expect(shownTitle.content,'shown title carries the name').toContain('A very long embroidery');
 const titleBox=await page.locator('header.top #name').boundingBox();
 expect(titleBox.width,'title keeps a usable width').toBeGreaterThanOrEqual(60);
 expect(await page.locator('header.top #name').evaluate(e=>e.scrollWidth>e.clientWidth),'long title is truncated').toBe(true);
 expect(await page.locator('#unsavedMark').evaluate(e=>e.getBoundingClientRect().width),'unsaved marker is shown').toBeGreaterThan(0);
 // The controls stay whole: Undo and Redo are visible and inside the window.
 for(const id of ['#undo','#redo']){
  const box=await page.locator(id).boundingBox();expect(box,id).not.toBeNull();
  expect(box.x+box.width,`${id} inside the window`).toBeLessThanOrEqual(760);
 }
 expect(errors).toEqual([]);
});

// Issue #238 (from audit #167 finding 4): a drag that starts on the canvas or a ruler, from any edge, does not select the page text
// around it (the zoom bar and the status line). The drag still runs on the canvas, so the marquee is not the thing being tested.
test('a drag from any canvas or ruler edge does not select page text',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/');
 const c=await page.locator('main .canvas').boundingBox();
 const target=await page.locator('#cursorPosition').boundingBox();
 // Starts: the corner beside the rulers, the top and left rulers, and the top, right and bottom edges of the canvas.
 const starts=[[c.x+4,c.y+4],[c.x+60,c.y+6],[c.x+6,c.y+60],[c.x+c.width-4,c.y+4],[c.x+c.width-4,c.y+c.height/2],[c.x+c.width/2,c.y+c.height-4]];
 for(const [x,y] of starts){
  await page.evaluate(()=>getSelection().removeAllRanges());
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(target.x+20,target.y+target.height/2,{steps:12});await page.mouse.up();
  const selected=await page.evaluate(()=>getSelection().toString());
  expect(selected,`page text selected by a drag from ${Math.round(x)},${Math.round(y)}`).toBe('');
 }
 expect(errors).toEqual([]);
});

// Issue #238 (from audit #167 finding 3 and audit #277 finding 7): with a 100-object design at 1440x900, the status bar's readouts
// do not overlap one another or the simulation summary, in the stitch view and the 3D view, in English and Spanish.
test('status bar readouts do not overlap at 1440x900 with 100 objects, in stitch and 3D views',async({page})=>{
 test.setTimeout(120000);
 const {initialDocument,applyOperations}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=400;doc.name='Probe';doc.revision=1;const cols=10,step=16,ops=[];
 for(let i=0;i<100;i++){const c=i%cols,r=Math.floor(i/cols);ops.push({op:'add_shape',id:`s${i}`,kind:'rect',x:-(cols*step)/2+c*step,y:-(cols*step)/2+r*step,width:12,height:12,thread:`#${((i*2654435761)>>>0).toString(16).slice(0,6).padStart(6,'0')}`,stitch:i%3?'fill':'run'});}
 applyOperations(doc,ops);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 for(const lang of ['en','es']){
  await page.goto(`/?lang=${lang}`);
  await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
  await page.reload();
  await page.locator('#restoreYes').click();await expect(page.locator('.object-row')).toHaveCount(100);
  for(const view of ['stitches','preview']){
   await page.locator(`button[data-view="${view}"]`).click();await expect(page.locator('#play')).toBeVisible();
   await page.waitForTimeout(300);
   // Every readout's box, and the simulation's time, stitch count and summary, must not overlap another visible box.
   const boxes=await page.evaluate(()=>{
    const ids=['cursorPosition','count','messagesBtn','playbackProgress','needlePosition','playbackTime','playbackSummary'];
    return ids.map(id=>document.getElementById(id)).filter(e=>e&&!e.hidden&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0)
     .map(e=>({id:e.id,...e.getBoundingClientRect().toJSON()}));
   });
   expect(boxes.length,`readouts shown in ${view} ${lang}`).toBeGreaterThanOrEqual(5);
   for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i],b=boxes[j];
    const overlap=a.left<b.right-0.5&&b.left<a.right-0.5&&a.top<b.bottom-0.5&&b.top<a.bottom-0.5;
    expect(overlap,`${a.id} and ${b.id} overlap in ${view} ${lang}`).toBe(false);
   }
  }
 }
 expect(errors).toEqual([]);
});

// Issue #319: with an object selected, an inspector field is reachable without scrolling the page past the canvas. At 1024x700 the
// inspector is a column beside the canvas (the page does not scroll); at 1440x900 it stays the desktop column.
for(const [width,height] of [[1024,700],[1440,900]]){
 test(`an inspector field is in view without page scroll at ${width}x${height}`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.setViewportSize({width,height});
  await page.goto('/');await newDesign(page);await page.locator('#rect').click();
  const field=page.locator('#inspector input:not([type=checkbox]):visible').first();
  await expect(field).toBeVisible();
  const box=await field.boundingBox();
  expect(box.y+box.height,'inspector field bottom inside the viewport').toBeLessThanOrEqual(height);
  expect(box.y,'inspector field top inside the viewport').toBeGreaterThanOrEqual(0);
  expect(await page.evaluate(()=>document.scrollingElement.scrollTop),'page scroll').toBe(0);
  // The page itself does not move when the user scrolls over the canvas (the inspector's own column scrolls, not the page).
  await page.locator('main .canvas').hover();await page.mouse.wheel(0,400);await page.waitForTimeout(150);
  expect(await page.evaluate(()=>scrollY),'page scrollY after wheel').toBe(0);
  // Every visible inspector control sits inside the window (no clipping at the right edge), and the page does not overflow sideways.
  const outside=await page.evaluate((w)=>{
   const bad=[];
   for(const el of document.querySelectorAll('#inspector input,#inspector select,#inspector button,#inspector label')){
    const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden'||el.closest('[hidden]'))continue;
    const r=el.getBoundingClientRect();if(r.width===0&&r.height===0)continue;
    if(r.right>w+0.5||r.left<-0.5)bad.push(`${el.id||el.tagName}:${Math.round(r.left)}-${Math.round(r.right)}`);
   }
   return {bad,docWidth:document.documentElement.scrollWidth};
  },width);
  expect(outside.bad,'inspector controls outside the window').toEqual([]);
  expect(outside.docWidth,'document width').toBeLessThanOrEqual(width);
  // The canvas stays visible beside the inspector.
  const canvas=await page.locator('main .canvas').boundingBox();
  expect(canvas.width,'canvas width').toBeGreaterThan(300);
  expect(errors).toEqual([]);
 });
}

// Issue #437: on a phone (375 and 390px, portrait, touch) the page fits the window in English and Spanish, the top bar stays on one row,
// and the Delete and Export controls are inside the window and clickable.
for(const width of [375,390]) for(const lang of ['en','es']){
 test(`the phone top bar fits on one row at ${width}px in ${lang}`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.setViewportSize({width,height:667});
  // New is not on the bar at phone widths (it is in the File menu), so the page is used as it opens.
  await page.goto(`/?lang=${lang}`);await page.locator('#rect').click();
  // No horizontal overflow: the document is exactly as wide as the window.
  expect(await page.evaluate(()=>document.documentElement.scrollWidth),'document width').toBe(width);
  const bar=page.locator('header.top');
  const info=await bar.evaluate(top=>{
   const kids=[...top.children].filter(e=>!e.classList.contains('sr-only')&&e.getBoundingClientRect().width>0);
   return {tops:kids.map(e=>e.getBoundingClientRect().top),height:top.getBoundingClientRect().height,overflow:top.scrollWidth-top.clientWidth};
  });
  // One row, no taller than the single-row bar at 760px (58px), and nothing scrolls sideways inside the bar.
  for(const t of info.tops) expect(Math.abs(t-info.tops[0]),'child top within the bar row').toBeLessThan(12);
  expect(info.height,'bar height is one row').toBeLessThanOrEqual(58);
  expect(info.overflow,'no horizontal overflow in the bar').toBeLessThanOrEqual(0);
  // Delete and Export are inside the window and are the element at their own centre (nothing covers them).
  for(const id of ['#remove','#export']){
   const box=await page.locator(id).boundingBox();expect(box,id).not.toBeNull();
   expect(box.x,`${id} left edge inside the window`).toBeGreaterThanOrEqual(0);
   expect(box.x+box.width,`${id} right edge inside the window`).toBeLessThanOrEqual(width);
   const hit=await page.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return !!e&&!!e.closest('#remove,#export');},[box.x+box.width/2,box.y+box.height/2]);
   expect(hit,`${id} is clickable at its centre`).toBe(true);
  }
  expect(errors).toEqual([]);
 });
}

// Issue #438 (from #430): at 1024x768 no two inspector controls sit on top of each other, in English or Spanish. Closed sections
// (Document stitch settings, Thread plan) take no room, so the controls below them are not pushed onto their hidden boxes.
const boxIn=(page,sel)=>page.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const sc=document.getElementById('inspector');const b=sc.getBoundingClientRect();const r=e.getBoundingClientRect();if(!r.width||!r.height)return null;return {l:r.left,t:r.top-b.top+sc.scrollTop,r:r.right,b:r.bottom-b.top+sc.scrollTop};},sel);
const meets=(a,b)=>a.l<b.r&&b.l<a.r&&a.t<b.b&&b.t<a.b;
for(const lang of ['en','es']){
 test(`inspector controls do not overlap at 1024x768 (${lang})`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.setViewportSize({width:1024,height:768});
  await page.goto(`/?lang=${lang}`);await newDesign(page);
  // Nothing selected: the document settings (trims, underlay, pull compensation) sit beside the default stitch fields. With the
  // sections open as a worst case, and with two rectangles selected, the thread plan's Replace control must not sit on Fabric.
  const pairs=[['#trims','#spacing'],['#underlay','#angle'],['#comp','#stitchLength']];
  // A closed section draws none of its controls, so its control has no box to overlap; the field below it must still be drawn.
  const checkClosed=async()=>{
   for(const [x,y] of pairs){
    expect(await boxIn(page,x),`${x} is not drawn while its section is closed`).toBeNull();
    expect(await boxIn(page,y),`${y} is shown`).not.toBeNull();
   }
  };
  const check=async(label)=>{
   for(const [x,y] of pairs){
    const a=await boxIn(page,x),b=await boxIn(page,y);
    expect(a,`${x} is shown (${label})`).not.toBeNull();expect(b,`${y} is shown (${label})`).not.toBeNull();
    expect(meets(a,b),`${x} and ${y} overlap (${label})`).toBe(false);
   }
  };
  await checkClosed();
  await page.evaluate(()=>document.querySelectorAll('#inspector details').forEach(d=>d.open=true));
  await check('nothing selected, sections open');
  for(const [a,b,c,d] of [[400,300,600,450],[250,500,380,600]]){await page.locator('#rect').click();await page.mouse.move(a,b);await page.mouse.down();await page.mouse.move(c,d,{steps:5});await page.mouse.up();}
  await expect(page.locator('.plan-replace').first()).toHaveCount(1);
  await page.evaluate(()=>{document.getElementById('secPlan').open=true;});
  const replace=await boxIn(page,'.plan-replace'),fabric=await boxIn(page,'#fabric');
  expect(replace,'Replace this thread is shown').not.toBeNull();expect(fabric,'Fabric is shown').not.toBeNull();
  expect(meets(replace,fabric),'Replace this thread and Fabric overlap').toBe(false);
  // The controls the user reaches for are shown.
  for(const sel of ['#spacing','#angle','#stitchLength','#fabric']) await expect(page.locator(sel),sel).toBeVisible();
  expect(errors).toEqual([]);
 });
}
// Issue #440: on a landscape phone (667x375 and 844x390, touch) the page fits the window in English and Spanish, the top bar stays on one
// row, and the tool column is icons only. Each tool keeps its accessible name, so a screen reader still announces it.
test.describe('landscape phone',()=>{
test.use({isMobile:true,hasTouch:true});
for(const [width,height] of [[667,375],[844,390]]) for(const lang of ['en','es']){
 test(`the landscape phone fits and the top bar is one row at ${width}x${height} in ${lang}`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.setViewportSize({width,height});
  await page.goto(`/?lang=${lang}`);await page.locator('#rect').click();
  // No horizontal overflow: the document is exactly as wide as the window.
  expect(await page.evaluate(()=>document.documentElement.scrollWidth),'document width').toBe(width);
  const info=await page.locator('header.top').evaluate(top=>{
   const kids=[...top.children].filter(e=>!e.classList.contains('sr-only')&&e.getBoundingClientRect().width>0);
   return {tops:kids.map(e=>e.getBoundingClientRect().top),height:top.getBoundingClientRect().height,overflow:top.scrollWidth-top.clientWidth};
  });
  // One row, no taller than the single-row bar at 760px (58px).
  for(const t of info.tops) expect(Math.abs(t-info.tops[0]),'child top within the bar row').toBeLessThan(12);
  expect(info.height,'bar height is one row').toBeLessThanOrEqual(58);
  expect(info.overflow,'no horizontal overflow in the bar').toBeLessThanOrEqual(0);
  // Icons only: no visible text in the tool rail or the canvas tool bar. The grid chip's "mm" text is clipped to 1px, and its name is kept.
  const tools=await page.evaluate(()=>{
   const out=[];
   for(const b of document.querySelectorAll('.canvas .tool-rail button, .canvas .floating button')){
    if(!b.getBoundingClientRect().width)continue;
    const label=b.querySelector('.grid-label');
    const text=label?(label.getBoundingClientRect().width>1?label.textContent:''):b.innerText.trim();
    out.push({id:b.id||b.getAttribute('aria-label'),text,name:b.getAttribute('aria-label')||b.textContent.trim()});
   }
   return out;
  });
  expect(tools.length,'tool buttons shown').toBeGreaterThan(10);
  for(const t of tools){
   expect(t.text,`${t.id} shows no visible text`).toBe('');
   expect(t.name,`${t.id} keeps an accessible name`).not.toBe('');
  }
  expect(errors).toEqual([]);
 });
}
});
