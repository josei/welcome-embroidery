// The reference picture: loading a file into the project, the panel fields that place it, moving it on the canvas, and
// the raw or annotated picture an agent asks for. The picture is never sewn, sent to the stitch worker or exported.
// ReferenceLayer.tsx and ReferencePicture.tsx render it; app.js supplies the editor commands through configureReference.
import {documentNow, documentState} from './documentState.js';
import {geometry, hoopSize} from './engine.js';
import {interactionNow, setInteraction} from './interactionState.js';
import {referenceFieldsState, setReferenceFields} from './referenceFieldsState.js';
import {t} from './i18n.js';

/** The document's reference picture, as the engine stores it. */
interface ReferencePictureDoc {
  data: string;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
  name?: string;
}

/** What the editor must do for the reference picture, supplied by app.js. */
export interface ReferenceApi {
  /** Runs one undoable command through the document store. */
  edit(operations: unknown[], after?: () => void): boolean;
  /** Shows a short message to the user. */
  toast(message: string, kind?: 'status' | 'error'): void;
  /** A pointer event's position in millimetres on the canvas. */
  coord(e: {clientX: number; clientY: number}): [number, number];
}

/** Where the reference picture sits, in millimetres, with its switches. */
export interface ReferencePlacement {
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  name: string | null;
}

/** The annotated picture's millimetre box, so an agent can turn pixels back into coordinates. */
export interface ReferenceImageBox {
  x: number;
  y: number;
  w: number;
  h: number;
  pixelsPerMm: number;
}

/** What referenceForAgent returns: the placement plus the picture itself. */
export interface ReferenceForAgent {
  placement: ReferencePlacement | null;
  hoop: {w: number; h: number};
  image: string | null;
  imageBox?: ReferenceImageBox;
}

let api: ReferenceApi | null = null;

/** Wires the editor commands the reference picture needs, and keeps the panel fields in step with the document. */
export function configureReference(next: ReferenceApi) {
  api = next;
  syncReferenceFields();
  documentState.subscribe(syncReferenceFields);
}

/** The wired editor commands. app.js calls configureReference before anything can load or move the picture. */
function wired(): ReferenceApi {
  if (!api) throw Error('The reference picture is not wired.');
  return api;
}

/** The reference picture as it is stored, or undefined when the document has none. */
function stored(): ReferencePictureDoc | undefined {
  return documentNow().doc.reference;
}

/** Copies the stored placement, opacity and switches into the panel fields, and leaves move mode when it cannot move. */
function syncReferenceFields() {
  const r = stored();
  if (!r) {
    if (interactionNow().refMoving) setInteraction({refMoving: false});
    return;
  }
  const next = {
    refX: String(+r.x.toFixed(2)),
    refY: String(+r.y.toFixed(2)),
    refW: String(+r.w.toFixed(2)),
    refH: String(+r.h.toFixed(2)),
    refVisible: r.visible !== false,
    refLocked: Boolean(r.locked),
    refOpacity: r.opacity ?? 0.5,
  };
  const current = referenceFieldsState.get();
  const changed = (Object.keys(next) as Array<keyof typeof next>).some(key => current[key] !== next[key]);
  if (changed) setReferenceFields(next);
  if (r.locked && interactionNow().refMoving) setInteraction({refMoving: false});
}

/** Loads a picture file: the bitmap is scaled to at most 1,400 px, painted on white and placed inside the hoop. */
export async function loadReference(file: File) {
  const {edit, toast} = wired();
  try {
    const bmp = await createImageBitmap(file), hs = hoopSize(documentNow().doc);
    const scale = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    let q = 0.85, data = c.toDataURL('image/jpeg', q);
    while (data.length > 1_200_000 && q > 0.4) {
      q -= 0.1;
      data = c.toDataURL('image/jpeg', q);
    }
    if (data.length > 1_400_000) throw Error(t('That picture is too large to keep in the project.'));
    const fit = Math.min((hs.w - 4) / bmp.width, (hs.h - 4) / bmp.height);
    const mw = +(bmp.width * fit).toFixed(2), mh = +(bmp.height * fit).toFixed(2);
    edit([{
      op: 'set_reference',
      data,
      x: +(-mw / 2).toFixed(2),
      y: +(-mh / 2).toFixed(2),
      w: mw,
      h: mh,
      opacity: stored()?.opacity ?? 0.5,
      visible: true,
      locked: false,
      name: String(file.name || 'picture').slice(0, 200),
    }]);
    setReferenceFields({refOpen: true});
    toast(t('Reference picture loaded. Draw on top of it; it is not sewn.'));
  } catch (err) {
    toast((err as Error).message || t('That picture could not be read.'), 'error');
  }
}

