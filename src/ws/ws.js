import { WebSocketServer as WsServer } from "ws";

class WebSocketServer {
  constructor() {
    this.wss = null;
    this.clients = new Map();
  }

  init(server) {
    this.wss = new WsServer({
      server,
    });

    console.log("✓ WebSocket Server initialized");

    this.wss.on("connection", (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on("error", (error) => {
      console.error("✗ WebSocket Server Error:", error.message);
    });
  }

  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const clientIp = req.socket.remoteAddress;

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
    console.log(`   - Path: /`);
    console.log(`   - Total clients: ${this.clients.size}\n`);

    this.sendToClient(clientId, {
      type: "connection",
      message: "Connected to Be My Eyes WebSocket Server",
      clientId: clientId,
      timestamp: Date.now(),
    });

    ws.on("message", (data) => {
      this.handleMessage(clientId, data);
    });

    ws.on("pong", () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.isAlive = true;
      }
    });

    ws.on("close", () => {
      this.handleDisconnection(clientId);
    });

    ws.on("error", (error) => {
      console.error(`✗ WebSocket Error for client ${clientId}:`, error.message);
    });
  }

  handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data.toString());

      console.log(`📨 Message from client ${clientId}:`, message);

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

  handleDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      console.log(`\n✗ Client disconnected: ${clientId}`);
      console.log(`   - Total clients: ${this.clients.size - 1}\n`);
      this.clients.delete(clientId);
    }
  }

  sendToClient(clientId, data) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

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

  broadcastLocationUpdate(locationData) {
    const message = {
      type: "location_update",
      data: locationData,
      timestamp: Date.now(),
    };

    return this.broadcast(message);
  }

  broadcastSensorUpdate(sensorData) {
    const message = {
      type: "sensor_update",
      data: sensorData,
      timestamp: Date.now(),
    };

    return this.broadcast(message);
  }

  broadcastTextMessage(text, metadata = {}) {
    const message = {
      type: "text_message",
      message: text,
      metadata: metadata,
      timestamp: Date.now(),
    };

    return this.broadcast(message);
  }

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

  getClientCount() {
    return this.clients.size;
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

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
    }, 30000);
  }
}

const wsServer = new WebSocketServer();
export default wsServer;
