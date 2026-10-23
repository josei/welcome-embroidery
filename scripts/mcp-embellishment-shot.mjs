// Builds the embellishment design the way an agent would (MCP document_apply) and writes its stitch view to a PNG.
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const port='18789',base=`http://127.0.0.1:${port}`,out='design/progress/features/mcp-embellishments.png';
const service=spawn(process.execPath,['server.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:port,WELCOME_ANONYMOUS_MCP:'1',WELCOME_SESSION_FILE:''},stdio:'ignore'});
try{
 for(let i=0;i<100;i++){try{if((await fetch(`${base}/health`)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const client=new Client({name:'embellishment-shot',version:'1.0.0'});
 await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
 const id=(await client.callTool({name:'document_create',arguments:{name:'Agent embellishments',hoop:110}})).structuredContent.documentId;
 const ops=[
  {op:'add_path',id:'bling',x:0,y:0,points:[[-45,-40],[-15,-40],[15,-40],[45,-40]],stitch:'bling'},
  {op:'set_object',id:'bling',blingShape:'hexagon',motifSize:6,motifSpacing:10},
  {op:'add_path',id:'oval',x:0,y:0,points:[[-45,-15],[-15,-15],[15,-15],[45,-15]],stitch:'bling'},
  {op:'set_object',id:'oval',blingShape:'oval',motifSize:6,motifSpacing:10},
  {op:'add_path',id:'leaf',x:0,y:0,points:[[-45,15],[45,15]],stitch:'motif'},
  {op:'set_object',id:'leaf',motifShape:'leaf',motifWarp:'along',motifSpacing:6,motifSize:4},
  {op:'add_path',id:'seq',x:0,y:0,points:[[-45,35],[45,35]],stitch:'sequin'},
  {op:'add_path',id:'bead',x:0,y:0,points:[[-45,50],[45,50]],stitch:'bead'}];
 const applied=await client.callTool({name:'document_apply',arguments:{documentId:id,expectedRevision:0,operations:ops}});
 if(applied.isError)throw Error(JSON.stringify(applied.content));
 const r=await client.callTool({name:'document_render',arguments:{documentId:id,view:'stitches',size:900}});
 const img=r.content.find(c=>c.type==='image');
 writeFileSync(out,Buffer.from(img.data,'base64'));
 console.log('wrote',out,'stitches:',(await client.callTool({name:'embroidery_compile',arguments:{documentId:id,expectedRevision:1}})).structuredContent.count);
 await client.close();
}finally{service.kill('SIGTERM');}
