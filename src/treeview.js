const vscode = require("vscode");
const { NetworkTreeItem } = require("./networkTreeItem");

class TreeViewProvider {
  constructor() {
    this.networks = [];
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    if (!element) {
      // Return the top-level networks
      return this.networks;
    } else if (element instanceof NetworkTreeItem) {
      // Return the network details (organizations, peers, orderers, cas)
      return element.children;
    }
  }

  createTreeItem(label, command, contextValue) {
    const treeItem = new vscode.TreeItem(
      label,
      vscode.TreeItemCollapsibleState.None
    );
    treeItem.command = { command, title: label };
    treeItem.contextValue = contextValue; // Set context value for conditional UI elements
    return treeItem;
  }

  addNetwork(data) {
    const label = data.channelName || "New Network";
    const networkItem = new NetworkTreeItem(
      label,
      vscode.TreeItemCollapsibleState.Collapsed
    );

    networkItem.children = []; // Initialize children array

    // Add channel item
    const channelItem = new vscode.TreeItem(data.channelName);
    channelItem.contextValue = "channelItem";
    networkItem.children.push(channelItem);

    const networkDetails = data.networkDetails;
    if (networkDetails) {
      networkDetails.organizations.forEach((org) => {
        const orgItem = new NetworkTreeItem(
          `Organization: ${org}`,
          vscode.TreeItemCollapsibleState.None
        );
        networkItem.children.push(orgItem);
      });

      networkDetails.peers.forEach((peer) => {
        const peerItem = new NetworkTreeItem(
          `Peer: ${peer}`,
          vscode.TreeItemCollapsibleState.None
        );
        networkItem.children.push(peerItem);
      });

      networkDetails.orderers.forEach((orderer) => {
        const ordererItem = new NetworkTreeItem(
          `Orderer: ${orderer}`,
          vscode.TreeItemCollapsibleState.None
        );
        networkItem.children.push(ordererItem);
      });

      networkDetails.cas.forEach((ca) => {
        const caItem = new NetworkTreeItem(
          `Certificate Authority: ${ca}`,
          vscode.TreeItemCollapsibleState.None
        );
        networkItem.children.push(caItem);
      });
    }

    this.networks.push(networkItem);
    this._onDidChangeTreeData.fire();
  }
}

module.exports = {
  TreeViewProvider,
};
