const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const configPath = path.join(os.homedir(), '.puzzle.aider.yml');

function readUserConfig() {
    if (!fs.existsSync(configPath)) {
        return {};
    }
    try {
        return yaml.load(fs.readFileSync(configPath, 'utf8')) || {};
    } catch (e) {
        console.error(`Error reading user config at ${configPath}:`, e);
        return {};
    }
}

function writeUserConfig(config) {
    try {
        fs.writeFileSync(configPath, yaml.dump(config), 'utf8');
    } catch (e) {
        console.error(`Error writing user config to ${configPath}:`, e);
    }
}

module.exports = { readUserConfig, writeUserConfig, configPath };
