// @ts-check
// Fabric profiles: the document settings a fabric sets in one set_settings step, the stabilizer to suggest for it, and the stretch that
// distortionGrid uses to map a plan's pull onto a grid. The engine re-exports these names, so callers keep importing them from engine.js.

/**
 * @typedef {{spacing: number, stitchLength: number, stagger: number, underlay: boolean, underlayType: string, compensation: number}} FabricValues
 * @typedef {{label: string, stretch: number, stabilizer: string, values: FabricValues}} FabricProfile
 */

// Fabric presets: the values in src/fabrics.js, written into the document settings by set_settings { fabric }. An explicit key in the same operation overrides a preset.
// Fabric profiles: the document settings a fabric sets in one set_settings step, and the stabilizer to suggest for it.
// The numbers are industry starting points for embroidery on these fabrics, not measurements from a machine. Test a
// sample before a production run, and change a value here if a sample says so: the engine, the MCP schema and the
// Fabric select all read this table.
// Each value's reason is written beside it. The same profile names its stabilizer, shown as a sewing tip.
/** @type {Record<string, FabricProfile>} */
export const FABRIC_PROFILES = {
 woven: {
  label: 'Woven (default)',
  stretch: 1, // the reference: a woven takes the stitches with no give
  stabilizer: 'tear-away backing for a plain woven fabric.',
  // Document defaults, so choosing woven returns every value to where a new document starts.
  values: {spacing: .4, stitchLength: 3, stagger: 4, underlay: true, underlayType: 'auto', compensation: .2},
 },
 knit: {
  label: 'Stretchy knit',
  stretch: 1.6, // starting point: a knit gives under the stitches, so it pulls and puckers the most
  stabilizer: 'cut-away mesh. A knit stretches, so the backing has to stay under the stitches; tear-away lets the stitches pucker.',
  values: {
   spacing: .45, // a little more open, so the stretch does not crowd the rows together
   stitchLength: 3, // unchanged: the length is not the problem on a knit
   stagger: 4,
   underlay: true, // the underlay holds the knit down under the top stitches
   underlayType: 'auto',
   compensation: .5, // a knit pulls in more, so the satin and fill are sewn wider
  },
 },
 towel: {
  label: 'Terry towel or fleece',
  stretch: 1.3, // starting point: a loop pile gives some way under the stitches
  stabilizer: 'tear-away backing with a water-soluble topping on the loops, so the stitches do not sink into the pile.',
  values: {
   spacing: .5, // open rows, so the stitches do not flatten the loops
   stitchLength: 2.5, // shorter, so loose loops do not catch on long stitches
   stagger: 8, // more needle phases, so the pile does not show a seam in the fill
   underlay: true,
   underlayType: 'auto',
   compensation: .4, // the pile takes up the stitches, so the fill is sewn slightly wider
  },
 },
 denim: {
  label: 'Denim',
  stretch: .8, // starting point: a dense woven gives less than a plain one
  stabilizer: 'cut-away or heavy tear-away backing for a dense, stable woven.',
  values: {
   spacing: .35, // a denser fill, which the stable fabric can hold without puckering
   stitchLength: 3,
   stagger: 4,
   underlay: true,
   underlayType: 'auto',
   compensation: .25, // a woven that barely pulls in
  },
 },
};
/** @type {Record<string, FabricProfile['values']>} */
export const FABRIC_PRESETS=Object.fromEntries(Object.entries(FABRIC_PROFILES).map(([key,profile])=>[key,profile.values]));
// Pull estimate for the 3D preview: the stitches that land in each cell of the hoop, scaled by how far the chosen fabric
// stretches. It shows where the fabric is likely to pull and pucker. It is a guide for where to look, not a simulation of
// the machine. A cell whose stretch-adjusted density equals DISTORTION_SCALE shows 63% of the colour, and denser cells show more.
// The pull direction is across the stitch lines in each cell (the stitch lines' normal), from the average line direction there.
export const DISTORTION_SCALE=1.5;
/**
 * @param {{stitches: {x: number, y: number, cmd: string}[]}} plan
 * @param {string} fabric
 * @param {{w: number, h: number}} hoop
 * @param {number} [cell]
 * @returns {{cols: number, rows: number, cell: number, x0: number, y0: number, values: Float32Array, dirs: Float32Array, peak: number, stretch: number, label: string}}
 */
export function distortionGrid(plan,fabric,hoop,cell=2){
  const profile=FABRIC_PROFILES[fabric]??FABRIC_PROFILES.woven,stretch=profile.stretch;
  const x0=-hoop.w/2,y0=-hoop.h/2,cols=Math.max(1,Math.ceil(hoop.w/cell)),rows=Math.max(1,Math.ceil(hoop.h/cell));
  const counts=new Float32Array(cols*rows),axialC=new Float32Array(cols*rows),axialS=new Float32Array(cols*rows);
  /** @type {(x: number, y: number) => number} */
  const cellOf=(x,y)=>{const c=Math.floor((x-x0)/cell),r=Math.floor((y-y0)/cell);return c>=0&&c<cols&&r>=0&&r<rows?r*cols+c:-1;};
  /** @type {{x: number, y: number}|null} */
  let prev=null;
  for(const s of plan.stitches){
    if(s.cmd!=='stitch'){prev=null;continue;}
    const i=cellOf(s.x,s.y);if(i>=0)counts[i]++;
    if(prev){const dx=s.x-prev.x,dy=s.y-prev.y,len2=dx*dx+dy*dy,j=cellOf((s.x+prev.x)/2,(s.y+prev.y)/2);
      if(j>=0&&len2>0){axialC[j]+=(dx*dx-dy*dy)/len2;axialS[j]+=2*dx*dy/len2;}}
    prev=s;
  }
  const values=new Float32Array(cols*rows),dirs=new Float32Array(cols*rows*2);let peak=0;
  for(let i=0;i<counts.length;i++){
    const pull=counts[i]/(cell*cell)*stretch;values[i]=1-Math.exp(-pull/DISTORTION_SCALE);peak=Math.max(peak,values[i]);
    if(axialC[i]||axialS[i]){const theta=0.5*Math.atan2(axialS[i],axialC[i]);dirs[i*2]=-Math.sin(theta);dirs[i*2+1]=Math.cos(theta);}
  }
  return {cols,rows,cell,x0,y0,values,dirs,peak,stretch,label:profile.label};
}
