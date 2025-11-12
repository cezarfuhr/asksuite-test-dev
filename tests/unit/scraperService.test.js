const ScraperService = require('../../src/services/ScraperService');

describe('ScraperService', () => {
    describe('buildSearchUrl', () => {
        it('should build correct URL with all parameters', () => {
            const url = ScraperService.buildSearchUrl('2024-12-25', '2024-12-27', 2);

            expect(url).toBe('https://reservations.fasthotel.me/188/214?entrada=2024-12-25&saida=2024-12-27&adultos=2#acomodacoes');
        });

        it('should use default adults=1 if not provided', () => {
            const url = ScraperService.buildSearchUrl('2024-12-25', '2024-12-27');

            expect(url).toContain('adultos=1');
        });
    });

    describe('validateDates', () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfterTomorrow = new Date();
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

        const formatDate = (date) => date.toISOString().split('T')[0];

        it('should validate correct dates', () => {
            const isValid = ScraperService.validateDates(
                formatDate(tomorrow),
                formatDate(dayAfterTomorrow)
            );

            expect(isValid).toBe(true);
        });

        it('should reject checkout before checkin', () => {
            const isValid = ScraperService.validateDates(
                formatDate(dayAfterTomorrow),
                formatDate(tomorrow)
            );

            expect(isValid).toBe(false);
        });

        it('should reject past checkin date', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const isValid = ScraperService.validateDates(
                formatDate(yesterday),
                formatDate(tomorrow)
            );

            expect(isValid).toBe(false);
        });

        it('should reject same checkin and checkout', () => {
            const isValid = ScraperService.validateDates(
                formatDate(tomorrow),
                formatDate(tomorrow)
            );

            expect(isValid).toBe(false);
        });
    });

    describe('scrapeRooms', () => {
        // Note: Este teste seria ideal com mocking do Puppeteer
        // Por ser um teste end-to-end real, pode ser lento e depende do site estar disponível
        it('should be defined', () => {
            expect(ScraperService.scrapeRooms).toBeDefined();
            expect(typeof ScraperService.scrapeRooms).toBe('function');
        });
    });
});
