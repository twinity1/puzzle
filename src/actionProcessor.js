const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { scanVariablesInFilePath, updateFilePaths, simplifyPathWithVariable } = require('./modules/variableHandler');
const { ask } = require('./llm/ask');
const { getFilesFromSection, ensureDirectoryExists } = require('./fileUtils');
const { isGitReadRequested, isGitWriteRequested } = require('./git');
const { getAllModules } = require('./modules/moduleHandler');
const { getWriteAndReadFilesFromTemplateFiles, resolveVarsAndUpdateFilePath } = require('./modules/fileHandler');
const { getAndProcessPrompt } = require('./modules/promptHandler');

async function processAction(
    action,
    varList,
    puzzleDir,
    workingDir,
    inquirerPrompt,
    defaultVarList,
    puzzleConfig,
    modifiedGitFiles
    ) {
    console.log(`Performing action: ${action}`);
    varList['PIECE_NAME'] = action;

    const modules = await getAllModules(puzzleDir, action);
    const allTemplateFiles = [];
    const allReadFiles = [];
    const allWriteFiles = [];

    modules.forEach(module => {
        if (module.dir) {
            allTemplateFiles.push(...getFilesFromSection(module.dir, 'template'));
            allReadFiles.push(...getFilesFromSection(module.dir, 'extra'));
        }
    });

    if (isGitReadRequested(varList)) {
        allReadFiles.push(...modifiedGitFiles);
    }

    if (isGitWriteRequested(varList)) {
        allWriteFiles.push(...modifiedGitFiles);
    }

    const actionContext = {
        vars: varList,
        ask: ask,
        inquirerPrompt: inquirerPrompt,
        readFiles: allReadFiles,
        writeFiles: allWriteFiles,
        config: puzzleConfig,
        defaultVars: defaultVarList,
        addReadFile: (file) => {
            const updatedFile = resolveVarsAndUpdateFilePath(puzzleConfig, file, varList);
            allReadFiles.push(updatedFile);
        },
        addWriteFile: (file) => {
            const updatedFile = resolveVarsAndUpdateFilePath(puzzleConfig, file, varList);
            allWriteFiles.push(updatedFile);
        },
    };

    for (const module of modules) {
        if (module.setup && module.setup.prepare !== undefined) {
            await module.setup.prepare(actionContext);
        }
    }
    const {resultWriteFiles, resultReadFiles} = getWriteAndReadFilesFromTemplateFiles(workingDir, modules, varList);

    allWriteFiles.push(...resultWriteFiles);
    allReadFiles.push(...resultReadFiles);

    await resolveAllVars(allTemplateFiles, allReadFiles, allWriteFiles, varList, inquirerPrompt, defaultVarList);

    for (const module of modules) {
        if (module.setup && module.setup.setup !== undefined) {
            await module.setup.setup(actionContext);
        }
    }

    // make sure new variables are also prompted
    await resolveAllVars(allTemplateFiles, allReadFiles, allWriteFiles, varList, inquirerPrompt, defaultVarList);

    const promptFilePath = await getAndProcessPrompt(modules, actionContext, puzzleDir);

    const finalReadFiles = [...new Set(allReadFiles)];
    const finalWriteFiles = [...new Set(allWriteFiles)];

    const maxReadCount = 10;

    if (finalReadFiles.length > maxReadCount) {
        const continueQuestion = {
            type: 'confirm',
            name: 'continue',
            message: `Total referenced files is ${allReadFiles.length}, do you wish to continue?`,
        };

        let continueResponse = await inquirerPrompt(continueQuestion);

        if (!continueResponse['continue']) {
            console.log('Aborting action because of high read list count...');
            return;
        }
    }

    let filesLink = '';

    finalReadFiles
        .filter(filePath => !finalWriteFiles.includes(filePath))
        .forEach((filePath) => {
        filesLink += ` \\\n --read "${filePath}"`;
    });

    finalWriteFiles.forEach((filePath) => {
        ensureDirectoryExists(filePath);
        filesLink += ` \\\n --file "${filePath}"`;
    });

    let aiderArgs = puzzleConfig.aiderArgs;
    let additionalAiderCmd = '';

    for (let key in aiderArgs) {
        if (aiderArgs[key] === true) {
            additionalAiderCmd += ` \\\n --${key}`;
        } else {
            additionalAiderCmd += ` \\\n --${key} "${aiderArgs[key]}"`;
        }
    }

    const aiderCmd = `aider ${additionalAiderCmd} \\\n --message-file ${promptFilePath}${filesLink}`;
    console.log(`Executing command: ${aiderCmd}`);
    execSync(aiderCmd, {stdio: 'inherit'});

    fs.unlinkSync(promptFilePath);
}

async function resolveAllVars(
    allTemplateFiles,
    allReadFiles,
    allWriteFiles,
    varList,
    promptFnc,
    defaultVarList,
    modules) {
    const allFiles = [...allTemplateFiles, ...allReadFiles, ...allWriteFiles];
    allFiles.forEach((filePath) => {
        scanVariablesInFilePath(filePath, varList);
    });

    await promptVariables(varList, promptFnc, defaultVarList, allFiles);

    const updatedWriteFiles = updateFilePaths(allWriteFiles, varList);
    const updatedReadFiles = updateFilePaths(allReadFiles, varList);

    // keep the same array object
    allReadFiles.length = 0;
    allWriteFiles.length = 0;

    allReadFiles.push(...updatedReadFiles);
    allWriteFiles.push(...updatedWriteFiles);
}

async function promptVariables(varList, promptFnc, defaultVarList, allFiles) {
    for (const key of Object.keys(varList).sort()) {
        if (varList[key] === undefined) {
            // Find first file containing this variable
            const exampleFile = allFiles.find(file => file.includes(`{${key}}`));
            const simplifiedPath = simplifyPathWithVariable(exampleFile, key);
            const message = exampleFile
                ? `Please provide a value for ${key} (used in ...${path.sep}${simplifiedPath}):`
                : `Please provide a value for ${key}:`;

            const promptRes = await promptFnc({
                type: 'input',
                name: key,
                default: key in defaultVarList ? defaultVarList[key] : undefined,
                message: message,
            });

            varList[key] = promptRes[key];
        }
    }
}

module.exports = {
    processAction
};
