/**
 * Middleware centralizado de tratamento de erros
 * Garante respostas consistentes para todos os erros da aplicação
 */

class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Middleware de tratamento de erros
 */
const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Log do erro para debugging
    console.error('❌ Error:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method
    });

    // Erros conhecidos do PostgreSQL
    if (err.code) {
        switch (err.code) {
            case '23505': // Unique violation
                statusCode = 409;
                message = 'Duplicate entry';
                break;
            case '23503': // Foreign key violation
                statusCode = 400;
                message = 'Invalid reference';
                break;
            case '22P02': // Invalid text representation
                statusCode = 400;
                message = 'Invalid data format';
                break;
        }
    }

    // Resposta JSON padronizada
    res.status(statusCode).json({
        success: false,
        error: {
            message,
            statusCode,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    });
};

/**
 * Middleware para rotas não encontradas
 */
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: {
            message: `Route ${req.method} ${req.path} not found`,
            statusCode: 404
        }
    });
};

module.exports = {
    errorHandler,
    notFoundHandler,
    AppError
};
