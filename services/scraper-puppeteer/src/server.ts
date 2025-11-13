import express, { Request, Response } from 'express';
import { PuppeteerProvider } from './PuppeteerProvider';

const app = express();
app.use(express.json());

const provider = new PuppeteerProvider();

app.post('/scrape', async (req: Request, res: Response) => {
  try {
    const { checkin, checkout, adults } = req.body;

    if (!checkin || !checkout) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required parameters: checkin and checkout'
        }
      });
    }

    const result = await provider.scrape({ checkin, checkout, adults });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SCRAPING_FAILED',
        message: error.message,
        provider: 'puppeteer'
      }
    });
  }
});

app.get('/health', async (req: Request, res: Response) => {
  const health = await provider.healthCheck();
  res.status(health.healthy ? 200 : 503).json(health);
});

const PORT = process.env.SCRAPER_PORT || 3001;

app.listen(PORT, () => {
  console.log(`[Puppeteer Service] 🚀 Running on port ${PORT}`);
});
