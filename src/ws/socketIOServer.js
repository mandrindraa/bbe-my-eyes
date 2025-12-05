import { Server as SocketIoServer } from "socket.io";
import { queryLatestData } from "../database/queries.js";

class SocketIOServer {
  constructor() {
    this.io = null;
    this.clientsMetadata = new Map();
    
    // Système de throttling pour les messages caméra
    this.lastCameraBroadcast = 0;
    this.cameraThrottleDelay = 10000; // 10 secondes entre chaque message caméra
    this.pendingCameraMessage = null;
    this.cameraMessageQueue = []; // File d'attente des messages caméra
    this.maxCameraQueueSize = 1; // Garde seulement le dernier message
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

    socket.on("client_message", (message) => {
      this.handleClientMessage(socket, message);
    });

    socket.on("update_location", (locationData) => {
      this.broadcastLocationUpdate(locationData, socket.id);
    });

    socket.on("disconnect", (reason) => {
      this.handleDisconnection(socket.id, reason);
    });

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
   * @param {string} eventName Le nom de l'événement à émettre.
   * @param {*} data Les données à envoyer.
   * @param {string} excludeClientId L'ID du client à exclure (facultatif).
   */
  broadcast(eventName, data, excludeClientId = null) {
    let emitter = this.io;

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

  /**
   * Diffuse les données d'image avec un système de throttling intelligent
   * pour éviter de saturer le canal TTS avec trop de messages caméra
   */
  broadcastImageData(imageData, excludeId = null) {
    // Ne rien faire s'il n'y a pas d'obstacle
    if (!imageData.obstacle) {
      console.log("📸 Camera message ignored (no obstacle)");
      return;
    }

    const now = Date.now();
    const timeSinceLastBroadcast = now - this.lastCameraBroadcast;

    const message = `Attention! Obstacle détecté ${imageData.direction} à ${imageData.distance} mètres.`;

    // Si assez de temps s'est écoulé depuis le dernier message
    if (timeSinceLastBroadcast >= this.cameraThrottleDelay) {
      // Envoyer immédiatement
      this.sendCameraMessage(message, excludeId);
    } else {
      // Ajouter à la file d'attente (garde seulement le dernier)
      this.cameraMessageQueue = [{ message, excludeId, imageData }];
      
      // Planifier l'envoi si pas déjà planifié
      if (!this.pendingCameraMessage) {
        const remainingTime = this.cameraThrottleDelay - timeSinceLastBroadcast;
        
        this.pendingCameraMessage = setTimeout(() => {
          this.processCameraQueue();
        }, remainingTime);

        console.log(`📸 Camera message queued (waiting ${Math.round(remainingTime / 1000)}s)`);
      } else {
        console.log(`📸 Camera message replaced in queue (only latest kept)`);
      }
    }
  }

  /**
   * Envoie un message caméra et met à jour le timestamp
   */
  sendCameraMessage(message, excludeId = null) {
    this.lastCameraBroadcast = Date.now();
    this.broadcast(
      "update_camera",
      JSON.stringify({ 
        timestamp: this.lastCameraBroadcast, 
        message,
        priority: "low" // Indique au frontend que c'est une priorité basse pour le TTS
      }),
      excludeId
    );
    console.log("📸 Camera message sent:", message);
  }

  /**
   * Traite la file d'attente des messages caméra
   */
  processCameraQueue() {
    if (this.cameraMessageQueue.length > 0) {
      // Prendre seulement le dernier message de la file
      const { message, excludeId } = this.cameraMessageQueue[this.cameraMessageQueue.length - 1];
      this.cameraMessageQueue = [];
      this.sendCameraMessage(message, excludeId);
    }
    this.pendingCameraMessage = null;
  }

  broadcastStepUpdate(stepData, excludeId = null) {
    return this.broadcast(
      "update_steps",
      JSON.stringify({ 
        timestamp: Date.now(), 
        ...stepData,
        priority: "medium" // Priorité moyenne pour les étapes
      }),
      excludeId
    );
  }

  async broadcastDataUpdate(data) {
    return this.broadcast("update:data", JSON.stringify({
      ...data,
      priority: "high" // Priorité haute pour les données importantes
    }));
  }

  getClients() {
    const clientList = [];
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

  /**
   * Permet de modifier le délai de throttling pour les messages caméra
   * @param {number} delayMs Délai en millisecondes (recommandé: 8000-15000)
   */
  setCameraThrottleDelay(delayMs) {
    this.cameraThrottleDelay = delayMs;
    console.log(`📸 Camera throttle delay set to ${delayMs}ms (${delayMs / 1000}s)`);
  }

  /**
   * Nettoie les messages caméra en attente (utile en cas de déconnexion)
   */
  clearCameraQueue() {
    if (this.pendingCameraMessage) {
      clearTimeout(this.pendingCameraMessage);
      this.pendingCameraMessage = null;
    }
    this.cameraMessageQueue = [];
    console.log("📸 Camera queue cleared");
  }
}

const ioServer = new SocketIOServer();
export default ioServer;