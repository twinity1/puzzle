#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { execSync, spawn } = require('child_process');
const path = require('path');
const prompt = require('inquirer').createPromptModule();
const { readUserConfig, writeUserConfig, configPath: userConfigPath } = require('./utils/userConfig');
const App = require('./app');
const ConfigHandler = require('./config/configHandler');
const { checkAndInstallAider } = require('./utils/aiderCheck');

/**
 * Main application entry point.
 * Parses command line arguments, initializes configuration, and runs the application logic.
 */
async function main() {
    // Check execution mode by checking wrapper file
    const isAiderMode = process.argv[1].endsWith('puzzle-aider') || 
                        process.argv[1].endsWith('puzzleAider.js');
    const isBatchMode = process.argv[1].endsWith('puzzle-batch') || 
        process.argv[1].endsWith('puzzleBatch.js');
    
    // Show both helps if --help is requested
    if (process.argv.includes('--help')) {
        if (isAiderMode) {
            console.log('\n=== PUZZLE-AIDER COMMAND (AI CHAT MODE) ===\n');
            execSync('aider --help', { stdio: 'inherit' });
            console.log('\n=== PUZZLE BASE COMMAND ===\n');
        }
    }

    const argv = yargs(hideBin(process.argv))
        .scriptName(isAiderMode ? 'puzzle-aider' : isBatchMode ? 'puzzle-batch' : 'puzzle')
        .usage(isBatchMode
            ? '$0 <pattern> [options]'
            : '$0 [options]', 'Run the tool for code scaffolding')
        .option('batch-pattern', {
            type: 'string',
            description: 'Process multiple files matching the glob pattern\n' +
                        'Example: "src/**/*.js" or "components/*.tsx"'
        })
        .example('$0 "src/**/*.js"', 'Process all JavaScript files in src directory')
        .example('$0 "components/*.tsx"', 'Process all TypeScript React files in components')
        .option('no-update-check', {
            type: 'boolean',
            description: 'Skip version and dependency update checks'
        })
        .option('ide', {
            type: 'string',
            description: 'Force a specific JetBrains IDE for diffs (e.g., "webstorm"). Overrides all other settings.\n' +
                         'Values: idea, webstorm, pycharm, rider, phpstorm, goland, clion.'
        })
        .command('create-piece', 'Create a new puzzle piece template', (yargs) => {
            return yargs
                .usage('$0 create-piece')
                .describe('Interactive wizard to create a new piece template for code scaffolding.\n' +
                        'A "piece" represents a set of templates for code generation.\n' +
                        'It can be used for various purposes like endpoint creation, CRUD operations, test generation, etc.');
        })
        .command('init', 'Initialize configuration only', (yargs) => {
            return yargs
                .usage('$0 init')
                .describe('Creates and initializes configuration file without running the main application');
        })
        .command('$0', 'Run the tool for scaffolding', (yargs) => {
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

    await checkAndInstallAider();

    if (argv.updateCheck !== false) {
        const { checkForUpdates } = require('./utils/versionCheck');
        await checkForUpdates();
    }

    const configHandler = new ConfigHandler();
    await configHandler.initialize(argv);

    // Check for JetBrains IDE and start watcher
    if (process.env.TERMINAL_EMULATOR && process.env.TERMINAL_EMULATOR.includes('JetBrains')) {
        const userConfig = readUserConfig();
        userConfig.jetbrains = userConfig.jetbrains || {};
        let showDiffs = userConfig.jetbrains.showDiffs;

        if (showDiffs === undefined) {
            const { confirm } = await prompt({
                type: 'confirm',
                name: 'confirm',
                message: '\x1b[36mJetBrains IDE detected!\x1b[0m Would you like to automatically see diffs for AI changes in your IDE?\n\x1b[90m(This opens a diff window after each AI edit for you to review)\x1b[0m',
                default: true
            });
            showDiffs = confirm;
            if (showDiffs) {
                console.log('\n\x1b[33;1m┌──────────────────────────────────────────────────────────────┐');
                console.log('│ \x1b[31;1mATTENTION:\x1b[0m \x1b[33;1mWhen the diff window appears...                   │');
                console.log('│                                                              │');
                console.log('│ • \x1b[32mLeft side:\x1b[0m Your original code (before AI changes).         │');
                console.log('│ • \x1b[31mRight side:\x1b[0m The file with AI changes applied.              │');
                console.log('│                                                              │');
                console.log('│ \x1b[33;1m➡️ \x1b[1mOnly edit the file on the RIGHT side to keep your changes.\x1b[0m │');
                console.log('└──────────────────────────────────────────────────────────────┘\n');
            }
            userConfig.jetbrains.showDiffs = showDiffs;
            writeUserConfig(userConfig);
            console.log(`\x1b[90mSetting saved to \x1b[33m${userConfigPath}\x1b[90m. You can change it there later.\x1b[0m`);
        }

        if (showDiffs) {
            const watcherScriptPath = path.join(__dirname, 'utils/jetbrainsHistoryWatcher.js');
            const repoPath = configHandler.getConfig().repoPath;

            let ideName;

            if (argv.ide) {
                ideName = argv.ide;
            } else if (process.env.PUZZLE_IDE) {
                ideName = process.env.PUZZLE_IDE;
            } else if (userConfig.jetbrains.ide) {
                ideName = userConfig.jetbrains.ide;
            } else {
                const { ide } = await prompt({
                    type: 'list',
                    name: 'ide',
                    message: 'Which JetBrains IDE are you using?',
                    choices: [
                        'idea',
                        'webstorm',
                        'pycharm',
                        'rider',
                        'phpstorm',
                        'goland',
                        'clion'
                    ],
                    default: 'idea'
                });
                ideName = ide;
                userConfig.jetbrains.ide = ideName;
                writeUserConfig(userConfig);
                console.log(`\n\x1b[90mIDE preference saved to \x1b[33m${userConfigPath}\x1b[90m.`);
                console.log(`You can override this for the current session by setting the \x1b[33mPUZZLE_IDE\x1b[90m environment variable.\x1b[0m`);
                console.log(`\x1b[90mExample: \x1b[33mexport PUZZLE_IDE=webstorm\x1b[0m\n`);
            }

            let ideCmd = ideName;
            if (process.platform === 'win32') {
                ideCmd = `${ideName}`;
            } else if (process.platform === 'linux') {
                ideCmd = `${ideName}`;
            }

            const watcher = spawn(process.execPath, [watcherScriptPath, repoPath, ideCmd], {
                detached: true,
                stdio: 'ignore'
            });

            // Store watcher PID to pass to child process
            global.jetbrainsWatcherPid = watcher.pid;

            watcher.unref(); // Allow parent to exit independently

            console.log(`👀 Watching for file changes to show diffs in JetBrains IDE (${ideCmd})...`);
        }
    }

    const app = new App(configHandler);

    // If init command, exit after config initialization
    if (argv._[0] === 'init') {
        await app.historyHandler.checkAndUpdateGitignore();
        return;
    }
    

    if (isAiderMode) {
        // Force chat mode and skip history for puzzle-aider
        argv.chat = true;
        argv.PIECE_NAME = 'virtual-chat';
    } else if (isBatchMode) {
        // Force batch mode for puzzle-batch
        const pattern = argv._[0] || process.argv[2];
        if (!pattern || pattern.startsWith('-')) {
            console.error('\x1b[31mError: Batch pattern is required and cannot start with "-"\x1b[0m');
            console.error('\x1b[31mExample: puzzle-batch "src/**/*.js" --msg "add comments"\x1b[0m');
            process.exit(1);
        }
        argv.BATCH_PATTERN = pattern;
        argv.PIECE_NAME = 'puzzle-batch';
    }

    await app.run(argv);
}

main().catch(error => {
    console.error('Application failed:', error);
    process.exit(1);
});
