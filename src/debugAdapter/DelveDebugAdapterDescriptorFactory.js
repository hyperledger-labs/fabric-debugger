const vscode = require("vscode");
const { spawn } = require("child_process");
const path = require("path");

class DelveDebugAdapterDescriptorFactory {
  constructor() {
    this.delveProcess = undefined;
  }

  async createDebugAdapterDescriptor(session) {
    const config = session.configuration;
    const program = config.program;
    const port = config.port || 2345;
    // console.log(
    //   `Hyperledger Fabric Debugger Config: Port=${port}, Program=${program}`
    // );
    

    if (!program) {
      vscode.window.showErrorMessage("No program specified to debug.");
      return null;
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
      console.log(`Delve spawned successfully`);
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));
    return new vscode.DebugAdapterServer(port, "localhost");
  }

  dispose() {
    if (this.delveProcess) {
      this.delveProcess.kill();
      this.delveProcess = undefined;
      console.log("Delve process terminated.");
    }
  }
}

module.exports = DelveDebugAdapterDescriptorFactory;
