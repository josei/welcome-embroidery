// The editor's markup, drawn by React. The sprite, the layout and the overlays are separate components.
import {EditorIcons} from './EditorIcons';
import {ReadoutIcons} from './ReadoutIcons';
import {EditorLayout} from './EditorLayout';
import {EditorOverlays} from './EditorOverlays';

export function EditorShell() {
 return (
  <div style={{display: 'contents'}}>
   <EditorIcons />{" "}
   <ReadoutIcons />{" "}
   <EditorLayout />
   <EditorOverlays />
  </div>
 );
}
