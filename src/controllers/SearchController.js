const SearchService = require('../services/SearchService');
const { validateSearchPayload } = require('../validators/searchValidator');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Controller para endpoints de busca
 * Responsável por receber requisições HTTP, validar e delegar para services
 */
class SearchController {
    /**
     * POST /search - Busca quartos disponíveis
     * @param {Request} req - Express request
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next middleware
     */
    async search(req, res, next) {
        try {
            // 1. Validar payload
            const validation = validateSearchPayload(req.body);

            if (!validation.isValid) {
                throw new AppError(
                    `Validation failed: ${validation.errors.join(', ')}`,
                    400
                );
            }

            // 2. Extrair parâmetros
            const { checkin, checkout, adults = 1 } = req.body;

            // 3. Executar busca
            const result = await SearchService.search({
                checkin,
                checkout,
                adults: parseInt(adults)
            });

            // 4. Retornar resposta
            res.status(200).json({
                success: true,
                data: result.data,
                meta: {
                    cached: result.cached,
                    executionTime: result.executionTime,
                    count: result.data.length
                }
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /search/history - Histórico de buscas
     * @param {Request} req - Express request
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next middleware
     */
    async getHistory(req, res, next) {
        try {
            const limit = parseInt(req.query.limit) || 50;
            const history = await SearchService.getHistory(limit);

            res.status(200).json({
                success: true,
                data: history,
                meta: {
                    count: history.length
                }
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /search/statistics - Estatísticas de uso
     * @param {Request} req - Express request
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next middleware
     */
    async getStatistics(req, res, next) {
        try {
            const stats = await SearchService.getStatistics();

            res.status(200).json({
                success: true,
                data: stats
            });

        } catch (error) {
            next(error);
        }
    }
}

module.exports = new SearchController();
