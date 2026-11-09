import test from 'node:test';
import assert from 'node:assert/strict';
import {ES} from '../src/i18n.js';
import {objectLabel} from '../src/objectNames.js';
import {initialDocument,applyOperations,validateDocument,compile,jefWarnings} from '../src/engine.js';

const textDoc=(name)=>{const d=initialDocument();d.objects=[];applyOperations(d,[{op:'add_text',id:'t',text:'Hello',x:0,y:0,font:'welcome-mono/1',height:8,thread:'#527461'}]);
  if(name!==undefined)d.objects[0].name=name;else delete d.objects[0].name;d.objects[0].font='Lobster';return d;};

test('objectLabel uses the name when there is one and never the id', () => {
  assert.equal(objectLabel({id:'o_12',name:' Logo '}),'Logo');
  assert.equal(objectLabel({id:'o_12',name:'  ',kind:'rect'}),'This object');
  assert.equal(objectLabel({id:'o_12',kind:'text'}),'This lettering');
  assert.equal(objectLabel({id:'o_12',kind:'rect'},'other'),'another object');
  assert.equal(objectLabel({id:'o_12',kind:'text'},'other'),'another lettering');
});

test('lettering messages name the object, or fall back without its id', () => {
  assert.throws(()=>validateDocument(textDoc('Monograma')),/^Error: Invalid Welcome project: Monograma uses the font “Lobster”/);
  assert.throws(()=>validateDocument(textDoc()),/This lettering uses the font “Lobster”, which is not bundled or stored in this project\. Choose another font\./);
  const d=textDoc();d.objects[0].font='welcome-mono/1';d.objects[0].text='';
  assert.throws(()=>validateDocument(d),/This lettering needs text of 1 to 24 characters\. Type some text into it, or delete it\./);
});

test('the clipping and hoop messages avoid the id when the object has no name', () => {
  const d=initialDocument();d.objects=[];
  applyOperations(d,[{op:'add_shape',id:'big_1',kind:'rect',x:0,y:0,width:200,height:20,stitch:'fill'}]);delete d.objects[0].name;
  const msg=compile(d).errors.join(' | ');
  assert.match(msg,/^This object extends \d+(\.\d)? mm past the hoop\. Move it or choose a larger hoop\./);
  assert.doesNotMatch(msg,/big_1/);
});

test('the JEF warning is plain and keeps the design size', () => {
  const [w]=jefWarnings({bounds:[0,0,210,50]},'jef');
  assert.equal(w,'This design is 210 × 50 mm, bigger than a JEF machine can hoop (200 × 200 mm). Make it smaller or export another format.');
  for(const bad of ['hoop code','header','distances']) assert.ok(!w.includes(bad),bad);
  assert.equal(ES[w.replace('210','{w}').replace('50','{h}')],'Este diseño mide {w} × {h} mm, más grande de lo que una máquina JEF puede bordar (200 × 200 mm). Hazlo más pequeño o exporta otro formato.');
});

test('no translation string interpolates an internal id', () => {
  for (const [k,v] of Object.entries(ES)) {
    assert.ok(!k.includes('{id}'),`key still takes an id: ${k}`);
    assert.ok(!String(v).includes('{id}'),`translation still takes an id: ${k}`);
  }
});
