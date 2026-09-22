const { chromium } = require('playwright');
(async () => {
  try {
    const browser = await chromium.launch({headless:true, args:['--no-sandbox','--disable-dev-shm-usage']});
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', err => errors.push('PAGE: '+err.message.substring(0,300)));
    page.on('console', msg => { if(msg.type()==='error') errors.push('CON: '+msg.text().substring(0,300)); });
    
    // Use local file
    await page.goto('file:///root/baby-trojan-render/core-memory/decoded-index.html', {timeout:15000});
    await page.waitForTimeout(6000);
    
    const state = await page.evaluate(() => {
      const sp = document.getElementById('splash');
      const wl = document.getElementById('welcome');
      return {
        splash: sp ? 'EXISTS disp:'+getComputedStyle(sp).display+' opa:'+getComputedStyle(sp).opacity : 'REMOVED',
        welcome: wl ? 'exists disp:'+getComputedStyle(wl).display+' opa:'+getComputedStyle(wl).opacity+' cls:'+wl.className : 'MISSING',
        bodyCls: document.body.className,
        splashWelcome: (document.getElementById('splashWelcome')||{}).innerHTML || 'N/A',
        headerName: (document.getElementById('headerName')||{}).textContent || 'N/A'
      };
    });
    console.log(JSON.stringify(state, null, 2));
    console.log('Errors (' + errors.length + '):');
    errors.forEach(e => console.log('  '+e));
    await browser.close();
  } catch(e) {
    console.log('FAIL:', e.message.substring(0,500));
  }
})();
