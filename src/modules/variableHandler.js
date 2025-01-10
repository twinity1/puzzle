const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { search } = require('@inquirer/prompts');

function scanVariablesInFilePath(path, varList) {
    const varPattern = /\{(\w+)\}/g;
    let match;
    while ((match = varPattern.exec(path)) !== null) {
        if (!(match[1] in varList)) {
            varList[match[1]] = undefined;
        }
    }
}

function simplifyPathWithVariable(filePath, variableKey) {
    if (!filePath) return filePath;

    const parts = filePath.split(path.sep);
    const varIndex = parts.findIndex(part => part.includes(`{${variableKey}}`));

    if (varIndex === -1) return filePath;

    const highlightedParts = parts.map((part, index) => {
        if (index === varIndex) {
            // Color only the variable portion, keep the rest of segment gray
            const varPattern = new RegExp(`(\\{${variableKey}\\})`, 'g');
            return `\x1b[90m${part.replace(varPattern, '\x1b[34m$1\x1b[90m')}\x1b[0m`;
        }
        return `\x1b[90m${part}\x1b[0m`; // Gray for path segments
    });

    return [
        ...highlightedParts.slice(Math.max(0, varIndex - 2), varIndex),
        highlightedParts[varIndex],
        ...highlightedParts.slice(varIndex + 1, varIndex + 3)
    ].join(path.sep);
}

function updateFilePaths(files, varList) {
    const resultFiles = [];

    files.forEach((filePath) => {
        let updatedFilePath = filePath;

        for (const [key, value] of Object.entries(varList)) {
            if (!varList[key]) {
                continue;
            }

            // if the file exist that means it is the template, so no need to update this path
            if (fs.existsSync(updatedFilePath)) {
                continue;
            }

            const varPattern = new RegExp(`\\{${key}\\}`, 'g');
            updatedFilePath = updatedFilePath.replace(varPattern, varList[key]);
        }

        resultFiles.push(updatedFilePath);
    });

    return resultFiles;
}

function calculateVariableDepths(varList, allFiles) {
    const varDepths = {};
    for (const key of Object.keys(varList)) {
        const paths = allFiles.filter(file => file.includes(`{${key}}`));
        if (paths.length > 0) {
            varDepths[key] = Math.min(...paths.map(p => {
                const parts = p.split(path.sep);
                return parts.findIndex(part => part.includes(`{${key}}`));
            }));
        } else {
            varDepths[key] = Infinity;
        }
    }
    return varDepths;
}

function getSortedVariableKeys(varList, varDepths) {
    return Object.keys(varList).sort((a, b) => {
        const depthDiff = varDepths[a] - varDepths[b];
        return depthDiff !== 0 ? depthDiff : a.localeCompare(b);
    });
}

function buildPromptMessage(key, exampleFile) {
    const simplifiedPath = simplifyPathWithVariable(exampleFile, key);
    const coloredKey = `\x1b[34m${key}\x1b[0m`;
    return exampleFile
        ? `Please provide a value for ${coloredKey} (used in ...${path.sep}${simplifiedPath}):`
        : `Please provide a value for ${coloredKey}:`;
}

async function handleSearchPrompt(promptConfig, choices, promptFnc) {
    return search({
        message: promptConfig.message,
        source: async (input) => {
            if (!input) {
                let map = choices.map(c => ({value: c}));

                if (promptConfig.default) {
                    map = [
                        ...[{value: promptConfig.default, name: `\x1b[90m${promptConfig.default} (default)\x1b[0m`}],
                        ...map
                    ];
                }

                return map;
            }
            const searchTerm = input.toLowerCase();

            const filteredChoices = choices
                .filter(c => c.toLowerCase().includes(searchTerm))
                .map(c => ({value: c}));

            // Only add user input as a choice if it doesn't match any existing choices
            if (!choices.includes(input)) {
                filteredChoices.push({value: input});
            }

            return filteredChoices;
        },
        pageSize: 10,
    });
}

async function promptForVariable(key, varList, defaultVarList, allFiles, varListTypes, piecePath, promptFnc) {
    const exampleFile = allFiles.find(file => file.includes(`{${key}}`));
    const message = buildPromptMessage(key, exampleFile);

    let promptConfig = {
        name: key,
        message: message,
        default: key in defaultVarList ? defaultVarList[key] : undefined,
    };

    if (varListTypes[key]?.type === 'list') {
        const choices = await getChoicesForVariable(allFiles, key, varList, varListTypes[key], piecePath);
        promptConfig.type = 'list';
        promptConfig.choices = choices;
        const promptRes = await promptFnc(promptConfig);
        return promptRes[key];
    }

    if (varListTypes[key]?.type === 'input') {
        promptConfig.type = 'input';
        const promptRes = await promptFnc(promptConfig);
        return promptRes[key];
    }

    const choices = await getChoicesForVariable(allFiles, key, varList, varListTypes[key], piecePath);
    promptConfig.type = 'search';
    return await handleSearchPrompt(promptConfig, choices, promptFnc);
}

async function promptVariables(varList, promptFnc, defaultVarList, allFiles, varListTypes, piecePath) {
    const varDepths = calculateVariableDepths(varList, allFiles);
    const sortedKeys = getSortedVariableKeys(varList, varDepths);

    for (const key of sortedKeys) {
        if (varList[key] === undefined) {
            varList[key] = await promptForVariable(
                key,
                varList,
                defaultVarList,
                allFiles,
                varListTypes,
                piecePath,
                promptFnc
            );
        }
    }
}

async function getChoicesForVariable(allFiles, key, varList, typeConfig, piecePath) {
    const choices = new Set();

    allFiles = updateFilePaths(allFiles, varList);

    for (const file of allFiles) {
        if (file.includes(piecePath)) continue;

        if (!file.includes(`{${key}}`)) continue;

        const parts = file.split(path.sep);
        const varIndex = parts.findIndex(part => part.includes(`{${key}}`));

        if (varIndex >= 0) {
            // Get the path up to where the variable is used
            const pathUpToVar = parts.slice(0, varIndex).join(path.sep);
            const varPart = parts[varIndex];
            const varPattern = new RegExp(`{${key}}`, 'g');
            if (fs.existsSync(pathUpToVar)) {
                const items = fs.readdirSync(pathUpToVar, { withFileTypes: true });
                items.forEach(item => {
                    // Check if the item matches the pattern of the variable part
                    const itemPattern = varPart.replace(varPattern, '(.*)');
                    const matchRegex = new RegExp(`^${itemPattern}$`);

                    // Extract just the variable part from the match
                    const match = item.name.match(matchRegex);

                    if (!match || !match[1]) {
                        return;
                    }

                    const variableValue = match[1];

                    // Skip if onlyDirs is true and item is not a directory
                    if (typeConfig?.onlyDirs && !item.isDirectory()) {
                        return;
                    }

                    // Skip if choices are specified and item name is not in choices
                    if (typeConfig?.choices && !typeConfig.choices.includes(item.name)) {
                        return;
                    }

                    choices.add(variableValue);
                });
            }
        }
    }

    return Array.from(choices).sort();
}

module.exports = {
    scanVariablesInFilePath,
    updateFilePaths,
    simplifyPathWithVariable,
    getChoicesForVariable,
    promptVariables
};
