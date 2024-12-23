#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { execSync } = require('child_process');
const App = require('./app');
const ConfigHandler = require('./config/configHandler');

function isAiderInstalled() {
    try {
        execSync('aider --help', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

async function main() {
    if (!isAiderInstalled()) {
        console.error('Error: aider-chat is not installed.');
        console.error('Please install it using: pip install aider-chat');
        process.exit(1);
    }

    const configHandler = new ConfigHandler();
    await configHandler.initialize();

    const app = new App(configHandler);
    await app.run(yargs(hideBin(process.argv)).argv);
}

main().catch(error => {
    console.error('Application failed:', error);
    process.exit(1);
});
