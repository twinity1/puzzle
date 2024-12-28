const fs = require('fs');
const path = require('path');

async function getAllModules(puzzleDir, action) {
    const modules = [];
    await addCommonModule(puzzleDir, modules);
    await addActionModule(puzzleDir, action, modules);
    return modules;
}

async function addCommonModule(puzzleDir, modules) {
    const commonDir = path.join(puzzleDir, 'common');
    const commonDirSetupPath = path.join(commonDir, 'setup.mjs');

    const commonDirExists = fs.existsSync(commonDir);
    const commonDirSetupExists = fs.existsSync(commonDirSetupPath);

    if (commonDirSetupExists || commonDirExists) {
        modules.push({
            dir: commonDirExists ? commonDir : undefined,
            setup: commonDirSetupExists ? await import(commonDirSetupPath) : undefined
        });
    }
}

async function addActionModule(puzzleDir, action, modules) {
    const actionsDir = path.join(puzzleDir, 'pieces');
    const actionDirPath = path.join(actionsDir, action);
    const actionModuleSetup = await import(path.join(actionDirPath, 'setup.mjs'));

    modules.push({
        dir: actionDirPath,
        setup: actionModuleSetup
    });
}

module.exports = {
    getAllModules
};