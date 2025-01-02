const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dayjs = require('dayjs');
const axios = require('axios');

const LAST_CHECK_FILE = path.join(require('os').tmpdir(), 'puzzle-ai-last-version-check');

async function checkForUpdates() {
    try {
        // Check if we've already checked today
        if (fs.existsSync(LAST_CHECK_FILE)) {
            const lastCheck = fs.readFileSync(LAST_CHECK_FILE, 'utf8');
            if (dayjs().isSame(dayjs(lastCheck), 'day')) {
                return;
            }
        }

        // Get local version
        const localVersion = require('../../package.json').version;

        // Get latest version from GitHub
        const { data: packageJson } = await axios.get(
            'https://raw.githubusercontent.com/twinity1/puzzle/main/package.json'
        );
        const latestVersion = packageJson.version;

        if (latestVersion !== localVersion) {
            console.log(`\n🎉 New version available: ${latestVersion} (current: ${localVersion})`);

            const { default: inquirer } = await import('inquirer');
            const { shouldUpdate } = await inquirer.prompt({
                type: 'confirm',
                name: 'shouldUpdate',
                message: 'Would you like to update now?',
                default: true
            });

            if (shouldUpdate) {
                console.log('🚀 Running "npm install -g puzzle-ai"...');
                try {
                    execSync('npm install -g puzzle-ai', { stdio: 'inherit' });
                    console.log('✅ Update successful!');
                } catch (error) {
                    console.error('❌ Update failed:', error.message);
                }
            } else {
                console.log('🚀 You can update later by running: npm install -g puzzle-ai');
            }
        }

        // Update last check timestamp
        fs.writeFileSync(LAST_CHECK_FILE, dayjs().format());
    } catch (error) {
        // Silently fail - don't interrupt the user experience
        console.error('❌ Version check failed:', error.message);
    }
}

module.exports = { checkForUpdates };
