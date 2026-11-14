import {test,expect} from '@playwright/test';
import {SHORTCUT_TABLE} from '../src/shortcutTable.js';

// The keyboard sheet groups keys by what pressing them does. Keys under "Tools" arm a tool, so pressing each one must make
// that tool the active one. Keys that insert an object sit under their own heading and each adds one object.
const newDesign=async page=>{await page.locator('#new').click();if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();};

const openSheet=async page=>{await page.keyboard.press('?');await expect(page.locator('#keysDialog')).toBeVisible();};

// The sheet's groups, read from the DOM: each heading with the [key, description] pairs under it.
const sheetGroups=page=>page.evaluate(()=>{
 const groups=[];
 for(const h of document.querySelectorAll('#keysList h4')){
  const rows=[];
  const group=h.parentElement;
  for(let el=h.nextElementSibling;el&&group.contains(el);el=el.nextElementSibling){
   if(el.tagName==='KBD')rows.push([el.textContent,el.nextElementSibling.textContent]);
  }
  groups.push({heading:h.textContent,rows});
 }
 return groups;
});

for(const lang of ['en','es']){
 test.describe(`keyboard sheet (${lang})`,()=>{
  test.use({viewport:{width:1440,height:900}});
  test.beforeEach(async({page})=>{
   await page.addInitScript(l=>localStorage.setItem('welcome.lang',l),lang);
   await page.addInitScript(()=>{delete window.showSaveFilePicker;});
   page.on('dialog',d=>d.accept());
  });

  test('pressing each key under Tools arms that tool',async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('/');await newDesign(page);
   const toolKeys=SHORTCUT_TABLE.filter(e=>e.section==='Tools'&&e.press);
   expect(toolKeys.length).toBeGreaterThan(0);
   await openSheet(page);
   const sheetToolKeys=(await sheetGroups(page)).find(g=>g.heading===(lang==='es'?'Herramientas':'Tools')).rows.map(([k])=>k);
   await page.keyboard.press('Escape');await expect(page.locator('#keysDialog')).toBeHidden();
   for(const entry of toolKeys){
    const key=entry.keys[0];
    expect(sheetToolKeys,`${key} is listed under Tools`).toContain(entry.label);
    await page.locator('#select').click();
    await page.keyboard.press(key);
    await expect(page.locator(`#${entry.press}`),`${key} arms ${entry.press}`).toHaveAttribute('aria-pressed','true');
    await page.keyboard.press('Escape');
   }
   expect(errors).toEqual([]);
  });

  test('R, O and T insert one object each and leave the tool on Select',async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('/');await newDesign(page);
   let count=0;
   for(const key of ['r','o','t']){
    await page.keyboard.press(key);
    count++;
    await expect(page.locator('.object-row'),`${key} adds one object`).toHaveCount(count);
    await expect(page.locator('#select'),`${key} leaves Select armed`).toHaveAttribute('aria-pressed','true');
   }
   expect(errors).toEqual([]);
  });

  test('every shortcut row appears once in the sheet, under a heading',async({page})=>{
   await page.goto('/');await newDesign(page);await openSheet(page);
   const groups=await sheetGroups(page);
   const rows=groups.flatMap(g=>g.rows);
   expect(rows.length).toBe(SHORTCUT_TABLE.length);
   const seen=new Set();
   for(const [key,desc] of rows){const id=key+'|'+desc;expect(seen.has(id),`${id} listed twice`).toBe(false);seen.add(id);}
   const insert=groups.find(g=>g.heading===(lang==='es'?'Insertar':'Insert'));
   expect(insert.rows.map(([k])=>k)).toEqual(['R','O','T']);
  });

  test('the sheet fits the 1440 by 900 window with no clipped labels or scrolling',async({page})=>{
   await page.goto('/');await newDesign(page);await openSheet(page);
   const m=await page.evaluate(()=>{
    const dlg=document.getElementById('keysDialog'),list=document.getElementById('keysList');
    const box=dlg.getBoundingClientRect();
    const clipped=[...list.querySelectorAll('kbd,span,h4')].filter(el=>el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1).map(el=>el.textContent);
    const outside=[...list.querySelectorAll('kbd,span,h4')].filter(el=>{const r=el.getBoundingClientRect();return r.right>box.right+1||r.bottom>box.bottom+1;}).map(el=>el.textContent);
    return {
     viewport:[innerWidth,innerHeight],dialog:[box.top,box.bottom],
     dialogScrolls:dlg.scrollHeight>dlg.clientHeight+1,
     listScrolls:list.scrollHeight>list.clientHeight+1,
     clipped,outside,
    };
   });
   expect(m.dialog[0]).toBeGreaterThanOrEqual(0);
   expect(m.dialog[1]).toBeLessThanOrEqual(900);
   expect(m.clipped,'clipped labels').toEqual([]);
   expect(m.outside,'rows outside the dialog').toEqual([]);
   expect(m.dialogScrolls,'dialog scrolls').toBe(false);
   expect(m.listScrolls,'list scrolls').toBe(false);
   await page.locator('#keysDialog').screenshot({path:`test-results/keys-sheet-${lang}.png`});
  });
 });
}
