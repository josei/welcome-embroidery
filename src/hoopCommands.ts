// The hoop row's edits: a preset, rotate and the width and height fields. Each writes the hoop through the same edit
// command, remembers it in the browser and fits the canvas to it.
import {documentNow} from './documentState.js';
import {hoopActions, setHoopFields} from './hoopState.js';
import {HOOP_PRESETS, hoopSize} from './engine.js';

/** What the hoop row needs from the editor. */
export interface HoopApi {
  /** Runs one undoable command through the document store. */
  edit(operations: unknown[], after?: () => void): boolean;
  /** Fits the canvas to the hoop after a change. */
  fitHoop(): void;
}

let api: HoopApi | null = null;

function wired(): HoopApi {
  if (!api) throw Error('The hoop row is not wired.');
  return api;
}

function setHoop(width: number, height: number) {
  if (!wired().edit([{op: 'set_hoop', width, height}])) return;
  try {
    localStorage.setItem('welcome.hoop', JSON.stringify(hoopSize(documentNow().doc)));
  } catch {
    // The hoop simply is not remembered when the browser refuses storage.
  }
  wired().fitHoop();
}

/** Wires the hoop row, once. */
export function configureHoopCommands(next: HoopApi) {
  api = next;
  hoopActions.preset = key => {
    const preset = HOOP_PRESETS.find(v => v.key === key);
    if (preset) {
      setHoop(preset.w, preset.h);
      return;
    }
    const current = hoopSize(documentNow().doc);
    setHoopFields({preset: HOOP_PRESETS.some(v => v.w === current.w && v.h === current.h) ? key : 'custom'});
  };
  hoopActions.rotate = () => {
    if (!wired().edit([{op: 'rotate_hoop'}])) return;
    try {
      localStorage.setItem('welcome.hoop', JSON.stringify(hoopSize(documentNow().doc)));
    } catch {
      // The hoop simply is not remembered when the browser refuses storage.
    }
    wired().fitHoop();
  };
  hoopActions.commit = (field, text) => {
    const current = hoopSize(documentNow().doc);
    if (field === 'hoopW') setHoop(Number(text), current.h);
    else setHoop(current.w, Number(text));
  };
}
