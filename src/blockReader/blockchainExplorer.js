const vscode = require("vscode");

class BlockchainTreeDataProvider {
  constructor() {
    this.blockData = [];
    this.onDidChangeTreeDataEvent = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.onDidChangeTreeDataEvent.event;
  }

  refresh(blocks) {
    this.blockData = blocks;
    this.onDidChangeTreeDataEvent.fire();
  }

  getChildren(element) {
    if (!element) {
      return this.blockData.map((block) => ({
        label: `Block ${block.header.number}`,
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        data: block,
      }));
    } else {
      const block = element.data;
      const transactions = block?.data?.data || [];
      console.log("Transactions data:", transactions);

      if (!Array.isArray(transactions)) {
        console.error("Transactions is not an array:", transactions);
        return [];
      }

      // Block summary node
      const summaryNode = {
        label: `Summary`,
        description: `Height: ${block.header.number}, Transactions: ${
          transactions.length
        }, Timestamp: ${new Date(block.header.data_hash).toUTCString()}`,
        collapsibleState: vscode.TreeItemCollapsibleState.None,
      };

      // Transaction nodes
      const transactionNodes = transactions.map((tx, index) => {
        return {
          label: `Transaction ${index + 1}`,
          description: `Transaction ID: ${
            tx?.payload?.header?.channel_header?.tx_id || "N/A"
          }`,
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
