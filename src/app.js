const fs = require('fs');
const inquirer = require('inquirer');
const { getActionList } = require('./utils/fileUtils');
const { getModifiedGitFiles, isGitReadRequested, isGitWriteRequested } = require('./utils/git');
const { processAction } = require('./actionProcessor');
const ConfigHandler = require('./config/configHandler');
const HistoryHandler = require('./history/historyHandler');
const path = require("node:path");

class App {
    constructor(configHandler) {
        this.configHandler = configHandler;
        this.config = this.configHandler.getConfig();
        this.initializePuzzleDirectories();
        this.inquirerPrompt = inquirer.createPromptModule();
        this.historyHandler = new HistoryHandler(
            this.config.puzzleDir,
            this.config.repoPath,
            this.inquirerPrompt);
        this.varList = {};
        this.defaultVarList = {};
    }

    initializePuzzleDirectories() {
        if (this.config.puzzleDir && !fs.existsSync(this.config.puzzleDir)) {
            console.info(`Initializing at ${this.config.puzzleDir}`);

            fs.mkdirSync(this.config.puzzleDir, { recursive: true });
            fs.mkdirSync(path.join(this.config.puzzleDir, 'pieces'), { recursive: true });
            fs.mkdirSync(path.join(this.config.puzzleDir, 'common', 'extra'), { recursive: true });
            fs.mkdirSync(path.join(this.config.puzzleDir, 'common', 'templates'), { recursive: true });

            const templatePath = path.join(__dirname, 'templates', 'setup.mjs');
            const setupContent = fs.readFileSync(templatePath, 'utf8');
            fs.writeFileSync(path.join(this.config.puzzleDir, 'common', 'setup.mjs'), setupContent);
        }
    }

    initializeVarList(argv) {
        Object.keys(argv).forEach(key => {
            if (key !== '_' && key !== '$0') {
                this.varList[key.toUpperCase()] = argv[key];
            }
        });
        delete this.varList['_'];
        delete this.varList['$0'];
    }

    async getGitFiles(varList) {
        if (isGitReadRequested(varList) || isGitWriteRequested(varList)) {
            return await getModifiedGitFiles(this.config.puzzleDir);
        }
        return [];
    }

    async selectActions() {
        // Handle virtual chat piece
        if (this.varList['PIECE_NAME'] === 'virtual-chat') {
            return ['virtual-chat'];
        }

        // Handle batch mode
        if (process.argv[1].endsWith('puzzleBatch.js')) {
            if (process.argv.length < 3) {
                throw new Error('No pattern specified for batch mode. Usage: puzzle-batch <pattern>');
            }
            return ['virtual-chat'];
        }

        const actionDir = path.join(this.config.puzzleDir, 'pieces');
        const actionList = getActionList(actionDir);

        if (actionList.length === 0) {
            const { createPiece } = await this.inquirerPrompt({
                type: 'confirm',
                name: 'createPiece',
                message: 'No pieces found. Would you like to create a new piece?',
                default: true
            });

            if (createPiece) {
                const { createNewPiece } = require('./modules/wizardHandler');
                await createNewPiece(this.config.puzzleDir, this.inquirerPrompt);

                // Check if any actions were created
                const newActionList = getActionList(actionDir);
                if (newActionList.length > 0) {
                    return await this.selectActions();
                }

                return [];
            }
            throw new Error('No puzzle selected. Exiting.');
        }

        const { actionsSelected } = await this.inquirerPrompt([{
            type: 'checkbox',
            name: 'actionsSelected',
            message: 'Choose one or more piece:',
            choices: actionList.map((action) => ({
                value: action,
                checked: this.defaultVarList.PIECE_NAME === action
            })),
        }]);

        if (actionsSelected.length === 0) {
            throw new Error('No puzzle selected. Exiting.');
        }

        return actionsSelected;
    }

    async run(argv) {
        try {
            // Handle create-piece command
            if (argv._[0] === 'create-piece') {
                const { createNewPiece } = require('./modules/wizardHandler');
                await createNewPiece(this.config.puzzleDir, this.inquirerPrompt);
                return;
            }

            this.initializeVarList(argv);

            const gitFiles = await this.getGitFiles(this.varList);
            this.defaultVarList = await this.historyHandler.loadHistory(this.varList) || {};

            if (this.varList['HISTORY']) {
                delete this.varList['HISTORY'];
            }

            const virtualPieces = ['virtual-chat', 'puzzle-batch'];
            
            if (virtualPieces.includes(this.varList['PIECE_NAME'])) {
                const action = this.varList['PIECE_NAME'];

                // Skip history updates for virtual chat
                await processAction(
                    action,
                    this.varList,
                    this.config.puzzleDir,
                    process.cwd(),
                    this.inquirerPrompt,
                    this.defaultVarList,
                    this.config,
                    gitFiles,
                    action === 'puzzle-batch'
                );
            } else {
                const actionsSelected = await this.selectActions();

                for (const action of actionsSelected) {
                    await processAction(
                        action,
                        this.varList,
                        this.config.puzzleDir,
                        process.cwd(),
                        this.inquirerPrompt,
                        this.defaultVarList,
                        this.config,
                        gitFiles
                    );
                    this.historyHandler.updateHistory(this.varList);
                }
            }
            } catch (error) {
                // Save variables to history even if selection is interrupted
                this.historyHandler.updateHistory(this.varList);
                throw error;
            }
            
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    }

module.exports = App;
