// Manage layers: open Layers, hide and show an object, reorder the objects, close Layers.
import {openPanel, closePanel} from '../walk-helpers.mjs';

export default {
  name: 'manage-layers',
  steps: [
    {name: 'start', run: async () => {}},
    {name: 'open-layers', run: page => openPanel(page, 'layers')},
    {name: 'hide-object', run: async page => {
      await page.locator('.object-line .row-eye').first().click();
    }},
    {name: 'show-object', run: async page => {
      await page.locator('.object-line .row-eye').first().click();
    }},
    {name: 'reorder', run: async page => {
      const rows = page.locator('.object-row');
      if (await rows.count() < 2) return;
      await rows.nth(1).dragTo(rows.nth(0));
    }},
    {name: 'close-layers', run: page => closePanel(page, '#layersSheet')},
  ],
};
