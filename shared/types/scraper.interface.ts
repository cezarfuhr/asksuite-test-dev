export interface ScrapeParams {
  checkin: string;
  checkout: string;
  adults?: number;
}

export interface RoomData {
  name: string;
  description: string;
  price: string;
  image: string;
}

export interface ScrapeResult {
  success: boolean;
  data?: RoomData[];
  error?: {
    code: 'SCRAPING_FAILED' | 'TIMEOUT' | 'BROWSER_CRASH' | 'VALIDATION_ERROR';
    message: string;
    provider?: string;
  };
  meta?: {
    provider: 'puppeteer' | 'playwright';
    executionTime: number;
    timestamp: string;
  };
}

export interface IScraperProvider {
  scrape(params: ScrapeParams): Promise<ScrapeResult>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
  getName(): string;
}

export interface HealthStatus {
  healthy: boolean;
  service: string;
  message?: string;
  timestamp: string;
}
