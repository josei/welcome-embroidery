// Public-MCP acceptance: closed smooth bordered paths, aligned/distributed shapes, JEF/VP3 export.
// MCP_URL=https://host/mcp node scripts/create-vector-example.mjs
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const client=new Client({name:'welcome-vector-example',version:'1.0.0'});
await client.connect(new StreamableHTTPClientTransport(new URL(process.env.MCP_URL||'http://127.0.0.1:8787/mcp')));
const call=async(name,args)=>{const r=await client.callTool({name,arguments:args});assert.ok(!r.isError,JSON.stringify(r.content));return r.structuredContent;};
const {documentId}=await call('document_create',{name:'Vector badge'});let rev=0;
const apply=async operations=>{rev=(await call('document_apply',{documentId,expectedRevision:rev,operations})).revision;};
await apply([
 {op:'add_path',id:'leaf',name:'Leaf',x:0,y:0,points:[[-30,0],[-15,-22],[10,-22],[30,0],[10,22],[-15,22]],closed:true,smooth:true,stitch:'fill',border:true,thread:'#89a377'},
 {op:'set_object',id:'leaf',borderThread:'#527461'},
 {op:'add_shape',id:'d1',kind:'ellipse',x:-40,y:-45,width:8,height:8,thread:'#d9897e'},
 {op:'add_shape',id:'d2',kind:'ellipse',x:-5,y:-33,width:8,height:8,thread:'#d3ad61'},
 {op:'add_shape',id:'d3',kind:'ellipse',x:30,y:-41,width:8,height:8,thread:'#d9897e'},
 {op:'align',ids:['d1','d2','d3'],edge:'top'},{op:'distribute',ids:['d1','d2','d3'],axis:'horizontal'},
 {op:'add_path',id:'wave',name:'Wave',x:0,y:0,points:[[-30,30],[0,30],[30,30]],thread:'#d3ad61'},{op:'set_path_node_type',id:'wave',index:1,type:'smooth'},{op:'set_path_handle',id:'wave',index:1,which:'out',x:12,y:24},{op:'group',ids:['d1','d2','d3']},
 {op:'add_text',id:'t',text:'BLOOM',x:-18,y:36,height:8,thread:'#527461'}]);
await apply([{op:'insert_path_point',id:'leaf',index:1,x:-24,y:-12},{op:'delete_path_point',id:'leaf',index:1},{op:'align',ids:['t'],edge:'hcenter',to:'hoop'}]);
const compiled=await call('embroidery_compile',{documentId,expectedRevision:rev});assert.equal(compiled.errors.length,0);
const out={};for(const format of ['jef','vp3'])out[format]=(await call('embroidery_export',{documentId,expectedRevision:rev,format}));
const saved=await call('document_save',{documentId});console.log(JSON.stringify({stitches:compiled.count,openUrl:saved.openUrl,exports:out},null,1).slice(0,900));await client.close();
