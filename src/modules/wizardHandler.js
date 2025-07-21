const fs = require('fs');
const path = require('path');
const { ensureDirectoryExists, findMatchingFiles } = require('../utils/fileUtils');
const { aider } = require('../llm/ask');

async function getPieceName(inquirerPrompt) {
    const { pieceName } = await inquirerPrompt({
        type: 'input',
        name: 'pieceName',
        message: 'Enter the name for your new piece:\n' +
                 '\x1b[90m(A piece is a template for code scaffolding, like "PostApiEndpoint")\x1b[0m\n' +
                 'Examples: \x1b[36m"Documentation"\x1b[0m, \x1b[36m"EntityListingScreen"\x1b[0m, \x1b[36m"IntegrationTest"\x1b[0m\n' +
                 '\x1b[33mYour piece name:\x1b[0m',
        validate: (input) => {
            if (/^[a-zA-Z0-9-_]+$/.test(input)) return true;
            return '\x1b[31mPlease use only letters, numbers, hyphens and underscores\x1b[0m';
        }
    });
    console.log(`Piece name selected: ${pieceName}`);
    return pieceName;
}

/**
 * Creates directory structure for a new piece
 * @param {string} pieceDir - The piece directory path
 * @returns {Object} - Object containing paths to important directories
 */
function createPieceDirectories(pieceDir) {
    const templateDir = path.join(pieceDir, 'template');
    const extraDir = path.join(pieceDir, 'extra');
    const examplesDir = path.join(extraDir, 'examples');
    
    fs.mkdirSync(pieceDir, { recursive: true });
    fs.mkdirSync(templateDir, { recursive: true });
    fs.mkdirSync(extraDir, { recursive: true });
    fs.mkdirSync(examplesDir, { recursive: true });
    
    return { templateDir, extraDir, examplesDir };
}

/**
 * Creates the setup.mjs file with template content
 * @param {string} pieceDir - The piece directory path
 * @param {string} pieceName - The name of the piece
 * @returns {string} - Path to the created setup.mjs file
 */
function createSetupFile(pieceDir, pieceName) {
    const setupPath = path.join(pieceDir, 'setup.mjs');
    const setupContent = `export async function prepare(context) {
    // Add read-only files for context (for example - endpoint needs to have some database entity to work with)
    // context.addReadFile('path/to/file');
    
    // Use can use variables in the template files
    // context.addReadFile('path/to/file/{ENTITY_NAME}.js');
    
    // And you can use glob patterns to add multiple files
    // context.addReadFile('path/to/files/**/*.js');
}

export async function setup(context) {
}

export async function prompt(context) {
    return {
        prompt: \`Create files for the ${pieceName} piece.\` // change this prompt to something more specific to your piece
    };
}`;

    fs.writeFileSync(setupPath, setupContent);
    return setupPath;
}

/**
 * Checks if a piece already exists and asks for confirmation to overwrite
 * @param {string} pieceDir - The piece directory path
 * @param {string} pieceName - The name of the piece
 * @param {Function} inquirerPrompt - The inquirer prompt function
 * @returns {Promise<boolean>} - True if the piece can be created/overwritten
 */
async function checkExistingPiece(pieceDir, pieceName, inquirerPrompt) {
    if (!fs.existsSync(pieceDir)) {
        return true;
    }
    
    const { overwritePiece } = await inquirerPrompt({
        type: 'confirm',
        name: 'overwritePiece',
        message: `A piece named '${pieceName}' already exists. Do you want to overwrite it?`,
        default: false
    });

    if (!overwritePiece) {
        console.log('Piece creation cancelled.');
        return false;
    }

    console.log(`Removing existing piece directory: ${pieceDir}`);
    fs.rmSync(pieceDir, { recursive: true, force: true });
    return true;
}

/**
 * Prompts the user for reference files
 * @param {Function} inquirerPrompt - The inquirer prompt function
 * @returns {Promise<Array<string>>} - Array of reference file paths
 */
