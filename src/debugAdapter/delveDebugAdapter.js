const vscode = require("vscode");
const { DebugSession } = require("@vscode/debugadapter");
const net = require("net");

class DelveDebugAdapter extends DebugSession {
  constructor(port, host) {
    super();
    this.socket = new net.Socket();

    this.socket.connect(port, host, () => {
      console.log("Connected to Delve server");
    });

    this.socket.on("data", (data) => {
      console.log(`Received data from Delve: ${data}`);
    });

    this.socket.on("error", (err) => {
      console.error(`Socket error: ${err}`);
    });

    this.socket.on("close", () => {
      console.log("Connection to Delve server closed");
    });
    console.log('delve debug adapter running')
  }
  

  async dispatchRequest(request) {
    console.log(`Received request: ${request.command}`);

    switch (request.command) {
      case "initialize":
        console.log("Debugging session initialized");
        break;
      case "next":
        console.log("User clicked Step Over");
        this.socket.write(
          JSON.stringify({
            command: "next",
          })
        );
        break;
      case "stepIn":
        console.log("User clicked Step In");
        this.socket.write(
          JSON.stringify({
            command: "stepIn",
          })
        );
        break;
      case "stepOut":
        console.log("User clicked Step Out");
        this.socket.write(
          JSON.stringify({
            command: "stepOut",
          })
        );
        break;
      case "continue":
        console.log("User clicked Continue");
        this.socket.write(
          JSON.stringify({
            command: "continue",
          })
        );
        break;
      case "pause":
        console.log("User clicked Pause");
        this.socket.write(
          JSON.stringify({
            command: "pause",
          })
        );
        break;
      default:
        console.log(`Unhandled command: ${request.command}`);
    }

    await super.dispatchRequest(request);
  }

  dispose() {
    this.socket.destroy();
  }
}

module.exports = DelveDebugAdapter;
