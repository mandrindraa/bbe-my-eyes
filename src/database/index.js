import { config } from "dotenv";
import { Pool } from "pg";
config();

// Create connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: true,
});

// Test connection
pool.connect((err) => {
  if (err) {
    console.error("Error connecting to database:", err.message);
    return;
  }
  console.log("✓ Database connected successfully");
});

// export async function queryLatestData() {
//   const rows = await pool.query(
//     `SELECT
//                 l.longitude, l.latitude, l.adresse, l.timestamp,
//                 s.step as steps, s.calories, s.velocity as speed, s.temperature
//             FROM locations l
//             JOIN sensors s ON l.id = s.id
//             WHERE l.timestamp <= $1 ORDER BY s.id DESC`,
//     [Date.now()]
//   );
//   return rows.rows;
// }

export default pool;