async function promptForReferenceFiles(inquirerPrompt) {
    console.log('\n\x1b[36mNow, let\'s add some reference files for your piece.\x1b[0m');
    console.log('\x1b[90mThese files will help when creating templates based on your existing code.\x1b[0m');
    
    const { referenceFiles } = await inquirerPrompt({
        type: 'editor',
        name: 'referenceFiles',
        message: 'Enter paths to reference files (one per line):',
        default: '# Enter file paths relative to repository root\n\n# Individual files:\n# src/controllers/UserController.js\n# src/models/User.js\n\n# Glob patterns (will match multiple files):\n# src/models/*.js\n# src/controllers/**/*.js\n\n# Directories (will include all files recursively):\n# src/views/\n# src/components'
    });
    
    if (!referenceFiles || !referenceFiles.trim()) {
        return [];
    }
    
    return referenceFiles
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
}

/**
 * Expands file paths, handling glob patterns and directories
 * @param {Array<string>} files - Array of file paths
 * @returns {Array<string>} - Array of expanded file paths
 */
function expandFilePaths(files) {
    const { findMatchingFiles } = require('../utils/fileUtils');
    
    const expandedPaths = [];
    
    for (const file of files) {
        const isDirectory = file.endsWith('/') || file.endsWith('\\') || 
                           (fs.existsSync(file) && fs.statSync(file).isDirectory());
        
        if (file.includes('*')) {
            // It's a glob pattern, use findMatchingFiles
            const matches = findMatchingFiles(file);
            if (matches.length > 0) {
                expandedPaths.push(...matches);
            } else {
                // If no matches found, keep the original pattern
                expandedPaths.push(file);
            }
        } else if (isDirectory) {
            // It's a directory, convert to glob pattern and find matches
            const dirPath = file.endsWith('/') || file.endsWith('\\') ? file : `${file}/`;
            const globPattern = `${dirPath}**/*`;
            const matches = findMatchingFiles(globPattern);
            
            if (matches.length > 0) {
                expandedPaths.push(...matches);
            } else {
                // If no matches found, keep the original directory pattern
                expandedPaths.push(globPattern);
            }
        } else {
            // Regular file path
            expandedPaths.push(file);
        }
    }
    
    return expandedPaths;
}

/**
 * Displays information about the created piece
 * @param {string} pieceName - The name of the piece
 * @param {string} pieceDir - The piece directory path
 */
function displayPieceInfo(pieceName, pieceDir) {
    console.log(`\n✅ Piece '${pieceName}' created successfully!`);
    
    // Get actual directory structure
    const dirStructure = [];
    
    function buildDirTree(dir, prefix = '', isLast = true) {
        const dirName = path.basename(dir);
        const displayName = dir === pieceDir ? `📁 ${dir}` : `📁 ${dirName}`;
        dirStructure.push(`${prefix}${isLast ? '└── ' : '├── '}${displayName}`);
        
        const items = fs.readdirSync(dir, { withFileTypes: true });
        const dirs = items.filter(item => item.isDirectory());
        const files = items.filter(item => item.isFile());
        
        // Process directories
        dirs.forEach((d, i) => {
            const isLastDir = i === dirs.length - 1 && files.length === 0;
            const newPrefix = prefix + (isLast ? '    ' : '│   ');
            buildDirTree(path.join(dir, d.name), newPrefix, isLastDir);
        });
        
        // Process files
        files.forEach((f, i) => {
            const isLastFile = i === files.length - 1;
            dirStructure.push(`${prefix}${isLast ? '    ' : '│   '}${isLastFile ? '└── ' : '├── '}📄 ${f.name}`);
        });
    }
    
    // Build directory tree
    buildDirTree(pieceDir);
    
    console.log(`\nDirectory structure created:`);
    dirStructure.forEach(line => console.log(line));
    
    console.log(`\nNext steps:`);
    console.log(`1. Add template files to the template/ directory`);
    console.log(`2. Edit setup.mjs to configure your piece`);
    console.log(`3. Run 'puzzle' to use your new piece`);
}

/**
 * Prompts the user for template creation
 * @param {Function} inquirerPrompt - The inquirer prompt function
 * @returns {Promise<{createTemplates: boolean, useSonnet: boolean}>} - User choices
 */
