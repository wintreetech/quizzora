import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('artifacts/review', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage();
const failures = [];
page.on('pageerror', (error) => failures.push(error.message));
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ['/', '/store', '/live', '/tournaments', '/pricing', '/help', '/how-it-works']) {
      await page.goto(`${process.env.REVIEW_URL || 'http://localhost:5173'}${path}`);
      await page.locator('h1').first().waitFor();
      await page.waitForTimeout(300);
      const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll('.main-shell *')].filter(el => { const r = el.getBoundingClientRect(); if (r.right <= innerWidth + 1 || r.width <= 0) return false; for(let p = el.parentElement; p && p !== document.body; p = p.parentElement) if(['hidden','auto','scroll','clip'].includes(getComputedStyle(p).overflowX)) return false; return true; }).map(el => ({ tag: el.tagName, class: el.className, text: el.textContent?.slice(0, 70), right: Math.round(el.getBoundingClientRect().right) })).slice(0, 10) }));
      if (layout.width > width) failures.push(JSON.stringify({ viewport: width, path, ...layout }));
      if ((width === 390 || width === 1440) && (path === '/' || path === '/store')) await page.screenshot({ path: `artifacts/review/${path === '/' ? 'discover' : 'store'}-${width}.png`, fullPage: true });
      if ((width === 390 || width === 1440) && path === '/how-it-works') await page.screenshot({ path: `artifacts/review/how-it-works-${width}.png`, fullPage: true });
    }
  }
  if (failures.length) throw new Error(failures.join('\n'));
  console.log('35 local route/viewport checks passed; no uncaught browser errors.');
} finally { await browser.close(); }
