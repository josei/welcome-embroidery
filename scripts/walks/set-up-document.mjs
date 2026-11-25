// Set up the document: with nothing selected, open Properties, choose a hoop preset, type a width and a height, rotate the hoop.
import {openPanel, closePanel} from '../walk-helpers.mjs';

export default {
  name: 'set-up-document',
  steps: [
    {name: 'start', run: async () => {}},
    {name: 'open-properties', run: async page => { await openPanel(page, 'properties'); await page.locator('#hoopPreset').scrollIntoViewIfNeeded(); }},
    {name: 'choose-preset', run: page => page.locator('#hoopPreset').selectOption('5x7in')},
    {name: 'type-width-height', run: async page => {
      for (const [id, v] of [['#hoopW', '150'], ['#hoopH', '200']]) { await page.locator(id).fill(v); await page.locator(id).press('Enter'); }
    }},
    {name: 'rotate-hoop', run: page => page.locator('#hoopRotate').click()},
    {name: 'close-properties', run: page => closePanel(page, '#inspector')},
  ],
};
