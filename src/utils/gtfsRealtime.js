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
    e.vehicle?.position?.longitude || 0,
    e.vehicle?.position?.latitude || 0,
  ];

  const properties = {
    ts: e.vehicle?.timestamp.toNumber(),
    be: Math.round(e.vehicle?.position?.bearing),
    sp: Math.round(e.vehicle?.position?.speed),
    ve: e.vehicle?.vehicle?.id,
    la: e.vehicle?.vehicle?.label,
  };

  if (e.vehicle?.trip?.tripId) {
    properties.tr = e.vehicle.trip.tripId;
  }

  if (e.vehicle?.trip?.routeId) {
    properties.ro = e.vehicle.trip.routeId;
  }

  if (e.vehicle?.trip?.startTime) {
    properties.st = e.vehicle.trip.startTime;
  }

  if (e.vehicle?.trip?.startDate) {
    properties.sd = e.vehicle.trip.startDate;
  }

  if (e.vehicle?.trip?.directionId) {
    properties.di = e.vehicle.trip.directionId;
  }

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
