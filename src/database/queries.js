import db from "./index.js";

/**
 * Query latest single record from both tables
 * @returns {Promise<Object>} Combined location and sensor data
 */
export async function queryLatestData() {
  try {
    // Get the latest location
    const locationResult = await db.query(`
      SELECT 
        id,
        longitude,
        latitude,
        adresse,
        EXTRACT(EPOCH FROM timestamp) * 1000 as timestamp
      FROM locations
      ORDER BY id DESC
      LIMIT 1
    `);

    // Get the latest sensor data
    const sensorResult = await db.query(`
      SELECT 
        id,
        step,
        calories,
        velocity,
        temperature,
        EXTRACT(EPOCH FROM timestamp) * 1000 as timestamp
      FROM sensors
      ORDER BY id DESC
      LIMIT 1
    `);

    const location = locationResult.rows[0] || null;
    const sensor = sensorResult.rows[0] || null;

    // Calculate time difference if both exist
    let timeDiff = null;
    if (location && sensor) {
      timeDiff = Math.abs(location.timestamp - sensor.timestamp);
    }

    // Return combined data
    return {
      location: location
        ? {
            id: location.id,
            longitude: parseFloat(location.longitude),
            latitude: parseFloat(location.latitude),
            adresse: location.adresse,
            timestamp: parseInt(location.timestamp),
          }
        : null,
      sensor: sensor
        ? {
            id: sensor.id,
            step: sensor.step,
            calories: sensor.calories,
            velocity: sensor.velocity,
            temperature: sensor.temperature,
            timestamp: parseInt(sensor.timestamp),
          }
        : null,
      timeDiff: timeDiff,
      idsMatch: location && sensor && location.id === sensor.id,
      combinedTimestamp: Math.max(
        location?.timestamp || 0,
        sensor?.timestamp || 0
      ),
    };
  } catch (error) {
    console.error("Error querying latest data:", error);
    throw error;
  }
}

/**
 * Query multiple records with ID-based joining
 * When IDs match, they are paired together
 * When IDs don't match, uses the latest available from each table
 * @param {number} limit - Number of records to fetch
 * @returns {Promise<Array>} Array of paired location-sensor data
 */
export async function queryPairedData(limit = 10) {
  try {
    // Get recent locations ordered by ID
    const locationResult = await db.query(
      `
      SELECT 
        id,
        longitude,
        latitude,
        adresse,
        EXTRACT(EPOCH FROM timestamp) * 1000 as timestamp
      FROM locations
      ORDER BY id DESC
    `
    );

    // Get recent sensors ordered by ID
    const sensorResult = await db.query(
      `
      SELECT 
        id,
        step,
        calories,
        velocity,
        temperature,
        EXTRACT(EPOCH FROM timestamp) * 1000 as timestamp
      FROM sensors
      ORDER BY id DESC
    `
    );

    const locations = locationResult.rows;
    const sensors = sensorResult.rows;

    // If both are empty, return empty array
    if (locations.length === 0 && sensors.length === 0) {
      return [];
    }

    // Get the latest from each table (first in array since we ordered DESC)
    const latestLocation = locations[0];
    const latestSensor = sensors[0];

    // Determine the maximum number of records to process
    const maxLength = Math.max(locations.length, sensors.length);
    const pairedData = [];

    for (let i = 0; i < maxLength; i++) {
      const location = locations[i];
      const sensor = sensors[i];

      // Use latest if current index doesn't exist
      const finalLocation = location || latestLocation;
      const finalSensor = sensor || latestSensor;

      if (!finalLocation && !finalSensor) {
        continue; // Skip if both are null
      }

      const timeDiff =
        finalLocation && finalSensor
          ? Math.abs(finalLocation.timestamp - finalSensor.timestamp)
          : null;

      pairedData.push({
        steps: finalSensor.step,
        calories: finalSensor.calories,
        speed: finalSensor.velocity,
        temperature: finalSensor.temperature,
        longitude: finalLocation.longitude,
        latitude: finalLocation.latitude,
        adresse: finalLocation.adresse,
        timestamp: Math.max(finalLocation.timestamp, finalSensor.timestamp),
      });
    }

    return pairedData;
  } catch (error) {
    console.error("Error querying paired data:", error);
    throw error;
  }
}

/**
 * Query with FULL OUTER JOIN based on ID
 * Pairs records by ID, includes unmatched records from both tables
 * @param {number} limit - Number of records to fetch
 * @returns {Promise<Array>} Array of joined location-sensor data
 */
export async function queryJoinedByID(limit = 10) {
  try {
    const result = await db.query(
      `
      WITH latest_locations AS (
        SELECT * FROM locations ORDER BY id DESC LIMIT $1
      ),
      latest_sensors AS (
        SELECT * FROM sensors ORDER BY id DESC LIMIT $1
      ),
      latest_combined AS (
        SELECT 
          COALESCE(l.id, s.id) as record_id,
          l.id as location_id,
          l.longitude,
          l.latitude,
          l.adresse,
          EXTRACT(EPOCH FROM l.timestamp) * 1000 as location_timestamp,
          s.id as sensor_id,
          s.step,
          s.calories,
          s.velocity,
          s.temperature,
          EXTRACT(EPOCH FROM s.timestamp) * 1000 as sensor_timestamp
        FROM latest_locations l
        FULL OUTER JOIN latest_sensors s ON l.id = s.id
      ),
      with_latest_fallback AS (
        SELECT 
          *,
          FIRST_VALUE(location_id) OVER (ORDER BY location_id DESC NULLS LAST) as latest_location_id,
          FIRST_VALUE(sensor_id) OVER (ORDER BY sensor_id DESC NULLS LAST) as latest_sensor_id
        FROM latest_combined
      )
      SELECT 
        record_id,
        COALESCE(location_id, latest_location_id) as location_id,
        longitude,
        latitude,
        adresse,
        location_timestamp,
        COALESCE(sensor_id, latest_sensor_id) as sensor_id,
        step,
        calories,
        velocity,
        temperature,
        sensor_timestamp
      FROM with_latest_fallback
      ORDER BY record_id DESC
    `,
      [limit]
    );

    return result.rows.map((row) => {
      const timeDiff =
        row.location_timestamp && row.sensor_timestamp
          ? Math.abs(row.location_timestamp - row.sensor_timestamp)
          : null;

      return {
        location: row.location_id
          ? {
              id: row.location_id,
              longitude: parseFloat(row.longitude),
              latitude: parseFloat(row.latitude),
              adresse: row.adresse,
              timestamp: parseInt(row.location_timestamp),
            }
          : null,
        sensor: row.sensor_id
          ? {
              id: row.sensor_id,
              step: row.step,
              calories: row.calories,
              velocity: row.velocity,
              temperature: row.temperature,
              timestamp: parseInt(row.sensor_timestamp),
            }
          : null,
        timeDiff: timeDiff,
        idsMatch: row.location_id === row.sensor_id,
        combinedTimestamp: Math.max(
          row.location_timestamp || 0,
          row.sensor_timestamp || 0
        ),
      };
    });
  } catch (error) {
    console.error("Error querying joined data:", error);
    throw error;
  }
}
