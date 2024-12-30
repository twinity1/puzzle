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

    const argv = yargs(hideBin(process.argv))
        .scriptName('puzzle')
        .usage('$0 [options]', 'Run the puzzle solver for code scaffolding')
        .command('create-piece', 'Create a new puzzle piece template', (yargs) => {
            return yargs
                .usage('$0 create-piece')
                .describe('Interactive wizard to create a new piece template for code scaffolding.\n' +
                        'A "piece" represents a set of templates for code generation.\n' +
                        'It can be used for various purposes like endpoint creation, CRUD operations, test generation, etc.');
        })
        .command('$0', 'Run the puzzle solver', (yargs) => {
            return yargs
                .option('history', {
                    alias: 'H',
                    type: 'boolean',
                    description: 'Use command history to re-run previous actions\n' +
                                'Shows last 10 runs and allows reusing variables'
                })
                .option('git-read', {
                    alias: ['GR', 'GIT-R'],
                    type: 'boolean',
                    description: 'Include modified git files for reading\n' +
                                'Provides context from changed files to the LLM'
                })
                .option('git-write', {
                    alias: ['GW', 'GIT-W'],
                    type: 'boolean',
                    description: 'Include modified git files for writing\n' +
                                'Allows the LLM to modify existing files'
                })
                .option('chat', {
                    type: 'boolean',
                    description: 'Enables aider chat mode instead of instant command exit'
                })
                .epilogue('For more information, see the full documentation at USAGE.md\n' +
                        'Key features:\n' +
                        '  - Create reusable code templates\n' +
                        '  - Dynamic prompt generation\n' +
                        '  - Shared configuration across pieces\n' +
                        '  - Custom variables support\n' +
                        '  - Git integration for context awareness');
        })
        .help()
        .alias('h', 'help')
        .version()
        .alias('v', 'version')
        .argv;

    const configHandler = new ConfigHandler();
    await configHandler.initialize();

    const app = new App(configHandler);
    await app.run(argv);
}

main().catch(error => {
    console.error('Application failed:', error);
    process.exit(1);
});
