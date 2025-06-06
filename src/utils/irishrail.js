"use strict";

const { XMLParser } = require("fast-xml-parser");
const xml = new XMLParser();

/*
  TrainLatitude: 53.3891,
  TrainLongitude: -6.07401,
  TrainCode: 'E914',
  TrainDate: '05 Apr 2024',
*/

// Gets data of interest from Irish Rail
exports.mapData = function (text) {
  const all = [];

  const e = xml.parse(text);

  for (const o of e.ArrayOfObjTrainPositions?.objTrainPositions) {
    const geometry = [o.TrainLatitude || 0, o.TrainLongitude || 0];

    const ts = new Date(`${o.TrainDate} 00:00:00 GMT`);
    const departureDate = ts.toISOString().slice(0, 10);

    const properties = {
      ts: Math.round(new Date() / 1000),
      be: null,
      sp: null,
      ve: `${o.TrainCode}-${departureDate}`,
      ro: String(o.TrainCode),
      sd: String(departureDate.replaceAll("-", "")),
      pm: o.PublicMessage,
      rt: 2,
    };

    all.push({ geometry, properties });
  }

  return all;
};
