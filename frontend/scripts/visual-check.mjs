import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('.cache/screens',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const width of [1440,1280,1024,768,390,320]){await page.setViewportSize({width,height:width>700?1024:844});await page.goto('http://localhost:5173/',{waitUntil:'networkidle'});await page.locator('.page-heading h1').waitFor();await page.screenshot({path:`.cache/screens/discover-${width}.png`,fullPage:true});const data=await page.evaluate(()=>({width:window.innerWidth,scroll:document.documentElement.scrollWidth,cards:document.querySelectorAll('.quiz-card').length}));console.log(JSON.stringify(data));}
console.log('BROWSER_ERRORS',JSON.stringify(errors));await browser.close();
