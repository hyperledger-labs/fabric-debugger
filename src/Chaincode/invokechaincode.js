const vscode = require("vscode");
const fs = require("fs");
const { exec } = require('child_process');
const fabricsamples = require('./src/fabricsamples');
const { Console, log } = require("console");
const outputChannel = vscode.window.createOutputChannel("Function Arguments Logger");
const { Gateway, Wallets } = require('fabric-network');
const yaml = require('js-yaml');

async function invokeCommand(functionName, argumentValues) {
    const outputChannel = vscode.window.createOutputChannel("Chaincode Invocation");
    outputChannel.appendLine(`Invoking function ${functionName} with arguments: ${argumentValues.join(', ')}`);

    let disposable = vscode.commands.registerCommand('extension.extractFunctions', function () {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor. Open a chaincode file.');
            return;
        }
        const filePath = editor.document.fileName;
        const text = editor.document.getText();
        let functions = [];

        if (isGoChaincodeFile(filePath)) {
            functions = extractGoFunctions(text);
        }

        const filteredFunctions = filterIntAndStringFunctions(functions);
        const uniqueFunctions = [...new Set(filteredFunctions)];
        storeFunctions(uniqueFunctions, context);

        vscode.window.showInformationMessage(`Extracted and stored ${uniqueFunctions.length} unique functions with int or string parameters.`);

        showStoredFunctions(context, outputChannel);
    });

    context.subscriptions.push(disposable);
    function isGoChaincodeFile(filePath) {
        const fileName = filePath.toLowerCase();
        return fileName.endsWith('.go');
    }

    function extractGoFunctions(code) {
        const functionDetails = [];
        const regex = /func\s*\((\w+)\s+\*SmartContract\)\s*(\w+)\s*\((.*?)\)\s*(\w*)/g;
        let match;

        while ((match = regex.exec(code)) !== null) {
            const functionName = match[2];
            const params = match[3];
            functionDetails.push({ name: functionName, params });
        }

        return functionDetails;
    }

    function filterIntAndStringFunctions(functions) {
        return functions.filter(func => /int|string/.test(func.params)).map(func => `${func.name}(${func.params})`);
    }

    function storeFunctions(functions, context) {
        let storedFunctions = context.workspaceState.get('storedFunctions', []);
        storedFunctions = [...new Set([...storedFunctions, ...functions])];
        context.workspaceState.update('storedFunctions', storedFunctions);
    }

    function showStoredFunctions(context, outputChannel) {
        const storedFunctions = context.workspaceState.get('storedFunctions', []);

        vscode.window.showQuickPick(storedFunctions, {
            placeHolder: 'Select a function to invoke',
            canPickMany: false
        }).then(selectedFunction => {
            if (selectedFunction) {
                vscode.window.showInformationMessage(`Selected: ${selectedFunction}`);
                promptForArgumentsSequentially(selectedFunction, outputChannel);
            }
        });
    }

    async function promptForArgumentsSequentially(selectedFunction, outputChannel) {
        const functionPattern = /(\w+)\((.*)\)/;
        const match = functionPattern.exec(selectedFunction);

        if (!match) {
            vscode.window.showErrorMessage("Invalid function format.");
            return;
        }

        const functionName = match[1];
        const paramList = match[2].split(',').map(param => param.trim());

        let argumentValues = [];

        for (let param of paramList) {
            if (/int/.test(param)) {
                const input = await vscode.window.showInputBox({ prompt: `Enter an integer value for ${param}` });
                const intValue = parseInt(input, 10);
                if (isNaN(intValue)) {
                    vscode.window.showErrorMessage(`Invalid integer value for ${param}.`);
                    return;
                }
                argumentValues.push(intValue);
            } else if (/string/.test(param)) {
                const input = await vscode.window.showInputBox({ prompt: `Enter a string value for ${param}` });
                if (!input) {
                    vscode.window.showErrorMessage(`Invalid string value for ${param}.`);
                    return;
                }
                argumentValues.push(`"${input}"`);
            }
        }

        const finalArgs = argumentValues.join(', ');
        outputChannel.show();
        outputChannel.appendLine(`Function: ${functionName}`);
        outputChannel.appendLine(`Arguments: ${finalArgs}`);


        vscode.window.showInformationMessage(`Arguments captured. Press "Invoke" to execute the command.`, "Invoke").then(selection => {
            if (selection === "Invoke") {
                invokeCommand(functionName, argumentValues);
            }
        });
    }

    outputChannel.show();
}
