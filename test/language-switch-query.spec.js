import {test,expect} from '@playwright/test';

// Choosing a language in Settings must win over a ?lang= in the address, which would otherwise
// reapply the old language on every reload.
const chooseLanguage=async(page,buttonId)=>{
 await page.locator('#settingsBtn').click();
 await page.locator('#'+buttonId).click();
};

test('choosing Español from a ?lang=en address reloads in Spanish',async({page})=>{
 await page.goto('/?lang=en');
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await chooseLanguage(page,'langEs');
 await expect(page.locator('html')).toHaveAttribute('lang','es');
 await expect(page.locator('#export')).toHaveText('Exportar');
 expect(new URL(page.url()).searchParams.has('lang')).toBe(false);
});

test('choosing English from a ?lang=es address reloads in English',async({page})=>{
 await page.goto('/?lang=es');
 await expect(page.locator('html')).toHaveAttribute('lang','es');
 await chooseLanguage(page,'langEn');
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.locator('#export')).toHaveText('Export');
 expect(new URL(page.url()).searchParams.has('lang')).toBe(false);
});
