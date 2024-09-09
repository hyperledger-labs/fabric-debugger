const vscode = require("vscode");
const { NetworkTreeItem } = require("./networkTreeItem");
const { WalletTreeItem } = require("./walletTreeItem");

class TreeViewProvider {
  constructor(type, context) {
    this.type = type;
    this.context = context;
    this.networks = new Map();
    this.wallets = new Map();
    this.networkWalletMap = new Map();
    this.activeNetwork = null;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.selectDefaultActiveNetwork();
  }

  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    if (!element) {
      if (this.type === "network-desc" && this.activeNetwork) {
        return [this.activeNetwork];
      }
      if (this.type === "wallets") {
        return Array.from(this.wallets.values());
      }
      return Array.from(this.networks.values());
    } else if (element.children) {
      return element.children || [];
    }
    return [];
  }

  addWallet(walletData) {
    const walletId = walletData.name || "Unknown Wallet";
    const walletName = walletData.name || walletId;
    const mspId = walletData.mspId || "Unknown MSP";
    const type = walletData.type || "Unknown Type";

    const walletItem = new WalletTreeItem(
      walletName,
      vscode.TreeItemCollapsibleState.Collapsed
    );
    walletItem.contextValue = "walletItem";

    const mspIdItem = new vscode.TreeItem(
      `MSP ID: ${mspId}`,
      vscode.TreeItemCollapsibleState.None
    );
    const typeItem = new vscode.TreeItem(
      `Type: ${type}`,
      vscode.TreeItemCollapsibleState.None
    );

    walletItem.children = [mspIdItem, typeItem];

    this.wallets.set(walletId, walletItem);
    this._onDidChangeTreeData.fire();
  }

  addNetwork(data) {
    const channelName = data.channelName || "New Network";
    let networkItem = this.networks.get(channelName);

    if (!networkItem) {
      const collapsibleState =
        this.type === "fabric-network"
          ? vscode.TreeItemCollapsibleState.None
          : vscode.TreeItemCollapsibleState.Collapsed;

      networkItem = new NetworkTreeItem(channelName, collapsibleState);
      this.networks.set(channelName, networkItem);
    }

    networkItem.children = [];
    this._onDidChangeTreeData.fire();

    const networkDetails = data.networkDetails;
    const walletDetails = data.walletDetails || []; 
    console.log(`Mapping wallets for network "${channelName}":`, walletDetails);

    if (networkDetails && this.type === "network-desc") {
      this.networkWalletMap.set(channelName, walletDetails);

      //organizations dropdown
      const organizationsItem = new NetworkTreeItem(
        "Organization",
        vscode.TreeItemCollapsibleState.Collapsed
      );
      organizationsItem.children = networkDetails.organizations.map((org) => {
        const orgItem = new NetworkTreeItem(
          org,
          vscode.TreeItemCollapsibleState.Collapsed
        );
        const mspidItem = new NetworkTreeItem(
          `mspid: ${org}-MSP`,
          vscode.TreeItemCollapsibleState.None
        );
        orgItem.children = [mspidItem];
        return orgItem;
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
    if (
      this.type === "network-desc" &&
      this.activeNetwork &&
      this.activeNetwork.label === channelName
    ) {
      this._onDidChangeTreeData.fire();
    }
  }

  deleteWallet(walletId) {
    if (this.wallets.has(walletId)) {
      console.log(`Deleting wallet: ${walletId}`);
      this.wallets.delete(walletId);
      this._onDidChangeTreeData.fire();
    } else {
      console.warn(`Wallet ${walletId} does not exist`);
    }
  }

  deleteNetwork(channelName) {
    if (this.networks.has(channelName)) {
      console.log(`Deleting network: ${channelName}`);

      const walletDetailsList = this.networkWalletMap.get(channelName);
      if (walletDetailsList && walletDetailsList.length > 0) {
        walletDetailsList.forEach((walletDetails) => {
          console.log(
            `Deleting wallet associated with network ${channelName}: ${walletDetails.name}`
          );
          this.deleteWallet(walletDetails.name);
        });
        this.networkWalletMap.delete(channelName); 
      } else {
        console.warn(
          `No wallets found for network "${channelName}" or walletDetailsList is undefined.`
        );
      }
      
      this.networks.delete(channelName);
      console.log(`Network "${channelName}" deleted.`);
      this._onDidChangeTreeData.fire();
    } else {
      console.warn(`Network ${channelName} does not exist.`);
    }
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

  selectDefaultActiveNetwork() {
    if (this.networks.size > 0) {
      const firstNetwork = Array.from(this.networks.values())[0];
      this.setActiveNetwork(firstNetwork);
    }
  }
}

module.exports = {
  TreeViewProvider,
};
