import express, { Request, Response } from 'express';
import { ProviderOrchestrator } from './ProviderOrchestrator';

const app = express();
app.use(express.json());

const orchestrator = new ProviderOrchestrator();

app.post('/search', async (req: Request, res: Response) => {
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

    const result = await orchestrator.scrape({ checkin, checkout, adults });

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
        provider: 'orchestrator'
      }
    });
  }
});

app.get('/health', async (req: Request, res: Response) => {
  const health = await orchestrator.healthCheck();
  res.status(health.healthy ? 200 : 503).json(health);
});

app.get('/metrics', (req: Request, res: Response) => {
  const metrics = orchestrator.getMetrics();
  res.json(metrics);
});

app.post('/admin/circuit-breaker/reset/:provider', (req: Request, res: Response) => {
  const { provider } = req.params;
  const success = orchestrator.resetCircuitBreaker(provider);

  if (success) {
    res.json({ success: true, message: `Circuit breaker for ${provider} reset` });
  } else {
    res.status(404).json({ success: false, message: `Provider ${provider} not found` });
  }
});

const PORT = process.env.ORCHESTRATOR_PORT || 8080;

app.listen(PORT, () => {
  console.log(`[Orchestrator] 🚀 Running on port ${PORT}`);
});
