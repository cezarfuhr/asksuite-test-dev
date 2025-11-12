-- Tabela para armazenar histórico de buscas
CREATE TABLE IF NOT EXISTS searches (
    id SERIAL PRIMARY KEY,
    checkin DATE NOT NULL,
    checkout DATE NOT NULL,
    adults INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER,
    status VARCHAR(20) DEFAULT 'success',
    error_message TEXT,
    CONSTRAINT valid_dates CHECK (checkout > checkin)
);

-- Tabela para armazenar quartos encontrados
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    search_id INTEGER REFERENCES searches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price VARCHAR(50),
    image VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_searches_dates ON searches(checkin, checkout);
CREATE INDEX IF NOT EXISTS idx_searches_created_at ON searches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_search_id ON rooms(search_id);

-- View para estatísticas
CREATE OR REPLACE VIEW search_statistics AS
SELECT
    COUNT(*) as total_searches,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_searches,
    COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_searches,
    AVG(execution_time_ms) as avg_execution_time_ms,
    MAX(execution_time_ms) as max_execution_time_ms,
    MIN(execution_time_ms) as min_execution_time_ms
FROM searches
WHERE created_at > CURRENT_DATE - INTERVAL '30 days';

-- Comentários para documentação
COMMENT ON TABLE searches IS 'Histórico de todas as buscas realizadas pelo sistema';
COMMENT ON TABLE rooms IS 'Quartos encontrados em cada busca';
COMMENT ON COLUMN searches.execution_time_ms IS 'Tempo de execução da busca em milissegundos';
COMMENT ON COLUMN searches.status IS 'Status da busca: success, error, timeout';
