const vscode = require("vscode");

class NetworkTreeItem extends vscode.TreeItem {
  constructor(label, collapsibleState, children = [], isActive = false) {
    super(label, collapsibleState);
    this.children = children;
    this.isActive = isActive;
    this.contextValue = isActive ? "activeNetwork" : "inactiveNetwork";
    this.updateIcon();
  }

  setActive(isActive) {
    this.isActive = isActive;
    this.contextValue = isActive ? "activeNetwork" : "inactiveNetwork";
    this.updateIcon();
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

module.exports = { NetworkTreeItem };
