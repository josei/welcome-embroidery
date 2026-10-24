// ASCII DXF import: LINE and LWPOLYLINE entities become path objects. Units are taken as millimetres; DXF's y axis points up, so y is flipped to match the editor.
// Other entities are counted and reported, not imported. Binary DXF is refused.
import {validateDocument} from './engine.js';

const MAX_POINTS=1000,MAX_TOTAL_POINTS=5000;

function dxfPairs(source){
  if(source.startsWith('AutoCAD Binary DXF')||source.includes('\u0000'))throw Error('Binary DXF is not supported; save the file as ASCII DXF.');
  const lines=source.split(/\r?\n/),pairs=[];
  for(let i=0;i+1<lines.length;i+=2){const code=Number(lines[i].trim());if(!Number.isInteger(code))throw Error('Invalid DXF group code on line '+(i+1)+'.');pairs.push([code,lines[i+1].trim()]);}
  return pairs;
}

// Returns the entities of the ENTITIES section as {type, codes: [[code, value], ...]}.
function dxfEntities(pairs){
  const out=[];let inEntities=false,current=null;
  for(let i=0;i<pairs.length;i++){const [code,value]=pairs[i];
    if(code===0&&value==='SECTION'&&pairs[i+1]?.[1]==='ENTITIES'){inEntities=true;i++;continue;}
    if(code===0&&value==='ENDSEC'){if(current)out.push(current);current=null;inEntities=false;continue;}
    if(!inEntities)continue;
    if(code===0){if(current)out.push(current);current={type:value,codes:[]};continue;}
    if(current)current.codes.push([code,value]);}
  return out;
}

const numbers=(codes,x,y)=>{const xs=codes.filter(c=>c[0]===x).map(c=>Number(c[1])),ys=codes.filter(c=>c[0]===y).map(c=>Number(c[1]));return xs.map((v,i)=>[v,ys[i]]);};

// Parses the source into paths (in DXF coordinates) and a count of what was skipped.
export function parseDxf(source){
  const entities=dxfEntities(dxfPairs(source)),paths=[],skipped={};let total=0,bulged=0;
  for(const e of entities){
    if(e.type==='LINE'){const a=numbers(e.codes,10,20)[0],b=numbers(e.codes,11,21)[0];if(!a||!b||[...a,...b].some(v=>!Number.isFinite(v)))throw Error('LINE needs two finite end points.');paths.push({points:[a,b],closed:false});continue;}
    if(e.type==='LWPOLYLINE'){const flags=Number((e.codes.find(c=>c[0]===70)||[0,'0'])[1]);let pts=numbers(e.codes,10,20);if(pts.some(p=>!Number.isFinite(p[0])||!Number.isFinite(p[1])))throw Error('LWPOLYLINE has a non-numeric vertex.');
      if(e.codes.some(c=>c[0]===42&&Number(c[1])!==0))bulged++;
      if(pts.length<2)continue;const closed=(flags&1)===1;if(closed&&pts.length>2&&Math.abs(pts[0][0]-pts.at(-1)[0])<1e-9&&Math.abs(pts[0][1]-pts.at(-1)[1])<1e-9)pts=pts.slice(0,-1);
      paths.push({points:pts,closed:closed&&pts.length>2});continue;}
    skipped[e.type]=(skipped[e.type]||0)+1;}
  for(const p of paths){if(p.points.length>MAX_POINTS)throw Error('A DXF polyline has more than 1,000 points.');total+=p.points.length;}
  if(total>MAX_TOTAL_POINTS)throw Error('DXF import is limited to 5,000 points.');
  return {paths,skipped,bulged};
}

// Builds a Welcome document from a DXF source: paths are flipped to y-down, centred on the hoop origin, and sewn as running stitches.
export function dxfDocument(source){
  const {paths,skipped,bulged}=parseDxf(source);
  if(!paths.length)throw Error('The DXF has no LINE or LWPOLYLINE entities to import.');
  const flipped=paths.map(p=>({...p,points:p.points.map(([x,y])=>[x,-y])})),all=flipped.flatMap(p=>p.points),
    xs=all.map(p=>p[0]),ys=all.map(p=>p[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
  const objects=flipped.map((p,i)=>{const points=p.points.map(([x,y])=>[x-cx,y-cy]),px=points.map(q=>q[0]),py=points.map(q=>q[1]);
    return {id:crypto.randomUUID(),name:`DXF ${p.closed?'shape':'line'} ${i+1}`,kind:'path',x:Math.min(...px),y:Math.min(...py),w:Math.max(...px)-Math.min(...px),h:Math.max(...py)-Math.min(...py),points,...(p.closed?{closed:true}:{}),thread:'#527461',stitch:'run'};});
  const doc={schema:'welcom/1',name:'Imported DXF',revision:0,hoop:110,settings:{spacing:.4,angle:32,underlay:true,compensation:.2},objects};
  validateDocument(doc);
  return {doc,skipped,bulged};
}
