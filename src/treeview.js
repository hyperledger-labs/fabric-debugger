const vscode = require("vscode");

class TreeViewProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.networks = [];
  }

  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    if (!element) {
      return Promise.resolve(this.networks);
    }
    return Promise.resolve([]);
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
    const label = data.channelName || "New Network";
    const command = `fabric-network.selectNetwork`;
    const contextValue = "networkItem";
    const treeItem = this.createTreeItem(label, command, contextValue);
    this.networks.push(treeItem);
    this._onDidChangeTreeData.fire();
  }
}

module.exports = {
  TreeViewProvider,
};
