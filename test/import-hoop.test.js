import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,applyOperations,importStitchLayer,initialDocument} from '../src/engine.js';
import {layerPastHoop} from '../src/importHoop.js';
import {pinnedMachineFixture} from './fixture-archive.js';

// The import toast reads the compile of the imported document: an out-of-hoop layer is reported in plan.issues under its id.
test('an imported layer that extends past the hoop is reported for the import toast', () => {
  const {bytes,fileName}=pinnedMachineFixture('jef'),doc=initialDocument(),layer=importStitchLayer(bytes,'jef',{fileName});
  doc.objects=[layer];
  applyOperations(doc,[{op:'transform',id:layer.id,x:200}]);
  const plan=compile(doc);
  assert.match(plan.errors.join(' '),/past the hoop/);
  assert.equal(layerPastHoop(plan,doc.revision,layer.id),true);
});

test('an imported layer that fits the hoop keeps the plain success toast', () => {
  const {bytes,fileName}=pinnedMachineFixture('jef'),doc=initialDocument(),layer=importStitchLayer(bytes,'jef',{fileName});
  doc.objects=[layer];
  const plan=compile(doc);
  assert.deepEqual(plan.errors,[]);
  assert.equal(layerPastHoop(plan,doc.revision,layer.id),false);
});

test('a plan from another revision or a missing plan does not claim the layer is past the hoop', () => {
  assert.equal(layerPastHoop(null,1,'x'),false);
  assert.equal(layerPastHoop({revision:1,issues:[{id:'x'}]},2,'x'),false);
});
