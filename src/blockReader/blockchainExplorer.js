const vscode = require("vscode");

class BlockchainTreeDataProvider {
  constructor() {
    this.blockData = [];
    this.onDidChangeTreeDataEvent = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.onDidChangeTreeDataEvent.event;
  }

  refresh(blocks) {
    console.log("Refreshing with blocks:", blocks);
    this.blockData = blocks;
    this.onDidChangeTreeDataEvent.fire();
  }

  getChildren(element) {
    if (!element) {
      return this.blockData.map((block) => {
        console.log("Block data:", block);
        return {
          label: `Block ${block.header.number}`,
          collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
          data: block,
        };
      });
    } else {
      const block = element.data;
      const transactions = block?.data?.data || [];
      console.log("Transactions data:", transactions);

      if (!Array.isArray(transactions)) {
        console.error("Transactions is not an array:", transactions);
        return [];
      }

      const timestamp =
        transactions.length > 0
          ? new Date(
              transactions[0]?.payload?.header?.channel_header?.timestamp
            ).toUTCString()
          : "Unknown";

      const summaryNode = {
        label: `Summary`,
        description: `Height: ${block.header.number}, Transactions: ${transactions.length}, Timestamp: ${timestamp}`,
        collapsibleState: vscode.TreeItemCollapsibleState.None,
      };

      const transactionNodes = transactions.map((tx, index) => {
        const txId = tx?.payload?.header?.channel_header?.tx_id || "N/A";
        return {
          label: `Transaction ${index + 1}`,
          description: `Transaction ID: ${txId}`,
          collapsibleState: vscode.TreeItemCollapsibleState.None,
        };
      });

      return [summaryNode, ...transactionNodes];
    }
  }

  getTreeItem(element) {
    return element;
  }
}

module.exports = { BlockchainTreeDataProvider };
