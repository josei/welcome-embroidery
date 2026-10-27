import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Header} from './components/Header';
import {EditorShell} from './components/EditorShell';

// React draws the whole editor once: the header, then the markup in src/components. app.js wires the
// controls it finds in the DOM after this (queue item 1c).
function Editor() {
 return (
  <>
   <Header />
   <EditorShell />
  </>
 );
}

flushSync(() => createRoot(document.getElementById('root')!).render(<Editor />));
