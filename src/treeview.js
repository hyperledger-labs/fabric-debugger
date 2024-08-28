const vscode = require("vscode");
const { NetworkTreeItem } = require("./networkTreeItem");

class TreeViewProvider {
  constructor(type, context) {
    this.type = type;
    this.context = context;
    this.networks = new Map();
    this.activeNetwork = null;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    if (!element) {
      return Array.from(this.networks.values());
    } else if (element instanceof NetworkTreeItem) {
      return element.children || [];
    }
    return [];
  }

  addNetwork(data) {
    const channelName = data.channelName || "New Network";
    let networkItem = this.networks.get(channelName);

    if (!networkItem) {
      const collapsibleState =
        this.type === "fabric-network"
          ? vscode.TreeItemCollapsibleState.None // No dropdown for "fabric-network"
          : vscode.TreeItemCollapsibleState.Collapsed; // Allows dropdown for others

      networkItem = new NetworkTreeItem(channelName, collapsibleState);
      this.networks.set(channelName, networkItem);
    }

    networkItem.children = []; // No children for "fabric-network"

    this._onDidChangeTreeData.fire();

    const networkDetails = data.networkDetails;
    if (networkDetails && this.type === "network-desc") {
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

    this._onDidChangeTreeData.fire();
  }

  deleteNetwork(channelName) {
    this.networks.delete(channelName);
    this._onDidChangeTreeData.fire();
  }

  setActiveNetwork(networkItem) {
    if (this.activeNetwork) {
      this.activeNetwork.setActive(false);
    }
    this.activeNetwork = networkItem;
    this.activeNetwork.setActive(true);
    this._onDidChangeTreeData.fire();
  }

  getNetworkByLabel(label) {
    return this.networks.get(label);
  }
}

module.exports = {
  TreeViewProvider,
};
