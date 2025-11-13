import axios from 'axios';
import { CircuitBreaker } from './CircuitBreaker';
import { ScrapeParams, ScrapeResult } from '../shared/types/scraper.interface';

export interface ProviderConfig {
  name: string;
  url: string;
  enabled: boolean;
}

export class ProviderOrchestrator {
  private providers: Map<string, ProviderConfig> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private playwrightTrafficPercentage: number;

  constructor() {
    this.playwrightTrafficPercentage = parseInt(process.env.PLAYWRIGHT_TRAFFIC_PERCENTAGE || '20', 10);

    // Register providers
    this.registerProvider({
      name: 'puppeteer',
      url: process.env.PUPPETEER_SERVICE_URL || 'http://scraper-puppeteer:3001',
      enabled: true
    });

    this.registerProvider({
      name: 'playwright',
      url: process.env.PLAYWRIGHT_SERVICE_URL || 'http://scraper-playwright:3002',
      enabled: true
    });

    console.log(`[Orchestrator] Initialized with ${this.playwrightTrafficPercentage}% Playwright traffic`);
  }

  private registerProvider(config: ProviderConfig): void {
    this.providers.set(config.name, config);
    this.circuitBreakers.set(config.name, new CircuitBreaker(config.name));
    console.log(`[Orchestrator] Registered provider: ${config.name} (${config.url})`);
  }

  async scrape(params: ScrapeParams): Promise<ScrapeResult> {
    const primaryProvider = this.selectProvider();
    console.log(`[Orchestrator] Selected provider: ${primaryProvider}`);

    try {
      return await this.scrapeWithProvider(primaryProvider, params);
    } catch (error) {
      console.log(`[Orchestrator] Primary provider ${primaryProvider} failed, trying fallback`);
      return await this.fallbackChain(primaryProvider, params);
    }
  }

  private async scrapeWithProvider(providerName: string, params: ScrapeParams): Promise<ScrapeResult> {
    const provider = this.providers.get(providerName);
    const circuitBreaker = this.circuitBreakers.get(providerName);

    if (!provider || !provider.enabled) {
      throw new Error(`Provider ${providerName} not available`);
    }

    if (!circuitBreaker) {
      throw new Error(`Circuit breaker for ${providerName} not found`);
    }

    return await circuitBreaker.execute(async () => {
      const response = await axios.post(
        `${provider.url}/scrape`,
        params,
        { timeout: 65000 }
      );

      if (!response.data.success) {
        throw new Error(`Provider ${providerName} returned error: ${response.data.error?.message}`);
      }

      return response.data;
    });
  }

  private async fallbackChain(failedProvider: string, params: ScrapeParams): Promise<ScrapeResult> {
    const fallbackProviders = Array.from(this.providers.keys()).filter(
      name => name !== failedProvider
    );

    for (const fallbackName of fallbackProviders) {
      const circuitBreaker = this.circuitBreakers.get(fallbackName);

      if (circuitBreaker?.isOpen()) {
        console.log(`[Orchestrator] Skipping ${fallbackName} (circuit is OPEN)`);
        continue;
      }

      try {
        console.log(`[Orchestrator] Attempting fallback to ${fallbackName}`);
        const result = await this.scrapeWithProvider(fallbackName, params);
        console.log(`[Orchestrator] ✅ Fallback to ${fallbackName} succeeded`);
        return result;
      } catch (error: any) {
        console.log(`[Orchestrator] ❌ Fallback to ${fallbackName} failed: ${error.message}`);
      }
    }

    // All providers failed
    return {
      success: false,
      error: {
        code: 'SCRAPING_FAILED',
        message: 'All providers failed',
        provider: 'orchestrator'
      }
    };
  }

  private selectProvider(): string {
    // A/B Testing logic: percentage-based
    const random = Math.random() * 100;

    if (random < this.playwrightTrafficPercentage) {
      const playwrightCB = this.circuitBreakers.get('playwright');
      if (!playwrightCB?.isOpen()) {
        return 'playwright';
      }
    }

    return 'puppeteer';
  }

  async healthCheck(): Promise<any> {
    const healthChecks = await Promise.allSettled(
      Array.from(this.providers.entries()).map(async ([name, config]) => {
        try {
          const response = await axios.get(`${config.url}/health`, { timeout: 5000 });
          return {
            provider: name,
            healthy: response.data.healthy,
            message: response.data.message,
            circuitBreaker: this.circuitBreakers.get(name)?.getMetrics()
          };
        } catch (error: any) {
          return {
            provider: name,
            healthy: false,
            message: error.message,
            circuitBreaker: this.circuitBreakers.get(name)?.getMetrics()
          };
        }
      })
    );

    const results = healthChecks.map(result =>
      result.status === 'fulfilled' ? result.value : { error: result.reason }
    );

    const allHealthy = results.every(r => 'healthy' in r && r.healthy === true);

    return {
      healthy: allHealthy,
      timestamp: new Date().toISOString(),
      providers: results
    };
  }

  resetCircuitBreaker(providerName: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(providerName);
    if (circuitBreaker) {
      circuitBreaker.reset();
      return true;
    }
    return false;
  }

  getMetrics() {
    return {
      playwrightTrafficPercentage: this.playwrightTrafficPercentage,
      providers: Array.from(this.providers.entries()).map(([name, config]) => ({
        name,
        enabled: config.enabled,
        url: config.url,
        circuitBreaker: this.circuitBreakers.get(name)?.getMetrics()
      }))
    };
  }
}
