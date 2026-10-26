import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const url=process.argv[2];
if(!url)throw new Error('usage: node scripts/capture-public.mjs <public-url>');
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 await page.goto(url,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelectorAll('.object-row').length>0);
 await page.locator('[data-view="stitches"]').click();
 await page.waitForFunction(()=>document.querySelector('#count').textContent.includes('stitches'));
 const lettering=page.locator('.object-row[data-id="word"]');
 if(await lettering.count())await lettering.click();
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#toast')).opacity==='0');
 await fs.mkdir('design/progress',{recursive:true});
 await page.screenshot({path:'design/progress/public-preview.png',fullPage:true});
 console.log(JSON.stringify({url,screenshot:'design/progress/public-preview.png'}));
}finally{await browser.close();}
