import {test,expect} from '@playwright/test';

// The Export split, the zoom bar and the Export dialog render the same elements and the same styles at every width: the phone and
// tablet layouts rearrange them but do not bring in their own versions. Compared against the desktop, in English and Spanish.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const SIZES=[
 {name:'phone 390x844',width:390,height:844},
 {name:'tablet 768x1024',width:768,height:1024},
 {name:'desktop 1280x800',width:1280,height:800},
];

async function snapshot(page){
 return page.evaluate(()=>{
  const style=(el,props)=>{const cs=getComputedStyle(el);return Object.fromEntries(props.map(p=>[p,cs.getPropertyValue(p)]));};
  const exp=document.querySelector('#export');
  const zoom=[...document.querySelectorAll('.zoombar > button, .zoombar > span.sep')];
  return {
   exportIds:[...exp.closest('.export-split').querySelectorAll('button')].map(b=>b.id),
   exportStyle:style(exp,['background-color','color','border-radius','font-weight','font-family']),
   zoomIds:zoom.map(b=>b.id||b.className),
   zoomClasses:zoom.map(b=>b.className),
   zoomIcons:[...document.querySelectorAll('.zoombar use')].map(u=>u.getAttribute('href')),
   zoomBarStyle:style(document.querySelector('.zoombar'),['border-top-width','border-radius','background-color','font-family']),
  };
 });
}

for(const lang of ['en','es']) test(`Export and the zoom bar share the desktop's ids, icons and fills at each width (${lang})`,async({page})=>{
 const shots={};
 for(const size of SIZES){
  await page.setViewportSize({width:size.width,height:size.height});
  await page.goto(`/?lang=${lang}`);
  await expect(page.locator('.canvas')).toBeVisible();
  await expect(page.locator('#export')).toBeVisible();
  shots[size.name]=await snapshot(page);
 }
 const desk=shots['desktop 1280x800'];
 for(const name of ['phone 390x844','tablet 768x1024']){
  const s=shots[name];
  expect(s.exportIds,`${name} Export split buttons`).toEqual(desk.exportIds);
  expect(s.exportStyle,`${name} Export fill and type`).toEqual(desk.exportStyle);
  expect(s.zoomIds,`${name} zoom bar controls`).toEqual(desk.zoomIds);
  expect(s.zoomClasses,`${name} zoom bar classes`).toEqual(desk.zoomClasses);
  expect(s.zoomIcons,`${name} zoom bar icons`).toEqual(desk.zoomIcons);
  expect(s.zoomBarStyle,`${name} zoom bar frame`).toEqual(desk.zoomBarStyle);
 }
});

test('the Export dialog has the same buttons, selects and fills at phone and desktop sizes (en)',async({page})=>{
 const dialogStyle=async()=>page.evaluate(()=>{
  const cs=el=>{const c=getComputedStyle(el);return {background:c.backgroundColor,color:c.color,radius:c.borderRadius,border:c.borderTopWidth,font:c.fontFamily};};
  return {
   download:cs(document.querySelector('#download')),
   cancel:cs([...document.querySelectorAll('#exportDialog button')].find(b=>b.textContent.trim()==='Cancel')),
   select:cs(document.querySelector('#format')),
   fileName:cs(document.querySelector('#exportFileStem')),
  };
 });
 const results={};
 for(const size of [{name:'phone',width:390,height:844},{name:'desktop',width:1280,height:800}]){
  await page.setViewportSize({width:size.width,height:size.height});
  await page.goto('/?lang=en');
  await page.locator('#export').click();
  await expect(page.locator('#exportDialog')).toBeVisible();
  results[size.name]=await dialogStyle();
  await page.keyboard.press('Escape');
  await expect(page.locator('#exportDialog')).toBeHidden();
 }
 expect(results.phone).toEqual(results.desktop);
});
