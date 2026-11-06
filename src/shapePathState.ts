// The shape and path tools panel's buttons. Each one edits the selection; app.js wires them through configureShapePathActions.
export const shapePathActions: {
  offset: (text: string) => void;
  strokeToShape: (text: string) => void;
  simplify: (text: string) => void;
  roundCorners: (text: string) => void;
  reverse: () => void;
  split: () => void;
  join: () => void;
  selectSameThread: () => void;
  redworkOutline: () => void;
  appliqueFromSelection: () => void;
  redworkGroup: () => void;
  removeSmallHoles: (text: string) => void;
  removeSmallIslands: (text: string) => void;
} = {
  offset() {},
  strokeToShape() {},
  simplify() {},
  roundCorners() {},
  reverse() {},
  split() {},
  join() {},
  selectSameThread() {},
  redworkOutline() {},
  appliqueFromSelection() {},
  redworkGroup() {},
  removeSmallHoles() {},
  removeSmallIslands() {},
};
