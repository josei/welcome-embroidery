import {test,expect} from '@playwright/test';

// Each control on the phone selection bar shows a word under or beside its glyph, so a first-time Spanish user can read it
// without hovering. The word is measured over its text, and must sit inside its button and the bar, on one line, unclipped.
// Each control keeps its full name in aria-label and title.

const SIZES=[[360,640],[390,844],[844,390]];
const LANGS=['en','es'];
const CONTROLS=['selectToggle','barDuplicate','barDelete','barProperties'];
const WORDS={
 en:{selectToggle:'Several',barDuplicate:'Duplicate',barDelete:'Delete',barProperties:'Properties'},
 es:{selectToggle:'Varios',barDuplicate:'Duplicar',barDelete:'Eliminar',barProperties:'Propiedades'},
};
const FULL={
 en:{selectToggle:'Tap objects to add them to the selection',barDuplicate:'Duplicate selected object',barDelete:'Delete selected object',barProperties:'Properties'},
 es:{selectToggle:'Toca objetos para añadirlos a la selección',barDuplicate:'Duplicar el objeto seleccionado',barDelete:'Eliminar el objeto seleccionado',barProperties:'Propiedades'},
};

test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

for(const [width,height] of SIZES){
 for(const lang of LANGS){
  test(`the selection bar words fit and read in ${lang} at ${width}x${height}`,async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept().catch(()=>{}));
   await page.setViewportSize({width,height});
   await page.goto(lang==='en'?'/':`/?lang=${lang}`);
   await page.locator('#rect').tap();
   const bar=page.locator('.phone-selection');
   await expect(bar).toBeVisible();

   const barBox=await bar.boundingBox();
   const viewport=page.viewportSize();
   expect(barBox.x>=0 && barBox.x+barBox.width<=viewport.width,'the bar stays inside the viewport across').toBe(true);
   expect(barBox.y>=0 && barBox.y+barBox.height<=viewport.height,'the bar stays inside the viewport down').toBe(true);
   expect(await bar.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'the bar does not overflow').toBe(true);
   if(lang==='es' && width===360){
    expect(viewport.width-barBox.width,'at 360 px es the bar keeps at least 40 px spare').toBeGreaterThanOrEqual(40);
   }

   const metrics=[];
   for(const id of CONTROLS){
    const button=page.locator(`#${id}`);
    const word=button.locator('.bar-word');
    await expect(button,`${id} is shown`).toBeVisible();
    await expect(word,`${id} shows its word`).toBeVisible();
    await expect(word).toHaveText(WORDS[lang][id]);
    await expect(button).toHaveAttribute('aria-label',FULL[lang][id]);
    await expect(button).toHaveAttribute('title',FULL[lang][id]);

    const buttonBox=await button.boundingBox();
    expect(buttonBox.width,`${id} is at least 44 px wide`).toBeGreaterThanOrEqual(44);
    expect(buttonBox.height,`${id} is at least 44 px tall`).toBeGreaterThanOrEqual(44);

    // The text box is measured over the text itself, not the span, which can be wider than its words.
    const m=await word.evaluate(el=>{
     const range=document.createRange();range.selectNodeContents(el);
     const r=range.getBoundingClientRect();
     const cs=getComputedStyle(el);
     const rects=[...range.getClientRects()];
     const pt={x:r.left+r.width/2,y:r.top+r.height/2};
     const hit=document.elementFromPoint(pt.x,pt.y);
     return {
      left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,
      lines:rects.length?new Set(rects.map(q=>Math.round(q.top))).size:0,
      fontSize:cs.fontSize,
      scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,
      hitInside:!!hit&&(hit===el||el.contains(hit)||hit.closest('button')===el.closest('button')),
     };
    });
    const bb=await bar.boundingBox();
    expect(m.left>=buttonBox.x-0.5 && m.right<=buttonBox.x+buttonBox.width+0.5,`${id} word lies inside its button`).toBe(true);
    expect(m.left>=bb.x-0.5 && m.right<=bb.x+bb.width+0.5,`${id} word lies inside the bar`).toBe(true);
    expect(m.top>=buttonBox.y-0.5 && m.bottom<=buttonBox.y+buttonBox.height+0.5,`${id} word lies inside its button vertically`).toBe(true);
    expect(m.scrollWidth<=m.clientWidth+1,`${id} word is not clipped`).toBe(true);
    expect(m.lines,`${id} word is one line`).toBe(1);
    expect(m.hitInside,`${id} word is what a tap at its centre reaches`).toBe(true);
    metrics.push({id,top:Math.round(m.top),fontSize:m.fontSize});
   }

   // All the words share one top and one font size.
   expect(new Set(metrics.map(x=>x.fontSize)).size,'the words share one font size').toBe(1);
   expect(new Set(metrics.map(x=>x.top)).size,'the words share one top').toBe(1);
   expect(errors).toEqual([]);
  });
 }
}
