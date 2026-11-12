import {test,expect} from '@playwright/test';

// Issue #482: the status line below the canvas holds its full Spanish text on landscape phones (844x390) and tablets (768x1024), and
// stays unclipped at phone portrait (390x844). The count text is the whole status string ("N puntadas · listo para bordar"), so its box
// must be wide enough that scrollWidth <= clientWidth (the ellipsis style stays set, so the width check is the real test). The English string is checked the same way.
const VIEWPORTS=[
 {name:'landscape phone',width:844,height:390,touch:true},
 {name:'tablet portrait',width:768,height:1024,touch:true},
 {name:'phone portrait',width:390,height:844,touch:true},
];

test('the Spanish status line is not truncated on landscape, tablet and phone portrait',async({browser})=>{
 test.setTimeout(240000);
 const {initialDocument,applyOperations}=await import('../src/engine.js');
 const doc=initialDocument();doc.objects=[];doc.hoop=400;doc.name='Probe';doc.revision=1;
 // A 20 x 15.1 mm fill compiles to 466 stitches; the count string is the same shape at any stitch count.
 applyOperations(doc,[{op:'add_shape',id:'s0',kind:'rect',x:0,y:0,width:20,height:15.1,thread:'#cc3333',stitch:'fill'}]);
 for(const vp of VIEWPORTS){
  for(const lang of ['en','es']){
   const ctx=await browser.newContext({viewport:{width:vp.width,height:vp.height},hasTouch:vp.touch,isMobile:vp.touch});
   const page=await ctx.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.goto(lang==='en'?'/':`/?lang=${lang}`);
   await page.evaluate(d=>localStorage.setItem('welcome.autosave:'+sessionStorage.getItem('welcome.tabId'),JSON.stringify({doc:d,clean:false,savedAt:Date.now()})),doc);
   await page.goto(lang==='en'?'/':`/?lang=${lang}`);
   await page.locator('#restoreYes').click();await expect(page.locator('.object-row')).toHaveCount(1);
   await expect(page.locator('#count')).toContainText('466');
   await page.waitForTimeout(300);
   const box=await page.evaluate(()=>{
    const e=document.getElementById('count');const cs=getComputedStyle(e);
    return {text:e.textContent,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,overflow:cs.textOverflow,rect:e.getBoundingClientRect().toJSON()};
   });
   const label=`${vp.name} ${lang}: "${box.text}"`;
   console.log('MEASURE',label,JSON.stringify({sw:box.scrollWidth,cw:box.clientWidth,ov:box.overflow,rect:box.rect}));
   expect(box.scrollWidth,`count not clipped, ${label}`).toBeLessThanOrEqual(box.clientWidth);
   if(lang==='es') expect(box.text,`full Spanish status, ${label}`).toContain('466 puntadas · listo para bordar');
   else expect(box.text,`full English status, ${label}`).toContain('466 stitches · compiled');
   expect(errors).toEqual([]);
   await ctx.close();
  }
 }
});
