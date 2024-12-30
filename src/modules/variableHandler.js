const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

module.exports = {
    scanVariablesInFilePath,
    updateFilePaths,
    simplifyPathWithVariable
};
