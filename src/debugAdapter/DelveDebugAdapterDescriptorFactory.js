const vscode = require("vscode");
const { spawn } = require("child_process");
const path = require("path");

class DelveDebugAdapterDescriptorFactory {
  constructor() {
    this.delveProcess = undefined;
  }

  createDebugAdapterDescriptor(session) {
    const config = session.configuration;
    const program = config.program;
    const port = config.port || 2345;

    if (!program) {
      vscode.window.showErrorMessage("No program specified to debug.");
      return;
    }

    this.delveProcess = spawn(
      "dlv-dap",
      [
        "debug",
        "--headless",
        `--listen=127.0.0.1:${port}`,
        "--log",
        "--api-version=2",
        program,
      ],
      {
        cwd: path.dirname(program),
        env: process.env,
      }
    );

    this.delveProcess.stdout.on("data", (data) => {
      console.log(`Delve: ${data}`);
    });

    this.delveProcess.stderr.on("data", (data) => {
      console.error(`Delve Error: ${data}`);
    });

    this.delveProcess.on("exit", (code) => {
      console.log(`Delve exited with code ${code}`);
    });

    return new vscode.DebugAdapterServer(port, "127.0.0.1");
  }

  dispose() {
    if (this.delveProcess) {
      this.delveProcess.kill();
      this.delveProcess = undefined;
    }
  }
}

module.exports = DelveDebugAdapterDescriptorFactory;
