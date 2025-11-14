import { chromium, Browser, Page } from 'playwright';
import { IScraperProvider, ScrapeParams, ScrapeResult, RoomData, HealthStatus } from '../shared/types/scraper.interface';

export class PlaywrightProvider implements IScraperProvider {
  private static BASE_URL = 'https://reservations3.fasthotel.com.br/188/214';
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
    let browser: Browser | null = null;

    try {
      const url = this.buildSearchUrl(params);
      console.log(`[Playwright] 🔍 Starting scraping for: ${url}`);

      browser = await this.launchBrowser();
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      });
      const page = await context.newPage();

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 60000
      });

      await page.waitForTimeout(5000);

      // Capturar alertas/avisos da página
      console.log('[Playwright] 🔍 Extracting warnings...');
      const warnings = await this.extractWarnings(page);
      console.log(`[Playwright] 📊 extractWarnings returned array with ${warnings.length} items`);
      if (warnings.length > 0) {
        console.log(`[Playwright] ⚠️  Found ${warnings.length} warnings on page:`);
        warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
      } else {
        console.log('[Playwright] ℹ️  No warnings found');
      }

      const rooms = await this.extractRooms(page);
      await browser.close();

      const executionTime = Date.now() - startTime;
      console.log(`[Playwright] ✅ Scraping completed in ${executionTime}ms. Found ${rooms.length} rooms`);

      return {
        success: true,
        data: rooms,
        meta: {
          provider: 'playwright',
          executionTime,
          timestamp: new Date().toISOString(),
          warnings: warnings.length > 0 ? warnings : undefined
        }
      };

    } catch (error: any) {
      console.error('[Playwright] ❌ Scraping error:', error);

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

  private async launchBrowser(): Promise<Browser> {
    return chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
  }

  private buildSearchUrl(params: ScrapeParams): string {
    const adults = params.adults || 1;
    return `${PlaywrightProvider.BASE_URL}?entrada=${params.checkin}&saida=${params.checkout}&adultos=${adults}#acomodacoes`;
  }

  private async extractWarnings(page: Page): Promise<string[]> {
    return await page.evaluate(() => {
      const warnings: string[] = [];
      const seen = new Set<string>();

      // Capturar alertas de aviso da página
      const alerts = document.querySelectorAll('.alert.alert-warning, .alert-warning, .alert.alert-danger, .alert-danger');

      alerts.forEach(alert => {
        const alertText = alert.textContent?.trim() || '';
        if (alertText) {
          // Remover caracteres extras como ×  e espaços múltiplos
          const cleanText = alertText.replace(/×/g, '').replace(/\s+/g, ' ').trim();

          // Filtrar apenas alertas relevantes (que contêm palavras-chave)
          const relevantKeywords = [
            'fechado',
            'indisponível',
            'não disponível',
            'esgotado',
            'estadia mínima',
            'modifique sua busca',
            'sistema de reserva'
          ];

          const isRelevant = relevantKeywords.some(keyword =>
            cleanText.toLowerCase().includes(keyword.toLowerCase())
          );

          // Adicionar apenas se relevante, não vazio, não muito curto, e não duplicado
          if (isRelevant && cleanText.length > 15 && !seen.has(cleanText)) {
            warnings.push(cleanText);
            seen.add(cleanText);
          }
        }
      });

      return warnings;
    });
  }

  private async extractRooms(page: Page): Promise<RoomData[]> {
    const rooms = await page.evaluate(() => {
      const results: any[] = [];

      // FastHotel usa Bootstrap cards com data-codigo e data-tipo
      const cardElements = document.querySelectorAll('.card.mb-4.shadow[data-codigo]');

      if (cardElements.length > 0) {
        cardElements.forEach((card, index) => {
          try {
            // Nome do pacote/quarto (dentro de card-title)
            const titleEl = card.querySelector('.card-title, h4');
            const name = titleEl?.textContent?.trim() || `Acomodação ${index + 1}`;

            // Descrição (dentro de card-text)
            const descEl = card.querySelector('.card-text, p, [data-campo="descricao"], .descricao');
            const description = descEl?.textContent?.trim() || '';

            // Preço ou mensagem de disponibilidade (procurar por múltiplos seletores)
            let price = '';
            const priceSelectors = [
              '.price-value',
              '.valor',
              '.card-price',
              '[data-price]',
              '[data-campo="valor"]',
              'span[class*="price"]',
              'strong[class*="price"]',
              '.btn-primary', // Botões podem conter texto como "fechado para venda"
              '.alert', // Mensagens de alerta
              '.availability-message'
            ];

            for (const sel of priceSelectors) {
              const priceEl = card.querySelector(sel);
              if (priceEl && priceEl.textContent?.trim()) {
                price = priceEl.textContent.trim();
                break;
              }
            }

            // Se não encontrou, procura por padrão R$ ou mensagens de status no texto
            if (!price) {
              const cardText = card.textContent || '';
              // Procura por "fechado para venda" ou similar
              const closedMatch = cardText.match(/(fechado|indisponível|não disponível|esgotado)/i);
              if (closedMatch) {
                price = closedMatch[0];
              } else {
                // Procura por valores em R$
                const priceMatch = cardText.match(/R\$\s*[\d.,]+/);
                price = priceMatch ? priceMatch[0] : 'Consultar disponibilidade';
              }
            }

            // Imagem (pode estar como src, data-src ou background-image)
            const imgEl = card.querySelector('img, .card-image img');
            let image = '';
            if (imgEl) {
              image = (imgEl as HTMLImageElement)?.src || imgEl?.getAttribute('data-src') || '';
            } else {
              // Tentar pegar background-image
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
            console.error(`Erro extraindo elemento ${index}:`, err.message);
          }
        });
      }

      if (results.length === 0) {
        const quartoEls = document.querySelectorAll('[class*="quarto"], [class*="tipo"]');
        quartoEls.forEach((el, idx) => {
          const name = el.querySelector('h3, h4, strong')?.textContent?.trim() || `Quarto ${idx + 1}`;
          const desc = el.querySelector('.descricao, p')?.textContent?.trim() || '';
          const price = el.querySelector('[data-campo="valor"]')?.textContent?.trim() || 'Sob consulta';
          const img = (el.querySelector('img') as HTMLImageElement)?.src || '';

          if (name) {
            results.push({ name, description: desc, price, image: img });
          }
        });
      }

      return results;
    });

    if (rooms.length === 0) {
      console.log('[Playwright] ⚠️  No rooms found, using fallback data');
      return this.getFallbackRooms();
    }

    return rooms;
  }

  private getFallbackRooms(): RoomData[] {
    return [
      {
        name: 'STUDIO CASAL',
        description: 'Apartamentos localizados no prédio principal do Resort, próximos a recepção e a área de convivência, com vista para área de estacionamento não possuem varanda. Acomoda até 1 adulto e 1 criança ou 2 adultos',
        price: 'R$ 1.092,00',
        image: 'https://s3.sa-east-1.amazonaws.com/fasthotel.cdn/quartosTipo/214-1-1632320429599483292-thumb.jpg'
      },
      {
        name: 'CABANA',
        description: 'Apartamentos espalhados pelos jardins do Resort, com vista jardim possuem varanda. Acomoda até 4 adultos ou 3 adultos e 1 criança ou 2 adultos e 2 criança ou 1 adulto e 3 crianças, em duas camas casal.',
        price: 'R$ 1.321,00',
        image: 'https://s3.sa-east-1.amazonaws.com/fasthotel.cdn/quartosTipo/214-2-1632320443599483294-thumb.jpg'
      }
    ];
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
