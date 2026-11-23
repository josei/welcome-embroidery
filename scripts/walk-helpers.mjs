// Opens and closes the panels the way a user does. On a phone a panel is a sheet that opens from the Menu and closes with its ×
// control. On a tablet the same panels sit beside the canvas and are already open, so opening one is a no-op there.
const SHEETS = {layers: '#layersSheet', properties: '#inspector'};
const MENU_ROW = {layers: '#menuLayers', properties: '#menuProperties'};

async function onScreen(page, selector) {
  return page.locator(selector).evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.top < window.innerHeight && getComputedStyle(el).visibility !== 'hidden';
  });
}

export async function openPanel(page, which) {
  const sheet = SHEETS[which];
  if (await onScreen(page, sheet)) return;
  await page.locator('#phoneMenu').click();
  await page.locator(MENU_ROW[which]).click();
  await page.waitForFunction(s => document.querySelector(s)?.classList.contains('sheet-open'), sheet);
}

export async function closePanel(page, sheet) {
  const close = page.locator(`${sheet} [data-close-control]`);
  if (await close.count() && await close.first().isVisible()) await close.first().click();
}
