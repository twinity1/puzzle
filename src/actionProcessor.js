const fs = require('fs');
const path = require('path');
const { search } = require('@inquirer/prompts');
const fg = require('fast-glob');
const {
    scanVariablesInFilePath,
    updateFilePaths,
    simplifyPathWithVariable,
    getChoicesForVariable, promptVariables
} = require('./modules/variableHandler');
const { ask } = require('./llm/ask');
const { getFilesFromSection, ensureDirectoryExists, getLineContinuation, unfoldWildcards, findMatchingFilesWithGroups} = require('./utils/fileUtils');
const { isGitReadRequested, isGitWriteRequested } = require('./utils/git');
const { getAllModules } = require('./modules/moduleHandler');
const { getWriteAndReadFilesFromTemplateFiles, resolveVarsAndUpdateFilePath } = require('./modules/fileHandler');
const { getAndProcessPrompt } = require('./modules/promptHandler');
const { findMatchingFiles } = require('./utils/fileUtils');

async function processAction(
    action,
    varList,
    puzzleDir,
    workingDir,
    inquirerPrompt,
    defaultVarList,
    puzzleConfig,
    modifiedGitFiles,
    isBatchMode = false
    ) {
    printAction(action, isBatchMode ? varList['FILE'] : null);
    
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

    await executeAiderCommand(varList, additionalAiderCmd, filesLink, lineContinuation, prompt, puzzleConfig, inquirerPrompt);
}

function printAction(action, batchFile = null) {
    if (action === 'virtual-chat' || action === 'puzzle-batch') {
        return;
    }
    
    const baseText = batchFile 
        ? `🎯 Performing action: ${action} on ${batchFile}`
        : `🎯 Performing action: ${action}`;
    const width = baseText.length + 2; // Add 2 for padding
    const border = '═'.repeat(width);

    console.log(`\x1b[35m╔${border}╗\x1b[0m`);
    console.log(`\x1b[35m║\x1b[0m 🎯 Performing action: \x1b[36m${action}\x1b[0m \x1b[35m║\x1b[0m`);
    console.log(`\x1b[35m╚${border}╝\x1b[0m`);
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

        if (key === 'read') {
            const paths = Array.isArray(aiderArgs[key]) 
                ? aiderArgs[key] 
                : aiderArgs[key].split(',');
            
            paths.forEach(readPath => {
                if (readPath.trim()) {
                    const expandedPaths = findMatchingFiles(readPath.trim());
                    expandedPaths.forEach(path => {
                        additionalAiderCmd += `${lineContinuation} --read "${path}"`;
                    });
                }
            });
            continue;
        }

        if (aiderArgs[key] === false) {
            additionalAiderCmd += `${lineContinuation} --no-${key}`;
        } else if (aiderArgs[key] === true) {
            additionalAiderCmd += `${lineContinuation} --${key}`;
        } else {
            additionalAiderCmd += `${lineContinuation} --${key} "${aiderArgs[key]}"`;
        }
    }
    return additionalAiderCmd;
}


const { BatchProcessor } = require('./modules/batchProcessor');
const { buildChatCommand, executeCommand } = require('./utils/commandBuilder');

async function processSingleFile(varList, additionalAiderCmd, filesLink, lineContinuation, prompt) {
    const command = buildChatCommand(additionalAiderCmd, filesLink, lineContinuation, varList['CHAT']);
    const env = varList['CHAT'] ? { PUZZLE_PROMPT: prompt } : { AIDER_MESSAGE: prompt };
    executeCommand(command, env);
}

async function executeAiderCommand(
    varList,
    additionalAiderCmd,
    filesLink,
    lineContinuation,
    prompt,
    puzzleConfig,
    inquirerPrompt) {
    if (varList['BATCH_PATTERN']) {
        const fileGroups = findMatchingFilesWithGroups(varList['BATCH_PATTERN']);
        const batchProcessor = new BatchProcessor(fileGroups, varList, puzzleConfig);
        await batchProcessor.process(additionalAiderCmd, filesLink, lineContinuation, inquirerPrompt);
    } else {
        await processSingleFile(varList, additionalAiderCmd, filesLink, lineContinuation, prompt);
    }
}

module.exports = {
    processAction
};
