// @ts-check
// The object context menu: a list of commands opened at a point on screen. One menu is open at a time. It closes when a
// command runs, when a press lands outside it, or when the canvas asks.
import {t} from './i18n.js';

export function createContextMenu(){
  /** @type {any} */
  let menu=null;
  function close(){menu?.remove();menu=null;}
  /** @param {any} target */
  function closeIfOutside(target){if(menu&&!menu.contains(target))close();}
  /**
   * @param {any[]} items
   * @param {number} x
   * @param {number} y
   */
  function open(items,x,y){
    if(!items.length)return;close();
    menu=document.createElement('div');menu.id='ctxMenu';menu.setAttribute('role','menu');
    for(const it of items){if(it==='-'){menu.append(document.createElement('hr'));
    continue;
    }const b=document.createElement('button');
    b.type='button';
    b.setAttribute('role','menuitem');
    b.disabled=Boolean(it.disabled);
    b.innerHTML=`<span></span><kbd></kbd>`;
    /** @type {HTMLElement} */(b.firstChild).textContent=t(it.label);
    /** @type {HTMLElement} */(b.lastChild).textContent=it.key||'';
    b.onclick=()=>{close();
    it.run();
    };
    menu.append(b);
    }
    document.body.append(menu);
    const r=menu.getBoundingClientRect();
    menu.style.left=Math.min(x,innerWidth-r.width-8)+'px';
    menu.style.top=Math.min(y,innerHeight-r.height-8)+'px';
    /** @type {HTMLElement|null} */(menu.querySelector('button:not(:disabled)'))?.focus();
  }
  return {close,closeIfOutside,open};
}
