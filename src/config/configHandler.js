const path = require('path');
const fs = require('fs');
const { findFileInDirectoriesUp } = require('../utils/fileUtils');
const { execSync } = require('child_process');
const inquirer = require('inquirer');

class ConfigHandler {
    constructor() {
        this.defaultConfig = require('../defaultConfig.json');
        this.config = {};
    }

    async initialize(argv = {}) {
        let userConfigPath = findFileInDirectoriesUp(".puzzle.json");
        let userConfigData = {};

        // Merge command line args into aiderArgs
        if (argv) {
            // Only allow specific aider args
            const allowedArgs = [
                'model', 'opus', 'sonnet', 'haiku', '4', '4o', 'mini', '4-turbo', '35turbo', 
                'deepseek', 'o1-mini', 'o1-preview', 'openai-api-key', 'anthropic-api-key',
                'openai-api-base', 'openai-api-type', 'openai-api-version', 'openai-api-deployment-id',
                'openai-organization-id', 'set-env', 'api-key', 'list-models', 'model-settings-file',
                'model-metadata-file', 'alias', 'verify-ssl', 'no-verify-ssl', 'timeout', 'edit-format',
                'architect', 'weak-model', 'editor-model', 'editor-edit-format', 'show-model-warnings',
                'no-show-model-warnings', 'max-chat-history-tokens', 'cache-prompts', 'no-cache-prompts',
                'cache-keepalive-pings', 'map-tokens', 'map-refresh', 'map-multiplier-no-files',
                'input-history-file', 'chat-history-file', 'restore-chat-history', 'no-restore-chat-history',
                'llm-history-file', 'dark-mode', 'light-mode', 'pretty', 'no-pretty', 'stream', 'no-stream',
                'user-input-color', 'tool-output-color', 'tool-error-color', 'tool-warning-color',
                'assistant-output-color', 'completion-menu-color', 'completion-menu-bg-color',
                'completion-menu-current-color', 'completion-menu-current-bg-color', 'code-theme',
                'show-diffs', 'git', 'no-git', 'gitignore', 'no-gitignore', 'aiderignore', 'subtree-only',
                'auto-commits', 'no-auto-commits', 'dirty-commits', 'no-dirty-commits', 'attribute-author',
                'no-attribute-author', 'attribute-committer', 'no-attribute-committer', 'attribute-commit-message-author',
                'no-attribute-commit-message-author', 'attribute-commit-message-committer', 'no-attribute-commit-message-committer',
                'commit', 'commit-prompt', 'dry-run', 'no-dry-run', 'skip-sanity-check-repo', 'watch-files',
                'no-watch-files', 'lint', 'lint-cmd', 'auto-lint', 'no-auto-lint', 'test-cmd', 'auto-test',
                'no-auto-test', 'test', 'analytics', 'no-analytics', 'analytics-log', 'analytics-disable',
                'just-check-update', 'check-update', 'no-check-update', 'show-release-notes', 'no-show-release-notes',
                'install-main-branch', 'upgrade', 'version', 'message', 'message-file', 'gui', 'no-gui',
                'browser', 'no-browser', 'copy-paste', 'no-copy-paste', 'apply', 'apply-clipboard-edits',
                'exit', 'show-repo-map', 'show-prompts', 'voice-format', 'voice-language', 'voice-input-device',
                'file', 'read', 'vim', 'chat-language', 'yes-always', 'v', 'load', 'encoding', 'c',
                'config-file', 'env-file', 'suggest-shell-commands', 'no-suggest-shell-commands',
                'fancy-input', 'no-fancy-input', 'multiline', 'no-multiline', 'detect-urls', 'no-detect-urls',
                'editor'
            ];

            // Filter and merge only allowed args
            const filteredArgs = Object.fromEntries(
                Object.entries(argv).filter(([key]) => allowedArgs.includes(key))
            );

            this.defaultConfig.aiderArgs = {
                ...this.defaultConfig.aiderArgs,
                ...filteredArgs
            };
        }

        // Ensure config exists before proceeding with initialization
        if (!userConfigPath) {
            try {
                // Get git repository root
                const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
                userConfigPath = path.join(gitRoot, '.puzzle.json');
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
                    userConfigPath = path.join(process.cwd(), '.puzzle.json');
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
