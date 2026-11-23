import {test,expect} from '@playwright/test';

// The footer of Export is one style at every size: the same computed button style, and the same stacked full-width buttons as
// on desktop. Settings and the keyboard shortcut sheet have no footer: their Close is the × in the heading row. Every dialog's
// body keeps a 24 px side margin at every size.

const SIZES=[{width:390,height:844},{width:768,height:1024},{width:1440,height:900}];
const DIALOGS=[
 {name:'Settings',open:'#settingsBtn',dialog:'#settingsDialog',body:'h2'},
 {name:'Export',open:'#export',dialog:'#exportDialog',body:'h2'},
 {name:'Keyboard shortcuts',open:'#helpBtn',dialog:'#keysDialog',body:'h2'},
];

const FOOTER_DIALOG=DIALOGS[1];

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
  const cs=last?getComputedStyle(last):null;
  const style={};
  if(cs)for(const p of ['display','minHeight','fontSize','fontWeight','padding','borderRadius','textAlign','backgroundColor','color','borderTopWidth'])style[p]=cs[p];
  const bodyEl=d.querySelector(body);
  const bodyLeft=bodyEl.getBoundingClientRect().left-dr.left;
  const stacked=buttons.length<2||buttons[0].getBoundingClientRect().bottom<=buttons[1].getBoundingClientRect().top;
  const widths=buttons.map(b=>Math.round(b.getBoundingClientRect().width));
  const footer=d.querySelector('.dialog-actions');
  const footerW=footer?Math.round(footer.getBoundingClientRect().width):0;
  return {style,bodyLeft,stacked,widths,footerW,count:buttons.length,height:last?Math.round(last.getBoundingClientRect().height):0};
 },{sel:dialog.dialog,body:dialog.body});
 await page.keyboard.press('Escape');
 await expect(page.locator(dialog.dialog)).toBeHidden();
 return m;
}

test('the Export footer button style is the same at every size',async({page})=>{
 const styles={};
 for(const size of SIZES) {
  const m=await footerAt(page,size,FOOTER_DIALOG);
  styles[`${FOOTER_DIALOG.name} ${size.width}`]=m.style;
 }
 // Export's footer has a Download button first; its last button (Cancel) is the one compared.
 const reference=styles[`${FOOTER_DIALOG.name} 1440`];
 for(const [key,style] of Object.entries(styles)) expect(style,key).toEqual(reference);
});

test('the Export footer buttons stack full width at every size, as on desktop',async({page})=>{
 for(const size of SIZES) {
  const m=await footerAt(page,size,FOOTER_DIALOG);
  expect(m.stacked,`${FOOTER_DIALOG.name} at ${size.width}`).toBe(true);
  expect(m.widths[m.widths.length-1],`${FOOTER_DIALOG.name} at ${size.width} full width`).toBeCloseTo(m.footerW,0);
  expect(m.height,`${FOOTER_DIALOG.name} at ${size.width} touch height`).toBeGreaterThanOrEqual(44);
 }
});

test('the dialog content has a 24 px side margin in every dialog at every size',async({page})=>{
 for(const size of SIZES) for(const dialog of DIALOGS){
  const m=await footerAt(page,size,dialog);
  expect(m.bodyLeft,`${dialog.name} body margin at ${size.width}`).toBeCloseTo(24,0);
 }
});
