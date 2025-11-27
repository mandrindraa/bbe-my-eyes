# BE MY EYES

bla bla goes here

## Functionality

- Listen on mqtt topic defined in .env

```bash
MQTT_TOPIC_LOCATIONS=be_my_eyes/locations #for ex.
MQTT_TOPIC_SENSORS=be_my_eyes/sensors #for ex.
```

#### Have a socket.io server for real time communication

- Emit `incoming_message` when there is new message that needs to be read by the tts module
- Emit `location_update` when a location update is triggered by the mobile app
- Emit `sensor_update` when a sensor update is received from the mqtt broker

#### Have a MQTT consumer

- Use `mqtt://broker.hivemq.com` as MQTT Broker

#### Have a REST API

- Have data history at `/api/v1/data`
- Save location data at `/api/v1/locations`
- Send speech data at `/api/v1/speech`

## How to install it?

- Clone the repo:

```bash
git clone https://github.com/mandrindraa/bbe-my-eyes
cd bbe-my-eyes
npm i
```

- Start dev server:

```bash
npm run dev
```

- Or the prod(like) server:

```bash
npm run start
```
