import { WebSocket } from "ws";

const wsClient = new WebSocket("ws://localhost:3000");

wsClient.on("open", () => {
  console.log("connected to the server");
  wsClient.send("Welcoùe");
});

wsClient.on("message", (message) => {
  console.log("new message received", message);
});

wsClient.on("close", () => {
  console.log("disconnected");
});

wsClient.on("error", (err) => {
  console.error(err);
});
