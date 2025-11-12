require('dotenv').config();
const express = require('express');
const cors = require('cors');
const router = require('./routes/router.js');
const { errorHandler, notFoundHandler } = require('./src/middlewares/errorHandler');
const { connectRedis } = require('./config/redis');
const { checkConnection } = require('./config/database');

const app = express();
const port = process.env.PORT || 8080;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (desenvolvimento)
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`📥 ${req.method} ${req.path}`);
        next();
    });
}

// Rotas
app.use('/', router);

// Middleware de erro 404
app.use(notFoundHandler);

// Middleware de tratamento de erros
app.use(errorHandler);

// Inicialização da aplicação
const startServer = async () => {
    try {
        // Conectar ao Redis
        await connectRedis();
        console.log('✅ Redis connected');

        // Verificar conexão com banco
        const dbConnected = await checkConnection();
        if (!dbConnected) {
            throw new Error('Failed to connect to database');
        }
        console.log('✅ Database connected');

        // Iniciar servidor
        app.listen(port, () => {
            console.log(`
╔═══════════════════════════════════════════════╗
║   🚀 Asksuite Hotel Search API                ║
║                                               ║
║   Server running on port: ${port}              ║
║   Environment: ${process.env.NODE_ENV || 'development'}              ║
║   Base URL: http://localhost:${port}           ║
║                                               ║
║   Endpoints:                                  ║
║   - POST   /search                            ║
║   - GET    /search/history                    ║
║   - GET    /search/statistics                 ║
║   - GET    /health                            ║
║                                               ║
╚═══════════════════════════════════════════════╝
            `);
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Tratamento de erros não capturados
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

// Iniciar
startServer();
