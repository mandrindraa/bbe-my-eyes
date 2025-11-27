import cors from "cors";
import { config } from "dotenv";
import express, { json, urlencoded } from "express";
import http from "node:http";
import db from "./database/index.js";
import { queryPairedData } from "./database/queries.js";
import client from "./mqtt/client.js";
import wsServer from "./ws/socketIOServer.js";

config();

const app = express();

// Middleware
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(cors());

const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// init the ws server for real time communication
wsServer.init(server);

// start the mqtt client
client.connect(wsServer);

// Test route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Be My Eyes API",
    mqtt_status: client.isConnected ? "connected" : "disconnected",
    websocket_clients: wsServer.getClientCount(),
  });
});

// Create new location
app.post("/api/v1/locations", async (req, res) => {
  try {
    const { long, lat, addr } = req.body;
    console.log(req.body);
    const timestamp = Date.now();

    await db.query(
      "INSERT INTO locations (longitude, latitude, adresse, timestamp) VALUES ($1, $2, $3, $4)",
      [long, lat, addr.formattedAddress, timestamp]
    );

    wsServer.broadcastLocationUpdate({
      longitude: long,
      latitude: lat,
      adresse: addr,
    });

    res.status(201).json({
      success: true,
      message: "Location created successfully",
      data: { timestamp },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get location with sensor data (JOIN)
app.get("/api/v1/data", async (req, res) => {
  try {
    const timestamp = Date.now();
    console.log(timestamp);
    const rows = await queryPairedData();
    console.log(rows);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/api/v1/speech", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: "Message is required",
      });
    }

    await db.query("INSERT INTO messages (text_content) VALUES ($1)", [text]);

    const clientCount = wsServer.broadcastTextMessage(text);

    res.json({
      success: true,
      message: "Message broadcasted",
      clientCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`✓ Server running on http://0.0.0.0:${PORT}`);
});
