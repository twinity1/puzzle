const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { search } = require('@inquirer/prompts');
const {
    scanVariablesInFilePath,
    updateFilePaths,
    simplifyPathWithVariable,
    getChoicesForVariable, promptVariables
} = require('./modules/variableHandler');
const { ask } = require('./llm/ask');
const { getFilesFromSection, ensureDirectoryExists, getLineContinuation, unfoldWildcards} = require('./utils/fileUtils');
const { isGitReadRequested, isGitWriteRequested } = require('./utils/git');
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
    // Find the action module (non-common module)
    const actionModule = modules.find(m => m.dir && !m.dir.endsWith('common'));
    const piecePath = actionModule ? actionModule.dir : undefined;

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
        varListTypes: {},  // Store variable types
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

    await resolveAllVars(allTemplateFiles, allReadFiles, allWriteFiles, varList, inquirerPrompt, defaultVarList, modules, actionContext.varListTypes, piecePath);

    for (const module of modules) {
        if (module.setup && module.setup.setup !== undefined) {
            await module.setup.setup(actionContext);
        }
    }

    // make sure new variables are also prompted
    await resolveAllVars(allTemplateFiles, allReadFiles, allWriteFiles, varList, inquirerPrompt, defaultVarList, modules, actionContext.varListTypes, piecePath);

    const prompt = await getAndProcessPrompt(modules, actionContext, puzzleDir);

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
    const lineContinuation = getLineContinuation();

    finalReadFiles
        .filter(filePath => !finalWriteFiles.includes(filePath))
        .forEach((filePath) => {
        filesLink += `${lineContinuation} --read "${filePath}"`;
    });

    finalWriteFiles.forEach((filePath) => {
        ensureDirectoryExists(filePath);
        filesLink += `${lineContinuation} --file "${filePath}"`;
    });

    let additionalAiderCmd = buildAiderCmdArgs(puzzleConfig.aiderArgs);

    if (varList['CHAT'] === true) {
        const aiderCmd = `puzzle-proxy ${additionalAiderCmd}${filesLink}`;

        console.log(`Executing command: ${aiderCmd}`);

        execSync(aiderCmd, {stdio: 'inherit', env: {...process.env, ...{
                    PUZZLE_PROMPT: prompt,
        }}});
    } else {
        const aiderCmd = `puzzle-proxy ${additionalAiderCmd}${lineContinuation} ${filesLink}`;

        execSync(aiderCmd, {stdio: 'inherit', env: {...process.env, ...{
                    AIDER_MESSAGE: prompt,
                }}});
    }
}

async function resolveAllVars(
    allTemplateFiles,
    allReadFiles,
    allWriteFiles,
    varList,
    promptFnc,
    defaultVarList,
    modules,
    varListTypes,
    piecePath) {
    const allFiles = [...allTemplateFiles, ...allReadFiles, ...allWriteFiles];
    allFiles.forEach((filePath) => {
        scanVariablesInFilePath(filePath, varList);
    });

    await promptVariables(varList, promptFnc, defaultVarList, allFiles, varListTypes, piecePath);

    const updatedWriteFiles = updateFilePaths(allWriteFiles, varList);
    const updatedReadFiles = unfoldWildcards(updateFilePaths(allReadFiles, varList))
        .filter(filePath => fs.existsSync(filePath));

    // keep the same array object
    allReadFiles.length = 0;
    allWriteFiles.length = 0;

    allReadFiles.push(...updatedReadFiles);
    allWriteFiles.push(...updatedWriteFiles);
}

function buildAiderCmdArgs(aiderArgs) {
    let additionalAiderCmd = '';
    const lineContinuation = getLineContinuation();

    for (let key in aiderArgs) {
        if (aiderArgs[key] === undefined || aiderArgs[key] === null) {
            continue;
        }

        if (aiderArgs[key] === true) {
            additionalAiderCmd += `${lineContinuation} --${key}`;
        } else {
            additionalAiderCmd += `${lineContinuation} --${key} "${aiderArgs[key]}"`;
        }
    }
    return additionalAiderCmd;
}

module.exports = {
    processAction
};
