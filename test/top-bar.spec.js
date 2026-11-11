import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

// Issue #433: the top bar reads as one row of controls. Every command except Export is icon-only with a tooltip (and an accessible
// name); every control is 36 px tall and centred on the menus' line; one divider sits between each group, in the layout order
// logo and menus | name | file | edit | export, help and settings. Screenshots of the bar at each width and language go to
// test-results/top-bar, and the report links them.
const WIDTHS=[1280,1440,1920];
const LANGS=['en','es'];
const SHOTS=process.env.TOP_BAR_SHOTS||'test-results/top-bar';

// The group each direct child of the bar belongs to (the menus share the logo's group). Hidden helpers have no group.
const GROUP_OF=`(el => {
 if (el.matches('.sep')) return 'sep';
 if (el.matches('a.logo,.file-menu')) return 'brand';
 if (el.matches('#unsavedMarker,.name-field,.save-status')) return 'name';
 if (el.matches('#new,#open,#importMachine,#save')) return 'file';
 if (el.matches('.edit-tools')) return 'edit';
 if (el.matches('.export-split,.export-reason,#helpBtn,#settingsBtn')) return 'export';
 return null;
})`;

for(const width of WIDTHS){
 for(const lang of LANGS){
  test(`top bar is one row of controls at ${width}px in ${lang}`,async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.addInitScript(()=>{delete window.showSaveFilePicker;});
   await page.setViewportSize({width,height:800});
   await page.goto(`/?lang=${lang}`);
   await page.locator('#new').click();
   if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
   await page.locator('#rect').click();
   await expect(page.locator('#remove')).toBeEnabled();

   const measured=await page.evaluate(GROUP_OF=>{
    const group=eval(GROUP_OF);
    const bar=document.querySelector('header.top');
    const menus=[...bar.querySelectorAll(':scope > .file-menu > button')];
    const centre=r=>r.top+r.height/2;
    const line=menus.map(b=>centre(b.getBoundingClientRect()));
    // Every control: the buttons (menu triggers included) and the name, minus the hidden file inputs and the menu rows.
    const controls=[...bar.querySelectorAll('button, input#name')].filter(e=>!e.closest('.file-menu-list')&&e.offsetParent!==null)
     .map(e=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e);
      return {id:e.id||e.className||e.tagName,isExport:e.id==='export',isMenu:e.parentElement.classList.contains('file-menu'),text:e.matches('input')?'':e.innerText.trim(),
       name:e.getAttribute('aria-label')||e.innerText.trim(),title:e.getAttribute('title')||e.getAttribute('aria-label')||'',
       height:r.height,centre:centre(r),left:r.left,right:r.right,visible:cs.visibility!=='hidden'};});
    // The sequence of groups in DOM order, one token per run of the same group, with each group's left edge.
    const kids=[...bar.children].filter(e=>e.offsetParent!==null||e.matches('.sep'));
    const seq=[];
    for(const k of kids){
     const g=group(k);
     if(!g)continue;
     const r=k.getBoundingClientRect();
     if(!seq.length||seq[seq.length-1].group!==g)seq.push({group:g,left:r.left,right:r.right,items:1});
     else seq[seq.length-1].items++;
    }
    const box=bar.getBoundingClientRect();
    return {line:line[0]??null,menuLines:line,controls,seq,
     bar:{scrollWidth:bar.scrollWidth,clientWidth:bar.clientWidth,height:box.height},
     doc:{scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth},
     seps:bar.querySelectorAll('.sep').length};
   },GROUP_OF);

   mkdirSync(SHOTS,{recursive:true});
   await page.locator('header.top').screenshot({path:`${SHOTS}/top-bar-${width}-${lang}.png`});

   // Text: no command except Export shows any words; each has an accessible name and a tooltip.
   expect(measured.controls.length,'controls found').toBeGreaterThanOrEqual(9);
   for(const c of measured.controls){
    if(c.isExport){expect(c.text,'Export keeps its text').not.toBe('');continue;}
    if(c.isMenu)continue; // the menus are text by design
    if(c.id==='name' || c.id.startsWith('name'))continue;
    expect(c.text,`${c.id} shows no visible text`).toBe('');
    expect(c.name,`${c.id} has an accessible name`).not.toBe('');
    expect(c.title,`${c.id} has a tooltip`).not.toBe('');
   }
   // Size and alignment: every control is 36 px tall, centred within 1 px of the menus' centre line.
   expect(measured.menuLines.length,'three menus').toBe(3);
   for(const line of measured.menuLines)expect(Math.abs(line-measured.line),'menus share a centre line').toBeLessThanOrEqual(1);
   for(const c of measured.controls){
    expect(Math.round(c.height),`${c.id} is 36 px tall`).toBe(36);
    expect(Math.abs(c.centre-measured.line),`${c.id} centre within 1 px of the menus`).toBeLessThanOrEqual(1);
   }
   // Groups: menus | name | file | edit | export, one divider between each pair, in that order and left to right.
   expect(measured.seps,'four dividers').toBe(4);
   expect(measured.seq.map(s=>s.group),'group order').toEqual(['brand','sep','name','sep','file','sep','edit','sep','export']);
   const groups=measured.seq.filter(s=>s.group!=='sep');
   for(let i=1;i<groups.length;i++)expect(groups[i].left,`${groups[i].group} starts after ${groups[i-1].group}`).toBeGreaterThanOrEqual(groups[i-1].right);
   // No horizontal overflow.
   expect(measured.bar.scrollWidth,'top bar has no horizontal overflow').toBe(measured.bar.clientWidth);
   expect(measured.doc.scrollWidth,'page has no horizontal overflow').toBeLessThanOrEqual(measured.doc.clientWidth);
   expect(errors).toEqual([]);
  });
 }
}
