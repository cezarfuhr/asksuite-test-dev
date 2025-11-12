const { validateSearchPayload, isValidDateFormat } = require('../../src/validators/searchValidator');

describe('Search Validator', () => {
    describe('isValidDateFormat', () => {
        it('should validate correct date format', () => {
            expect(isValidDateFormat('2024-12-25')).toBe(true);
            expect(isValidDateFormat('2025-01-01')).toBe(true);
        });

        it('should reject invalid date formats', () => {
            expect(isValidDateFormat('25-12-2024')).toBe(false);
            expect(isValidDateFormat('2024/12/25')).toBe(false);
            expect(isValidDateFormat('invalid')).toBe(false);
            expect(isValidDateFormat('')).toBe(false);
        });

        it('should reject invalid dates', () => {
            expect(isValidDateFormat('2024-13-01')).toBe(false); // Invalid month
            expect(isValidDateFormat('2024-02-30')).toBe(false); // Invalid day
        });
    });

    describe('validateSearchPayload', () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfterTomorrow = new Date();
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

        const formatDate = (date) => date.toISOString().split('T')[0];

        it('should validate correct payload', () => {
            const payload = {
                checkin: formatDate(tomorrow),
                checkout: formatDate(dayAfterTomorrow)
            };

            const result = validateSearchPayload(payload);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject missing checkin', () => {
            const payload = {
                checkout: formatDate(dayAfterTomorrow)
            };

            const result = validateSearchPayload(payload);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Field "checkin" is required');
        });

        it('should reject missing checkout', () => {
            const payload = {
                checkin: formatDate(tomorrow)
            };

            const result = validateSearchPayload(payload);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Field "checkout" is required');
        });

        it('should reject invalid date format', () => {
            const payload = {
                checkin: '25-12-2024',
                checkout: '26-12-2024'
            };

            const result = validateSearchPayload(payload);
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should reject checkout before or equal to checkin', () => {
            const payload = {
                checkin: formatDate(dayAfterTomorrow),
                checkout: formatDate(tomorrow)
            };

            const result = validateSearchPayload(payload);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Field "checkout" must be after "checkin"');
        });

        it('should reject past checkin date', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const payload = {
                checkin: formatDate(yesterday),
                checkout: formatDate(tomorrow)
            };

            const result = validateSearchPayload(payload);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Field "checkin" must be today or a future date');
        });

        it('should validate adults parameter', () => {
            const payload = {
                checkin: formatDate(tomorrow),
                checkout: formatDate(dayAfterTomorrow),
                adults: 2
            };

            const result = validateSearchPayload(payload);
            expect(result.isValid).toBe(true);
        });

        it('should reject invalid adults parameter', () => {
            const payload = {
                checkin: formatDate(tomorrow),
                checkout: formatDate(dayAfterTomorrow),
                adults: 0
            };

            const result = validateSearchPayload(payload);
            expect(result.isValid).toBe(false);
        });
    });
});
