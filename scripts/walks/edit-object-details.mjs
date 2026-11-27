// Edit an object's details: select an object, open Properties, change a value, close Properties.
import {openPanel, closePanel} from '../walk-helpers.mjs';

export default {
  name: 'edit-object-details',
  steps: [
    {name: 'start', run: async () => {}},
    {name: 'select-object', run: async page => {
      await openPanel(page, 'layers');
      await page.locator('.object-row[data-id="leaf"]').click();
      await closePanel(page, '#layersSheet');
      await page.locator('.sel-box').waitFor();
    }},
    {name: 'open-properties', run: page => openPanel(page, 'properties')},
    {name: 'change-width', run: async page => {
      const width = page.locator('#sizeW');
      await width.fill('30');
      await width.press('Enter');
    }},
    {name: 'move-past-hoop', run: async page => {
      // Moved so its right edge runs past the 400 mm hoop: the editor reports one issue, and the top bar shows it.
      const x = page.locator('#posX');
      await x.fill('390');
      await x.press('Enter');
      await page.locator('#issuesBtn').waitFor();
    }},
    {name: 'close-properties', run: page => closePanel(page, '#inspector')},
  ],
};
