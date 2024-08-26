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
      return this.networks;
    } else if (element instanceof NetworkTreeItem) {
      return element.children || [];
    }
    return [];
  }

  createTreeItem(label, command, contextValue) {
    const treeItem = new vscode.TreeItem(
      label,
      vscode.TreeItemCollapsibleState.None
    );
    treeItem.command = { command, title: label };
    treeItem.contextValue = contextValue;
    return treeItem;
  }

  addNetwork(data) {
    const channelName = data.channelName || "New Network";
    const label = data.channelName || "Channel Name";
    const networkItem = new NetworkTreeItem(
      channelName,
      label,
      vscode.TreeItemCollapsibleState.Collapsed
    );

    networkItem.children = [];

    const networkDetails = data.networkDetails;
    if (networkDetails) {
      //organizations dropdown
      const organizationsItem = new NetworkTreeItem(
        "Organization",
        vscode.TreeItemCollapsibleState.Collapsed
      );
      organizationsItem.children = networkDetails.organizations.map((org) => {
        return new NetworkTreeItem(org, vscode.TreeItemCollapsibleState.None);
      });
      networkItem.children.push(organizationsItem);

      //peers dropdown
      const peersItem = new NetworkTreeItem(
        "Peers",
        vscode.TreeItemCollapsibleState.Collapsed
      );
      peersItem.children = networkDetails.peers.map((peer) => {
        return new NetworkTreeItem(peer, vscode.TreeItemCollapsibleState.None);
      });
      networkItem.children.push(peersItem);

      //orderers dropdown
      const orderersItem = new NetworkTreeItem(
        "Orderers",
        vscode.TreeItemCollapsibleState.Collapsed
      );
      orderersItem.children = networkDetails.orderers.map((orderer) => {
        return new NetworkTreeItem(
          orderer,
          vscode.TreeItemCollapsibleState.None
        );
      });
      networkItem.children.push(orderersItem);

      //CA dropdown
      const casItem = new NetworkTreeItem(
        "Certificate Authorities",
        vscode.TreeItemCollapsibleState.Collapsed
      );
      casItem.children = networkDetails.cas.map((ca) => {
        return new NetworkTreeItem(ca, vscode.TreeItemCollapsibleState.None);
      });
      networkItem.children.push(casItem);
    }

    this.networks.push(networkItem);
    this._onDidChangeTreeData.fire();
  }
}

module.exports = {
  TreeViewProvider,
};
