"use strict";
const GtfsRealtimeBindings = require("gtfs-realtime-bindings");

// Gets the GTFS-RT feed
exports.fetchGtfsRealtime = async (url) => {
  try {
    const response = await fetch(url);

    // Throw error if fetch fails
    if (!response.ok) {
      const error = new Error(
        `${response.url}: ${response.status} ${response.statusText}`
      );
      throw error;
    }

    // Decode the Protocol Buffer response
    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );
    return feed;
  } catch (error) {
    throw error;
  }
};

// Decodes the Protocol Buffer response
exports.decodeGtfsRealtime = (buffer) => {
  try {
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );
    return feed;
  } catch (error) {
    throw error;
  }
};

// Gets data of interest from the FeedEntity
exports.mapData = (e) => {
  const geometry = [
    e.vehicle?.position?.latitude || 0,
    e.vehicle?.position?.longitude || 0,
  ];

  const properties = {
    ts: e.vehicle?.timestamp.toNumber(),
    be: Math.round(e.vehicle?.position?.bearing),
    sp: Math.round(e.vehicle?.position?.speed * 3.6),
    ve: String(e.vehicle?.vehicle?.id),
    tr: String(e.vehicle?.trip?.tripId) || null,
    ri: String(e.vehicle?.trip?.routeId) || null,
    ro: String(e.vehicle?.trip?.routeId) || null,
    st: String(e.vehicle?.trip?.startTime) || null,
    sd: String(e.vehicle?.trip?.startDate) || null,
    di: e.vehicle?.trip?.directionId || 0,
  };

  if (e.vehicle?.vehicle?.licensePlate) {
    properties.lp = e.vehicle.vehicle.licensePlate;
  }

  if (e.vehicle?.occupancyStatus) {
    properties.os = e.vehicle.occupancyStatus;
  }

  if (e.vehicle?.occupancyPercentage) {
    properties.op = e.vehicle.occupancyPercentage;
  }

  return { geometry, properties };
};