/** Removes the picture from the project. */
export function removeReference() {
  wired().edit([{op: 'clear_reference'}]);
}

/** The panel calls this when a placement field is committed; false puts the stored value back. */
export function commitReferenceField(field: 'refX' | 'refY' | 'refW' | 'refH', text: string): boolean | void {
  const {edit} = wired(), r = stored();
  if (field === 'refX' || field === 'refY') {
    if (!Number.isFinite(Number(text))) return false;
    edit([{op: 'set_reference', [field === 'refX' ? 'x' : 'y']: Number(text)}]);
    return;
  }
  if (field === 'refW') {
    const w = Number(text);
    if (!(r && w >= 1)) return false;
    edit([{op: 'set_reference', w, h: +(r.h * w / r.w).toFixed(2)}]);
    return;
  }
  const h = Number(text);
  if (!(r && h >= 1)) return false;
  edit([{op: 'set_reference', h, w: +(r.w * h / r.h).toFixed(2)}]);
}

/** The panel calls this when the visible or locked switch is flipped. */
export function chooseReference(field: 'refVisible' | 'refLocked', checked: boolean) {
  wired().edit([{op: 'set_reference', ...(field === 'refVisible' ? {visible: checked} : {locked: checked})}]);
}

/** The opacity slider as it moves: shows the new opacity without committing an edit on every step. */
export function previewReferenceOpacity(percent: number) {
  setReferenceFields({refOpacity: Math.max(0.05, Math.min(1, percent / 100))});
}

/** The opacity slider when it is let go: one edit, skipped when the stored opacity is already that value. */
export function commitReferenceOpacity(percent: number) {
  const r = stored();
  if (!r) return;
  const value = Math.max(0.05, Math.min(1, percent / 100));
  if (value === (r.opacity ?? 0.5)) return;
  wired().edit([{op: 'set_reference', opacity: value}]);
}

/** Fit to hoop: centres the picture and scales it inside the hoop with a 4 mm margin. */
export function fitReference() {
  const r = stored();
  if (!r) return;
  const hs = hoopSize(documentNow().doc);
  const f = Math.min((hs.w - 4) / r.w, (hs.h - 4) / r.h);
  const w = +(r.w * f).toFixed(2), h = +(r.h * f).toFixed(2);
  wired().edit([{op: 'set_reference', x: +(-w / 2).toFixed(2), y: +(-h / 2).toFixed(2), w, h}]);
}

/** Move on canvas: switches between drawing and dragging the picture; only an unlocked picture can move. */
export function toggleReferenceMove() {
  const r = stored();
  if (!r || r.locked) return;
  const moving = !interactionNow().refMoving;
  setInteraction({refMoving: moving});
  if (moving) wired().toast(t('Drag on the canvas to move the picture. Press the button again to go back to drawing.'));
}

/** Starts a drag when move mode is on and the left button goes down over the canvas. */
export function startReferenceDrag(e: {button: number; pointerId: number; clientX: number; clientY: number}): boolean {
  const r = stored();
  if (!interactionNow().refMoving || e.button !== 0 || !r) return false;
  const start = wired().coord(e);
  setInteraction({refDrag: {start, x: r.x, y: r.y, pointerId: e.pointerId}});
  return true;
}

/** Moves the picture with the pointer; the committed position only changes on release. */
export function continueReferenceDrag(e: {pointerId: number; clientX: number; clientY: number}) {
  const drag = interactionNow().refDrag;
  if (!drag || e.pointerId !== drag.pointerId) return;
  const q = wired().coord(e);
  setInteraction({refDrag: {...drag, nx: drag.x + q[0] - drag.start[0], ny: drag.y + q[1] - drag.start[1]}});
}

/** Ends a drag with one set_reference, or none when the picture did not actually move. */
export function endReferenceDrag(e: {pointerId: number}) {
  const drag = interactionNow().refDrag;
  if (!drag || e.pointerId !== drag.pointerId) return;
  setInteraction({refDrag: null});
  if (drag.nx !== undefined && drag.ny !== undefined
    && (Math.abs(drag.nx - drag.x) > 0.01 || Math.abs(drag.ny - drag.y) > 0.01)) {
    wired().edit([{op: 'set_reference', x: +drag.nx.toFixed(2), y: +drag.ny.toFixed(2)}]);
  }
}

/** Drops a drag that the browser cancelled, keeping the stored position. */
export function cancelReferenceDrag(e: {pointerId: number}) {
  const drag = interactionNow().refDrag;
  if (drag && e.pointerId === drag.pointerId) setInteraction({refDrag: null});
}

