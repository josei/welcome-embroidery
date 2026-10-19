// Convert downloaded open TrueType fonts into Welcome font JSON (outline fills).
//   node scripts/extract-ttf-fonts.mjs <dir with .ttf files and manifest.json> [outDir]
// manifest.json: [{family, style: regular|bold|italic, file, category: sans|serif|display|script, source, upstream}]
// All bundled fonts come from google/fonts `ofl/` (SIL Open Font License 1.1).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ttfToFont,parseTrueType} from '../src/ttf.js';
const dir=process.argv[2],out=process.argv[3]||path.join(path.dirname(fileURLToPath(import.meta.url)),'..','fonts','ttf');
fs.mkdirSync(out,{recursive:true});for(const f of fs.readdirSync(out))if(f.endsWith('.json'))fs.rmSync(path.join(out,f));
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8')),index=[],skipped=[];
for(const m of manifest){try{
  const bytes=fs.readFileSync(path.join(dir,m.file)),names=parseTrueType(bytes).names,family=names[16]||names[1]||m.family,label=m.style==='regular'?family:`${family} ${m.style==='bold'?'Bold':'Italic'}`,id=m.style==='regular'?m.family:`${m.family}-${m.style}`;
  const font=ttfToFont(bytes,{id,name:label,keywords:[m.category,'truetype','outline',...(m.style!=='regular'?[m.style]:[])],license:'SIL Open Font License 1.1',licenseText:`${(names[0]||'').trim()} Licensed under the SIL Open Font License, Version 1.1 (https://openfontlicense.org). Upstream: ${m.source}`,source:`google/fonts ofl/${m.family}/${m.upstream}`,originalUrl:m.source});
  font.family=family;font.style=m.style;const json=JSON.stringify(font);fs.writeFileSync(path.join(out,`${id}.json`),json);
  index.push({id,name:label,description:'',keywords:font.keywords,license:font.license,original:family,originalUrl:m.source,source:font.source,kind:'outline',size:font.size,minScale:font.minScale,maxScale:font.maxScale,letterCase:'',glyphCount:Object.keys(font.glyphs).length,bytes:json.length,prims:['f'],family,style:m.style});
}catch(error){skipped.push([m.file,error.message]);}}
fs.writeFileSync(path.join(out,'index.json'),JSON.stringify(index));
console.log(`converted ${index.length} TrueType fonts, skipped ${skipped.length}`,skipped,`total ${(index.reduce((n,f)=>n+f.bytes,0)/1e6).toFixed(1)} MB`);
