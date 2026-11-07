// @ts-check
// Photo fills: a photo's pixels become a greyscale PNG data URL for the pattern that paints it on the canvas.
// Results are cached by the photo's size and a fingerprint of its data, so redrawing does not re-encode it.

/** @type {Map<string, string>} */
const photoUrls=new Map();

/**
 * @param {{pw: number, ph: number, data: string}} ph the photo: its pixel size and base64 greyscale bytes
 * @returns {string} a PNG data URL
 */
export function photoUrl(ph){const key=ph.pw+'x'+ph.ph+':'+ph.data.slice(0,64)+ph.data.length;let u=photoUrls.get(key);if(u)return u;const c=
  document.createElement('canvas');c.width=ph.pw;c.height=ph.ph;const ctx=/** @type {CanvasRenderingContext2D} */(c.getContext('2d')),img=
  ctx.createImageData(ph.pw,ph.ph),bin=atob(ph.data);
  for(let i=0;i<ph.pw*ph.ph;i++){const g=bin.charCodeAt(i)||0;img.data[i*4]=img.data[i*4+1]=img.data[i*4+2]=g;img.data[i*4+3]=255;}ctx.putImageData(img,0,0);u=
  c.toDataURL('image/png');photoUrls.set(key,u);return u;}
