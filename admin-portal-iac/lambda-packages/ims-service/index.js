exports.handler = async (event) => {
  return {
    statusCode: 503,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      error: 'Service Unavailable',
      message: 'IMS Service placeholder - Deploy actual service code'
    })
  };
};