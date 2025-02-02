const vscode = require("vscode");
const { DebugAdapterServer } = require("@vscode/debugadapter");
const net = require("net");

class DelveDebugAdapter {
  constructor(port, host) {
    this.port = port;
    this.host = host;
    this.socket = null;
  }

  async start() {
    console.log(`Starting Hyperledger Fabric Debugger on ${this.host}:${this.port}`);

    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();

      this.socket.connect(this.port, this.host, () => {
        console.log(
          "Successfully connected to Hyperledger Fabric Debugger server"
        );
        resolve();
      });

      this.socket.on("error", (err) => {
        console.error(`Socket error: ${err.message}`);
        reject(err);
      });

      this.socket.on("close", () => {
        console.log("Connection to Hyperledger Fabric Debugger server closed");
      });

      this.socket.on("data", (data) => {
        this.handleDelveMessage(data);
      });
    });
  }

  handleDelveMessage(data) {
    console.log("Raw Delve Data:", data.toString());
    try {
      const message = JSON.parse(data.toString());
      console.log("Parsed Delve Message:", message);
      switch (message.type) {
        case "response":
          this.handleResponse(message);
          break;
        case "event":
          this.handleEvent(message);
          break;
        default:
          console.log("Unknown message type:", message);
      }
    } catch (err) {
      console.error("Error parsing Hyperledger Fabric Debugger message:", err);
    }
  }

  handleResponse(response) {
    console.log("Hyperledger Fabric Debugger response:", response);
  }

  handleEvent(event) {
    console.log("Hyperledger Fabric Debugger event:", event);
  }

  stop() {
    if (this.socket) {
      this.socket.end();
      this.socket = null;
    }
  }
}

module.exports = DelveDebugAdapter;
