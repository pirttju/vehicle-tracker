// Parses string values to GTFS-RT Proto numbers
function parseOs(name) {
  if (name == "notBoardable") {
    return 8;
  } else if (name == "noData") {
    return 7;
  } else if (name == "notAcceptingPassengers") {
    return 6;
  } else if (name == "full") {
    return 5;
  } else if (name == "crushedStandingRoomOnly") {
    return 4;
  } else if (name == "standingRoomOnly") {
    return 3;
  } else if (name == "fewSeatsAvailable") {
    return 2;
  } else if (name == "manySeatsAvailable") {
    return 1;
  } else if (name == "empty") {
    return 0;
  } else {
    return null;
  }
}

// Gets data of interest from Entur Graphql
exports.mapData = (e) => {
  const geometry = [e.location?.latitude || 0, e.location?.longitude || 0];

  const ts = Date.parse(e.lastUpdated);

  const properties = {
    ts: Math.round(ts / 1000),
    be: null,
    sp: null,
    ve: e.vehicleId,
    tr: e.serviceJourney?.id,
    ro: e.line?.publicCode,
    sd: String(e.serviceJourney?.date.replaceAll("-", "")),
    os: parseOs(e.occupancyStatus),
    rt: 2,
  };

  return { geometry, properties };
};
