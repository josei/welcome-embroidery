import {test,expect} from '@playwright/test';

// The footer of Settings, Export and the keyboard shortcut sheet is one style at every size: the same computed button
// style, a 24 px side margin for the dialog body, and the same stacked full-width buttons as on desktop.

const SIZES=[{width:390,height:844},{width:768,height:1024},{width:1440,height:900}];
const DIALOGS=[
 {name:'Settings',open:'#settingsBtn',dialog:'#settingsDialog',body:'h2'},
 {name:'Export',open:'#export',dialog:'#exportDialog',body:'h2'},
 {name:'Keyboard shortcuts',open:'#helpBtn',dialog:'#keysDialog',body:'h2'},
];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function footerAt(page,size,dialog){
 await page.setViewportSize(size);
 await page.goto('/?lang=en');
 await expect(page.locator('.canvas')).toBeVisible();
 await page.evaluate(sel=>document.querySelector(sel).click(),dialog.open);
 await expect(page.locator(`${dialog.dialog}[open]`)).toHaveCount(1);
 const m=await page.evaluate(({sel,body})=>{
  const d=document.querySelector(sel);
  const dr=d.getBoundingClientRect();
  const buttons=[...d.querySelectorAll('.dialog-actions button')];
  const last=buttons[buttons.length-1];
  const cs=getComputedStyle(last);
  const style={};
  for(const p of ['display','minHeight','fontSize','fontWeight','padding','borderRadius','textAlign','backgroundColor','color','borderTopWidth'])style[p]=cs[p];
  const bodyEl=d.querySelector(body);
  const bodyLeft=bodyEl.getBoundingClientRect().left-dr.left;
  const stacked=buttons.length<2||buttons[0].getBoundingClientRect().bottom<=buttons[1].getBoundingClientRect().top;
  const widths=buttons.map(b=>Math.round(b.getBoundingClientRect().width));
  const footerW=Math.round(d.querySelector('.dialog-actions').getBoundingClientRect().width);
  return {style,bodyLeft,stacked,widths,footerW,count:buttons.length,height:Math.round(last.getBoundingClientRect().height)};
 },{sel:dialog.dialog,body:dialog.body});
 await page.keyboard.press('Escape');
 await expect(page.locator(dialog.dialog)).toBeHidden();
 return m;
}

test('the footer button style is the same in Settings, Export and the shortcut sheet at every size',async({page})=>{
 const styles={};
 for(const size of SIZES) for(const dialog of DIALOGS){
  const m=await footerAt(page,size,dialog);
  styles[`${dialog.name} ${size.width}`]=m.style;
 }
 // Export's footer has a Download button first; its last button (Cancel) is the one compared with Close.
 const reference=styles['Settings 1440'];
 for(const [key,style] of Object.entries(styles)) expect(style,key).toEqual(reference);
});

test('the footer buttons stack full width at every size, as on desktop',async({page})=>{
 for(const size of SIZES) for(const dialog of DIALOGS){
  const m=await footerAt(page,size,dialog);
  expect(m.stacked,`${dialog.name} at ${size.width}`).toBe(true);
  expect(m.widths[m.widths.length-1],`${dialog.name} at ${size.width} full width`).toBeCloseTo(m.footerW,0);
  expect(m.height,`${dialog.name} at ${size.width} touch height`).toBeGreaterThanOrEqual(44);
 }
});

test('the dialog content has a 24 px side margin in Settings and Export at every size',async({page})=>{
 for(const size of SIZES) for(const dialog of DIALOGS.filter(d=>d.name!=='Keyboard shortcuts')){
  const m=await footerAt(page,size,dialog);
  expect(m.bodyLeft,`${dialog.name} body margin at ${size.width}`).toBeCloseTo(24,0);
 }
});
