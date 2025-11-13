import { PuppeteerProvider } from '../scraper-puppeteer/src/PuppeteerProvider';
import { PlaywrightProvider } from '../scraper-playwright/src/PlaywrightProvider';
import { ScrapeParams } from '../../shared/types/scraper.interface';

describe('Provider Comparison Tests (A/B Shadow Mode)', () => {
  const puppeteerProvider = new PuppeteerProvider();
  const playwrightProvider = new PlaywrightProvider();

  const testParams: ScrapeParams = {
    checkin: '2025-12-01',
    checkout: '2025-12-03',
    adults: 2
  };

  test('should return similar results for same search parameters', async () => {
    const [puppeteerResult, playwrightResult] = await Promise.all([
      puppeteerProvider.scrape(testParams),
      playwrightProvider.scrape(testParams)
    ]);

    expect(puppeteerResult.success).toBe(true);
    expect(playwrightResult.success).toBe(true);

    if (puppeteerResult.success && playwrightResult.success &&
        puppeteerResult.data && playwrightResult.data) {

      // Allow ±20% variance in room count (more lenient for real-world scraping)
      const variance = Math.abs(
        puppeteerResult.data.length - playwrightResult.data.length
      ) / Math.max(puppeteerResult.data.length, 1);

      console.log(`Room count comparison:
        Puppeteer: ${puppeteerResult.data.length}
        Playwright: ${playwrightResult.data.length}
        Variance: ${(variance * 100).toFixed(2)}%
      `);

      expect(variance).toBeLessThan(0.2);

      // Structure validation
      if (puppeteerResult.data.length > 0 && playwrightResult.data.length > 0) {
        expect(puppeteerResult.data[0]).toMatchObject({
          name: expect.any(String),
          description: expect.any(String),
          price: expect.any(String),
          image: expect.any(String)
        });
        expect(playwrightResult.data[0]).toMatchObject({
          name: expect.any(String),
          description: expect.any(String),
          price: expect.any(String),
          image: expect.any(String)
        });
      }
    }
  }, 240000);

  test('should compare execution times (performance)', async () => {
    const puppeteerStart = Date.now();
    const puppeteerResult = await puppeteerProvider.scrape(testParams);
    const puppeteerTime = Date.now() - puppeteerStart;

    const playwrightStart = Date.now();
    const playwrightResult = await playwrightProvider.scrape(testParams);
    const playwrightTime = Date.now() - playwrightStart;

    console.log(`Performance comparison:
      Puppeteer: ${puppeteerTime}ms
      Playwright: ${playwrightTime}ms
      Difference: ${Math.abs(puppeteerTime - playwrightTime)}ms
      Playwright is ${playwrightTime < puppeteerTime ? 'faster' : 'slower'} by ${Math.abs(((playwrightTime - puppeteerTime) / puppeteerTime * 100).toFixed(2))}%
    `);

    // Meta data validation
    if (puppeteerResult.success && puppeteerResult.meta) {
      expect(puppeteerResult.meta.executionTime).toBeGreaterThan(0);
      expect(puppeteerResult.meta.provider).toBe('puppeteer');
    }

    if (playwrightResult.success && playwrightResult.meta) {
      expect(playwrightResult.meta.executionTime).toBeGreaterThan(0);
      expect(playwrightResult.meta.provider).toBe('playwright');
    }

    // Both should complete within reasonable time
    expect(puppeteerTime).toBeLessThan(120000); // 2 minutes
    expect(playwrightTime).toBeLessThan(120000); // 2 minutes
  }, 240000);

  test('should extract same room names (data quality)', async () => {
    const [puppeteerResult, playwrightResult] = await Promise.all([
      puppeteerProvider.scrape(testParams),
      playwrightProvider.scrape(testParams)
    ]);

    if (puppeteerResult.success && playwrightResult.success &&
        puppeteerResult.data && playwrightResult.data &&
        puppeteerResult.data.length > 0 && playwrightResult.data.length > 0) {

      const puppeteerNames = new Set(puppeteerResult.data.map(r => r.name.toLowerCase().trim()));
      const playwrightNames = new Set(playwrightResult.data.map(r => r.name.toLowerCase().trim()));

      console.log(`Room names comparison:
        Puppeteer rooms: ${Array.from(puppeteerNames).join(', ')}
        Playwright rooms: ${Array.from(playwrightNames).join(', ')}
      `);

      // At least 50% of room names should match
      const commonNames = Array.from(puppeteerNames).filter(name => playwrightNames.has(name));
      const matchRate = commonNames.length / Math.max(puppeteerNames.size, playwrightNames.size);

      console.log(`Match rate: ${(matchRate * 100).toFixed(2)}%`);
      expect(matchRate).toBeGreaterThan(0.5);
    }
  }, 240000);

  test('should handle errors consistently', async () => {
    const invalidParams: ScrapeParams = {
      checkin: 'invalid-date',
      checkout: 'invalid-date'
    };

    const [puppeteerResult, playwrightResult] = await Promise.all([
      puppeteerProvider.scrape(invalidParams),
      playwrightProvider.scrape(invalidParams)
    ]);

    // Both should handle errors gracefully
    expect(puppeteerResult).toHaveProperty('success');
    expect(playwrightResult).toHaveProperty('success');

    if (!puppeteerResult.success) {
      expect(puppeteerResult.error).toBeDefined();
      expect(puppeteerResult.error?.code).toBeDefined();
    }

    if (!playwrightResult.success) {
      expect(playwrightResult.error).toBeDefined();
      expect(playwrightResult.error?.code).toBeDefined();
    }
  }, 120000);

  test('should maintain consistent success rates over multiple runs', async () => {
    const runs = 5;
    const results = {
      puppeteer: { successes: 0, failures: 0, totalTime: 0 },
      playwright: { successes: 0, failures: 0, totalTime: 0 }
    };

    for (let i = 0; i < runs; i++) {
      console.log(`Run ${i + 1}/${runs}`);

      const puppeteerStart = Date.now();
      const puppeteerResult = await puppeteerProvider.scrape(testParams);
      const puppeteerTime = Date.now() - puppeteerStart;

      const playwrightStart = Date.now();
      const playwrightResult = await playwrightProvider.scrape(testParams);
      const playwrightTime = Date.now() - playwrightStart;

      if (puppeteerResult.success) {
        results.puppeteer.successes++;
      } else {
        results.puppeteer.failures++;
      }
      results.puppeteer.totalTime += puppeteerTime;

      if (playwrightResult.success) {
        results.playwright.successes++;
      } else {
        results.playwright.failures++;
      }
      results.playwright.totalTime += playwrightTime;

      // Wait 2 seconds between runs
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const puppeteerSuccessRate = (results.puppeteer.successes / runs) * 100;
    const playwrightSuccessRate = (results.playwright.successes / runs) * 100;
    const puppeteerAvgTime = results.puppeteer.totalTime / runs;
    const playwrightAvgTime = results.playwright.totalTime / runs;

    console.log(`
Success Rate Summary (${runs} runs):
  Puppeteer: ${puppeteerSuccessRate.toFixed(2)}% (${results.puppeteer.successes}/${runs})
  Playwright: ${playwrightSuccessRate.toFixed(2)}% (${results.playwright.successes}/${runs})

Average Execution Time:
  Puppeteer: ${puppeteerAvgTime.toFixed(0)}ms
  Playwright: ${playwrightAvgTime.toFixed(0)}ms
  Performance improvement: ${(((puppeteerAvgTime - playwrightAvgTime) / puppeteerAvgTime) * 100).toFixed(2)}%
    `);

    // Both should have >80% success rate
    expect(puppeteerSuccessRate).toBeGreaterThan(80);
    expect(playwrightSuccessRate).toBeGreaterThan(80);
  }, 600000); // 10 minutes for 5 runs
});
