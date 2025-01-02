const { execSync } = require('child_process');

function isAiderInstalled() {
    try {
        execSync('aider --help', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

async function checkAndInstallAider() {
    if (!isAiderInstalled()) {
        const { default: inquirer } = await import('inquirer');
        const { install } = await inquirer.prompt({
            type: 'confirm',
            name: 'install',
            message: 'aider-chat is not installed. Would you like to install it now?',
            default: true
        });

        if (install) {
            try {
                console.log('Installing aider-chat...');
                execSync('python -m pip install aider-install && aider-install', { stdio: 'inherit' });
                console.log('aider-chat installed successfully!');
            } catch (error) {
                console.error('Failed to install aider-chat:', error);
                process.exit(1);
            }
        } else {
            console.log('You can install aider-chat manually using: python -m pip install aider-install && aider-install');
            process.exit(1);
        }
    }
}

module.exports = { checkAndInstallAider };
