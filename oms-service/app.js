const express = require('express');
const cors = require('cors');
const logger = require('./logger');
const config = require('./config');

// Middleware imports
const authenticateUser = require('./src/middlewares/auth');
const validateTenant = require('./src/middlewares/tenant');
const assumeRole = require('./src/middlewares/assume-role');
const { errorHandler, notFoundHandler } = require('./src/middlewares/error-handler');

// Route imports
const customerRoutes = require('./src/routes/customers');
const productRoutes = require('./src/routes/products');
const orderRoutes = require('./src/routes/orders');
const inventoryRoutes = require('./src/routes/inventory');

// Initialize Express app
const app = express();

// CORS configuration
app.use(cors({
    origin: config.CORS_ORIGIN || '*',
    credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    logger.info({
        method: req.method,
        path: req.path,
        ip: req.ip
    }, 'Incoming request');
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'oms-service',
        timestamp: new Date().toISOString()
    });
});

// API routes with authentication and tenant middleware
app.use(
    `${config.API_PREFIX}/customers`,
    authenticateUser,
    validateTenant,
    assumeRole,
    customerRoutes
);

app.use(
    `${config.API_PREFIX}/products`,
    authenticateUser,
    validateTenant,
    assumeRole,
    productRoutes
);

app.use(
    `${config.API_PREFIX}/orders`,
    authenticateUser,
    validateTenant,
    assumeRole,
    orderRoutes
);

app.use(
    `${config.API_PREFIX}/inventory`,
    authenticateUser,
    validateTenant,
    assumeRole,
    inventoryRoutes
);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

module.exports = app;
