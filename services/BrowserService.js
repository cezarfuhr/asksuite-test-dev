const puppeteer = require('puppeteer');

class BrowserService {

    static getBrowser() {
        return puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-extensions'
            ]
        });
    }

    static closeBrowser(browser) {
        if (!browser) {
            return;
        }
        return browser.close();
    }
}

module.exports = BrowserService;
