// Input size limits for the MCP tool schemas (server.js). Zod 3 walks every
// array item even after a length check fails, so an array limit on its own does
// not stop a large payload being parsed. `bounded()` adds a pre-check that cuts
// the array before its items are parsed; strings are cheap to check
// (length is known up front), so `z.string().max(...)` is enough for them.
// Zod stays on 3.x for this batch; see the zod advisory issue (#330).
import {z} from 'zod';

// Every size limit on a tool input (string length or array item count) is set
// here, and server.js refers to it by name. Numeric value ranges (coordinates,
// angles, opacities) stay inline in the schemas: they are not sizes. Values are
// the largest legitimate use in the app as of this change; a person can raise one
// here. Limits that share a value keep separate names, so each can move alone.
export const LIMITS = Object.freeze({
  // Strings (characters)
  id: 100,             // ids: document, object, path, snapshot, thread (a uuid is 36)
  label: 120,          // short names and labels: document, snapshot, add_text text
  text: 1000,          // free text: object names, multi-line text
  font: 200,           // font ids such as "inkstitch/<name>"
  color: 7,            // "#rrggbb"
  fileName: 240,       // an imported file name
  referenceName: 200,  // a reference image name
  query: 60,           // a font search query
  fileBase64: 1398104, // base64 of a 1 MiB embroidery file: ceil(1048576 * 4 / 3), rounded up to a multiple of 4
  photoData: 140000,   // base64 photo on set_object (about 105 KB of image)
  referenceData: 1500000, // base64 data URL of a reference image (about 1.1 MB of image)

  // Arrays (item counts)
  selectionIds: 100,   // object ids an operation acts on (group, align, transform...)
  bulkIds: 200,        // object ids for redwork_group and applique_group
  mergeIds: 20,        // object ids for boolean and join_paths
  copyIds: 60,         // object ids for the array operation (count is also capped at 60)
  pathPoints: 1000,    // points on one path, and point indexes into a path
  handles: 1000,       // bezier handle pairs on one path
  holePoints: 200,     // points of a hole to add
  cutPoints: 50,       // points of a knife cut line
  guidePoints: 50,     // points of a set_object guide
  widthStops: 50,      // width stops along a satin stitch
  blendPalette: 5,     // colours in a blend
  operations: 40,      // operations in one document_apply call
});

export function str(max = LIMITS.text) {
  return z.string().max(max);
}

// Wraps an array schema that declares an explicit .max(). Zod 3 would walk every
// item of an oversized array before the length check reports, so the pre-check
// cuts the input to max + 1 items first: the array's own .max() still rejects it
// (the error names the limit), and at most max + 1 items are ever parsed.
// z.preprocess keeps the array as the advertised JSON schema (type, maxItems).
export function bounded(schema) {
  const max = schema._def.maxLength?.value;
  if (typeof max !== 'number') throw new Error('bounded() needs an array schema with .max()');
  return z.preprocess(v => (Array.isArray(v) && v.length > max ? v.slice(0, max + 1) : v), schema);
}
