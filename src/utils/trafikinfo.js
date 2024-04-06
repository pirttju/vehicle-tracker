// Gets data of interest from Trafikinfo
exports.mapData = (e) => {
  let [x, y] = e.Position.WGS84.replace(/[^\d .-]/g, "")
    .trim()
    .split(/\s+/);

  const geometry = [y || 0, x || 0];

  const ts = Date.parse(e.TimeStamp);

  let departureDate = e.Train.OperationalTrainDepartureDate.slice(0, 10);

  const properties = {
    ts: Math.round(ts / 1000),
    be: Math.round(e.Bearing),
    sp: Math.round(e.Speed),
    ve: `${e.Train.AdvertisedTrainNumber}-${departureDate}`,
    ro: String(e.Train.AdvertisedTrainNumber),
    sd: String(departureDate.replaceAll("-", "")),
    rt: 2,
  };

  return { geometry, properties };
};
