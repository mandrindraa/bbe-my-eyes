import { config } from "dotenv";
import mysql from "mysql2";

config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Get promise-based connection
const promisePool = pool.promise();

// Test connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error("Error connecting to MySQL database:", err.message);
    return;
  }
  console.log("✓ MySQL database connected successfully");
  connection.release();
});

export default promisePool;
