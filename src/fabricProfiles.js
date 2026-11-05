// @ts-check
/**
 * @typedef {{spacing: number, stitchLength: number, stagger: number, underlay: boolean, underlayType: string, compensation: number}} FabricValues
 * @typedef {{label: string, stretch: number, stabilizer: string, values: FabricValues}} FabricProfile
 */

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
export const FABRIC_PRESETS = Object.fromEntries(Object.entries(FABRIC_PROFILES).map(([key, profile]) => [key, profile.values]));
