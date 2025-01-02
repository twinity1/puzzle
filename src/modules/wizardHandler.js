const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { ensureDirectoryExists } = require('../fileUtils');
const { ask, aider} = require('../llm/ask');

const README_CONTENT = fs.readFileSync(path.join(__dirname, '../../README.md'), 'utf8');
const USAGE_CONTENT = fs.readFileSync(path.join(__dirname, '../../USAGE.md'), 'utf8')
    .replace(/## Create Piece Using the Wizard[\s\S]*?(?=## Creating a Piece)/, ''); // do not confuse the LLM with this

const softwareDescription = `
You are helping to create a new piece for a software project.:

README.md

${README_CONTENT}

USAGE.md

${USAGE_CONTENT}

Prompt:
`;

async function getPieceName(inquirerPrompt) {
    const { pieceName } = await inquirerPrompt({
        type: 'input',
        name: 'pieceName',
        message: 'Enter the name for your new piece:',
        validate: (input) => {
            if (/^[a-zA-Z0-9-_]+$/.test(input)) return true;
            return 'Please use only letters, numbers, hyphens and underscores';
        }
    });
    console.log(`Piece name selected: ${pieceName}`);
    return pieceName;
}

async function getPieceInfo(inquirerPrompt) {
    const { pieceInfo } = await inquirerPrompt({
        type: 'editor',
        name: 'pieceInfo',
        message: 'Describe what this piece should do (e.g. "Create "Read" endpoint for an entity that will be used in CRUD")\n' +
                 'Provide path to example files (controller, vue template, react template, repository, dto, etc.)'
    });
    return pieceInfo;
}

async function createNewPiece(puzzleDir, inquirerPrompt) {
    console.log('Starting new piece creation process...');

    const pieceName = await getPieceName(inquirerPrompt);
    const pieceInfo = await getPieceInfo(inquirerPrompt);
    const readFiles = await selectFilesForPiece(pieceInfo, inquirerPrompt, puzzleDir);

    if (!readFiles.length) {
        console.log('No files selected for piece creation.');
        return null;
    }

    const { pieceDir, normalizedWriteFiles } = await preparePieceStructure(
        puzzleDir,
        pieceName,
        pieceInfo,
        readFiles,
        inquirerPrompt
    );

    if (!pieceDir) {
        return null;
    }

    await generatePieceDetails(puzzleDir, pieceName, pieceInfo, readFiles, normalizedWriteFiles);
    console.log(`Piece '${pieceName}' created 🔥!`);

    return { pieceName };
}

async function selectFilesForPiece(pieceInfo, inquirerPrompt, puzzleDir) {
    let readFiles = [];
    let continueSelecting = true;
    let selectFilesTries = 0;

    while (continueSelecting) {
        const filesPrompt = await getFilesPrompt(selectFilesTries, inquirerPrompt);
        const gitFiles = getGitTrackedFiles();

        if (!await confirmLargeFileProcessing(gitFiles, inquirerPrompt)) {
            continueSelecting = false;
            continue;
        }

        try {
            // Only try AI suggestions if we haven't failed before
            if (selectFilesTries === 0) {
                readFiles = await getAiFileSuggestions(pieceInfo, filesPrompt, readFiles, gitFiles, inquirerPrompt, puzzleDir);
            } else {
                throw new Error('Skipping AI suggestions after previous failure');
            }
        } catch (error) {
            console.error('Error getting AI file suggestions:');
            console.error(error.stack || error);

            // Offer manual file selection
            const { manualFiles } = await inquirerPrompt({
                type: 'editor',
                name: 'manualFiles',
                message: 'Enter file paths manually (from root of the repo, one per line or comma separated):'
            });

            // Split input by newlines or commas and trim whitespace
            const newFiles = manualFiles.split(/[\n,]/)
                .map(file => file.trim())
                .filter(file => file.length > 0);

            // Add only files that exist in git repository
            const gitFiles = getGitTrackedFiles();
            newFiles.forEach(file => {
                if (gitFiles.includes(file) && !readFiles.includes(file)) {
                    readFiles.push(file);
                }
            });
        }

        continueSelecting = await confirmContinueSelection(readFiles, inquirerPrompt);
        selectFilesTries++;
    }

    return readFiles;
}

async function getFilesPrompt(selectFilesTries, inquirerPrompt) {
    if (selectFilesTries > 0) {
        const { filesPrompt: newPrompt } = await inquirerPrompt({
            type: 'input',
            name: 'filesPrompt',
            message: 'Which files should be changed?',
        });
        return `Requirement: ${newPrompt}`;
    }
    return '';
}

async function confirmLargeFileProcessing(gitFiles, inquirerPrompt) {
    if (gitFiles.length > 500) {
        // Calculate total characters in all file paths
        const totalChars = gitFiles.reduce((sum, file) => sum + file.length, 0);
        // Estimate tokens using OpenAI's formula: ~1 token per 4 characters
        const estimatedTokens = Math.ceil(totalChars / 4);

        const { continueWithLargeFiles } = await inquirerPrompt({
            type: 'confirm',
            name: 'continueWithLargeFiles',
            message: `Warning: Found ${gitFiles.length} files. Processing this many file names (content of files is not exposed!) may use significant LLM tokens (~${estimatedTokens} tokens). Continue?`,
            default: true
        });
        return continueWithLargeFiles;
    }
    return true;
}

async function getAiFileSuggestions(pieceInfo, filesPrompt, readFiles, gitFiles, inquirerPrompt, puzzleDir) {
    // Create a tree structure from the file paths
    const pathTree = {};

    gitFiles.forEach(filePath => {
        const parts = filePath.split(path.sep);
        let currentLevel = pathTree;

        parts.forEach((part, index) => {
            if (!currentLevel[part]) {
                currentLevel[part] = {};
            }
            currentLevel = currentLevel[part];
        });
    });

    // Convert tree to compact string representation
    const buildTreeString = (node, indent = '') => {
        let result = '';
        Object.keys(node).forEach(key => {
            result += `${indent}${key}\n`;
            if (Object.keys(node[key]).length > 0) {
                result += buildTreeString(node[key], indent + '  ');
            }
        });
        return result;
    };

    const gitFilesString = buildTreeString(pathTree);

    const aiPrompt = `
${softwareDescription}
        
You will be trying to find files for scaffolding template.
Files will be used as example for scaffolding.
        
Find files according to description.
Description of the scaffolding: ${pieceInfo}

${filesPrompt}

Currently selected files: ${readFiles.join(', ')}

Can you suggest additional relevant files that should be included? Return the whole list.
Suggest only existing files!!
Provide JSON array (flat array) of file paths from the repository that are most relevant.

Available files in repository:
${gitFilesString}
`;

    const result = await ask(puzzleDir, aiPrompt, [], []);
    return JSON.parse(result);
}

async function confirmContinueSelection(readFiles, inquirerPrompt) {
    if (readFiles.length > 0) {
        console.log('\nCurrently selected files:');
        readFiles.forEach(file => console.log(`- ${file}`));
    }

    const { continue: shouldContinue } = await inquirerPrompt({
        type: 'confirm',
        name: 'continue',
        message: 'Would you like to add/remove more files?',
        default: false
    });

    return shouldContinue;
}

async function generateAndValidateTemplatePaths(puzzleDir, pieceName, pieceInfo, readFiles, templateDir, inquirerPrompt) {
    const basePrompt = createPromptMessage(pieceName, pieceInfo);
    const initialPrompt = `${basePrompt}
        
        Complete this task:
        
        Give me paths for those files, as json flat array (array of strings).
        Just fill variables in each path, do not change the path (adding/removing dir in the file path is forbidden)!
        Each path must contain at least one variable. 
        
        If you find dir/part of file that could be common for future generating, then replace the variable in the path.
        For example {SERVICE_NAME}, {MODULE_NAME}, Create{ENTITY_NAME}Endpoint.cs, {ENTITY_NANE}Component.vue, {APP_NAME}, etc.
        
        ${readFiles.join('\n')}`;

    let normalizedWriteFiles = [];
    let userSatisfied = false;
    let currentPrompt = initialPrompt;

    while (!userSatisfied) {
        const writeFilesByAi = JSON.parse(await ask(
            puzzleDir,
            currentPrompt,
            readFiles,
            []
        ));

        normalizedWriteFiles = writeFilesByAi.map(filePath =>
            filePath.startsWith(templateDir) ? filePath : path.join(templateDir, filePath)
        );

        console.log('\nGenerated template file paths:');
        normalizedWriteFiles.forEach(file => console.log(`- ${file}`));

        const { confirmFiles, modifyPrompt } = await inquirerPrompt([{
            type: 'confirm',
            name: 'confirmFiles',
            message: 'Are these template file paths correct?',
            default: true
        }, {
            type: 'input',
            name: 'modifyPrompt',
            message: 'Enter any corrections or additional instructions:',
            when: (answers) => !answers.confirmFiles,
            default: ''
        }]);

        if (confirmFiles) {
            userSatisfied = true;
        } else {

            currentPrompt = `${basePrompt}
                
                ${modifyPrompt}
                
                Here are the last generated file paths:
                ${writeFilesByAi.join('\n')}
                
                Update the file paths based on these instructions.
                Return the updated paths as a JSON array.`;
        }
    }

    return normalizedWriteFiles;
}

async function preparePieceStructure(puzzleDir, pieceName, pieceInfo, readFiles, inquirerPrompt) {
    // Step 1: Initialize directories
    const pieceDir = path.join(puzzleDir, 'pieces', pieceName);
    const templateDir = path.join(pieceDir, 'template');
    console.log('Trying to figure out piece template paths...');

    // Step 2: Generate and validate template paths
    const normalizedWriteFiles = await generateAndValidateTemplatePaths(
        puzzleDir,
        pieceName,
        pieceInfo,
        readFiles,
        templateDir,
        inquirerPrompt
    );

    // Step 3: Add setup.mjs to the file list
    normalizedWriteFiles.push(path.join(pieceDir, 'setup.mjs'));

    // Step 4: Confirm final piece generation
    if (!await confirmPieceGeneration(pieceDir, inquirerPrompt)) {
        return { pieceDir: null, normalizedWriteFiles: [] };
    }

    return { pieceDir, normalizedWriteFiles };
}

function createPromptMessage(pieceName, pieceInfo) {
    return `
${softwareDescription}

Piece Name: ${pieceName}
Piece requirements: ${pieceInfo}

- Files from the existing-working action are attached
- Convert those files to some sort of neutral form - use word "example" for domain specific naming
- Do not use variables {} in file contents! Only in paths! 
`;
}

async function confirmPieceGeneration(pieceDir, inquirerPrompt) {
    if (fs.existsSync(pieceDir)) {
        const { overwritePiece } = await inquirerPrompt({
            type: 'confirm',
            name: 'overwritePiece',
            message: `A piece named '${pieceDir.split(path.sep).pop()}' already exists. Do you want to overwrite it?`,
            default: false
        });

        if (!overwritePiece) {
            console.log('Piece creation cancelled.');
            return false;
        }

        console.log(`Removing existing piece directory: ${pieceDir}`);
        fs.rmSync(pieceDir, { recursive: true, force: true });
    }

    const { confirmGeneration } = await inquirerPrompt({
        type: 'confirm',
        name: 'confirmGeneration',
        message: 'Would you like to generate piece details using AI?',
        default: true
    });

    if (!confirmGeneration) {
        console.log('Piece generation cancelled.');
        return false;
    }

    return true;
}

async function generatePieceDetails(puzzleDir, pieceName, pieceInfo, readFiles, normalizedWriteFiles) {
    const promptMessage = createPromptMessage(pieceName, pieceInfo);

    console.log('Generating piece details using AI...');
    await aider(
        puzzleDir,
        `${promptMessage}

Complete this task:
Create the template (piece) according to attached read-only files.
Do not add attached read-only files to prepare method as addReadFile('....') or don't mentioned them anywhere. Example files that you will generate will be sufficient as example.

This is the list of the read-only files that you will create the template from:
${readFiles.join('\n')}

Write result to those files:
${normalizedWriteFiles.join('\n')}
`,
        readFiles,
        normalizedWriteFiles);
    console.log('AI piece details generated successfully');
}

function getGitTrackedFiles() {
    // Get list of all tracked files using git ls-files
    const gitFiles = execSync('git ls-files', { encoding: 'utf-8' })
        .split('\n')
        .filter(file => file.trim() !== '');
    return gitFiles;
}

module.exports = {
    createNewPiece,
};
