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
  
  createTreeItem(label, command) {
    const treeItem = new vscode.TreeItem(
      label,
      vscode.TreeItemCollapsibleState.None
    );
    treeItem.command = {
      command,
      title: label,
    };
    return treeItem;
  }
  addNetwork(data) {
    const label = data.channelName || "New Network";
    const command = `fabric-network.button${this.networks.length + 1}`;
    const treeItem = this.createTreeItem(label, command);
    this.networks.push(treeItem);
    this._onDidChangeTreeData.fire();
  }
}

module.exports = {
  TreeViewProvider,
};
