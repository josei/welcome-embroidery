// Edit an object's details: select an object, open Properties, change a value, close Properties.
import {openPanel, closePanel} from '../walk-helpers.mjs';

export default {
  name: 'edit-object-details',
  steps: [
    {name: 'start', run: async () => {}},
    {name: 'select-object', run: async page => {
      await page.locator('#rect').click();
      await page.locator('.sel-box').waitFor();
    }},
    {name: 'open-properties', run: page => openPanel(page, 'properties')},
    {name: 'change-width', run: async page => {
      const width = page.locator('#sizeW');
      await width.fill('30');
      await width.press('Enter');
    }},
    {name: 'close-properties', run: page => closePanel(page, '#inspector')},
  ],
};
