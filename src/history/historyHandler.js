const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');

class HistoryHandler {
    constructor(
        puzzleDir,
        repoPath,
        inquirerPromptModule) {
        this.puzzleDir = puzzleDir;
        this.inquirerPrompt = inquirerPromptModule;
        this.historyPath = path.join(puzzleDir, '.puzzle.history.json');
        this.gitignorePath = path.join(repoPath, '.gitignore');
    }

    async loadHistory(varList) {
        // Check and offer to add .puzzle.history.json to .gitignore if not already present
        await this.checkAndUpdateGitignore();

        if (!fs.existsSync(this.historyPath)) {
            console.log('No history found.');
            return null;
        }

        const history = JSON.parse(fs.readFileSync(this.historyPath, 'utf8'));
        const first10Records = history.slice(0, 10);

        if (!varList['HISTORY']) {
            // Collect variables from all records, if the variable is found then don't search for it
            if (first10Records.length > 0) {
                const collectedVars = {};
                // Iterate through all records to collect variables
                for (const record of first10Records) {
                    for (const [key, value] of Object.entries(record)) {
                        // Only collect if the variable isn't already set
                        if (key !== 'PIECE_NAME' && !(key in collectedVars)) {
                            collectedVars[key] = value;
                        }
                    }
                }
                return collectedVars;
            }
            return null;
        }

        if (first10Records.length > 0) {
            const choices = first10Records.map((record, index) => ({
                name: `Record ${index + 1}: ${JSON.stringify(record).replaceAll("\"", "")}`,
                value: record
            }));

            const promptFnc = inquirer.createPromptModule();
            const {selectedRecord} = await promptFnc([{
                type: 'list',
                name: 'selectedRecord',
                message: 'Select a record to view details:',
                choices
            }]);

            return selectedRecord;
        }

        console.log('No records found in history.json.');
        return null;
    }

    async checkAndUpdateGitignore() {
        console.log(this.gitignorePath);

        // Check if .gitignore exists
        if (!fs.existsSync(this.gitignorePath)) {
            const {createGitignore} = await this.inquirerPrompt({
                type: 'confirm',
                name: 'createGitignore',
                message: 'Would you like to create a .gitignore file to exclude .puzzle.history.json?',
                default: true
            });

            if (createGitignore) {
                fs.writeFileSync(this.gitignorePath, '.puzzle.history.json\n', 'utf8');
                console.log('Created .gitignore with .puzzle.history.json entry.');
                return;
            }
        }

        // If .gitignore exists, check if .puzzle.history.json is already ignored
        const gitignoreContent = fs.existsSync(this.gitignorePath)
            ? fs.readFileSync(this.gitignorePath, 'utf8')
            : '';

        if (!gitignoreContent.includes('.puzzle.history.json')) {
            const {updateGitignore} = await this.inquirerPrompt({
                type: 'confirm',
                name: 'updateGitignore',
                message: 'Would you like to add .puzzle.history.json to .gitignore?',
                default: true
            });

            if (updateGitignore) {
                fs.appendFileSync(this.gitignorePath, '\n.puzzle.history.json\n');
                console.log('Added .puzzle.history.json to .gitignore.');
            }
        }
    }

    updateHistory(varList) {
        let history = [];
        if (fs.existsSync(this.historyPath)) {
            history = JSON.parse(fs.readFileSync(this.historyPath, 'utf8'));
        }

        const updatedVarList = {...varList};
        delete updatedVarList['HISTORY'];

        const existingIndex = history.findIndex(
            (record) => JSON.stringify(record) === JSON.stringify(updatedVarList)
        );

        if (existingIndex !== -1) {
            history.splice(existingIndex, 1);
        }

        history.unshift(updatedVarList);
        history = history.slice(0, 20);

        fs.writeFileSync(this.historyPath, JSON.stringify(history, null, 2), 'utf8');
    }
}

module.exports = HistoryHandler;
