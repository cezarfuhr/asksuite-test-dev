const request = require('supertest');
const express = require('express');
const router = require('../../routes/router');

// Mock das dependências externas
jest.mock('../../config/database', () => ({
    pool: {
        query: jest.fn()
    },
    checkConnection: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../config/redis', () => ({
    connectRedis: jest.fn().mockResolvedValue(true),
    checkConnection: jest.fn().mockResolvedValue(true),
    generateCacheKey: jest.fn((checkin, checkout, adults) => `search:${checkin}:${checkout}:${adults}`),
    getCacheData: jest.fn().mockResolvedValue(null),
    setCacheData: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../src/services/ScraperService', () => ({
    validateDates: jest.fn().mockReturnValue(true),
    scrapeRooms: jest.fn().mockResolvedValue([
        {
            name: 'STUDIO CASAL',
            description: 'Apartamento confortável',
            price: 'R$ 1.092,00',
            image: 'https://example.com/image.jpg'
        },
        {
            name: 'CABANA',
            description: 'Cabana com vista para jardim',
            price: 'R$ 1.321,00',
            image: 'https://example.com/image2.jpg'
        }
    ])
}));

// Criar app de teste
const app = express();
app.use(express.json());
app.use('/', router);

describe('Search API Integration Tests', () => {
    describe('GET /', () => {
        it('should return API information', async () => {
            const response = await request(app).get('/');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Asksuite Hotel Search API');
        });
    });

    describe('GET /health', () => {
        it('should return health status', async () => {
            const response = await request(app).get('/health');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.services).toHaveProperty('database');
            expect(response.body.services).toHaveProperty('redis');
            expect(response.body.services).toHaveProperty('api');
        });
    });

    describe('POST /search', () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfterTomorrow = new Date();
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

        const formatDate = (date) => date.toISOString().split('T')[0];

        beforeEach(() => {
            // Mock do repositório
            const { pool } = require('../../config/database');
            pool.query.mockResolvedValue({ rows: [{ id: 1 }] });
        });

        it('should return 400 for missing checkin', async () => {
            const response = await request(app)
                .post('/search')
                .send({
                    checkout: formatDate(dayAfterTomorrow)
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it('should return 400 for missing checkout', async () => {
            const response = await request(app)
                .post('/search')
                .send({
                    checkin: formatDate(tomorrow)
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it('should return 400 for invalid date format', async () => {
            const response = await request(app)
                .post('/search')
                .send({
                    checkin: '25-12-2024',
                    checkout: '26-12-2024'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it('should return 200 with valid payload', async () => {
            const response = await request(app)
                .post('/search')
                .send({
                    checkin: formatDate(tomorrow),
                    checkout: formatDate(dayAfterTomorrow)
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Array);
            expect(response.body.meta).toHaveProperty('executionTime');
            expect(response.body.meta).toHaveProperty('count');
        });

        it('should return array of rooms with correct structure', async () => {
            const response = await request(app)
                .post('/search')
                .send({
                    checkin: formatDate(tomorrow),
                    checkout: formatDate(dayAfterTomorrow)
                });

            expect(response.status).toBe(200);
            expect(response.body.data).toBeInstanceOf(Array);

            if (response.body.data.length > 0) {
                const room = response.body.data[0];
                expect(room).toHaveProperty('name');
                expect(room).toHaveProperty('description');
                expect(room).toHaveProperty('price');
                expect(room).toHaveProperty('image');
            }
        });
    });

    describe('GET /search/history', () => {
        it('should return search history', async () => {
            const { pool } = require('../../config/database');
            pool.query.mockResolvedValue({ rows: [] });

            const response = await request(app).get('/search/history');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Array);
        });
    });

    describe('GET /search/statistics', () => {
        it('should return statistics', async () => {
            const { pool } = require('../../config/database');
            pool.query.mockResolvedValue({ rows: [{}] });

            const response = await request(app).get('/search/statistics');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
        });
    });

    describe('404 Not Found', () => {
        it('should return 404 for non-existent routes', async () => {
            const response = await request(app).get('/non-existent-route');

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
        });
    });
});
