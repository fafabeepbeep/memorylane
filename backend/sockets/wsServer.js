// sockets/wsServer.js – WebSocket server for real-time photo updates

const { WebSocketServer } = require('ws');
const url = require('url');

let wss = null;

// Map: eventCode → Set of WebSocket clients
const rooms = new Map();

/**
 * Initialize the WebSocket server attached to an HTTP server
 * @param {import('http').Server} httpServer
 */
const initWS = (httpServer) => {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const { query } = url.parse(req.url, true);
    const eventCode = (query.event || '').toUpperCase();

    if (!eventCode) {
      ws.close(1008, 'Missing event code');
      return;
    }

    // Add client to the event room
    if (!rooms.has(eventCode)) rooms.set(eventCode, new Set());
    rooms.get(eventCode).add(ws);

    console.log(`🔌 WS client joined room: ${eventCode} (total: ${rooms.get(eventCode).size})`);

    // Send welcome ping
    ws.send(JSON.stringify({ type: 'CONNECTED', event: eventCode }));

    ws.on('message', (data) => {
      // Clients can send heartbeats
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'PING') ws.send(JSON.stringify({ type: 'PONG' }));
      } catch {}
    });

    ws.on('close', () => {
      const room = rooms.get(eventCode);
      if (room) {
        room.delete(ws);
        if (room.size === 0) rooms.delete(eventCode);
      }
      console.log(`🔌 WS client left room: ${eventCode}`);
    });

    ws.on('error', (err) => {
      console.error(`WS error in room ${eventCode}:`, err.message);
    });
  });

  console.log('✅ WebSocket server ready at /ws');
  return wss;
};

/**
 * Broadcast a message to all clients in a specific event room
 * @param {string} eventCode
 * @param {object} payload
 */
const broadcastToEvent = (eventCode, payload) => {
  const room = rooms.get(eventCode?.toUpperCase());
  if (!room || room.size === 0) return;

  const msg = JSON.stringify(payload);
  room.forEach((client) => {
    if (client.readyState === 1 /* OPEN */) {
      try { client.send(msg); } catch {}
    }
  });
};

/**
 * Get number of connected clients in an event room
 */
const getRoomSize = (eventCode) => {
  return rooms.get(eventCode?.toUpperCase())?.size || 0;
};

module.exports = { initWS, broadcastToEvent, getRoomSize };