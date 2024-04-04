"use strict";

const gtfsRealtime = require("./utils/gtfsRealtime");
const HttpPoller = require("./utils/httpPoller");
const config = require("../config.json");

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
  console.log(feedId);

  const message = gtfsRealtime.decodeGtfsRealtime(buffer);

  for (const entity of message.entity) {
    console.log(entity.vehicle);

    const data = gtfsRealtime.mapData(entity);

    // Check that the data isn't stale
    // (i.e. must not be older than 15 min)
    const diff = Date.now() / 1000 - data.properties.ts;
    if (diff < 900) {
      console.log(data.geometry);
      console.log(data.properties);
    }
  }
};

const main = () => {
  for (const feed of config.feeds) {
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
