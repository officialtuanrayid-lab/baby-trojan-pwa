const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGE EXCEPTION:', e.message.slice(0, 300)));
  try {
    await page.goto('https://adaptia.isaacdev.workers.dev/', { waitUntil: 'commit', timeout: 45000 });
  } catch (e) { console.log('goto warning:', e.message.slice(0, 150)); }
  try { await page.waitForLoadState('domcontentloaded', { timeout: 30000 }); } catch (e) {}
  console.log('page title:', await page.title());
  await page.waitForTimeout(4000);
  try {
    const panel = await page.$('#catPanel');
    const vb = await page.$('#voiceBtn');
    console.log('catPanel exists:', !!panel, '| voiceBtn exists:', !!vb);
    if (vb) { await vb.click(); console.log('voiceBtn clicked'); }
    await page.waitForTimeout(800);
    console.log('catPanel active:', !!(await page.$('#catPanel.active')));
    console.log('storyOverlay active (bug?):', !!(await page.$('#storyOverlay.active')));
    await page.screenshot({ path: '/tmp/story-bug-panel.png' });
    // avatar story open
    const av = await page.$('#avatar');
    if (av) { await av.click(); console.log('avatar clicked'); }
    await page.waitForTimeout(1200);
    console.log('storyOverlay active after avatar:', !!(await page.$('#storyOverlay.active')));
    await page.screenshot({ path: '/tmp/story-bug-open.png' });
  } catch (e) { console.log('interact error:', e.message.slice(0, 200)); }
  await browser.close();
  console.log('DONE');
})().catch(e => { console.log('FATAL:', e.message.slice(0, 300)); process.exit(1); });
