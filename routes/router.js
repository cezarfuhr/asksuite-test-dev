const express = require('express');
const router = express.Router();
const SearchController = require('../src/controllers/SearchController');

// Health check
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Asksuite Hotel Search API',
        version: '1.0.0',
        endpoints: {
            search: 'POST /search',
            history: 'GET /search/history',
            statistics: 'GET /search/statistics'
        }
    });
});

// Health check detalhado
router.get('/health', async (req, res) => {
    const { checkConnection: checkDb } = require('../config/database');
    const { checkConnection: checkRedis } = require('../config/redis');

    const dbHealth = await checkDb().catch(() => false);
    const redisHealth = await checkRedis().catch(() => false);

    res.status(dbHealth && redisHealth ? 200 : 503).json({
        success: true,
        status: dbHealth && redisHealth ? 'healthy' : 'degraded',
        services: {
            database: dbHealth ? 'up' : 'down',
            redis: redisHealth ? 'up' : 'down',
            api: 'up'
        },
        timestamp: new Date().toISOString()
    });
});

// Endpoints principais
router.post('/search', SearchController.search.bind(SearchController));
router.get('/search/history', SearchController.getHistory.bind(SearchController));
router.get('/search/statistics', SearchController.getStatistics.bind(SearchController));

module.exports = router;
