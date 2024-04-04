"use strict";

const mqtt = require("mqtt");
const EventEmitter = require("events");

class MqttClient extends EventEmitter {
  constructor(url, options = {}) {
    super();

    this.client = null;

    this.url = url;
    this.name = options.name || "MQTT";
    this.topics = options.topics || ["/#"];
  }

  connectToBroker() {
    if (!this.client) {
      const clientId = "mqtt_" + Math.random().toString(36).substring(7);

      const options = {
        clientId: clientId,
      };

      this.client = mqtt.connect(this.url, options);

      // init event handlers
      this.client.on("connect", () => {
        console.log(`${this.name}: connected to ${this.url}`);
      });
      this.client.on("disconnect", () => {
        console.log(`${this.name}: disconnected`);
      });
      this.client.on("reconnect", () => {
        console.log(`${this.name}: reconnecting...`);
      });
      this.client.on("error", (error) => {
        console.error(`${this.name}: ${error}`);
      });
      this.client.on("message", (topic, message) => {
        this.emit("data", this.name, message, topic);
      });

      for (const topic of this.topics) {
        this.client.subscribe(topic);
        console.log(`${this.name}: subscribed to ${topic}`);
      }
    }
  }

  end() {
    this.client.end();
    this.client = null;
  }
}

module.exports = MqttClient;
