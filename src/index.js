import cors from "cors";
import { config } from "dotenv";
import express, { json, urlencoded } from "express";
import http from "node:http";
import db from "./database/index.js";
import client from "./mqtt/client.js";
import wsServer from "./ws/ws.js";

config();

const app = express();
// const privateKey = fs.readFileSync(process.env.SSL_KEY_PATH, "utf8");
// const certificate = fs.readFileSync(process.env.SSL_CERT_PATH, "utf8");
// const credentials = { key: privateKey, cert: certificate };

// Middleware
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(cors());

// ping the system to prevent sleep on render
// setInterval(async () => {
//   try {
//     await ping.promise.probe("https://bbe-my-eyes.onrender.com");
//     console.log("Ping completed");
//   } catch (err) {
//     console.error("Ping error", err);
//   }
// }, 40 * 1000);

const server = http.createServer(app);

// const server = https.createServer(app);
const PORT = process.env.PORT || 3000;

// start the mqtt client
client.connect();

// init the ws server for real time communication

wsServer.init(server);
wsServer.startHeartbeat();

// Test route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Be My Eyes API",
    mqtt_status: client.isConnected ? "connected" : "disconnected",
    websocket_clients: wsServer.getClientCount(),
  });
});

// Get all locations
// app.get("/api/v1/locations", async (req, res) => {
//   try {
//     const [rows] = await db.query("SELECT * FROM locations");
//     res.json({
//       success: true,
//       data: rows,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// });

// Get location by timestamp
// app.get("/api/locations", async (req, res) => {
//   try {
//     const [rows] = await db.query(
//       "SELECT * FROM locations WHERE timestamp = ?",
//       [req.params.timestamp]
//     );

//     if (rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Location not found",
//       });
//     }

//     res.json({
//       success: true,
//       data: rows[0],
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// });

// Create new location
app.post("/api/v1/locations", async (req, res) => {
  try {
    const { long, lat, addr } = req.body;
    const timestamp = Date.now();
    wsServer.broadcast(
      JSON.stringify([
        { longitude: long, latitude: lat, adresse: addr, timestamp },
      ])
    );

    await db.query(
      "INSERT INTO locations (longitude, latitude, adresse, timestamp) VALUES ($1, $2, $3, $4)",
      [longitude, latitude, adresse, timestamp]
    );

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

// Get all sensors
// app.get("/api/sensors", async (req, res) => {
//   try {
//     const [rows] = await db.query("SELECT * FROM sensors");
//     res.json({
//       success: true,
//       data: rows,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// });

// Create new sensor data
// app.post("/api/sensors", async (req, res) => {
//   try {
//     const { step, calories, velocity, timestamp, temperature } = req.body;

//     const [result] = await db.query(
//       "INSERT INTO sensors (step, calories, velocity, timestamp, temperature) VALUES (?, ?, ?, ?, ?)",
//       [step, calories, velocity, timestamp, temperature]
//     );

//     res.status(201).json({
//       success: true,
//       message: "Sensor data created successfully",
//       data: { timestamp },
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// });

// Get location with sensor data (JOIN)
app.get("/api/v1/data", async (req, res) => {
  try {
    const timestamp = Date.now() - 1000000;
    const rows = await db.query(
      `SELECT 
                l.longitude, l.latitude, l.adresse, l.timestamp,
                s.step, s.calories, s.velocity, s.temperature
            FROM locations l
            LEFT JOIN sensors s ON l.id = s.id
            WHERE l.timestamp >= $1`,
      [timestamp]
    );

    res.json({
      ...rows.rows,
    });
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

    const clientCount = wsServer.broadcast(text);

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
