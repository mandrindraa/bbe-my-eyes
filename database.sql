-- Create database
CREATE DATABASE be_my_eyes;

-- Connect to the database
\c be_my_eyes;

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS sensors CASCADE;
DROP TABLE IF EXISTS locations CASCADE;

-- Create locations table with auto-increment ID
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    longitude DECIMAL(10, 8) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    adresse TEXT,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sensors table with auto-increment ID
CREATE TABLE sensors (
    id SERIAL PRIMARY KEY,
    location_id INTEGER,
    step INTEGER NOT NULL,
    calories REAL,
    velocity REAL,
    timestamp BIGINT NOT NULL,
    temperature BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES locations(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT false
    text TEXT
);

-- Create indexes for better performance
CREATE INDEX idx_locations_id ON locations(id);
CREATE INDEX idx_locations_timestamp ON locations(timestamp);
CREATE INDEX idx_locations_created_at ON locations(created_at DESC);

CREATE INDEX idx_sensors_id ON sensors(id);
CREATE INDEX idx_sensors_location_id ON sensors(location_id);
CREATE INDEX idx_sensors_timestamp ON sensors(timestamp);
CREATE INDEX idx_sensors_created_at ON sensors(created_at DESC);

CREATE INDEX idx_message_id ON messages(id);

-- Display tables
\dt

-- Display table structures
\d locations
\d sensors