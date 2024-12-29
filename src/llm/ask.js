const path = require("path");
const { execSync } = require("child_process");
const fs = require("fs");

async function ask(scriptDir, message, readFiles = [], writeFiles = []) {
    try {
        const answerFile = path.join(scriptDir, 'answer.txt');
        const messageFile = path.join(scriptDir, 'message.txt');

        // Remove temporary files if they exist
        if (fs.existsSync(answerFile)) {
            fs.unlinkSync(answerFile);
        }
        if (fs.existsSync(messageFile)) {
            fs.unlinkSync(messageFile);
        }

        // Write message to a file
        fs.writeFileSync(messageFile, `Save the answer to ${answerFile}. Write the answer to the file and do not output any other information! Is is very important when JSON or any other format is requested.  Request: ${message}`);

        const readFilesArgs = readFiles.map(file => `--read "${file}"`).join(' ');
        const writeFilesArgs = writeFiles.map(file => `--file "${file}"`).join(' ');
        execSync(
            `aider --no-suggest-shell-commands --no-detect-urls --edit-format whole --no-git --no-auto-commit --no-auto-lint --file ${answerFile} --message-file ${messageFile} ${readFilesArgs} ${writeFilesArgs}`,
            {stdio: 'inherit'});

        const content = fs.readFileSync(answerFile, 'utf-8');

        // Clean up temporary files
        fs.unlinkSync(answerFile);
        fs.unlinkSync(messageFile);

        return content;
    } catch (error) {
        console.error(error.stack || error);
        throw `Error during LLM interaction: ${error.message}`;
    }
}

async function aider(scriptDir, message, readFiles = [], writeFiles = []) {
    try {
        const messageFile = path.join(scriptDir, 'message.txt');

        // Write message to a file
        fs.writeFileSync(messageFile, message);

        const readFilesArgs = readFiles.map(file => `--read "${file}"`).join(' ');
        const writeFilesArgs = writeFiles.map(file => `--file "${file}"`).join(' ');
        const aiderCommand = `aider --no-suggest-shell-commands --no-detect-urls --no-auto-commit --no-auto-lint --message-file ${messageFile} ${readFilesArgs} ${writeFilesArgs}`;

        console.log(`Executing command: ${aiderCommand}`);

        execSync(
            aiderCommand,
            {stdio: 'inherit'});

        // Clean up temporary files
        fs.unlinkSync(messageFile);
    } catch (error) {
        throw `Error during LLM interaction: ${error.message}`;
    }
}

module.exports = { ask, aider };
