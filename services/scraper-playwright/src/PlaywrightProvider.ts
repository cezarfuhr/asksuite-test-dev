import { chromium, Browser, Page } from 'playwright';
import { IScraperProvider, ScrapeParams, ScrapeResult, RoomData, HealthStatus, SiteConfig } from '../shared/types/site-config.interface';
import { getSiteConfig, isSiteConfigured, isSiteEnabled, getMockRoomsForSite } from '../config/sites';

export class PlaywrightProvider implements IScraperProvider {
  private browser: Browser | null = null;

  getName(): string {
    return 'playwright';
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      const testBrowser = await this.launchBrowser();
      await testBrowser.close();
      return {
        healthy: true,
        service: 'scraper-playwright',
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        healthy: false,
        service: 'scraper-playwright',
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async scrape(params: ScrapeParams): Promise<ScrapeResult> {
    const startTime = Date.now();
    const siteId = params.site || 'fasthotel';  // Default to fasthotel for backward compatibility

    console.log(`[Playwright] 🔍 Starting scrape for site: ${siteId}`);

    // Check if site is configured
    if (!isSiteConfigured(siteId)) {
      return this.createErrorResponse(
        'SITE_NOT_CONFIGURED',
        `Site "${siteId}" is not configured. Please add configuration in config/sites/${siteId}.config.ts`,
        siteId
      );
    }

    // Load site configuration
    const config = getSiteConfig(siteId);
    console.log(`[Playwright] 📋 Loaded config for: ${config.name}`);

    // Check if site is enabled (implemented)
    if (!isSiteEnabled(siteId)) {
      console.log(`[Playwright] ⚠️  Site "${siteId}" is not enabled, returning mock data`);
      return this.createMockResponse(siteId, config, startTime);
    }

    // Real scraping for enabled sites
    let browser: Browser | null = null;

    try {
      const url = config.urlBuilder(params);
      console.log(`[Playwright] 🌐 URL: ${url}`);

      browser = await this.launchBrowser(config);
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: config.settings?.userAgent ||
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      });

      const page = await context.newPage();

      // Anti-bot measures if enabled
      if (config.settings?.antiBot) {
        await this.applyAntiBot(page);
      }

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: config.settings?.timeout || 60000
      });

      await page.waitForTimeout(config.settings?.waitTime || 5000);

      // Extract warnings and rooms using site config
      console.log('[Playwright] 🔍 Extracting warnings...');
      const warnings = await this.extractWarnings(page, config);
      console.log(`[Playwright] 📊 Found ${warnings.length} warnings`);

      if (warnings.length > 0) {
        console.log(`[Playwright] ⚠️  Warnings:`);
        warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
      }

      console.log('[Playwright] 🔍 Extracting rooms...');
      const rooms = await this.extractRooms(page, config);

      await browser.close();

      const executionTime = Date.now() - startTime;
      console.log(`[Playwright] ✅ Scraping completed in ${executionTime}ms. Found ${rooms.length} rooms`);

