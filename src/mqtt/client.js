import { config } from "dotenv";
import mqtt from "mqtt";
import db from "../database/index.js";

config();

class MQTTClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  // Connect to MQTT broker
  connect() {
    const options = {
      port: process.env.MQTT_PORT || 1883,
      username: process.env.MQTT_USERNAME || "",
      password: process.env.MQTT_PASSWORD || "",
      clientId: `be_my_eyes_${Math.random().toString(16).slice(3)}`,
      clean: true,
      reconnectPeriod: 1000,
    };

    this.client = mqtt.connect(process.env.MQTT_BROKER, options);

    // Connection event
    this.client.on("connect", () => {
      console.log("✓ MQTT Client connected successfully");
      this.isConnected = true;
      this.subscribeToTopics();
    });

    // Error event
    this.client.on("error", (error) => {
      console.error("✗ MQTT Connection error:", error.message);
      this.isConnected = false;
    });

    // Reconnect event
    this.client.on("reconnect", () => {
      console.log("↻ MQTT Client reconnecting...");
    });

    // Offline event
    this.client.on("offline", () => {
      console.log("✗ MQTT Client offline");
      this.isConnected = false;
    });

    // Message event
    this.client.on("message", (topic, message) => {
      this.handleMessage(topic, message);
    });
  }

  // Subscribe to topics
  subscribeToTopics() {
    const topics = [
      process.env.MQTT_TOPIC_LOCATIONS,
      process.env.MQTT_TOPIC_SENSORS,
    ];

    topics.forEach((topic) => {
      this.client.subscribe(topic, (err) => {
        if (err) {
          console.error(`✗ Failed to subscribe to ${topic}:`, err.message);
        } else {
          console.log(`✓ Subscribed to topic: ${topic}`);
        }
      });
    });
  }

  // Handle incoming messages
  async handleMessage(topic, message) {
    try {
      const data = JSON.parse(message.toString());
      console.log(`📨 Received message from ${topic}:`, data);

      if (topic === process.env.MQTT_TOPIC_LOCATIONS) {
        await this.saveLocation(data);
      } else if (topic === process.env.MQTT_TOPIC_SENSORS) {
        await this.saveSensor(data);
      }
    } catch (error) {
      console.error("Error handling MQTT message:", error.message);
    }
  }

  // Save location data to database
  async saveLocation(data) {
    try {
      const { longitude, latitude, adresse, timestamp } = data;

      // Validate required fields
      if (!longitude || !latitude || !timestamp) {
        console.error("Missing required fields for location");
        return;
      }

      await db.query(
        "INSERT INTO locations (longitude, latitude, adresse, timestamp) VALUES ($1, $2, $3, $4)",
        [longitude, latitude, adresse, timestamp]
      );

      console.log("✓ Location saved to database:", { timestamp });
    } catch (error) {
      console.error("Error saving location to database:", error.message);
    }
  }

  // Save sensor data to database
  async saveSensor(data) {
    try {
      const { step, calories, velocity, timestamp, temperature } = data;

      // Validate required fields
      if (step === undefined || !timestamp) {
        console.error("Missing required fields for sensor");
        return;
      }

      await db.query(
        "INSERT INTO sensors (step, calories, velocity, timestamp, temperature) VALUES ($1, $2, $3, $4, $5)",
        [step, calories, velocity, timestamp, temperature]
      );

      console.log("✓ Sensor data saved to database:", { timestamp });
    } catch (error) {
      console.error("Error saving sensor to database:", error.message);
    }
  }

  // Publish message to topic
  publish(topic, message) {
    if (!this.isConnected) {
      console.error("MQTT Client is not connected");
      return false;
    }

    this.client.publish(topic, JSON.stringify(message), (err) => {
      if (err) {
        console.error("Error publishing message:", err.message);
      } else {
        console.log(`✓ Message published to ${topic}`);
      }
    });

    return true;
  }

  // Disconnect from MQTT broker
  disconnect() {
    if (this.client) {
      this.client.end();
      console.log("✓ MQTT Client disconnected");
    }
  }
}

export default new MQTTClient();
