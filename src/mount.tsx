import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import shellHtml from './shell.html?raw';

// React mounts the editor markup once. app.js then wires the controls it finds in the DOM.
// The markup stays HTML until it is split into components (queue item 1c).
function Shell({html}: {html: string}) {
 return <div style={{display: 'contents'}} dangerouslySetInnerHTML={{__html: html}} />;
}

flushSync(() => createRoot(document.getElementById('root')!).render(<Shell html={shellHtml} />));
