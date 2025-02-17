const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { search } = require('@inquirer/prompts');
const fg = require('fast-glob');
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

function printAiderCommand(aiderCmd) {
    console.log(`\x1b[36mExecuting command:\x1b[0m \x1b[33m${aiderCmd.replace('puzzle-proxy', 'aider')}\x1b[0m`); // just print aider instead of puzzle-proxy => no need to confuse the use
}

function buildBatchCommand(additionalAiderCmd, filesLink, lineContinuation, file) {
    return `aider${additionalAiderCmd}${lineContinuation} ${filesLink}${lineContinuation}--file "${file}"`;
}

function buildChatCommand(additionalAiderCmd, filesLink, lineContinuation, isChat) {
    if (isChat) {
        return `puzzle-proxy ${additionalAiderCmd}${filesLink}`;
    }
    return `puzzle-proxy ${additionalAiderCmd}${lineContinuation} ${filesLink}`;
}

function executeCommand(command, env = {}) {
    printAiderCommand(command);
    execSync(command, {
        stdio: 'inherit',
        env: { ...process.env, ...env }
    });
}

async function processBatchFiles(varList, additionalAiderCmd, filesLink, lineContinuation, puzzleConfig, inquirerPrompt) {
    
    const files = findMatchingFiles(varList['BATCH_PATTERN']);
        

    if (files.length === 0) {
        console.error(`No files found matching pattern: ${varList['BATCH_PATTERN']}`);
        return;
    }
    
    // Check if any message parameter is set
    if (!varList['MESSAGE'] && !varList['MSG'] && !varList['MESSAGE_FILE']) {
        console.error('Error: One of the message parameters must be set (--message, --msg, --message-file)');
        console.error('Example: puzzle-batch "pattern" --msg "add comment to each class"');
        return;
    }

    console.log(`\x1b[36mFound ${files.length} files matching pattern:\x1b[0m \x1b[33m${varList['BATCH_PATTERN']}\x1b[0m`);
    console.log('\x1b[36mFiles to process:\x1b[0m');
    files
        .map(file => path.relative(puzzleConfig.repoPath, file))
        .forEach(file => console.log(`  \x1b[32m- ${file}\x1b[0m`));
    
    console.log('\x1b[33mNote: Each file will be processed individually with Aider command\x1b[0m');

    const { proceed } = await inquirerPrompt({
        type: 'confirm',
        name: 'proceed',
        message: 'Do you want to proceed with these files?',
        default: true
    });

    if (!proceed) {
        console.log('Batch processing cancelled.');
        return;
    }

    for (const file of files) {
        const currentIndex = files.indexOf(file) + 1;
        const progress = Math.round((currentIndex / files.length) * 100);
        const message = `Processing file: ${file}`;
        const stats = `Progress: ${progress}% (${currentIndex}/${files.length})`;
        const width = Math.max(message.length, stats.length) + 4;
        const border = '━'.repeat(width);
        
        console.log('\n');
        console.log(`\x1b[31m┏${border}┓\x1b[0m`);
        console.log(`\x1b[31m┃\x1b[0m  ${stats.padEnd(width - 2)}  \x1b[31m┃\x1b[0m`);
        console.log(`\x1b[31m┃\x1b[0m  ${message.padEnd(width - 2)}  \x1b[31m┃\x1b[0m`);
        console.log(`\x1b[31m┗${border}┛\x1b[0m`);
        const command = buildBatchCommand(additionalAiderCmd, filesLink, lineContinuation, file);
        executeCommand(command);
    }
}

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
        await processBatchFiles(varList, additionalAiderCmd, filesLink, lineContinuation, puzzleConfig, inquirerPrompt);
    } else {
        await processSingleFile(varList, additionalAiderCmd, filesLink, lineContinuation, prompt);
    }
}

module.exports = {
    processAction
};
