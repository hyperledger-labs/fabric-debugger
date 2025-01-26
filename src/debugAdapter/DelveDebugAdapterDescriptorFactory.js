const vscode = require("vscode");
const { spawn } = require("child_process");
const path = require("path");
const DelveDebugAdapter = require("./delveDebugAdapter");

class DelveDebugAdapterDescriptorFactory {
  constructor() {
    this.delveProcess = undefined;
  }

  async createDebugAdapterDescriptor(session) {
    const config = session.configuration;
    const program = config.program;
    const port = config.port || 2345;
    console.log("port number", port);

    if (!program) {
      vscode.window.showErrorMessage("No program specified to debug.");
      console.log("No program specified to debug");
      return;
    }

    this.delveProcess = spawn(
      "dlv",
      [
        "dap",
        `--listen=localhost:${port}`,
        "--log",
        "--api-version=2",
        "--allow-non-terminal-interactive=true",
      ],
      {
        cwd: path.dirname(program),
        env: process.env,
      }
    );

    console.log("Delve debugger started");

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

  async dispose() {
    if (this.delveProcess) {
      this.delveProcess.kill();
      this.delveProcess = undefined;
      console.log("Delve process terminated.");
    }
  }
}

module.exports = DelveDebugAdapterDescriptorFactory;
