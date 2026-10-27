import type {ReactElement} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import shellHtml from './shell.html?raw';
import {Header} from './components/Header';
import {DocumentSettings} from './components/DocumentSettings';
import {ReferencePicture} from './components/ReferencePicture';
import {SewingOrder} from './components/SewingOrder';
import {ThreadPlan} from './components/ThreadPlan';
import {TransformPanel} from './components/TransformPanel';

// Panels rendered by React into a <div data-react-panel="Name"> placeholder in shell.html.
// Add a panel here when its markup moves out of the HTML.
const panels: Record<string, () => ReactElement> = {DocumentSettings, ReferencePicture, SewingOrder, ThreadPlan, TransformPanel};

// React mounts the editor once: the header, then the markup in shell.html. Each panel then renders
// into its placeholder, all before app.js wires the controls it finds in the DOM (queue item 1c).
function Shell({html}: {html: string}) {
 return (
  <>
   <Header />
   <div style={{display: 'contents'}} dangerouslySetInnerHTML={{__html: html}} />
  </>
 );
}

flushSync(() => createRoot(document.getElementById('root')!).render(<Shell html={shellHtml} />));
for (const node of document.querySelectorAll<HTMLElement>('[data-react-panel]')) {
 const Panel = panels[node.dataset.reactPanel!];
 flushSync(() => createRoot(node).render(<Panel />));
}
