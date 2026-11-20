const http = require('http');
const WebSocket = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils');

const host = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '1234', 10);

// Dynamic import for ES Module @google/stitch-sdk
let StitchToolClient = null;
let Stitch = null;
import('@google/stitch-sdk').then((mod) => {
  StitchToolClient = mod.StitchToolClient;
  Stitch = mod.Stitch;
  console.log('[Stitch] @google/stitch-sdk loaded successfully in backend.');
}).catch((err) => {
  console.warn('[Stitch] Could not load @google/stitch-sdk:', err.message);
});

// Helper to parse JSON body from incoming HTTP requests
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) { // 5MB limit
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON: ' + e.message));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS headers so browser clients can reach backend endpoints
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-stitch-api-key, x-stitch-access-token');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Health check
  if (url.pathname === '/health' || url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'y-websocket-backend',
      stitchEnabled: Boolean(StitchToolClient),
      time: new Date().toISOString()
    }));
    return;
  }

  // Stitch API Status / Capabilities check
  if (url.pathname === '/api/stitch/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      sdkLoaded: Boolean(StitchToolClient),
      serverEnvConfigured: Boolean(process.env.STITCH_API_KEY || process.env.STITCH_ACCESS_TOKEN),
      supportedFeatures: [
        'list_projects',
        'create_project',
        'generate_screen_from_text',
        'list_screens',
        'get_screen',
        'create_design_system'
      ]
    }));
    return;
  }

  // Stitch Tool Invocation Proxy
  // Allows the editor frontend to invoke Stitch tools securely without exposing server secrets
  if (url.pathname === '/api/stitch/call' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    try {
      if (!StitchToolClient) {
        res.writeHead(503);
        res.end(JSON.stringify({
          error: 'Stitch SDK is initializing or not available on the server.'
        }));
        return;
      }

      const body = await parseRequestBody(req);
      const { toolName, args = {}, config = {} } = body;

      if (!toolName) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing toolName parameter' }));
        return;
      }

      // Check client auth or server env auth
      const apiKey = config.apiKey || req.headers['x-stitch-api-key'] || process.env.STITCH_API_KEY;
      const accessToken = config.accessToken || req.headers['x-stitch-access-token'] || process.env.STITCH_ACCESS_TOKEN;
      const projectId = config.projectId || process.env.STITCH_PROJECT_ID;

      const clientConfig = {};
      if (apiKey) clientConfig.apiKey = apiKey;
      if (accessToken) clientConfig.accessToken = accessToken;
      if (projectId) clientConfig.projectId = projectId;

      const client = new StitchToolClient(clientConfig);
      const result = await client.callTool(toolName, args);

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, result }));
    } catch (err) {
      console.error('[Stitch Tool Error]:', err.message);
      res.writeHead(err.code || 500);
      res.end(JSON.stringify({
        success: false,
        error: err.message || 'Internal error invoking Stitch tool'
      }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (conn, req) => {
  setupWSConnection(conn, req);
});

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

server.listen(port, host, () => {
  console.log(`[H9 Backend] Server running on http://${host}:${port}`);
});
