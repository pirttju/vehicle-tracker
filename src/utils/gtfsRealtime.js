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
exports.decodeGtfsRealtime = (url) => {
  try {
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );
    return feed;
  } catch (error) {
    throw error;
  }
};
