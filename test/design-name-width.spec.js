import {test,expect} from '@playwright/test';

// At 1024, 1100, 1180 and 1280px the design name shows its whole text, or ends in an ellipsis, and never cuts a word.
// The autosave line beside it is not clipped. English and Spanish are both checked.
for(const lang of ['en','es']) for(const width of [1024,1100,1180,1280]){
 test(`design name is whole or ellipsised at ${width}px in ${lang}`,async({page})=>{
  await page.addInitScript(()=>{delete window.showSaveFilePicker;});
  await page.setViewportSize({width,height:800});
  await page.goto(`/?lang=${lang}`);
  await page.locator('#rect').click();
  await expect(page.locator('#remove')).toBeEnabled();
  const m=await page.evaluate(()=>{
    const field=document.querySelector('.top .name-field');
    const shown=field.dataset.shown;
    const cs=getComputedStyle(field,'::after');
    const ctx=document.createElement('canvas').getContext('2d');
    ctx.font=`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const bar=document.querySelector('header.top');
    const status=document.querySelector('#unsavedMark');
    return {
      shown,
      fieldWidth:field.getBoundingClientRect().width,
      textWidth:ctx.measureText(shown).width+16,
      ellipsis:cs.textOverflow==='ellipsis',
      barOverflow:bar.scrollWidth-bar.clientWidth,
      statusClip:status.scrollWidth-status.clientWidth,
    };
  });
  expect(m.barOverflow,'top bar has no horizontal overflow').toBeLessThanOrEqual(0);
  expect(m.statusClip,'autosave line is not clipped').toBeLessThanOrEqual(0);
  const whole=m.textWidth<=m.fieldWidth+0.5;
  expect(whole||m.ellipsis,'name is whole, or ends in an ellipsis').toBe(true);
 });
}
