"use strict";

const EventEmitter = require("events");

class EnturPoller extends EventEmitter {
  constructor(url, options = {}) {
    super();

    this.polling = false;
    this.pollingTimeoutId = null;

    this.interval = options.interval || 30000;
    this.name = options.name || "no";
    this.timeout = options.timeout || 10000;
    this.etClientName = options.etClientName;
    this.url = url;
    this.headers = {
      "ET-Client-Name": this.etClientName,
      "Content-Type": "application/json",
    };
  }

  queryString() {
    const request = `{
  vehicles(mode:RAIL) {
    lastUpdated
    line {
      publicCode
    }
    location {
      latitude
      longitude
    }
    occupancyStatus
    serviceJourney {
      id
      date
    }
    vehicleId
  }
}`;

    return request;
  }

  async request() {
    const controller = new AbortController();
    const abortTimeoutId = setTimeout(() => controller.abort(), this.timeout);

    const queryString = this.queryString();

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          query: queryString,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        console.log(await response.text());
        throw error;
      }

      // Convert the response and emit data
      const data = await response.json();

      // Check if we have actual response
      if (data.data && data.data.vehicles && data.data.vehicles.length > 0) {
        for (const train of data.data.vehicles) {
          this.emit("data", this.name, train);
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

module.exports = EnturPoller;
