const { Pool } = require('pg');

// Configuração do pool de conexões PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Máximo de conexões no pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Event listeners para monitoramento
pool.on('connect', () => {
    console.log('📦 Database connected');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
    process.exit(-1);
});

// Health check
const checkConnection = async () => {
    try {
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        return true;
    } catch (error) {
        console.error('Database health check failed:', error);
        return false;
    }
};

module.exports = {
    pool,
    checkConnection,
};
