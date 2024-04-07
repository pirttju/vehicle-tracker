"use strict";

const EventEmitter = require("events");

class Trafikinfo extends EventEmitter {
  constructor(url, options = {}) {
    super();

    this.polling = false;
    this.pollingTimeoutId = null;

    this.interval = options.interval || 15000;
    this.name = options.name || "trafikinfo";
    this.timeout = options.timeout || 5000;
    this.token = options.token;
    this.url = url;
    this.headers = {};

    this.lastModified = new Date().toISOString();
  }

  queryString() {
    const gt = `<GT name="ModifiedTime" value="${this.lastModified}" />`;
    const filter = `<FILTER>${gt}</FILTER>`;
    const query = `<QUERY namespace="järnväg.trafikinfo" objecttype="TrainPosition" schemaversion="1.0">${filter}</QUERY>`;
    const request = `<REQUEST><LOGIN authenticationkey="${this.token}" />${query}</REQUEST>`;

    return request;
  }

  async request() {
    const controller = new AbortController();
    const abortTimeoutId = setTimeout(() => controller.abort(), this.timeout);

    const queryString = this.queryString();

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body: queryString,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        throw error;
      }

      // Convert the response and emit data
      const data = await response.json();

      // Check if we have actual response
      if (
        data &&
        data.RESPONSE &&
        data.RESPONSE.RESULT &&
        data.RESPONSE.RESULT.length > 0
      ) {
        for (const tp of data.RESPONSE.RESULT[0].TrainPosition) {
          // grab ModifiedTime
          if (tp.ModifiedTime > this.lastModified) {
            this.lastModified = tp.ModifiedTime;
          }
          this.emit("data", this.name, tp);
        }
      }
    } catch (error) {
      // Error
      console.error(`${this.name}: ${error}`);
    } finally {
      clearTimeout(abortTimeoutId);
      // Re-run if polling forever
      if (this.polling) {
        this.poll();
      }
    }
  }

  poll() {
    this.pollingTimeoutId = setTimeout(this.request.bind(this), this.interval);
  }

  pollForever() {
    this.polling = true;
    console.log(`${this.name}: polling at interval ${this.interval}ms`);
    this.poll();
  }

  stopPolling() {
    if (this.pollingTimeoutId !== null) {
      clearTimeout(this.pollingTimeoutId);
    }
    this.pollingTimeoutId = null;
    this.polling = false;
    console.log(`${this.name}: polling stopped`);
  }
}

module.exports = Trafikinfo;
