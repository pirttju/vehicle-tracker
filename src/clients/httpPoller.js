"use strict";

const EventEmitter = require("events");
const unzipit = require("unzipit");

class HttpPoller extends EventEmitter {
  constructor(url, options = {}) {
    super();

    this.polling = false;
    this.pollingTimeoutId = null;
    this.name = options.name || "Polling";
    this.interval = options.interval || 30000;
    this.timeout = options.timeout || 5000;
    this.response = options.response || "json";
    this.unzip = options.unzip || false;
    this.url = url;
    this.headers = {};

    if (options.token !== undefined) {
      this.headers = {
        Authorization: `Basic ${options.token}`,
      };
    }
  }

  async request() {
    const controller = new AbortController();
    const abortTimeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      let url = this.url;
      const response = await fetch(url, {
        headers: this.headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        throw error;
      }

      // Convert the response and emit data
      if (this.unzip) {
        const zipbuf = await response.arrayBuffer();
        const { entries } = await unzipit.unzip(zipbuf);
        for (const [name, entry] of Object.entries(entries)) {
          console.log(name, entry.size);
          const unzipped = await entry.arrayBuffer();
          this.emit("data", this.name, unzipped);
        }
      } else if (this.response === "buffer") {
        const buffer = await response.arrayBuffer();
        this.emit("data", this.name, buffer);
      } else if (this.response === "text") {
        const data = await response.text();
        this.emit("data", this.name, data);
      } else {
        const data = await response.json();
        this.emit("data", this.name, data);
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

module.exports = HttpPoller;
