/**
 * The object list's actions. The list (ObjectList.tsx) calls them; app.js runs them, since they change the selection or the
 * document through the same paths as the canvas.
 */
export const layersActions: {
  select: (ids: string[], primary: string) => void;
  setVisible: (ids: string[], visible: boolean) => void;
  setLocked: (ids: string[], locked: boolean) => void;
  reorder: (id: string, index: number) => void;
  rename: (id: string, text: string | null) => void;
} = {
  select() {},
  setVisible() {},
  setLocked() {},
  reorder() {},
  rename() {},
};
