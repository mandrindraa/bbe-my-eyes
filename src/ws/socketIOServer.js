import { Server as SocketIoServer } from "socket.io";
import { queryLatestData } from "../database/queries.js";

class SocketIOServer {
  constructor() {
    this.io = null;
    this.clientsMetadata = new Map();
  }

  /**
   * Initialise le serveur Socket.IO en l'attachant au serveur HTTP existant.
   * @param {import("http").Server} server Le serveur HTTP.
   */
  init(server) {
    this.io = new SocketIoServer(server, {
      cors: {
        origin: "*",
      },
    });

    console.log("✓ Socket.IO Server initialized");

    this.io.on("connection", (socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Gère les nouvelles connexions Socket.IO.
   * @param {import("socket.io").Socket} socket Le socket du client connecté.
   */
  handleConnection(socket) {
    const clientId = socket.id;
    const clientIp = socket.handshake.address;

    this.clientsMetadata.set(clientId, {
      ip: clientIp,
      connectedAt: new Date(),
    });

    console.log(`\n✓ New Socket.IO client connected`);
    console.log(`   - Client ID: ${clientId}`);
    console.log(`   - IP: ${clientIp}`);
    console.log(`   - Total clients: ${this.io.engine.clientsCount}\n`);

    // L'ancien "handleMessage" qui faisait un ECHO de tout message reçu
    socket.on("client_message", (message) => {
      this.handleClientMessage(socket, message);
    });

    // Si le client envoie un message pour une mise à jour de localisation
    socket.on("update_location", (locationData) => {
      // Traitement de la donnée et diffusion aux autres si nécessaire
      this.broadcastLocationUpdate(locationData, socket.id);
    });

    // L'ancien ws.on("close", ...)
    socket.on("disconnect", (reason) => {
      this.handleDisconnection(socket.id, reason);
    });

    // L'ancien ws.on("error", ...)
    socket.on("error", (error) => {
      console.error(
        `✗ Socket.IO Error for client ${socket.id}:`,
        error.message
      );
    });
  }

  /**
   * Gère les messages reçus du client, agissant comme un 'echo' pour cet exemple.
   */
  handleClientMessage(socket, message) {
    console.log(`📨 Message from client ${socket.id}:`, message);

    // 1. Remplacement de l'envoi de "type: echo"
    // Socket.IO gère le JSON pour vous.
    socket.emit("echo", {
      message: "Message received",
      originalMessage: message,
      timestamp: Date.now(),
    });
  }

  handleDisconnection(clientId, reason) {
    if (this.clientsMetadata.has(clientId)) {
      this.clientsMetadata.delete(clientId);
      console.log(`\n✗ Client disconnected: ${clientId}`);
      console.log(`   - Reason: ${reason}`);
      console.log(`   - Total clients: ${this.io.engine.clientsCount}\n`);
    }
  }

  /**
   * Envoi un message à tous les clients connectés, ou exclut un client spécifique.
   * Remplacement de la méthode broadcast() manuelle.
   * @param {string} eventName Le nom de l'événement à émettre.
   * @param {*} data Les données à envoyer.
   * @param {string} excludeClientId L'ID du client à exclure (facultatif).
   */
  broadcast(eventName, data, excludeClientId = null) {
    let emitter = this.io;

    // Si un client doit être exclu, on utilise la méthode 'except'
    if (excludeClientId) {
      emitter = emitter.except(excludeClientId);
    }

    emitter.emit(eventName, data);

    const sentCount = this.io.engine.clientsCount - (excludeClientId ? 1 : 0);
    console.log(
      `📤 Broadcast sent (Event: ${eventName}) to approx. ${sentCount} client(s)`
    );
    return sentCount;
  }

  async broadcastLocationUpdate(locationData, excludeId = null) {
    return this.broadcast(
      "location_update",
      JSON.stringify([{ ...locationData, timestamp: Date.now() }]),
      excludeId
    );
  }

  broadcastSensorUpdate(sensorData, excludeId = null) {
    return this.broadcast(
      "sensor_update",
      JSON.stringify([{ ...sensorData, timestamp: Date.now() }]),
      excludeId
    );
  }

  broadcastImageData(imageData, excludeId = null) {
    const message = (() => {
      if(!imageData.obstacle) return ""
      return `Attention! Obstacle détecter ${imageData.direction} à ${imageData.distance} mètres.`
    })()
    return setTimeout(() => {this.broadcast(
      "update_camera",
      JSON.stringify({ timestamp: Date.now(), message }),
      excludeId)
    }, 7000);
  }
    
  broadcastStepUpdate (stepData, excludeId = null) {
    return this.broadcast(
      "update_steps",
      JSON.stringify({ timestamp: Date.now(),...stepData}),
      excludeId
    );
  }  

  async broadcastDataUpdate(data) {
     return this.broadcast("update:data", JSON.stringify(data));
  }

  getClients() {
    const clientList = [];
    // io.sockets.sockets est une Map de tous les sockets connectés
    this.io.sockets.sockets.forEach((socket, clientId) => {
      const metadata = this.clientsMetadata.get(clientId) || {};
      clientList.push({
        id: clientId,
        ip: metadata.ip,
        connectedAt: metadata.connectedAt,
        isAlive: true,
      });
    });
    return clientList;
  }

  getClientCount() {
    return this.io.engine.clientsCount;
  }
}

const ioServer = new SocketIOServer();
export default ioServer;
