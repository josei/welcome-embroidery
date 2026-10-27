import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import shellHtml from './shell.html?raw';
import {Header} from './components/Header';

// React mounts the editor once: the header as components, then the rest of the markup as HTML.
// app.js then wires the controls it finds in the DOM. The HTML is replaced panel by panel (queue item 1c).
function Shell({html}: {html: string}) {
 return (
  <>
   <Header />
   <div style={{display: 'contents'}} dangerouslySetInnerHTML={{__html: html}} />
  </>
 );
}

flushSync(() => createRoot(document.getElementById('root')!).render(<Shell html={shellHtml} />));
