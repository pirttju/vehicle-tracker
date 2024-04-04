"use strict";

const gtfsRealtime = require("./utils/gtfsRealtime");
const HttpPoller = require("./utils/httpPoller");
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

const parseGtfsRt = (feedId, buffer, topic = null) => {
  const message = gtfsRealtime.decodeGtfsRealtime(buffer);

  for (const entity of message.entity) {
    const data = gtfsRealtime.mapData(entity);
    data.properties.ve = feedId + ":" + data.properties.ve;
    data.properties.fe = feedId;

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

const main = () => {
  // Load all configured feeds
  for (const feed of config.feeds) {
    // GTFS Realtime
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
  }
};

main();
