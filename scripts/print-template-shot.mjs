// Downloads the print template from the editor, then renders that exact SVG at 1:1 for design/progress/features/print-template.png.
import {chromium} from 'playwright';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const base=process.argv[2]||'http://127.0.0.1:8790/';
const out='design/progress/features';mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1600,height:1000}});
page.on('dialog',d=>d.accept());
await page.goto(base,{waitUntil:'networkidle',timeout:60000});
const download=page.waitForEvent('download');
await page.locator('#export').click();await page.locator('#format').selectOption('print');await page.locator('#download').click();
const file=await download;const tmp='/tmp/welcom-print-template-shot.svg';await file.saveAs(tmp);
const svg=readFileSync(tmp,'utf8');
const sheet=await browser.newPage({viewport:{width:900,height:900}});
await sheet.setContent(`<html><body style="margin:0;background:#fff">${svg.replace(/<\?xml[^>]*\?>/,'').replace('width="110mm" height="110mm"','width="800" height="800"')}</body></html>`);
await sheet.screenshot({path:path.join(out,'print-template.png')});
await browser.close();
console.log('wrote',path.join(out,'print-template.png'));
