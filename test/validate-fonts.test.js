import test from 'node:test';
import assert from 'node:assert/strict';
import {initialDocument,applyOperations,validateDocument} from '../src/engine.js';

const textDoc=(font,height=8)=>{const d=initialDocument();d.objects=[];applyOperations(d,[{op:'add_text',id:'t',text:'Hello',x:0,y:0,font:'welcome-mono/1',height,thread:'#527461'}]);
  d.objects[0].font=font;return d;};

test('an unbundled font is named in the validation message, not reported as a size problem',()=>{
  assert.throws(()=>validateDocument(textDoc('Lobster',8)),/lettering t uses the font “Lobster”, which is not bundled or stored in this project\./);
  assert.doesNotThrow(()=>validateDocument(textDoc('welcome-mono/1',8)));
});

test('a size failure names the font and its size range',()=>{
  assert.throws(()=>validateDocument(textDoc('welcome-mono/1',20)),/the size range of Welcome Mono is 4–16 mm/);
  assert.throws(()=>validateDocument(textDoc('neon-blinking/1',8)),/the size range of Néon blinking is 20–60 mm/);
});
