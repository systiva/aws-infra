exports.handler = async (event) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: '<h1>App Frontend Web Server - Placeholder</h1><p>Run workflow 09 to deploy actual frontend.</p>'
  };
};
