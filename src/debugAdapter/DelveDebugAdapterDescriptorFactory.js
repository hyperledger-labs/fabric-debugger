const vscode = require("vscode");
const { spawn } = require("child_process");
const path = require("path");
const DelveDebugAdapter = require("./delveDebugAdapter");

class DelveDebugAdapterDescriptorFactory {
  constructor() {
    this.delveProcess = undefined;
  }

  createDebugAdapterDescriptor(session) {
    const config = session.configuration;
    const program = config.program;
    const port = config.port || 2345;
    console.log("port number", port);

    if (!program) {
      vscode.window.showErrorMessage("No program specified to debug.");
      return;
    }

    this.delveProcess = spawn(
      "dlv",
      [
        "dap",
        "debug",
        `--listen=localhost:${port}`,
        "--log",
        "--api-version=2",
        program,
      ],
      {
        cwd: path.dirname(program),
        env: process.env,
      }
    );
    console.log("delve debugger started");
    this.delveProcess.stdout.on("data", (data) => {
      console.log(`Delve: ${data}`);
    });

    this.delveProcess.stderr.on("data", (data) => {
      console.error(`Delve Error: ${data}`);
    });

    this.delveProcess.on("exit", (code) => {
      console.log(`Delve exited with code ${code}`);
    });

    this.delveProcess.on("spawn", () => {
      console.log(`Delve spawn`);
    });
    this.sleep(20 * 1000);
    return new DelveDebugAdapter(port, "localhost");
  }

  sleep(ms) {
    const start = Date.now();
    while (Date.now() - start < ms) {}
  }


  dispose() {
    if (this.delveProcess) {
      this.delveProcess.kill();
      this.delveProcess = undefined;
    }
  }
}

module.exports = DelveDebugAdapterDescriptorFactory;
