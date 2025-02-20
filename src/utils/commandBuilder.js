function printAiderCommand(aiderCmd) {
    console.log(`\x1b[36mExecuting command:\x1b[0m \x1b[33m${aiderCmd.replace('puzzle-proxy', 'aider')}\x1b[0m`);
}

function buildBatchCommand(additionalAiderCmd, filesLink, lineContinuation, files) {
    const fileArgs = files.map(file => `--file "${file}"`).join(lineContinuation);
    return `aider${additionalAiderCmd}${lineContinuation} ${filesLink}${lineContinuation}${fileArgs}`;
}

function buildChatCommand(additionalAiderCmd, filesLink, lineContinuation, isChat) {
    if (isChat) {
        return `puzzle-proxy ${additionalAiderCmd}${filesLink}`;
    }
    return `puzzle-proxy ${additionalAiderCmd}${lineContinuation} ${filesLink}`;
}

function executeCommand(command, env = {}) {
    printAiderCommand(command);
    const { execSync } = require('child_process');
    execSync(command, {
        stdio: 'inherit',
        env: { ...process.env, ...env }
    });
}

module.exports = {
    buildBatchCommand,
    buildChatCommand,
    executeCommand
};
