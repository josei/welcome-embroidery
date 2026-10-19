import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','dist');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.md':'text/markdown; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{try{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end('Method not allowed');return;}
 const url=new URL(req.url,'http://localhost');if(url.pathname==='/health'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,service:'welcome-static-dist'}));return;}
 let relative;try{relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';}catch{res.writeHead(400);res.end('Invalid path');return;}
 const file=path.resolve(root,relative);if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(404);res.end('Not found');return;}
 const actual=await fs.realpath(file);if(actual!==root&&!actual.startsWith(root+path.sep)){res.writeHead(404);res.end('Not found');return;}
 const data=await fs.readFile(actual);res.writeHead(200,{'content-type':mime[path.extname(actual)]||'application/octet-stream','content-length':data.length,'cache-control':'no-cache','x-content-type-options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Not found');}});
const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||18789);server.listen(port,host,()=>console.log(`Serving only ${root} on http://${host}:${port}`));
