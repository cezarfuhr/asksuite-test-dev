import { PuppeteerProvider } from '../scraper-puppeteer/src/PuppeteerProvider';
import { PlaywrightProvider } from '../scraper-playwright/src/PlaywrightProvider';
import { IScraperProvider, ScrapeParams } from '../../shared/types/scraper.interface';

describe('Scraper Provider Contract Tests', () => {
  const providers: IScraperProvider[] = [
    new PuppeteerProvider(),
    new PlaywrightProvider()
  ];

  const validParams: ScrapeParams = {
    checkin: '2025-12-01',
    checkout: '2025-12-03',
    adults: 2
  };

  providers.forEach(provider => {
    describe(`${provider.getName()} Provider`, () => {

      test('should implement getName method', () => {
        expect(provider.getName).toBeDefined();
        expect(typeof provider.getName()).toBe('string');
        expect(provider.getName().length).toBeGreaterThan(0);
      });

      test('should implement healthCheck method', async () => {
        expect(provider.healthCheck).toBeDefined();

        const health = await provider.healthCheck();

        expect(health).toHaveProperty('healthy');
        expect(health).toHaveProperty('service');
        expect(health).toHaveProperty('timestamp');
        expect(typeof health.healthy).toBe('boolean');
        expect(typeof health.service).toBe('string');
        expect(typeof health.timestamp).toBe('string');
      });

      test('should implement scrape method', () => {
        expect(provider.scrape).toBeDefined();
        expect(typeof provider.scrape).toBe('function');
      });

      test('should return standardized success structure', async () => {
        const result = await provider.scrape(validParams);

        expect(result).toHaveProperty('success');
        expect(typeof result.success).toBe('boolean');

        if (result.success) {
          expect(result).toHaveProperty('data');
          expect(result).toHaveProperty('meta');
          expect(Array.isArray(result.data)).toBe(true);

          // Meta validation
          expect(result.meta).toHaveProperty('provider');
          expect(result.meta).toHaveProperty('executionTime');
          expect(result.meta).toHaveProperty('timestamp');
          expect(result.meta?.provider).toBe(provider.getName());
          expect(typeof result.meta?.executionTime).toBe('number');
          expect(typeof result.meta?.timestamp).toBe('string');

          // Room data validation
          if (result.data && result.data.length > 0) {
            result.data.forEach(room => {
              expect(room).toHaveProperty('name');
              expect(room).toHaveProperty('description');
              expect(room).toHaveProperty('price');
              expect(room).toHaveProperty('image');
              expect(typeof room.name).toBe('string');
              expect(typeof room.description).toBe('string');
              expect(typeof room.price).toBe('string');
              expect(typeof room.image).toBe('string');
            });
          }
        }
      }, 120000); // 2 minute timeout for scraping

      test('should return standardized error structure on invalid params', async () => {
        const invalidParams: ScrapeParams = {
          checkin: '',
          checkout: ''
        };

        const result = await provider.scrape(invalidParams);

        if (!result.success) {
          expect(result).toHaveProperty('error');
          expect(result.error).toHaveProperty('code');
          expect(result.error).toHaveProperty('message');
          expect(typeof result.error?.code).toBe('string');
          expect(typeof result.error?.message).toBe('string');
          expect(['SCRAPING_FAILED', 'TIMEOUT', 'BROWSER_CRASH', 'VALIDATION_ERROR']).toContain(result.error?.code);
        }
      }, 120000);

      test('should handle timeout gracefully', async () => {
        const result = await provider.scrape(validParams);

        // Should complete within reasonable time or return error
        expect(result).toHaveProperty('success');

        if (!result.success) {
          expect(result.error?.code).toBeDefined();
        }
      }, 120000);

      test('should return consistent data structure across multiple calls', async () => {
        const result1 = await provider.scrape(validParams);
        const result2 = await provider.scrape(validParams);

        expect(result1).toHaveProperty('success');
        expect(result2).toHaveProperty('success');

        if (result1.success && result2.success) {
          expect(Array.isArray(result1.data)).toBe(true);
          expect(Array.isArray(result2.data)).toBe(true);

          if (result1.data && result1.data.length > 0 && result2.data && result2.data.length > 0) {
            const room1 = result1.data[0];
            const room2 = result2.data[0];

            expect(Object.keys(room1).sort()).toEqual(Object.keys(room2).sort());
          }
        }
      }, 240000); // 4 minutes for two scrapes
    });
  });
});
