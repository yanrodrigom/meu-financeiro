// Gera os ícones PNG (192, 512 e maskable) a partir de SVG usando o Chromium do Playwright.
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

const mark = (scale = 1) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <rect x="118" y="160" width="276" height="200" rx="40" fill="#fff" opacity="0.96"/>
    <rect x="118" y="205" width="276" height="34" fill="#0b6e63" opacity="0.22"/>
    <circle cx="335" cy="300" r="22" fill="#0f9f6e"/>
    <path d="M160 300h88" stroke="#0e7a86" stroke-width="20" stroke-linecap="round"/>
    <path d="M372 104l11 27 27 11-27 11-11 27-11-27-27-11 27-11z" fill="#d9fbe9"/>
  </g>`;
const bg = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14b885"/><stop offset="1" stop-color="#0d6f80"/></linearGradient></defs>`;
const any = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}<rect width="512" height="512" rx="112" fill="url(#g)"/>${mark(1)}</svg>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}<rect width="512" height="512" fill="url(#g)"/>${mark(0.78)}</svg>`;

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/favicon.svg', any);
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, svg, size] of [['icon-192.png', any, 192], ['icon-512.png', any, 512], ['maskable-512.png', maskable, 512]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await browser.close();
console.log('ícones gerados');
