const logger = require('../../logger');

/**
 * Extract user context from API Gateway authorizer
 * Serverless-http wraps the Lambda event in req.apiGateway.event
 */
const extractUserFromApiGateway = (req) => {
    try {
        // Check if request came through serverless-http (Lambda)
        if (req.apiGateway && req.apiGateway.event) {
            const event = req.apiGateway.event;
            
            // Extract claims from authorizer context
            const authorizer = event.requestContext?.authorizer;
            
            if (authorizer) {
                logger.debug({ 
                    authorizerKeys: Object.keys(authorizer),
                    userId: authorizer.userId,
                    tenantId: authorizer.tenantId
                }, 'JWT claims from API Gateway authorizer');
                
                return {
                    userId: authorizer.userId || authorizer.sub,
                    email: authorizer.email,
                    tenantId: authorizer.tenantId || authorizer['custom:tenant_id'],
                    groups: authorizer.groups ? (typeof authorizer.groups === 'string' ? JSON.parse(authorizer.groups) : authorizer.groups) : [],
                    roles: authorizer.roles ? (typeof authorizer.roles === 'string' ? JSON.parse(authorizer.roles) : authorizer.roles) : [],
                    permissions: authorizer.permissions ? (typeof authorizer.permissions === 'string' ? JSON.parse(authorizer.permissions) : authorizer.permissions) : []
                };
            }
        }

        // Fallback for local development
        const authHeader = req.headers.authorization || req.headers.Authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            logger.debug('JWT token found in Authorization header (local mode)');
            return {
                userId: 'local-dev-user',
                email: 'dev@example.com',
                tenantId: 'local-tenant',
                groups: [],
                roles: [],
                permissions: []
            };
        }

        return null;
    } catch (error) {
        logger.error({ error: error.message }, 'Error extracting user from API Gateway');
        return null;
    }
};

/**
 * Authentication middleware
 * Extracts and validates user context from API Gateway authorizer
 */
const authMiddleware = (req, res, next) => {
    try {
        const user = extractUserFromApiGateway(req);
        
        logger.debug({ 
            hasUser: !!user,
            hasApiGateway: !!(req.apiGateway && req.apiGateway.event),
            hasAuthorizer: !!(req.apiGateway?.event?.requestContext?.authorizer)
        }, 'Auth middleware - extracting user context');
        
        if (!user) {
            logger.error({ 
                path: req.path,
                method: req.method
            }, 'No user context found in request');
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: 'Authentication required' 
            });
        }
        
        // Ensure user has required fields
        if (!user.userId || !user.tenantId) {
            logger.error({ 
                userId: user.userId,
                tenantId: user.tenantId
            }, 'Invalid user context - missing userId or tenantId');
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: 'Invalid authentication token' 
            });
        }
        
        // Attach user to request
        req.user = user;
        
        logger.debug({ 
            userId: req.user.userId, 
            tenantId: req.user.tenantId,
            groupsCount: req.user.groups.length,
            groupsRaw: JSON.stringify(req.user.groups),
            groupNames: JSON.stringify(req.user.groups.map(g => g.name || g))
        }, 'User authenticated');
        
        next();
    } catch (error) {
        logger.error({ error: error.message }, 'Authentication middleware error');
        return res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Authentication processing failed' 
        });
    }
};

module.exports = authMiddleware;
