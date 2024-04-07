"use strict";

const gtfsRealtime = require("./utils/gtfsRealtime");
const digitraffic = require("./utils/digitraffic");
const trafik = require("./utils/trafikinfo");
const irishRail = require("./utils/irishrail");
const Trafikinfo = require("./clients/trafikinfo");
const HttpPoller = require("./clients/httpPoller");
const MqttClient = require("./clients/mqtt");
const config = require("../config.json");
const tile38 = require("./db/tile38");

// --- Http Clients ---
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

// --- Mqtt Clients ---
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

// --- GTFS Realtime ---
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
    // because trains are also fetched from Digitraffic
    if (feedId === "HSL" && data.properties.ro.startsWith("3001")) {
      continue;
    } else if (feedId === "HSL" && data.properties.ro.startsWith("3002")) {
      continue;
    }

    if (feedId === "digitransit") {
      // for Digitransit use feedId from the topic
      const t = topic.split("/");
      feedId = t[3];

      // Manual override to remove trains from Digitransit feed
      if (t[3] === "digitraffic") {
        continue;
      } else if (t[6] === "RAIL") {
        continue;
      }
    }

    // Set feedId to the feature
    data.properties.fe = feedId;
    // Add feedId to the vehicleId
    data.properties.ve = feedId + ":" + data.properties.ve;

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

// --- Digitraffic ---
const parseDigitraffic = (feedId, buffer, topic = null) => {
  const data = digitraffic.mapData(JSON.parse(buffer.toString()));

  // Set feedId to the feature
  data.properties.fe = feedId;
  // Add feedId to the vehicleId
  data.properties.ve = feedId + ":" + data.properties.ve;

  const props = JSON.stringify(data.properties);

  tile38.client.set(
    "vehicles",
    data.properties.ve,
    data.geometry,
    { properties: props },
    { expire: 300 }
  );
};

// --- Trafikinfo ---
const parseTrafikinfo = (feedId, message) => {
  const data = trafik.mapData(message);

  // Set feedId to the feature
  data.properties.fe = feedId;
  // Add feedId to the vehicleId
  data.properties.ve = feedId + ":" + data.properties.ve;

  const props = JSON.stringify(data.properties);

  tile38.client.set(
    "vehicles",
    data.properties.ve,
    data.geometry,
    { properties: props },
    { expire: 300 }
  );
};

// --- Irish Rail ---
const parseIrishRail = (feedId, message) => {
  const all = irishRail.mapData(message);

  for (const data of all) {
    // Set feedId to the feature
    data.properties.fe = feedId;
    // Add feedId to the vehicleId
    data.properties.ve = feedId + ":" + data.properties.ve;

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

const main = async () => {
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
    // --- Digitransit ---
    else if (feed.type === "digitransit") {
      const options = {
        name: feed.feedId,
        topics: feed.topics,
      };
      const m = mqttClients.newClient(feed.feedUrl, options);
      m.on("data", parseGtfsRt);
      m.connectToBroker();
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
    // --- Trafikinfo ---
    else if (feed.type === "trafikinfo") {
      const options = {
        name: feed.feedId,
        interval: feed.frequency * 1000,
        token: feed.token,
      };
      const p = new Trafikinfo(feed.feedUrl, options);
      p.on("data", parseTrafikinfo);
      p.pollForever();
    }
    // --- Irish Rail ---
    else if (feed.type === "irishrail") {
      const options = {
        name: feed.feedId,
        interval: feed.frequency * 1000,
        response: "text",
      };
      const p = polling.newPoller(feed.feedUrl, options);
      p.on("data", parseIrishRail);
      p.pollForever();
    }
    // --- Delay ---
    await new Promise((r) => setTimeout(r, 500));
  }
};

main();
