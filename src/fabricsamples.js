const vscode = require('vscode');

class fabricsamples {
    constructor() {
        // Define the tree structure
        this.treeData = [
            {
                label: "Fabric Sample",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed, // Collapsible node

            }
        ];
    }

    getTreeItem(element) {
        const treeItem = new vscode.TreeItem(
            element.label,
            element.collapsibleState
        );
        return treeItem;
    }

    getChildren(element) {
        if (element) {
            // Return children for the given element
            return element.children || [];
        } else {
            // Return top-level items (i.e., Start a Local Network)
            return this.treeData;
        }
    }
}

module.exports = fabricsamples;
