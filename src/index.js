import cors from "cors";
import { config } from "dotenv";
import express, { json, urlencoded } from "express";
import http from "node:http";
import db from "./database/index.js";
import { queryPairedData, queryUnreadMessages } from "./database/queries.js";
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
client.connect();

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
      "INSERT INTO locations (longitude, latitude, adresse) VALUES ($1, $2, $3)",
      [long, lat, addr.formattedAddress]
    );
    
    const data = queryPairedData();

    wsServer.broadcastDataUpdate(data);

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

app.post("/api/v1/steps", async (req,res) => {
  try {
    const { step, speed, calories} = req.body;
    console.log(req.body);
    
     await db.query(
      "INSERT INTO sensors (step, calories, velocity) VALUES ($1, $2, $3)",
      [step, speed, calories]
    );

  const data = queryPairedData();

    wsServer.broadcastDataUpdate(data);



  //  wsServer.broadcastStepUpdate(req.body);
     res.status(201).json({});
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

    const result = await db.query(
      "INSERT INTO messages (text_content) VALUES ($1) RETURNING id",
      [text]
    );

    const clientCount = wsServer.broadcast(
      "incoming_message",
      JSON.stringify({ id: result.rows[0].id, text })
    );

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

app.patch("/api/v1/speech/:id", async (req, res) => {
  try {
    const { id } = req.params;
    db.query("UPDATE messages SET is_read = true where id = $1", [id]);
    res.status(202).json({
      message: "message read",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json("Internal Server Error");
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`✓ Server running on http://0.0.0.0:${PORT}`);
  unreadMessageChecker();
});

const unreadMessageChecker = () => {
  const CHECK_INTERVAL = 30 * 1000;

  setInterval(async () => {
    try {
      const unreadMessages = await queryUnreadMessages();

      if (unreadMessages.length > 0) {
        console.log(`📬 Found ${unreadMessages.length} unread message(s)`);

        // Broadcast all unread messages to connected clients
        wsServer.broadcast("unread_messages", JSON.stringify(unreadMessages));
      }
    } catch (error) {
      console.error("Error checking unread messages:", error);
    }
  }, CHECK_INTERVAL);

  console.log(
    `✓ Unread message checker started (interval: ${CHECK_INTERVAL}ms)`
  );
};
