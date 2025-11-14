/**
 * Validadores para endpoints de busca
 * Implementa validação de entrada para garantir dados corretos
 */

/**
 * Valida formato de data YYYY-MM-DD
 * @param {string} dateString - Data em string
 * @returns {boolean} - Válido ou não
 */
const isValidDateFormat = (dateString) => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;

    // Parse manualmente para evitar problemas de timezone
    const [year, month, day] = dateString.split('-').map(Number);

    // Criar data usando valores locais (não UTC)
    const date = new Date(year, month - 1, day);

    // Verificar se a data criada corresponde aos valores fornecidos
    return date.getFullYear() === year &&
           date.getMonth() === month - 1 &&
           date.getDate() === day;
};

/**
 * Valida payload do endpoint /search
 * @param {Object} body - Corpo da requisição
 * @returns {Object} - Resultado da validação
 */
const validateSearchPayload = (body) => {
    const errors = [];

    // Validar presença de campos obrigatórios
    if (!body.checkin) {
        errors.push('Field "checkin" is required');
    }

    if (!body.checkout) {
        errors.push('Field "checkout" is required');
    }

    // Validar formato de datas
    if (body.checkin && !isValidDateFormat(body.checkin)) {
        errors.push('Field "checkin" must be in format YYYY-MM-DD');
    }

    if (body.checkout && !isValidDateFormat(body.checkout)) {
        errors.push('Field "checkout" must be in format YYYY-MM-DD');
    }

    // Validar lógica de datas
    if (body.checkin && body.checkout && isValidDateFormat(body.checkin) && isValidDateFormat(body.checkout)) {
        const checkinDate = new Date(body.checkin);
        const checkoutDate = new Date(body.checkout);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (checkinDate < today) {
            errors.push('Field "checkin" must be today or a future date');
        }

        if (checkoutDate <= checkinDate) {
            errors.push('Field "checkout" must be after "checkin"');
        }
    }

    // Validar número de adultos (se fornecido)
    if (body.adults !== undefined) {
        const adults = parseInt(body.adults);
        if (isNaN(adults) || adults < 1 || adults > 10) {
            errors.push('Field "adults" must be a number between 1 and 10');
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

module.exports = {
    validateSearchPayload,
    isValidDateFormat
};
