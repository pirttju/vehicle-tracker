// Gets data of interest from Digitraffic
exports.mapData = (e) => {
  const geometry = [
    e.location?.coordinates[1] || 0,
    e.location?.coordinates[0] || 0,
  ];

  const ts = Date.parse(e.timestamp);

  const properties = {
    ts: Math.round(ts / 1000),
    be: 0,
    sp: Math.round(e.speed),
    ve: `digitraffic:${e.departureDate}/${e.trainNumber}`,
    ro: e.trainNumber,
    sd: e.departureDate.replaceAll("-", ""),
    fe: "digitraffic",
  };

  return { geometry, properties };
};
