// Gets data of interest from NS API
exports.mapData = (e) => {
  const geometry = [e.lat || 0, e.lng || 0];

  const properties = {
    ts: Math.round(new Date() / 1000),
    be: Math.round(e.richting),
    sp: Math.round(e.snelheid),
    ve: `${e.ritId}`,
    ro: String(e.treinNummer),
    rt: 2,
  };

  return { geometry, properties };
};
