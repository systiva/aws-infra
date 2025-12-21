const logger = require('../../logger');

/**
 * RBAC Middleware - Role-Based Access Control
 * Checks user's groups to determine access level
 */

/**
 * Check if user has write permissions
 * Required groups: account-user-rw, account-admin
 */
const checkWritePermission = (req, res, next) => {
    try {
        const groups = req.user?.groups || [];
        const groupNames = groups.map(g => g.name || g);
        
        const writeGroups = ['account-user-rw', 'account-admin'];
        const hasWriteAccess = groupNames.some(g => writeGroups.includes(g));
        
        if (!hasWriteAccess) {
            logger.warn('Write permission denied', { 
                userId: req.user.userId, 
                userGroups: groupNames 
            });
            return res.status(403).json({ 
                error: 'Forbidden', 
                message: 'Write permission denied. Requires account-user-rw or account-admin group.' 
            });
        }
        
        logger.debug('Write permission granted', { 
            userId: req.user.userId, 
            userGroups: groupNames 
        });
        
        next();
    } catch (error) {
        logger.error('RBAC write check error', { error: error.message });
        return res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Permission check failed' 
        });
    }
};

/**
 * Check if user is platform admin
 * Platform admins have read-only access across all accounts
 */
const checkPlatformAdmin = (req, res, next) => {
    try {
        const groups = req.user?.groups || [];
        const groupNames = groups.map(g => g.name || g);
        
        const isPlatformAdmin = groupNames.includes('platform-admin');
        
        if (!isPlatformAdmin) {
            logger.warn('Platform admin access denied', { 
                userId: req.user.userId, 
                userGroups: groupNames 
            });
            return res.status(403).json({ 
                error: 'Forbidden', 
                message: 'Platform admin access required' 
            });
        }
        
        // Platform admin can only read, not write
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
            logger.warn('Platform admin write attempt denied', { 
                userId: req.user.userId, 
                method: req.method,
                path: req.path 
            });
            return res.status(403).json({ 
                error: 'Forbidden', 
                message: 'Platform admin has read-only access' 
            });
        }
        
        logger.debug('Platform admin access granted', { 
            userId: req.user.userId 
        });
        
        // Mark request as platform admin for special handling
        req.isPlatformAdmin = true;
        
        next();
    } catch (error) {
        logger.error('RBAC platform admin check error', { error: error.message });
        return res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Permission check failed' 
        });
    }
};

/**
 * Check if user has any access to OMS features
 * At least one of: account-user-ro, account-user-rw, account-admin
 * Note: platform-admin is EXCLUDED from OMS access
 */
const checkOMSAccess = (req, res, next) => {
    try {
        const groups = req.user?.groups || [];
        const groupNames = groups.map(g => g.name || g);
        
        // Log group information for debugging
        logger.error({
            userId: req.user?.userId,
            groupsCount: groups.length,
            groupsRaw: JSON.stringify(groups),
            groupNames: JSON.stringify(groupNames),
            expectedGroups: ['account-user-ro', 'account-user-rw', 'account-admin']
        }, 'OMS RBAC Check');
        
        const omsGroups = ['account-user-ro', 'account-user-rw', 'account-admin'];
        const hasOMSAccess = groupNames.some(g => omsGroups.includes(g));
        
        if (!hasOMSAccess) {
            logger.error({ 
                userId: req.user.userId, 
                userGroups: JSON.stringify(groupNames),
                expectedGroups: JSON.stringify(omsGroups),
                matchResult: JSON.stringify(groupNames.map(g => ({ group: g, expected: omsGroups.includes(g) })))
            }, 'OMS access denied');
            return res.status(403).json({ 
                error: 'Forbidden', 
                message: 'Access denied. OMS access requires appropriate group membership.' 
            });
        }
        
        logger.debug('OMS access granted', { 
            userId: req.user.userId, 
            userGroups: groupNames 
        });
        
        next();
    } catch (error) {
        logger.error('RBAC OMS access check error', { error: error.message });
        return res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Access check failed' 
        });
    }
};

module.exports = {
    checkWritePermission,
    checkPlatformAdmin,
    checkOMSAccess
};
