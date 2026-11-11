// @ts-check
// The hoop-anchor tail: a moved design's JEF, PES and EXP file ends with this text, so the importer keeps the stitches' position in the hoop
// instead of centring them on the origin. The same idea as the WE:CENTRE header line in DST (encoders/dst.js). A file without the tail
// imports centred, as before, so every file written for an unmoved design is unchanged.

/** Text appended to a moved design's JEF, PES or EXP file. */
export const ANCHOR_TAIL = 'WE:CENTRE';

/**
 * True when a visible object in the document has been moved off its placement: a native object an edit moved (operations.js sets `moved`),
 * or an imported stitch layer whose position differs from its default placement. Only such a file gets the tail, so a file with nothing
 * moved is written exactly as before.
 * @param {any} document
 * @returns {boolean}
 */
export function hasMovedImport(document){
  return (document?.objects||[]).some((/** @type {any} */ o)=>{
    if(o.visible===false)return false;
    if(o.moved)return true;
    const d=o.kind==='stitch_layer'&&o.source?.defaultPlacement;
    return !!d&&(Math.abs(o.x-d.x)>1e-6||Math.abs(o.y-d.y)>1e-6);
  });
}

/**
 * Appends the anchor tail to an encoded file.
 * @param {Uint8Array} bytes
 * @param {number[]} [lead] bytes written before the tail, to end the stream where the format's reader stops (EXP needs an unknown control)
 * @returns {Uint8Array}
 */
export function withAnchorTail(bytes,lead=[]){
  const tail=[...lead,...new TextEncoder().encode(ANCHOR_TAIL)];
  const out=new Uint8Array(bytes.length+tail.length);out.set(bytes);out.set(tail,bytes.length);return out;
}

/**
 * True when a file ends with the anchor tail.
 * @param {Uint8Array} bytes
 * @returns {boolean}
 */
export function hasAnchorTail(bytes){
  const tail=new TextEncoder().encode(ANCHOR_TAIL);
  if(bytes.length<tail.length)return false;
  for(let i=0;i<tail.length;i++)if(bytes[bytes.length-tail.length+i]!==tail[i])return false;
  return true;
}
