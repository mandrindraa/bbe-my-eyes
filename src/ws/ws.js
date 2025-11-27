import { WebSocketServer as WsServer } from "ws";

class WebSocketServer {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Store clients with metadata
  }

  // Initialize WebSocket server
  init(server) {
    this.wss = new WsServer({ server });

    console.log("✓ WebSocket Server initialized");

    // Setup connection handler
    this.wss.on("connection", (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Setup error handler
    this.wss.on("error", (error) => {
      console.error("✗ WebSocket Server Error:", error.message);
    });
  }

  // Handle new client connection
  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const clientIp = req.socket.remoteAddress;

    // Store client information
    this.clients.set(clientId, {
      ws,
      id: clientId,
      ip: clientIp,
      connectedAt: new Date(),
      isAlive: true,
    });

    console.log(`\n✓ New WebSocket client connected`);
    console.log(`   - Client ID: ${clientId}`);
    console.log(`   - IP: ${clientIp}`);
    console.log(`   - Total clients: ${this.clients.size}\n`);

    // Send welcome message
    this.sendToClient(clientId, {
      type: "connection",
      message: "Connected to Be My Eyes WebSocket Server",
      clientId: clientId,
      timestamp: Date.now(),
    });

    // Setup message handler
    ws.on("message", (data) => {
      this.handleMessage(clientId, data);
    });

    // Setup pong handler (for heartbeat)
    ws.on("pong", () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.isAlive = true;
      }
    });

    // Setup close handler
    ws.on("close", () => {
      this.handleDisconnection(clientId);
    });

    // Setup error handler
    ws.on("error", (error) => {
      console.error(`✗ WebSocket Error for client ${clientId}:`, error.message);
    });
  }

  // Handle incoming messages from clients
  handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data.toString());

      console.log(`📨 Message from client ${clientId}:`, message);

      // Echo back or process message
      this.sendToClient(clientId, {
        type: "echo",
        message: "Message received",
        originalMessage: message,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error(
        `✗ Error parsing message from client ${clientId}:`,
        error.message
      );
      this.sendToClient(clientId, {
        type: "error",
        message: "Invalid JSON format",
        timestamp: Date.now(),
      });
    }
  }

  // Handle client disconnection
  handleDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      console.log(`\n✗ Client disconnected: ${clientId}`);
      console.log(`   - Total clients: ${this.clients.size - 1}\n`);
      this.clients.delete(clientId);
    }
  }

  // Send message to specific client
  sendToClient(clientId, data) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  // Broadcast message to all connected clients
  broadcast(data, excludeClientId = null) {
    let sentCount = 0;

    this.clients.forEach((client, clientId) => {
      if (
        clientId !== excludeClientId &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        client.ws.send(JSON.stringify(data));
        sentCount++;
      }
    });

    console.log(`📤 Broadcast sent to ${sentCount} client(s)`);
    return sentCount;
  }

  // Send location update to all clients
  broadcastLocationUpdate(locationData) {
    const message = {
      type: "location_update",
      data: locationData,
      timestamp: Date.now(),
    };

    return this.broadcast(message);
  }

  // Send sensor update to all clients
  broadcastSensorUpdate(sensorData) {
    const message = {
      type: "sensor_update",
      data: sensorData,
      timestamp: Date.now(),
    };

    return this.broadcast(message);
  }

  // Send custom text message to all clients
  broadcastTextMessage(text, metadata = {}) {
    const message = {
      type: "text_message",
      message: text,
      metadata: metadata,
      timestamp: Date.now(),
    };

    return this.broadcast(message);
  }

  // Send notification to all clients
  broadcastNotification(title, body, data = {}) {
    const message = {
      type: "notification",
      notification: {
        title,
        body,
        data,
      },
      timestamp: Date.now(),
    };

    return this.broadcast(message);
  }

  // Get all connected clients
  getClients() {
    const clientList = [];
    this.clients.forEach((client, clientId) => {
      clientList.push({
        id: clientId,
        ip: client.ip,
        connectedAt: client.connectedAt,
        isAlive: client.isAlive,
      });
    });
    return clientList;
  }

  // Get client count
  getClientCount() {
    return this.clients.size;
  }

  // Generate unique client ID
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Start heartbeat to check client connections
  startHeartbeat() {
    setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          console.log(`✗ Terminating inactive client: ${clientId}`);
          client.ws.terminate();
          this.clients.delete(clientId);
          return;
        }

        client.isAlive = false;
        client.ws.ping();
      });
    }, 30000); // Check every 30 seconds
  }
}

// Create singleton instance
const wsServer = new WebSocketServer();

export default wsServer;
