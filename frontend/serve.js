#!/usr/bin/env node
// serve.js – Simple static file server for MemoryLane frontend
// Usage: node serve.js [port]
// This replaces the need for Live Server or Vite for local dev

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2]) || 5500;

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? '/index.html' : req.url);

  // Strip query strings
  filePath = filePath.split('?')[0];

  // Default to index.html for extensionless routes
  if (!path.extname(filePath)) filePath += '.html';

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end(`404 – ${req.url} not found`);
      }
      res.writeHead(500);
      return res.end('Server error');
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌐 MemoryLane frontend running at:\n`);
  console.log(`   http://localhost:${PORT}           → Landing (Join Event)`);
  console.log(`   http://localhost:${PORT}/gallery   → Photo Gallery`);
  console.log(`   http://localhost:${PORT}/admin     → Admin Panel`);
  console.log(`   http://localhost:${PORT}/screen    → Projector Screen`);
  console.log(`\n   📱 On phone (same WiFi): http://YOUR_LAPTOP_IP:${PORT}\n`);
});