const { Separator } = require('@inquirer/prompts');
const path = require('path');
const { buildBatchCommand, executeCommand } = require('../utils/commandBuilder');

class BatchProcessor {
    constructor(fileGroups, varList, puzzleConfig) {
        this.fileGroups = fileGroups;
        this.varList = varList;
        this.puzzleConfig = puzzleConfig;
        this.totalFiles = fileGroups.reduce((sum, group) => sum + group.length, 0);
    }

    validateMessageParameter() {
        if (!this.varList['MESSAGE'] && !this.varList['MSG'] && !this.varList['MESSAGE-FILE']) {
            console.error('Error: One of the message parameters must be set (--message, --msg, --message-file)');
            console.error('Example: puzzle-batch "pattern" --msg "add comment to each class"');
            return false;
        }
        return true;
    }

    printInitialStatus() {
        console.log(`\x1b[36mFound ${this.fileGroups.length} groups with total ${this.totalFiles} files matching pattern:\x1b[0m \x1b[33m${this.varList['BATCH_PATTERN']}\x1b[0m`);
        console.log('\x1b[33mNote: Files will be processed individually with Aider command\x1b[0m');
    }

    buildChoices() {
        // Check if we're using groups (more than one file per group)
        const hasGroups = this.fileGroups.some(group => group.length > 1);
        
        return this.fileGroups.flatMap((group, groupIndex) => {
            const files = group.map(file => ({
                name: path.relative(this.puzzleConfig.repoPath, file),
                value: file,
                checked: true
            }));

            if (hasGroups) {
                const groupName = `Group ${groupIndex + 1}`;
                return [
                    new Separator(`\n=== ${groupName} ===`),
                    ...files
                ];
            }

            return files;
        });
    }

    processSelections(selectedFiles) {
        const groupedFiles = new Map();
        
        // Group selected files by their original groups
        for (let i = 0; i < this.fileGroups.length; i++) {
            const groupFiles = selectedFiles.filter(file => this.fileGroups[i].includes(file));
            if (groupFiles.length > 0) {
                groupedFiles.set(`Group ${i + 1}`, groupFiles);
            }
        }

        return groupedFiles;
    }

    printProgress(groupName, files, processedGroups, totalGroups) {
        const progress = Math.round((processedGroups / totalGroups) * 100);
        const message = `Processing ${groupName} (${files.length} files)`;
        const stats = `Progress: ${progress}% (${processedGroups}/${totalGroups} groups)`;
        const width = Math.max(message.length, stats.length) + 4;
        const border = '━'.repeat(width);
        
        console.log('\n');
        console.log(`\x1b[31m┏${border}┓\x1b[0m`);
        console.log(`\x1b[31m┃\x1b[0m  ${stats.padEnd(width - 2)}  \x1b[31m┃\x1b[0m`);
        console.log(`\x1b[31m┃\x1b[0m  ${message.padEnd(width - 2)}  \x1b[31m┃\x1b[0m`);
        console.log(`\x1b[31m┗${border}┛\x1b[0m`);
    }

    async process(additionalAiderCmd, filesLink, lineContinuation, inquirerPrompt) {
        if (this.fileGroups.length === 0 || !this.validateMessageParameter()) {
            return;
        }

        this.printInitialStatus();
        const choices = this.buildChoices();

        const { selectedFiles } = await inquirerPrompt({
            type: 'checkbox',
            name: 'selectedFiles',
            message: 'Select files to process:',
            choices,
        });

        if (selectedFiles.length === 0) {
            console.log('No files selected. Batch processing cancelled.');
            return;
        }

        const groupedFiles = this.processSelections(selectedFiles);
        let processedGroups = 0;
        const totalGroups = groupedFiles.size;

        for (const [groupName, files] of groupedFiles) {
            processedGroups++;
            this.printProgress(groupName, files, processedGroups, totalGroups);
            
            const command = buildBatchCommand(additionalAiderCmd, filesLink, lineContinuation, files);
            executeCommand(command);
        }
    }
}

module.exports = {
    BatchProcessor
};
