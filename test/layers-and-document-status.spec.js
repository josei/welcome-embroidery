import {test,expect} from '@playwright/test';

// The Layers heading, the lettering layer's name while it is typed, and the Document panel while a compile is pending.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEmptyEditor(page,width,height,lang){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:1280,height:800});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.locator('#new').click();
 if(await page.locator('#discardDialog[open]').count()) await page.locator('#discardDiscard').click();
 await expect(page.locator('.object-row'),'the design starts empty').toHaveCount(0);
 await page.setViewportSize({width,height});
 return errors;
}

const rowNames=page=>page.locator('.object-row').allTextContents();

test('Spanish lettering layer never reads "Texto: Texto" while "Hola" is typed (1440x900)',async({page})=>{
 const errors=await openEmptyEditor(page,1440,900,'es');
 await page.locator('.tool-rail #letter').click();
 await expect(page.locator('#canvasText'),'text box opens').toBeVisible();
 const seen=[...(await rowNames(page))];
 for(const ch of 'Hola'){
  await page.keyboard.type(ch);
  seen.push(...(await rowNames(page)));
 }
 await page.keyboard.press('Enter');
 await expect(page.locator('.object-row'),'the lettering is added').toHaveCount(1);
 seen.push(...(await rowNames(page)));
 for(const name of seen) expect(name,'no doubled prefix in the layer name').not.toMatch(/Texto: Texto/);
 expect(errors).toEqual([]);
});

test('Spanish Layers heading is at most two lines tall on desktop (1440x900)',async({page})=>{
 const errors=await openEmptyEditor(page,1440,900,'es');
 for(let i=1;i<=7;i++){
  await page.locator('#rect').click();
  await expect(page.locator('.object-row'),'the shape is added').toHaveCount(i);
 }
 await expect(page.locator('.layers-head .layers-count')).toContainText('objetos');
 await expect(page.locator('.layers-head .layers-count')).toContainText('usado');
 // Count the lines the text actually occupies: the distinct tops of its text boxes.
 const lines=await page.locator('.layers-head .layers-count').evaluate(el=>{
  const range=document.createRange();
  range.selectNodeContents(el);
  return new Set([...range.getClientRects()].filter(r=>r.width>0&&r.height>0).map(r=>Math.round(r.top))).size;
 });
 expect(lines,'the header text fills at most two lines').toBeLessThanOrEqual(2);
 expect(errors).toEqual([]);
});

test('Spanish Layers header with a two-colour count keeps Properties inside the panel (1440x900)',async({page})=>{
 const errors=await openEmptyEditor(page,1440,900,'es');
 // A two-colour count is longer than the one-colour text the other test uses.
 await page.locator('.layers-head .layers-count').evaluate(el=>{
  el.innerHTML='7 objetos<br>8 colores usados';
 });
 const m=await page.evaluate(()=>{
  const head=document.querySelector('.layers-head');
  const panel=head.parentElement.getBoundingClientRect();
  const count=document.querySelector('.layers-head .layers-count');
  const range=document.createRange();
  range.selectNodeContents(count);
  const lines=new Set([...range.getClientRects()].filter(r=>r.width>0&&r.height>0).map(r=>Math.round(r.top))).size;
  const toggle=head.querySelector('.inspector-toggle');
  const toggleBox=toggle?toggle.getBoundingClientRect():null;
  return {
   headLines:lines,
   panelRight:panel.right,
   toggleRight:toggleBox&&toggleBox.width>0?toggleBox.right:null,
   countScroll:count.scrollWidth-count.clientWidth,
  };
 });
 expect(m.headLines,'the count fills at most two lines').toBeLessThanOrEqual(2);
 if(m.toggleRight!==null) expect(m.toggleRight,'Properties stays inside the Layers panel').toBeLessThanOrEqual(m.panelRight);
 expect(m.countScroll,'the count text is not clipped').toBeLessThanOrEqual(0);
 expect(errors).toEqual([]);
});

test('Document panel shows Compiling… after an undo, not the empty-design message (1440x900)',async({page})=>{
 const errors=await openEmptyEditor(page,1440,900,'en');
 await page.locator('#rect').click();
 await expect(page.locator('.object-row'),'the rectangle is added').toHaveCount(1);
 await expect(page.locator('#stats')).not.toContainText('No generated stitches.');
 // Record every state the two panels show from the undo on, not only the one a later read happens to catch.
 await page.evaluate(()=>{
  window.__panelStates=[];
  const record=()=>{
   const count=document.querySelector('#count')?.textContent??'';
   const stats=document.querySelector('#stats')?.textContent??'';
   window.__panelStates.push({count,stats});
  };
  new MutationObserver(record).observe(document.body,{subtree:true,childList:true,characterData:true});
  record();
 });
 await page.keyboard.press('Control+z');
 await expect(page.locator('.object-row'),'the undo removes the rectangle').toHaveCount(0);
 const states=await page.evaluate(()=>window.__panelStates);
 expect(states.some(p=>p.count.includes('Compiling')),'the status line showed Compiling…').toBe(true);
 for(const p of states){
  if(p.count.includes('Compiling')) expect(p.stats,'the Document panel does not say no stitches while compiling').not.toContain('No generated stitches.');
 }
 expect(errors).toEqual([]);
});

test('Document panel shows the compile error, not Compiling…, when a compile fails (1440x900)',async({page})=>{
 // Make the stitch worker's compile replies fail, so the editor is left with an error and no plan.
 await page.addInitScript(()=>{
  const post=Worker.prototype.postMessage;
  Worker.prototype.postMessage=function(data,transfer){
   if(window.__failCompile&&data&&data.type==='compile'){
    const worker=this;
    setTimeout(()=>worker.onmessage?.({data:{id:data.id,generation:data.generation,ok:false,error:'Forced compile failure'}}),0);
    return;
   }
   return post.call(this,data,transfer);
  };
 });
 const errors=await openEmptyEditor(page,1440,900,'en');
 await page.evaluate(()=>{window.__failCompile=true;});
 await page.locator('#rect').click();
 await expect(page.locator('.object-row'),'the rectangle is added').toHaveCount(1);
 await expect(page.locator('#count'),'the status line shows the compile error').toContainText('Forced compile failure');
 await expect(page.locator('#stats'),'the Document panel shows the same error').toContainText('Forced compile failure');
 await expect(page.locator('#stats')).not.toContainText('Compiling…');
 expect(errors).toEqual([]);
});
