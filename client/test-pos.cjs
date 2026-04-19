const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        page.on('console', msg => console.log('LOG:', msg.text()));
        page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
        
        console.log('Navigating to login...');
        await page.goto('http://localhost:3005/login');
        await page.type('input[placeholder="Email"]', 'admin@skyra.com');
        await page.type('input[placeholder="Password"]', 'admin123');
        await page.click('button[type="submit"]');
        
        console.log('Waiting for Dashboard...');
        await page.waitForNavigation();
        
        console.log('Navigating to POS...');
        await page.goto('http://localhost:3005/pos');
        await page.waitForSelector('.pos-menu-card');
        
        console.log('Clicking Menu Card...');
        await page.click('.pos-menu-card');
        
        console.log('Clicking Bayar...');
        await page.waitForSelector('.pos-pay-btn');
        await page.click('.pos-pay-btn');
        
        await new Promise(r => setTimeout(r, 2000));
        await browser.close();
        console.log('Done.');
    } catch(err) {
        console.error('Puppeteer Script Error:', err);
    }
})();