      return {
        success: true,
        data: rooms,
        meta: {
          provider: 'playwright',
          site: siteId,
          executionTime,
          timestamp: new Date().toISOString(),
          warnings: warnings.length > 0 ? warnings : undefined
        }
      };

    } catch (error: any) {
      console.error(`[Playwright] ❌ Scraping error for ${config.name}:`, error);

      if (browser) {
        await browser.close().catch(() => {});
      }

      return {
        success: false,
        error: {
          code: this.getErrorCode(error),
          message: error.message,
          provider: 'playwright'
        }
      };
    }
  }

  private async launchBrowser(config?: SiteConfig): Promise<Browser> {
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ];

    // Add stealth mode if configured
    if (config?.settings?.antiBot) {
      args.push('--disable-blink-features=AutomationControlled');
    }

    return chromium.launch({
      headless: true,
      args
    });
  }

  private async applyAntiBot(page: Page): Promise<void> {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });
  }

  private async extractWarnings(page: Page, config: SiteConfig): Promise<string[]> {
    if (!config.selectors.warnings || config.selectors.warnings.length === 0) {
      return [];
    }

    const warningSelectors = config.selectors.warnings;

    return await page.evaluate((selectors) => {
      const warnings: string[] = [];
      const seen = new Set<string>();

      selectors.forEach((selector: string) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.textContent?.trim().replace(/×/g, '').replace(/\s+/g, ' ').trim();
          if (text && text.length > 15 && !seen.has(text)) {
            warnings.push(text);
            seen.add(text);
          }
        });
      });

      return warnings;
    }, warningSelectors);
  }

  private async extractRooms(page: Page, config: SiteConfig): Promise<RoomData[]> {
    const sel = config.selectors;
    const parsers = config.parsers;

    const rooms = await page.evaluate(({ selectors, parsersStr }) => {
      const results: any[] = [];
      const cards = document.querySelectorAll(selectors.roomCard);

      console.log(`Found ${cards.length} room cards with selector: ${selectors.roomCard}`);

      cards.forEach((card, index) => {
        try {
          // Extract name
          const nameEl = card.querySelector(selectors.roomName);
          let name = nameEl?.textContent?.trim() || `Room ${index + 1}`;

          // Extract description
          const descEl = card.querySelector(selectors.roomDescription);
          let description = descEl?.textContent?.trim() || '';

          // Extract price (try multiple selectors)
          let price = '';
          const priceSelectors = selectors.roomPrice.split(',').map((s: string) => s.trim());

          for (const priceSel of priceSelectors) {
            const priceEl = card.querySelector(priceSel);
            if (priceEl && priceEl.textContent?.trim()) {
              price = priceEl.textContent.trim();
              break;
            }
          }

          // Fallback: search for price patterns in card text
          if (!price) {
            const cardText = card.textContent || '';
            const closedMatch = cardText.match(/(fechado|indisponível|não disponível|esgotado)/i);
            if (closedMatch) {
              price = closedMatch[0];
            } else {
              const priceMatch = cardText.match(/R\$\s*[\d.,]+|US\$\s*[\d.,]+|\$\s*[\d.,]+/);
              price = priceMatch ? priceMatch[0] : 'Consultar disponibilidade';
            }
          }

          // Apply custom price parser if exists
          if (parsersStr?.price && price) {
            try {
              const parserFunc = eval(`(${parsersStr.price})`);
              price = parserFunc(price);
            } catch (e) {
              console.error('Error applying price parser:', e);
            }
          }

          // Extract image
          const imgEl = card.querySelector(selectors.roomImage);
          let image = '';
          if (imgEl) {
            image = (imgEl as HTMLImageElement)?.src || imgEl?.getAttribute('data-src') || '';
          } else {
            // Try background-image
            const cardImage = card.querySelector('.card-image');
            if (cardImage) {
              const bgImage = window.getComputedStyle(cardImage).backgroundImage;
              const urlMatch = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
              image = urlMatch ? urlMatch[1] : '';
            }
          }

          if (name && price) {
            results.push({ name, description, price, image });
          }
        } catch (err: any) {
          console.error(`Error extracting room ${index}:`, err.message);
        }
      });

      return results;
    }, { selectors: sel, parsersStr: parsers }) as RoomData[];

    if (rooms.length === 0) {
      console.log('[Playwright] ⚠️  No rooms found with configured selectors');
    }

    return rooms;
  }

  private createMockResponse(siteId: string, config: SiteConfig, startTime: number): ScrapeResult {
    const executionTime = Date.now() - startTime;
    const mockRooms = getMockRoomsForSite(siteId);

    return {
      success: true,
      data: mockRooms,
      meta: {
        provider: 'playwright',
        site: siteId,
        executionTime,
        timestamp: new Date().toISOString(),
        warnings: [
          `⚠️ MOCK DATA - Site "${config.name}" is not yet enabled.`,
          `To enable: Set enabled: true in config/sites/${siteId}.config.ts and verify selectors are correct.`
        ],
        mock: true
      }
    };
  }

  private createErrorResponse(code: string, message: string, siteId?: string): ScrapeResult {
    return {
      success: false,
      error: {
        code: code as any,
        message,
        provider: 'playwright'
      },
      meta: {
        provider: 'playwright',
        site: siteId,
        executionTime: 0,
        timestamp: new Date().toISOString()
      }
    };
  }

  private getErrorCode(error: any): 'SCRAPING_FAILED' | 'TIMEOUT' | 'BROWSER_CRASH' | 'VALIDATION_ERROR' {
    if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
      return 'TIMEOUT';
    }
    if (error.message?.includes('browser') || error.message?.includes('Browser')) {
      return 'BROWSER_CRASH';
    }
    if (error.message?.includes('validation') || error.message?.includes('invalid')) {
      return 'VALIDATION_ERROR';
    }
    return 'SCRAPING_FAILED';
  }
}
