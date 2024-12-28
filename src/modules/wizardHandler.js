const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { ensureDirectoryExists } = require('../fileUtils');
const { ask, aider} = require('../llm/ask');

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
        message: 'Provide description for the piece?'
    });
    return pieceInfo;
}

async function createNewPiece(puzzleDir, inquirerPrompt) {
    console.log('Starting new piece creation process...');

    const pieceName = await getPieceName(inquirerPrompt);
    const pieceInfo = await getPieceInfo(inquirerPrompt);

    // Interactive file selection process
    let readFiles = [];
    let continueSelecting = true;
    let selectFilesTries = 0;

    while (continueSelecting) {
        let filesPrompt = '';
        if (selectFilesTries > 0) {
            const { filesPrompt: newPrompt } = await inquirerPrompt({
                type: 'input',
                name: 'filesPrompt',
                message: 'Which files should be changed?',
            });
            filesPrompt = `Requirement: ${newPrompt}`;
        }

        const gitFiles = getGitTrackedFiles();

        const aiPrompt = `
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
${gitFiles.join('\n')}
`;

        try {
            readFiles = JSON.parse(await ask(puzzleDir, aiPrompt));
        } catch (error) {
            console.error('Error getting AI file suggestions:', error);
        }

        // Show current selection
        if (readFiles.length > 0) {
            console.log('\nCurrently selected files:');
            readFiles.forEach(file => console.log(`- ${file}`));
        }

        const { continue: shouldContinue } = await inquirerPrompt({
            type: 'confirm',
            name: 'continue',
            message: 'Would you like to add more files?',
            default: false
        });

        continueSelecting = shouldContinue;
        selectFilesTries++;
    }

    const setupMjsPrompt = `
    and here's an example of setup.mjs

export async function prepare(context) {
    context.addReadFile('templates/backend/domain/src/data/entities/ENTITY_NAME}.ts');
}
    
export async function setup(context) {
}

export async function prompt(context) {
    return {
        prompt: \`Implement the operation: \${context.vars['PIECE_NAME']} for entity \${context.vars['ENTITY_NAME']} in module \${context.vars['MODULE_NAME']}.
        Replace "Example" with the name of the entity.
        Reference the action \${context.vars['PIECE_NAME']} operation like in attached example files.
        Add endpoint to a controller. Be precise to the example files as you can.\`
    };
}

and it can get complex like this:

import path from 'path';

let queries = [
    'CustomQuery',
    'Detail',
    'List',
    'ListEnum',
];

let commands = [
    'Create',
    'CustomCommand',
    'Delete',
    'Update'
];

export async function prepare(context) {
    if (context.vars.ENTITIES) {
        context.addReadFile('be/core/src/DAL/Data/Entities/*.cs');
    }

    if (commands.includes(context.vars['PIECE_NAME']) ) {
        context.addReadFile('dev/puzzle/common/custom/ExampleValidator.cs');
        context.addReadFile('be/modules/abstraction/src/Modules.Abstraction/Api/Dto/RelationDto.cs');
        context.addWriteFile('be/core/src/BL/Core.Common/Errors/ErrorCodes.cs');
    }
}

export async function setup(context) {
    if (context.vars.ENTITIES) {
        context.addReadFile('be/core/src/DAL/Data/Entities/*.cs');
    }

    if (commands.includes(context.vars['PIECE_NAME'])) {
        const validatorPath = nextTo(context.writeFiles, 'Command.cs', 'Validator');
        context.addWriteFile(validatorPath);
    }
}

export async function prompt(context) {
    if (context.vars['ENTERED_CUSTOM_PROMPT']) {
        return context.vars['ENTERED_CUSTOM_PROMPT'];
    }
    
    if (context.vars['CUSTOM-PROMPT']) {
        const {userPrompt} = await context.inquirerPrompt({
            type: 'editor',
            name: 'userPrompt',
            default: 'ENTERED_CUSTOM_PROMPT' in context.defaultVars ? context.defaultVars['ENTERED_CUSTOM_PROMPT'] : undefined,
            message: \`Enter custom instructions.\`,
        });
        
        // no need to enter the prompt again for next action
        context.vars['ENTERED_CUSTOM_PROMPT'] = userPrompt;

        return userPrompt;
    }
    
    return null; 
}

function nextTo(files, targetFileExpression, appendFileName) {
    // Find the target file in the list of files
    const targetFile = files.find(file => file.includes(targetFileExpression));
    
    if (!targetFile) {
        return null;
    }

    // Get the directory and base name of the target file
    const targetDir = path.dirname(targetFile);
    const targetBase = path.basename(targetFile, path.extname(targetFile));

    // Construct the new file path with the appended file name
    const newFileName = \`\${targetBase}\${appendFileName}\${path.extname(targetFile)}\`;
    
    return path.join(targetDir, newFileName);
}`;

    // Prepare a comprehensive prompt for piece creation
    const promptMessage = `
You are helping to create a new piece for a software project.

piece = action 

Piece Name: ${pieceName}
Piece requirements (write files - template directory): ${pieceInfo}

- Files from the existing-working action are attached 
- Convert those files to some sort of neutral form (for example use word "example" for domain specific names
- Add variables to the directories/files names that could be common
 - for example services/financial/src/modules/invoices/logic.ts will be services/{SERVICE_NAME}/src/modules/{MODULE_NAME}/logic.ts
 - or Endpoints/CreateUser.cs, Endpoints/CreateUserDto.cs,  will be Endpoints/{ACTION_NAME}.cs, Endpoints/{ACTION_NAME}Dto.cs
- But don't use {} variables inside in file contents.. use word example to replace business specific naming - if you {} inside the file content, it will break the programming language syntax

(pay attention to the {} which are variables)
`;

    // Create the files and directories according to the AI-generated description
    const pieceDir = path.join(puzzleDir, 'pieces', pieceName);
    const templateDir = path.join(pieceDir, 'template');

    console.log('Trying to figure out piece template paths...')

    const writeFilesByAi = await ask(
        puzzleDir,
        `${promptMessage}
        
        Give me paths for those files, as json flat array (array of strings).
        Just fill variables in each path, do not change the path drastically! 
        
        ${readFiles.join('\n')}
        `,
        readFiles,
        []
    );

    console.log(writeFilesByAi);

    // Ensure write files are in the template directory
    const normalizedWriteFiles = JSON.parse(writeFilesByAi).map(filePath =>
        filePath.startsWith(templateDir) ? filePath : path.join(templateDir, filePath)
    );

    normalizedWriteFiles.push(path.join(pieceDir, 'setup.mjs'));

    console.log(normalizedWriteFiles.join('\n'));

    // Confirm before generating piece details
    const { confirmGeneration } = await inquirerPrompt({
        type: 'confirm',
        name: 'confirmGeneration',
        message: 'Would you like to generate piece details using AI?',
        default: true
    });

    if (!confirmGeneration) {
        console.log('Piece generation cancelled.');
        return null;
    }

    // Check if the piece already exists
    if (fs.existsSync(pieceDir)) {
        const { overwritePiece } = await inquirerPrompt({
            type: 'confirm',
            name: 'overwritePiece',
            message: `A piece named '${pieceName}' already exists. Do you want to overwrite it?`,
            default: false
        });

        if (!overwritePiece) {
            console.log('Piece creation cancelled.');
            return null;
        }

        // Remove existing piece directory
        console.log(`Removing existing piece directory: ${pieceDir}`);
        fs.rmSync(pieceDir, { recursive: true, force: true });
    }

    // Use AI to generate piece details
    console.log('Generating piece details using AI...');
    await aider(
        puzzleDir,
        `${promptMessage} \n\n${setupMjsPrompt}`,
        readFiles,
        normalizedWriteFiles);
    console.log('AI piece details generated successfully');

    // Add message that piece is created with AI assistance
    console.log(`Piece '${pieceName}' created 🔥!`);

    return { pieceName };
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
