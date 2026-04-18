const http = require('http');
const https = require('https');

/**
 * Pings the server periodically to keep it awake on platforms like Render.
 * @param {string} url - The URL to ping.
 */
const startKeepAlive = (url) => {
  if (!url) {
    console.log('Keep-alive URL not provided, skipping...');
    return;
  }

  console.log(`Starting keep-alive for: ${url}`);
  
  // Ping every minute
  setInterval(() => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      console.log(`Keep-alive ping to ${url} - Status Code: ${res.statusCode}`);
    }).on('error', (err) => {
      console.error(`Keep-alive ping error: ${err.message}`);
    });
  }, 60000); // 1 minute
};

module.exports = startKeepAlive;
