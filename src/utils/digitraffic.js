// Gets data of interest from Digitraffic
exports.mapData = (e) => {
  const geometry = [
    e.location?.coordinates[1] || 0,
    e.location?.coordinates[0] || 0,
  ];

  const ts = Date.parse(e.timestamp);

  const properties = {
    ts: Math.round(ts / 1000),
    be: null,
    sp: Math.round(e.speed),
    ve: `${e.trainNumber}-${e.departureDate}`,
    ro: String(e.trainNumber),
    sd: String(e.departureDate.replaceAll("-", "")),
    rt: 2,
  };

  return { geometry, properties };
};
