const path = require('path');
const fs = require('fs');
const { findFileInDirectoriesUp } = require('../fileUtils');
const { execSync } = require('child_process');
const inquirer = require('inquirer');

class ConfigHandler {
    constructor() {
        this.defaultConfig = require('../defaultConfig.json');
        this.config = {};
    }

    async initialize() {
        let userConfigPath = findFileInDirectoriesUp("puzzle.json");
        let userConfigData = {};

        // Ensure config exists before proceeding with initialization
        if (!userConfigPath) {
            try {
                // Get git repository root
                const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
                userConfigPath = path.join(gitRoot, 'puzzle.json');
                fs.writeFileSync(userConfigPath, JSON.stringify({}, null, 2));
                userConfigData = this.defaultConfig;
            } catch (error) {
                // Fallback to current directory if not in a git repo
                const answer = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'createConfig',
                    message: 'No git repository found. Create config in current directory?',
                    default: false
                }]);

                if (answer.createConfig) {
                    userConfigPath = path.join(process.cwd(), 'puzzle.json');
                    fs.writeFileSync(userConfigPath, JSON.stringify({}, null, 2));
                    userConfigData = this.defaultConfig;
                } else {
                    console.log('Config creation cancelled. Exiting...');
                    process.exit(1);
                }
            }
        } else {
            try {
                userConfigData = JSON.parse(fs.readFileSync(userConfigPath, 'utf8'));
            } catch (error) {
                throw `Could not parse ${userConfigPath} content. Must be a valid JSON: ${error}`;
            }
        }

        this.config = { ...this.defaultConfig, ...userConfigData };
        this.config.repoPath = path.dirname(userConfigPath);
        this.config.puzzleDir = path.join(this.config.repoPath, this.config.puzzleDir);
    }

    getConfig() {
        return this.config;
    }
}

module.exports = ConfigHandler;
