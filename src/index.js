"use strict";
const NodeCache = require("node-cache");
const gtfsRealtime = require("./utils/gtfsRealtime");
const digitraffic = require("./utils/digitraffic");
const nsApi = require("./utils/nsApi");
const trafik = require("./utils/trafikinfo");
const irishRail = require("./utils/irishrail");
const Trafikinfo = require("./clients/trafikinfo");
const HttpPoller = require("./clients/httpPoller");
const MqttClient = require("./clients/mqtt");
const entur = require("./utils/entur");
const config = require("../config.json");
const tile38 = require("./db/tile38");
const EnturPoller = require("./clients/enturPoller");

// HSL Route Short Name
const hsl_route = require("../data/hsl_routes.json");
const getHSLShortRouteName = (routeId) => {
  const res = hsl_route.filter((o) => {
    return o.route_id == routeId;
  });

  if (res && res.length > 0) {
    return res[0].route_short_name;
  } else {
    return routeId;
  }
};

// Cache points
const pointCache = new NodeCache({
  stdTTL: 600,
  deleteOnExpire: true,
});

const equalsCheck = (a, b) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

// Bearing calculation
function bearing(point1, point2) {
  var lon1 = toRad(point1[0]);
  var lon2 = toRad(point2[0]);
  var lat1 = toRad(point1[1]);
  var lat2 = toRad(point2[1]);
  var a = Math.sin(lon2 - lon1) * Math.cos(lat2);
  var b =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);

  var bearing = toDeg(Math.atan2(a, b));

  return bearing;
}

function toRad(degree) {
  return (degree * Math.PI) / 180;
}

function toDeg(radian) {
  return (radian * 180) / Math.PI;
}

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
    if (feedId === "hsl" && data.properties.ro.startsWith("3001")) {
      continue;
    } else if (feedId === "hsl" && data.properties.ro.startsWith("3002")) {
      continue;
    }

    // Get short route name for HSL routeId
    if (feedId === "hsl") {
      data.properties.ro = getHSLShortRouteName(data.properties.ri);
    }

    // Dirty workaround for Tampere routeIds
    if (feedId === "tampere") {
      const ve = data.properties.ve.split("_");
      data.properties.ro = data.properties.ri.replace(ve[0], "");
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

  // Calculate bearing for records without bearing information
  // Try to get previous record
  const prev = pointCache.get(data.properties.ve);
  if (prev == undefined) {
    data.properties.be = 0;
  } else {
    const point1 = [prev.geometry[1], prev.geometry[0]];
    const point2 = [data.geometry[1], data.geometry[0]];
    if (!equalsCheck(point1, point2)) {
      let be = bearing(point1, point2);
      if (be < 0) {
        be += 360;
      }
      data.properties.be = Math.round(be);
    }
  }

  // Cache point
  pointCache.set(data.properties.ve, { geometry: data.geometry });

  // Properties to JSON
  const props = JSON.stringify(data.properties);

  tile38.client.set(
    "vehicles",
    data.properties.ve,
    data.geometry,
    { properties: props },
    { expire: 300 }
  );
};

// --- Entur Graphql ---
const parseEntur = (feedId, message) => {
  const data = entur.mapData(message);

  // Set feedId to the feature
  data.properties.fe = feedId;

  // Add feedId to the vehicleId
  data.properties.ve = feedId + ":" + data.properties.ve;

  // Try to get previous record
  const prev = pointCache.get(data.properties.ve);
  if (prev == undefined) {
    data.properties.be = 0;
  } else {
    // Calculate bearing manually as it is missing from the data itself
    const point1 = [prev.geometry[1], prev.geometry[0]];
    const point2 = [data.geometry[1], data.geometry[0]];
    if (!equalsCheck(point1, point2)) {
      let be = bearing(point1, point2);
      if (be < 0) {
        be += 360;
      }
      data.properties.be = Math.round(be);
    } else {
      data.properties.be = prev.bearing;
    }
  }

  // Cache point
  pointCache.set(data.properties.ve, {
    geometry: data.geometry,
    bearing: data.properties.be,
  });

  // Properties to JSON
  const props = JSON.stringify(data.properties);

  tile38.client.set(
    "vehicles",
    data.properties.ve,
    data.geometry,
    { properties: props },
    { expire: 300 }
  );
};

// --- NS API ---
const parseNSApi = (feedId, message) => {
  if (message.payload && message.payload.treinen) {
    for (const trein of message.payload.treinen) {
      const data = nsApi.mapData(trein);
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
  }
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
        interval: feed.interval * 1000,
        response: "buffer",
        token: feed.token,
      };
      const p = polling.newPoller(feed.feedUrl, options);
      p.on("data", parseGtfsRt);
      p.pollForever();
    }
    // --- Entur Graphql ---
    else if (feed.type === "entur") {
      const options = {
        name: feed.feedId,
        interval: feed.interval * 1000,
        etClientName: feed.etClientName,
      };
      const p = new EnturPoller(feed.feedUrl, options);
      p.on("data", parseEntur);
      p.pollForever();
    }
    // --- NS API ---
    else if (feed.type === "nsapi") {
      const options = {
        name: feed.feedId,
        interval: feed.interval * 1000,
        response: "json",
        nskey: feed.nskey,
      };
      const p = polling.newPoller(feed.feedUrl, options);
      p.on("data", parseNSApi);
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
    // --- Trafikinfo ---
    else if (feed.type === "trafikinfo") {
      const options = {
        name: feed.feedId,
        interval: feed.interval * 1000,
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
        interval: feed.interval * 1000,
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