async function promptForTemplateCreation(inquirerPrompt) {
    const { createTemplates } = await inquirerPrompt({
        type: 'confirm',
        name: 'createTemplates',
        message: '\n\x1b[36mWould you like to generate template files using Aider?\x1b[0m',
        default: true
    });
    
    let useSonnet = false;
    
    if (createTemplates) {
        const { confirmSonnet } = await inquirerPrompt({
            type: 'confirm',
            name: 'confirmSonnet',
            message: '\n\x1b[36mWould you like to use Claude Sonnet for better template generation?\x1b[0m\n' +
                     '\x1b[90mNote: The model configured in .aider.conf.yml will be used.\x1b[0m\n' +
                     '\x1b[90mRecommendation: Claude Sonnet provides excellent results for code generation.\x1b[0m',
            default: true
        });
        
        useSonnet = confirmSonnet;
    }
    
    return { createTemplates, useSonnet };
}

/**
 * Creates template files using AI
 * @param {string} puzzleDir - The puzzle directory path
 * @param {string} pieceDir - The piece directory path
 * @param {string} pieceName - The name of the piece
 * @param {Array<string>} referenceFiles - Array of reference file paths
 * @param {boolean} useSonnet - Whether to use Claude Sonnet model
 */
async function createTemplateFiles(puzzleDir, pieceDir, pieceName, referenceFiles, useSonnet) {
    const { aider } = require('../llm/ask');
    const templateDir = path.join(pieceDir, 'template');
    
    console.log('\n\x1b[36mGenerating template files using AI...\x1b[0m');
    console.log('\x1b[90mThis may take a moment depending on the complexity of your reference files.\x1b[0m');
    
    // Set up options for aider
    const aiderOptions = {};
    
    if (useSonnet) {
        console.log('\x1b[36mUsing Claude Sonnet for template generation.\x1b[0m');
        aiderOptions.model = "openrouter/anthropic/claude-3.5-sonnet";
        console.log('\x1b[90mUsing model: openrouter/anthropic/claude-3.5-sonnet\x1b[0m');
    }
    
    try {
        // Get all files in the template directory
        const templateFiles = [];
        
        // Create a list of potential template files based on reference files
        referenceFiles.forEach(refFile => {
            try {
                // Get the relative path from the repo root
                const relativePath = path.relative(process.cwd(), refFile);
                
                // Skip files that are outside the repo
                if (relativePath.startsWith('..')) return;
                
                // Create a template path with variables
                let templatePath = relativePath;
                
                // Extract potential entity names from the file path
                const pathParts = relativePath.split(path.sep);
                const fileName = pathParts[pathParts.length - 1];
                
                // Replace potential entity names with variables
                // Example: UserController.js -> {ENTITY_NAME}Controller.js
                const fileNameParts = fileName.split('.');
                if (fileNameParts.length > 1) {
                    const baseName = fileNameParts[0];
                    const extension = fileNameParts.slice(1).join('.');
                    
                    // Check if the base name has camel or pascal case that could be an entity
                    if (/^[A-Z][a-zA-Z0-9]*$/.test(baseName)) {
                        // Pascal case like UserController
                        templatePath = templatePath.replace(baseName, '{ENTITY_NAME}');
                    } else if (/^[a-z]+([A-Z][a-zA-Z0-9]*)+$/.test(baseName)) {
                        // Camel case like userController
                        templatePath = templatePath.replace(baseName, '{entity_name}');
                    }
                }
                
                // Add to template files list
                templateFiles.push(path.join(templateDir, templatePath));
            } catch (error) {
                // Skip files that cause errors
                console.error(`Error processing reference file ${refFile}: ${error.message}`);
            }
        });
        
        const prompt = `Your task is to create a set of template files for a new software component (a "piece") named "${pieceName}".
You will be given a set of reference files that demonstrate the desired structure and style.

**Instructions for creating template files:**

1.  **File and Directory Structure:**
    *   Replicate the file and directory structure of the reference files.
    *   In file and directory names, replace specific names (like \`User\`, \`Product\`, \`Client\`) with generic, uppercase placeholder variables (e.g., {ENTITY_NAME}, {MODULE_NAME}).
    *   For example, \`src/api/services/UserService.js\` should become \`src/api/services/{ENTITY_NAME}Service.js\`.
    *   **IMPORTANT**: Do not use the word "Example" in file or directory names.

2.  **File Content:**
    *   The content of the template files should be generic and reusable.
    *   Replace any hardcoded names from the reference files (e.g., \`User\`, \`UserService\`) with generic but descriptive placeholders (e.g., \`ExampleEntity\`, \`ExampleService\`).
    *   **CRITICAL**: Do not use the \`{VARIABLE_NAME}\` syntax inside the file content. This syntax is ONLY for file and directory names. Using it in the code will create syntax errors.
    *   The generated code in each file must be syntactically correct and serve as a clear, working example.

3.  **\`setup.mjs\` file:**
    *   You will be provided a \`setup.mjs\` file.
    *   Analyze the user's goal and the reference files to determine what the user is trying to achieve.
    *   Based on your analysis, **update the \`prompt()\` function** in \`setup.mjs\` with a descriptive prompt that will be used to generate the final code from these templates.
    *   **DO NOT MODIFY** the \`prepare()\` function in \`setup.mjs\`.

**Goal:** The final output should be a set of high-quality, reusable template files and an updated \`setup.mjs\` that together can be used to scaffold new components. Create the template files in the \`template/\` directory.`;

        // Call aider to generate templates
        await aider(puzzleDir, prompt, referenceFiles, templateFiles, aiderOptions);
        
        // Count created files
        let filesCreated = 0;
        if (fs.existsSync(templateDir)) {
            const countFiles = (dir) => {
                let count = 0;
                const items = fs.readdirSync(dir, { withFileTypes: true });
                
                for (const item of items) {
                    if (item.isDirectory()) {
                        count += countFiles(path.join(dir, item.name));
                    } else {
                        count++;
                    }
                }
                
                return count;
            };
            
            filesCreated = countFiles(templateDir);
        }
        
        console.log(`\n✅ Created ${filesCreated} template files in the template directory`);
    } catch (error) {
        console.error('\n\x1b[31mError generating template files:\x1b[0m', error);
        console.log('\x1b[33mYou can still create template files manually in the template directory.\x1b[0m');
    }
}

