/**
 * @param {vscode.ExtensionContext} context
 */

const vscode = require("vscode");
const path = require("path");

function createConnectionProfileWebview() {
  const panel = vscode.window.createWebviewPanel(
    "connectionProfile",
    "Connection Profile",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      enableForms: true,
      localResourceRoots: [vscode.Uri.file(path.join(__dirname, "media"))],
    }
  );

  panel.webview.html = getWebViewContent();

  panel.webview.onDidReceiveMessage(
    (message) => {
      switch (message.command) {
        case "submitForm":
          vscode.commands.executeCommand(
            "extension.handleConnectionProfileData",
            message.data
          );
          console.log("Received data:", message.data);
          break;
      }
    },
    undefined,
    []
  );
}

function getWebViewContent() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Connection Profile</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 10px;
        }
        input[type="text"], input[type="password"] {
          width: 100%;
          padding: 8px;
          margin: 6px 0;
          box-sizing: border-box;
        }
        .tls-radio-group {
          margin: 6px 0;
        }
        .tls-radio-group label {
          display: inline-block;
          margin-right: 10px;
          font-weight: normal;
        }
        .tls-radio-group input[type="radio"] {
          margin-right: 5px;
        }
        button {
          background-color: #4CAF50;
          color: white;
          padding: 10px 15px;
          border: none;
          cursor: pointer;
        }
        button:hover {
          background-color: #45a049;
        }
      </style>
    </head>
    <body>
      <h1>Fabric Connection Profile</h1>
      <form id="fabric-connection-form">
        <label for="channelName">Channel Name:</label>
        <input type="text" id="channelName" name="channelName" required>

        <label for="chaincodeId">Chaincode ID:</label>
        <input type="text" id="chaincodeId" name="chaincodeId" required>

        <label for="peerAddress">Peer Address:</label>
        <input type="text" id="peerAddress" name="peerAddress" required>

        <label for="ordererAddress">Orderer Address:</label>
        <input type="text" id="ordererAddress" name="ordererAddress" required>

        <label for="localMspId">Local MSP ID:</label>
        <input type="text" id="localMspId" name="localMspId" required>

        <label for="mspConfigPath">MSP Config Path:</label>
        <input type="text" id="mspConfigPath" name="mspConfigPath" required>

        <label for="tlsEnabled">TLS Enabled:</label>
        <div class="tls-radio-group">
          <label for="tlsEnabledYes">
            <input type="radio" id="tlsEnabledYes" name="tlsEnabled" value="yes" required>
            Yes
          </label>
          <label for="tlsEnabledNo">
            <input type="radio" id="tlsEnabledNo" name="tlsEnabled" value="no">
            No
          </label>
        </div>

        <label for="tlsRootCertFile">TLS Root Cert File:</label>
        <input type="text" id="tlsRootCertFile" name="tlsRootCertFile" required>

        <label for="javaChaincodePath">Java/GO Chaincode Path:</label>
        <input type="text" id="javaChaincodePath" name="javaChaincodePath" required>

        <button type="submit" id="submitProfile">Submit</button>
      </form>

      <script>
        const vscode = acquireVsCodeApi();

        document.addEventListener('DOMContentLoaded', () => {
          document.getElementById('fabric-connection-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const data = {
              channelName: document.getElementById('channelName').value,
              chaincodeId: document.getElementById('chaincodeId').value,
              peerAddress: document.getElementById('peerAddress').value,
              ordererAddress: document.getElementById('ordererAddress').value,
              localMspId: document.getElementById('localMspId').value,
              mspConfigPath: document.getElementById('mspConfigPath').value,
              tlsEnabled: document.querySelector('input[name="tlsEnabled"]:checked').value,
              tlsRootCertFile: document.getElementById('tlsRootCertFile').value,
              javaChaincodePath: document.getElementById('javaChaincodePath').value,
            };
            vscode.postMessage({ command: 'submitForm', data: data });
          });


          window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'populateForm') {
              document.getElementById('channelName').value = message.data.channelName;
              document.getElementById('chaincodeId').value = message.data.chaincodeId;
              document.getElementById('peerAddress').value = message.data.peerAddress;
              document.getElementById('ordererAddress').value = message.data.ordererAddress;
              document.getElementById('localMspId').value = message.data.localMspId;
              document.getElementById('mspConfigPath').value = message.data.mspConfigPath;
              document.querySelector(\`input[name="tlsEnabled"][value="\${message.data.tlsEnabled}"]\`).checked = true;
              document.getElementById('tlsRootCertFile').value = message.data.tlsRootCertFile;
              document.getElementById('javaChaincodePath').value = message.data.javaChaincodePath;
            }
          });
        });
      </script>
    </body>
    </html>
    `;
}

module.exports = {
  createConnectionProfileWebview,
};
