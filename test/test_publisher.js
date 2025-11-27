import mqtt from "mqtt";

const client = mqtt.connect("mqtt://broker.hivemq.com");

client.on("connect", () => {
  console.log("✓ Connected to MQTT broker");
  console.log("📤 Publishing test data...\n");

  // Publish location data
  const locationData = {
    longitude: -73.935242,
    latitude: 40.73061,
    adresse: "New York City",
    timestamp: Date.now(),
  };

  client.publish("be_my_eyes/locations", JSON.stringify(locationData), () => {
    console.log("✓ Location data published:", locationData);
  });

  // Publish sensor data after 2 seconds
  setTimeout(() => {
    const sensorData = {
      step: 5000,
      calories: 250.5,
      velocity: 5.2,
      timestamp: Date.now(),
      temperature: 25,
    };

    client.publish("be_my_eyes/sensors", JSON.stringify(sensorData), () => {
      console.log("✓ Sensor data published:", sensorData);

      // Close connection
      setTimeout(() => {
        client.end();
        console.log("\n✓ Publisher disconnected");
      }, 1000);
    });
  }, 2000);
});

client.on("error", (error) => {
  console.error("✗ Connection error:", error.message);
});
