const redis = require('redis');

// Cliente Redis com retry strategy
const redisClient = redis.createClient({
    url: process.env.REDIS_URL,
    socket: {
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                console.error('❌ Redis max reconnection attempts reached');
                return new Error('Redis max reconnection attempts reached');
            }
            return Math.min(retries * 50, 500);
        }
    }
});

// Event listeners
redisClient.on('connect', () => {
    console.log('🔴 Redis connecting...');
});

redisClient.on('ready', () => {
    console.log('✅ Redis ready');
});

redisClient.on('error', (err) => {
    console.error('❌ Redis error:', err);
});

redisClient.on('reconnecting', () => {
    console.log('🔄 Redis reconnecting...');
});

// Conectar ao Redis
const connectRedis = async () => {
    try {
        await redisClient.connect();
    } catch (error) {
        console.error('Failed to connect to Redis:', error);
        throw error;
    }
};

// Helper para gerar cache key
const generateCacheKey = (checkin, checkout, adults = 1) => {
    return `search:${checkin}:${checkout}:${adults}`;
};

// Helper para salvar no cache
const setCacheData = async (key, data, ttl = parseInt(process.env.REDIS_TTL || 3600)) => {
    try {
        await redisClient.setEx(key, ttl, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Error setting cache:', error);
        return false;
    }
};

// Helper para buscar do cache
const getCacheData = async (key) => {
    try {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error getting cache:', error);
        return null;
    }
};

// Health check
const checkConnection = async () => {
    try {
        await redisClient.ping();
        return true;
    } catch (error) {
        console.error('Redis health check failed:', error);
        return false;
    }
};

module.exports = {
    redisClient,
    connectRedis,
    generateCacheKey,
    setCacheData,
    getCacheData,
    checkConnection,
};
