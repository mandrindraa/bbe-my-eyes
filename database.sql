CREATE DATABASE  IF NOT EXISTS be_my_eyes;

USE be_my_eyes;

-- Create Locations table
CREATE TABLE locations (
    longitude DECIMAL(10, 8) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    adresse TEXT,
    timestamp BIGINT NOT NULL,
    PRIMARY KEY (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create Sensors table
CREATE TABLE sensors (
    step INT NOT NULL,
    calories FLOAT,
    velocity FLOAT,
    timestamp BIGINT NOT NULL,
    temperature FLOAT,
    PRIMARY KEY (timestamp),
    FOREIGN KEY (timestamp) REFERENCES locations(timestamp)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;