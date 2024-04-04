"use strict";
require("dotenv").config();
const Tile38 = require("tile38");

// Ultra Fast Geospatial Database & Geofencing Server
exports.client = new Tile38({
  host: process.env.TILE38_HOST || "localhost",
  port: process.env.TILE38_PORT || 9851,
});
