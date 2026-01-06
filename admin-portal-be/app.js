const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const httpLogger = require('./src/middlewares/http-logger');
const accountRoutes = require('./src/routes/account');
const Constant = require('./constant');
const app = express();

// configure CORS
const corsOptions = {
  origin: true,
  credentials: true,
  preflightContinue: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};
app.use(cors(corsOptions));
// enable pre-flight
app.options('*', cors(corsOptions));

// parse application/json
app.use(bodyParser.json());

// logger middleware
app.use(httpLogger);

// set routes - support both /api/v1/accounts and /api/accounts
app.use('/api/v1/accounts', accountRoutes);
app.use('/api/accounts', accountRoutes);

// Error Handling
// catch 404
app.use((req, res, next) => {
  res.status(Constant.HTTP_STATUS.NOT_FOUND);
  return res.send({
    result: Constant.RESPONSE_RESULT.FAILED,
    msg: 'Not Found',
  });
});
// catch all other errors
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || Constant.HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
    result: Constant.RESPONSE_RESULT.FAILED,
    msg: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