/**
 * What an agent gets for the reference picture: the placement in millimetres plus either the raw picture or an
 * annotated view (the picture where it sits, a millimetre grid with labels, the hoop outline, the origin and
 * optionally the current shapes) so coordinates can be read straight off the image.
 */
export async function referenceForAgent({view = 'annotated', includeShapes = true}: {
  view?: 'raw' | 'annotated';
  includeShapes?: boolean;
} = {}): Promise<ReferenceForAgent> {
  const r = stored(), hs = hoopSize(documentNow().doc);
  if (!r) return {placement: null, hoop: hs, image: null};
  const placement: ReferencePlacement = {
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    opacity: r.opacity ?? 0.5,
    visible: r.visible !== false,
    locked: Boolean(r.locked),
    name: r.name || null,
  };
  if (view === 'raw') return {placement, hoop: hs, image: r.data};
  const bmp = await createImageBitmap(await (await fetch(r.data)).blob());
  const m = 6;
  const x0 = Math.min(-hs.w / 2, r.x) - m, y0 = Math.min(-hs.h / 2, r.y) - m;
  const x1 = Math.max(hs.w / 2, r.x + r.w) + m, y1 = Math.max(hs.h / 2, r.y + r.h) + m;
  const W = x1 - x0, H = y1 - y0, scale = Math.min(1000 / W, 1000 / H);
  const cw = Math.round(W * scale), ch = Math.round(H * scale);
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext('2d')!;
  const X = (x: number) => (x - x0) * scale, Y = (y: number) => (y - y0) * scale;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(bmp, X(r.x), Y(r.y), r.w * scale, r.h * scale);
  ctx.lineWidth = 1;
  ctx.font = '12px sans-serif';
  ctx.textBaseline = 'top';
  for (let gx = Math.ceil(x0 / 10) * 10; gx <= x1; gx += 10) {
    const major = gx % 20 === 0;
    ctx.strokeStyle = major ? 'rgba(0,90,120,.45)' : 'rgba(0,90,120,.18)';
    ctx.beginPath();
    ctx.moveTo(X(gx), 0);
    ctx.lineTo(X(gx), ch);
    ctx.stroke();
    if (major) {
      ctx.fillStyle = '#04506a';
      ctx.fillText(String(gx), X(gx) + 2, 2);
    }
  }
  for (let gy = Math.ceil(y0 / 10) * 10; gy <= y1; gy += 10) {
    const major = gy % 20 === 0;
    ctx.strokeStyle = major ? 'rgba(0,90,120,.45)' : 'rgba(0,90,120,.18)';
    ctx.beginPath();
    ctx.moveTo(0, Y(gy));
    ctx.lineTo(cw, Y(gy));
    ctx.stroke();
    if (major) {
      ctx.fillStyle = '#04506a';
      ctx.fillText(String(gy), 2, Y(gy) + 2);
    }
  }
  ctx.strokeStyle = '#d03a2a';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 5]);
  ctx.strokeRect(X(-hs.w / 2), Y(-hs.h / 2), hs.w * scale, hs.h * scale);
  ctx.setLineDash([]);
  ctx.strokeStyle = '#d03a2a';
  ctx.beginPath();
  ctx.moveTo(X(0) - 10, Y(0));
  ctx.lineTo(X(0) + 10, Y(0));
  ctx.moveTo(X(0), Y(0) - 10);
  ctx.lineTo(X(0), Y(0) + 10);
  ctx.stroke();
  ctx.fillStyle = '#d03a2a';
  ctx.fillText('0,0', X(0) + 6, Y(0) + 6);
  if (includeShapes) {
    for (const o of documentNow().doc.objects) {
      if (o.visible === false || o.kind === 'stitch_layer') continue;
      let lines: Array<Array<[number, number]>>;
      try {
        lines = geometry(o, 0);
      } catch {
        continue;
      }
      ctx.strokeStyle = o.thread || '#1c725d';
      ctx.lineWidth = 2;
      for (const line of lines) {
        if (line.length < 2) continue;
        ctx.beginPath();
        line.forEach(([px, py], i) => (i ? ctx.lineTo(X(px), Y(py)) : ctx.moveTo(X(px), Y(py))));
        ctx.stroke();
      }
    }
  }
  return {
    placement,
    hoop: hs,
    image: c.toDataURL('image/png'),
    imageBox: {x: +x0.toFixed(2), y: +y0.toFixed(2), w: +W.toFixed(2), h: +H.toFixed(2), pixelsPerMm: +scale.toFixed(3)},
  };
}
