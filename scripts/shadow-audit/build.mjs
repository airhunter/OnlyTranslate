import { build } from 'vite'
import { resolve } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'

// Standalone diagnostic bundle: no extension configuration, credentials or API calls.
await build({
  configFile: false,
  resolve: { alias: { '@': resolve('.') } },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'output/playwright/shadow-audit',
    copyPublicDir: false,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: 'scripts/shadow-audit/browser.ts',
      name: 'OnlyTranslateShadowAuditBundle',
      formats: ['iife'],
      fileName: () => 'audit.js',
    },
  },
})

const bundle = await readFile('output/playwright/shadow-audit/audit.js', 'utf8')
for (const mode of ['smart', 'full']) {
  await writeFile(`output/playwright/shadow-audit/run-${mode}.js`, `async (page) => {
    await page.evaluate(${JSON.stringify(bundle)});
    const result = await page.evaluate(() => window.OnlyTranslateShadowAudit.run('${mode}', 3));
    return result;
  }`)
}
await writeFile('output/playwright/shadow-audit/run-dynamic.js', 'async (page) => await page.evaluate(() => window.OnlyTranslateShadowAudit.stop())')
await writeFile(`output/playwright/shadow-audit/run-compare.js`, `async (page) => {
  await page.evaluate(${JSON.stringify(bundle)});
  return await page.evaluate(() => window.OnlyTranslateShadowAudit.compareProduction('smart', 10));
}`)
for (const action of ['more', 'expand']) {
  const click = action === 'more'
    ? "page.getByRole('button', { name: 'View more', exact: true }).click()"
    : "page.getByRole('listitem', { name: 'Registration & Networking', exact: true }).getByRole('button', { name: 'expand session details: Collapsed', exact: true }).click()"
  await writeFile(`output/playwright/shadow-audit/run-${action}.js`, `async (page) => {
    await page.goto('https://rsvp.withgoogle.com/events/devfest-in-siliconvalley-2025');
    await page.getByRole('heading', { name: 'DevFest in Silicon Valley 2025', exact: true }).waitFor();
    await page.waitForTimeout(2500);
    await page.evaluate(${JSON.stringify(bundle)});
    await page.evaluate(() => window.OnlyTranslateShadowAudit.watch('smart'));
    await ${click};
    await page.waitForTimeout(1500);
    return await page.evaluate(() => window.OnlyTranslateShadowAudit.stop());
  }`)
}