/**
 * Creates a new piece with the given name
 * @param {string} puzzleDir - The puzzle directory path
 * @param {Function} inquirerPrompt - The inquirer prompt function
 * @returns {Promise<Object|null>} - Object containing the piece name or null if cancelled
 */
async function createNewPiece(puzzleDir, inquirerPrompt) {
    console.log('Starting new piece creation process...');

    const pieceName = await getPieceName(inquirerPrompt);
    
    // Create piece directory and setup.mjs file
    const piecesDir = path.join(puzzleDir, 'pieces');
    const pieceDir = path.join(piecesDir, pieceName);
    
    // Check if piece already exists
    if (!await checkExistingPiece(pieceDir, pieceName, inquirerPrompt)) {
        return null;
    }
    
    // Create directories
    createPieceDirectories(pieceDir);
    
    // Create setup.mjs file
    const setupPath = createSetupFile(pieceDir, pieceName);
    
    // Get reference files
    const files = await promptForReferenceFiles(inquirerPrompt);
    let expandedFiles = [];
    
    // Process reference files
    if (files.length > 0) {
        expandedFiles = expandFilePaths(files);
        
        console.log('\n\x1b[36mExpanded reference files:\x1b[0m');
        expandedFiles.forEach(file => console.log(`- ${file}`));
        
        // Ask if user wants to create template files
        const { createTemplates, useSonnet } = await promptForTemplateCreation(inquirerPrompt);
        
        if (createTemplates) {
            await createTemplateFiles(puzzleDir, pieceDir, pieceName, expandedFiles, useSonnet);
        }
    }
    
    // Display information
    displayPieceInfo(pieceName, pieceDir);
    
    return { pieceName };
}

module.exports = {
    createNewPiece,
    // Export helper functions for testing
    _internal: {
        createPieceDirectories,
        createSetupFile,
        checkExistingPiece,
        promptForReferenceFiles,
        expandFilePaths,
        displayPieceInfo,
        promptForTemplateCreation,
        createTemplateFiles
    }
};
