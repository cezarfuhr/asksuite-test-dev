const ScraperService = require('./ScraperService');
const SearchRepository = require('../repositories/SearchRepository');
const { generateCacheKey, getCacheData, setCacheData } = require('../../config/redis');

/**
 * Service principal para orquestração de buscas
 * Implementa lógica de negócio, cache e persistência
 */
class SearchService {
    /**
     * Executa busca de quartos com cache e persistência
     * @param {Object} searchParams - Parâmetros de busca
     * @returns {Promise<Object>} - Resultado da busca
     */
    async search(searchParams) {
        const { checkin, checkout, adults = 1 } = searchParams;
        const startTime = Date.now();
        let searchId = null;

        try {
            // 1. Validar datas
            if (!ScraperService.validateDates(checkin, checkout)) {
                throw new Error('Invalid dates: Check-in must be today or later, and check-out must be after check-in');
            }

            // 2. Verificar cache
            const cacheKey = generateCacheKey(checkin, checkout, adults);
            const cachedResult = await getCacheData(cacheKey);

            if (cachedResult) {
                console.log('✅ Cache HIT - Returning cached results');
                return {
                    success: true,
                    data: cachedResult,
                    cached: true,
                    executionTime: Date.now() - startTime
                };
            }

            console.log('❌ Cache MISS - Proceeding with scraping');

            // 3. Criar registro de busca no banco
            searchId = await SearchRepository.createSearch({
                checkin,
                checkout,
                adults
            });

            // 4. Realizar scraping
            const rooms = await ScraperService.scrapeRooms(checkin, checkout, adults);

            // 5. Salvar quartos no banco
            await SearchRepository.saveRooms(searchId, rooms);

            // 6. Atualizar status da busca
            const executionTime = Date.now() - startTime;
            await SearchRepository.updateSearch(searchId, {
                status: 'success',
                executionTimeMs: executionTime,
                errorMessage: null
            });

            // 7. Salvar no cache
            await setCacheData(cacheKey, rooms);

            console.log(`✅ Search completed successfully in ${executionTime}ms`);

            return {
                success: true,
                data: rooms,
                cached: false,
                executionTime
            };

        } catch (error) {
            console.error('❌ Search failed:', error);

            // Atualizar registro de busca com erro (se foi criado)
            if (searchId) {
                const executionTime = Date.now() - startTime;
                await SearchRepository.updateSearch(searchId, {
                    status: 'error',
                    executionTimeMs: executionTime,
                    errorMessage: error.message
                });
            }

            throw error;
        }
    }

    /**
     * Busca histórico de buscas
     * @param {number} limit - Limite de registros
     * @returns {Promise<Array>} - Histórico
     */
    async getHistory(limit = 50) {
        try {
            return await SearchRepository.getSearchHistory(limit);
        } catch (error) {
            console.error('Error fetching history:', error);
            throw error;
        }
    }

    /**
     * Busca estatísticas de uso
     * @returns {Promise<Object>} - Estatísticas
     */
    async getStatistics() {
        try {
            return await SearchRepository.getStatistics();
        } catch (error) {
            console.error('Error fetching statistics:', error);
            throw error;
        }
    }
}

module.exports = new SearchService();
