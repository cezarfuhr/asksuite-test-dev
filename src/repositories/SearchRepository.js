const { pool } = require('../../config/database');

/**
 * Repository para operações de banco de dados relacionadas a buscas
 * Implementa pattern Repository para separar lógica de persistência
 */
class SearchRepository {
    /**
     * Cria um novo registro de busca
     * @param {Object} searchData - Dados da busca
     * @returns {Promise<number>} - ID da busca criada
     */
    async createSearch(searchData) {
        const { checkin, checkout, adults = 1 } = searchData;

        const query = `
            INSERT INTO searches (checkin, checkout, adults, status)
            VALUES ($1, $2, $3, 'processing')
            RETURNING id
        `;

        try {
            const result = await pool.query(query, [checkin, checkout, adults]);
            return result.rows[0].id;
        } catch (error) {
            console.error('Error creating search record:', error);
            throw error;
        }
    }

    /**
     * Atualiza o status e métricas de uma busca
     * @param {number} searchId - ID da busca
     * @param {Object} updateData - Dados para atualizar
     */
    async updateSearch(searchId, updateData) {
        const { status, executionTimeMs, errorMessage } = updateData;

        const query = `
            UPDATE searches
            SET status = $1, execution_time_ms = $2, error_message = $3
            WHERE id = $4
        `;

        try {
            await pool.query(query, [status, executionTimeMs, errorMessage, searchId]);
        } catch (error) {
            console.error('Error updating search record:', error);
            throw error;
        }
    }

    /**
     * Salva os quartos encontrados em uma busca
     * @param {number} searchId - ID da busca
     * @param {Array<Object>} rooms - Array de quartos
     */
    async saveRooms(searchId, rooms) {
        if (!rooms || rooms.length === 0) return;

        const query = `
            INSERT INTO rooms (search_id, name, description, price, image)
            VALUES ($1, $2, $3, $4, $5)
        `;

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            for (const room of rooms) {
                await client.query(query, [
                    searchId,
                    room.name,
                    room.description,
                    room.price,
                    room.image
                ]);
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error saving rooms:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Busca histórico de buscas
     * @param {number} limit - Limite de registros
     * @returns {Promise<Array>} - Array de buscas
     */
    async getSearchHistory(limit = 50) {
        const query = `
            SELECT
                s.id,
                s.checkin,
                s.checkout,
                s.adults,
                s.created_at,
                s.execution_time_ms,
                s.status,
                COUNT(r.id) as rooms_found
            FROM searches s
            LEFT JOIN rooms r ON s.id = r.search_id
            GROUP BY s.id
            ORDER BY s.created_at DESC
            LIMIT $1
        `;

        try {
            const result = await pool.query(query, [limit]);
            return result.rows;
        } catch (error) {
            console.error('Error fetching search history:', error);
            throw error;
        }
    }

    /**
     * Busca estatísticas de uso
     * @returns {Promise<Object>} - Estatísticas
     */
    async getStatistics() {
        const query = 'SELECT * FROM search_statistics';

        try {
            const result = await pool.query(query);
            return result.rows[0] || {};
        } catch (error) {
            console.error('Error fetching statistics:', error);
            throw error;
        }
    }
}

module.exports = new SearchRepository();
