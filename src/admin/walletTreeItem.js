const vscode = require("vscode");

class WalletTreeItem extends vscode.TreeItem {
  constructor(
    label,
    collapsibleState,
    organization,
    isActive = false,
    children = []
  ) {
    super(label, collapsibleState);
    this.organization = organization;
    this.isActive = isActive;
    this.children = children;
    this.contextValue = isActive ? "activeWallet" : "inactiveWallet";
    this.updateIcon();
  }

  setActive(isActive) {
    this.isActive = isActive;
    this.contextValue = isActive ? "activeWallet" : "inactiveWallet";
    this.updateIcon();
    if (this.treeViewProvider) {
      this.treeViewProvider.refresh(this);
    }
  }

  updateIcon() {
    this.iconPath = this.isActive
      ? new vscode.ThemeIcon(
          "circle-filled",
          new vscode.ThemeColor("charts.green")
        )
      : new vscode.ThemeIcon("circle-outline");
  }

  addChild(child) {
    this.children.push(child);
  }
}

module.exports = { WalletTreeItem };
