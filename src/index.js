"use strict";

const gtfsRealtime = require("./utils/gtfsRealtime");
const digitraffic = require("./utils/digitraffic");
const HttpPoller = require("./utils/httpPoller");
const MqttClient = require("./utils/mqtt");
const config = require("../config.json");
const tile38 = require("./db/tile38");

class Pollers {
  constructor() {
    this.pollers = [];
  }

  newPoller(url, options) {
    let p = new HttpPoller(url, options);
    this.pollers.push(p);
    return p;
  }

  get allPollers() {
    return this.pollers;
  }
}

let polling = new Pollers();

class MqttClients {
  constructor() {
    this.mqttClients = [];
  }

  newClient(url, options) {
    let m = new MqttClient(url, options);
    this.mqttClients.push(m);
    return m;
  }

  get allClients() {
    return this.mqttClients;
  }
}

let mqttClients = new MqttClients();

const parseGtfsRt = (feedId, buffer, topic = null) => {
  const message = gtfsRealtime.decodeGtfsRealtime(buffer);

  for (const entity of message.entity) {
    const data = gtfsRealtime.mapData(entity);

    // Check that the data isn't stale
    // (i.e. must not be older than 15 min)
    const diff = Date.now() / 1000 - data.properties.ts;
    if (diff >= 900) {
      continue;
    }

    // Check that the data has vehicleId
    // it is used as the unique identifier in tile38
    if (
      typeof data.properties.ve === "string" &&
      data.properties.ve.length === 0
    ) {
      continue;
    }

    // Manual override to remove trains from HSL feed
    // because trains are fetched from Digitraffic
    if (feedId === "HSL" && data.properties.ve.startsWith("3001")) {
      continue;
    }

    // Add feedId to the vehicleId
    data.properties.ve = feedId + ":" + data.properties.ve;
    data.properties.fe = feedId;

    const props = JSON.stringify(data.properties);

    tile38.client.set(
      "vehicles",
      data.properties.ve,
      data.geometry,
      { properties: props },
      { expire: 300 }
    );
  }
};

const parseDigitraffic = (feedId, buffer, topic = null) => {
  const data = digitraffic.mapData(JSON.parse(buffer.toString()));
  const props = JSON.stringify(data.properties);

  tile38.client.set(
    "vehicles",
    data.properties.ve,
    data.geometry,
    { properties: props },
    { expire: 300 }
  );
};

const main = () => {
  // Load all configured feeds
  for (const feed of config.feeds) {
    // --- GTFS Realtime ---
    if (feed.type === "gtfs-rt") {
      const options = {
        name: feed.feedId,
        interval: feed.frequency * 1000,
        response: "buffer",
        token: feed.token,
      };
      const p = polling.newPoller(feed.feedUrl, options);
      p.on("data", parseGtfsRt);
      p.pollForever();
    }
    // --- Digitraffic ---
    else if (feed.type === "digitraffic") {
      const options = {
        name: feed.feedId,
        topics: feed.topics,
      };
      const m = mqttClients.newClient(feed.feedUrl, options);
      m.on("data", parseDigitraffic);
      m.connectToBroker();
    }
  }
};

main();
