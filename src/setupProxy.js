const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy for new v2 API
  app.use(
    '/v2',
    createProxyMiddleware({
      target: 'http://api-production.data.gov.sg',
      changeOrigin: true,
      secure: false, // HTTP, not HTTPS
      logLevel: 'info',
      pathRewrite: {
        '^/v2': '/v2', // Keep the /v2 path
      },
      onProxyReq: (proxyReq, req, res) => {
        console.log('Proxying v2 request:', req.method, req.url, '->', proxyReq.path);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log('Proxy v2 response:', proxyRes.statusCode, req.url);
      },
      onError: (err, req, res) => {
        console.error('Proxy v2 error:', err.message);
        res.status(500).send('Proxy error: ' + err.message);
      }
    })
  );
  
  // Keep old CKAN API proxy for backward compatibility
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'https://data.gov.sg',
      changeOrigin: true,
      secure: true,
      logLevel: 'info',
      onProxyReq: (proxyReq, req, res) => {
        console.log('Proxying CKAN request:', req.method, req.url, '->', proxyReq.path);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log('Proxy CKAN response:', proxyRes.statusCode, req.url);
      },
      onError: (err, req, res) => {
        console.error('Proxy CKAN error:', err.message);
        res.status(500).send('Proxy error: ' + err.message);
      }
    })
  );
};

