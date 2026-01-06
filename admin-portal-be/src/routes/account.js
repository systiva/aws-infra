const express = require('express');
const router = express.Router();
const AccountService = require('../services/account-service');
const Logger = require('../../logger');
const { authMiddleware } = require('../middlewares/auth');

// Apply auth middleware to all account routes
router.use(authMiddleware);

// GET /accounts - Get all accounts and total count
router.get('/', async (req, res, next) => {
  try {
    Logger.debug('GET /accounts - Retrieving all accounts');
    const serviceRes = await AccountService.getAllAccounts();
    Logger.debug(serviceRes, 'GET /accounts - Service response');
    res.status(serviceRes.status).json(serviceRes.json);
  } catch (error) {
    Logger.error(error, 'GET /accounts - Error occurred');
    next(error);
  }
});

// GET /accounts/:accountId - Get single account by ID
router.get('/:accountId', async (req, res, next) => {
  try {
    const accountId = req.params.accountId;
    Logger.debug({ accountId }, 'GET /accounts/:accountId - Retrieving account by ID');
    const serviceRes = await AccountService.getAccountDetails(accountId);
    Logger.debug(serviceRes, 'GET /accounts/:accountId - Service response');
    res.status(serviceRes.status).json(serviceRes.json);
  } catch (error) {
    Logger.error(error, 'GET /accounts/:accountId - Error occurred');
    next(error);
  }
});

// POST /onboard - Create new account
router.post('/onboard', async (req, res, next) => {
  try {
    Logger.debug(req.body, 'POST /onboard - Creating new account with data');
    const serviceRes = await AccountService.createAccount(req.body);
    Logger.debug(serviceRes, 'POST /onboard - Service response');
    res.status(serviceRes.status).json(serviceRes.json);
  } catch (error) {
    Logger.error(error, 'POST /onboard - Error occurred');
    next(error);
  }
});

// PUT /onboard - Update existing account
router.put('/onboard', async (req, res, next) => {
  try {
    Logger.debug(req.body, 'PUT /onboard - Updating account with data');
    const serviceRes = await AccountService.updateAccount(req.body);
    Logger.debug(serviceRes, 'PUT /onboard - Service response');
    res.status(serviceRes.status).json(serviceRes.json);
  } catch (error) {
    Logger.error(error, 'PUT /onboard - Error occurred');
    next(error);
  }
});

// PUT / - Update existing account (alternative endpoint)
router.put('/', async (req, res, next) => {
  try {
    // Support both 'id' and 'accountId' in request body
    const accountData = {
      ...req.body,
      accountId: req.body.accountId || req.body.id
    };
    Logger.debug(accountData, 'PUT / - Updating account with data');
    const serviceRes = await AccountService.updateAccount(accountData);
    Logger.debug(serviceRes, 'PUT / - Service response');
    res.status(serviceRes.status).json(serviceRes.json);
  } catch (error) {
    Logger.error(error, 'PUT / - Error occurred');
    next(error);
  }
});

// DELETE /offboard - Delete account
router.delete('/offboard', async (req, res, next) => {
  try {
    const accountId = req.query.accountId;
    if (!accountId) {
      return res.status(400).json({
        result: 'failed',
        msg: 'accountId query parameter is required'
      });
    }
    Logger.debug({ accountId }, 'DELETE /offboard - Offboarding account');
    const serviceRes = await AccountService.deleteAccount(accountId);
    Logger.debug(serviceRes, 'DELETE /offboard - Service response');
    res.status(serviceRes.status).json(serviceRes.json);
  } catch (error) {
    Logger.error(error, 'DELETE /offboard - Error occurred');
    next(error);
  }
});

// PUT /suspend - Suspend account (set status to inactive)
router.put('/suspend', async (req, res, next) => {
  try {
    const accountId = req.query.accountId;
    if (!accountId) {
      return res.status(400).json({
        result: 'failed',
        msg: 'accountId query parameter is required'
      });
    }
    Logger.debug({ accountId }, 'PUT /suspend - Suspending account');
    const serviceRes = await AccountService.suspendAccount(accountId);
    Logger.debug(serviceRes, 'PUT /suspend - Service response');
    res.status(serviceRes.status).json(serviceRes.json);
  } catch (error) {
    Logger.error(error, 'PUT /suspend - Error occurred');
    next(error);
  }
});

// GET /provisioning-status/:accountId - Get account provisioning status
router.get('/provisioning-status/:accountId', async (req, res, next) => {
  try {
    const accountId = req.params.accountId;
    Logger.debug({ accountId }, 'GET /provisioning-status - Getting account provisioning status');
    const serviceRes = await AccountService.getAccountProvisioningStatus(accountId);
    Logger.debug(serviceRes, 'GET /provisioning-status - Service response');
    res.status(serviceRes.status).json(serviceRes.json);
  } catch (error) {
    Logger.error(error, 'GET /provisioning-status - Error occurred');
    next(error);
  }
});

// POST /complete-provisioning/:accountId - Complete account provisioning for completed CloudFormation stacks
router.post('/complete-provisioning/:accountId', async (req, res, next) => {
  try {
    const accountId = req.params.accountId;
    Logger.debug({ accountId }, 'POST /complete-provisioning - Completing account provisioning');
    const serviceRes = await AccountService.completeProvisioningForAccount(accountId);
    Logger.debug(serviceRes, 'POST /complete-provisioning - Service response');
    res.status(serviceRes.status).json(serviceRes.json);
  } catch (error) {
    Logger.error(error, 'POST /complete-provisioning - Error occurred');
    next(error);
  }
});

// GET /:accountId - Get individual account details
router.get('/:accountId', async (req, res, next) => {
  try {
    const accountId = req.params.accountId;
    Logger.debug({ accountId }, 'GET /:accountId - Getting account details');
    const serviceRes = await AccountService.getAccountDetails(accountId);
    Logger.debug(serviceRes, 'GET /:accountId - Service response');
    res.status(serviceRes.status).json(serviceRes.json);
  } catch (error) {
    Logger.error(error, 'GET /:accountId - Error occurred');
    next(error);
  }
});

module.exports = router;
