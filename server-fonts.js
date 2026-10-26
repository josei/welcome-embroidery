// Node-side font loading: registers every bundled font (fonts/inkstitch/*.json, fonts/ttf/*.json) so headless MCP documents and the test suite can lay text out.
import fs from 'node:fs';
import path from 'node:path';
import {registerFont} from './src/fonts.js';
export function loadBundledFonts(root){let count=0;for(const group of ['inkstitch','ttf']){const dir=path.join(root,'fonts',group);let names;try{names=fs.readdirSync(dir);}catch{continue;}for(const name of names){if(!name.endsWith('.json')||name==='index.json')continue;try{registerFont(`${group}/${name.slice(0,-5)}`,JSON.parse(fs.readFileSync(path.join(dir,name),'utf8')));count++;}catch(error){console.warn(`Skipping font ${group}/${name}: ${error.message}`);}}}return count;}
