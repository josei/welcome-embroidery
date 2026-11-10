import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wheelZoomFactor,wheelZooms} from '../src/wheelZoom.js';

test('one wheel notch zooms about 1.2x in and out, with or without Ctrl/⌘', () => {
  for(const mods of [{}, {ctrlKey:true}, {metaKey:true}]){
    const inF=wheelZoomFactor({deltaY:-100,deltaX:0,deltaMode:0,...mods});
    const outF=wheelZoomFactor({deltaY:100,deltaX:0,deltaMode:0,...mods});
    assert.ok(inF>1.15&&inF<1.25,`in ${inF}`);
    assert.ok(outF<1/1.15&&outF>1/1.25,`out ${outF}`);
    assert.ok(Math.abs(inF*outF-1)<1e-12);
  }
});

test('a line-mode wheel notch is treated as a notch', () => {
  const f=wheelZoomFactor({deltaY:-3,deltaX:0,deltaMode:1,ctrlKey:true});
  assert.ok(f>1.15&&f<1.25,`${f}`);
});

test('a trackpad pinch with Ctrl keeps its smooth curve', () => {
  const f=wheelZoomFactor({deltaY:-4.5,deltaX:0,deltaMode:0,ctrlKey:true});
  assert.equal(f,Math.exp(4.5*.01));
});

test('wheelZooms routes Ctrl/⌘ and notches to zoom, plain trackpad to pan', () => {
  assert.equal(wheelZooms({deltaY:-100,deltaX:0,deltaMode:0}),true);
  assert.equal(wheelZooms({deltaY:-4.5,deltaX:2,deltaMode:0,ctrlKey:true}),true);
  assert.equal(wheelZooms({deltaY:-4.5,deltaX:2,deltaMode:0}),false);
});
