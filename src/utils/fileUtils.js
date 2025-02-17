const fs = require('fs');
const path = require('path');
const fg = require('fast-glob');

function getDirectoryContents(dir, options = { withFileTypes: true }) {
    return fs.readdirSync(dir, options);
}

function getActionList(templateDir) {
    return getDirectoryContents(templateDir)
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);
}

function getFilesFromSection(templateDirPath, section) {
    const wholePath = path.join(templateDirPath, section);
    if (!fs.existsSync(wholePath)) {
        return [];
    }

    return fs.readdirSync(wholePath, {
        withFileTypes: true,
        recursive: true,
    })
        .filter(dirent => dirent.isFile())
        .map(dirent => path.join(dirent.parentPath, dirent.name));
}

function unfoldWildcards(updatedRefList) {
    const targetRefList = [];

    updatedRefList.forEach(filePath => {
        if (filePath.includes("$") || filePath.includes("*")) {
            const wildcardPath = filePath.replaceAll("$", '*');

            const matchingFiles = findMatchingFiles(wildcardPath);

            matchingFiles.forEach(matchedFile => {
                targetRefList.push(matchedFile);
            });
        } else {
            targetRefList.push(filePath);
        }
    });

    return targetRefList;
}

function findMatchingFiles(filePath) {
    filePath = filePath.trim();
    
    try {
        const wildcardPath = filePath.replaceAll("$", '*');

        // Options object for more control
        const options = {
            onlyFiles: true,        // Only return files (not directories)
            dot: false,             // Include/exclude files starting with a dot
            absolute: true,         // Return absolute paths
            ignore: ['**/node_modules/**'], // Ignore patterns
            caseSensitiveMatch: true      // Case insensitive matching
        };

        const matches = fg.sync(wildcardPath, options);

        if (matches.length === 0) {
            console.warn(`No files found matching pattern: ${wildcardPath}`);
        }

        return matches;

    } catch (error) {
        console.error(`Error finding files: ${error.message}`);
        return [];
    }
}

function ensureDirectoryExists(filePath) {
    const dirPath = path.dirname(filePath);
    fs.mkdirSync(dirPath, {recursive: true});
}

const findFileInDirectoriesUp = (fileName) => {
    let currentDir = process.cwd();

    while (currentDir) {
        const potentialFile = path.join(currentDir, fileName);
        if (fs.existsSync(potentialFile)) {
            return potentialFile;
        }

        const parentDir = path.dirname(currentDir);
        if (currentDir === parentDir) {
            break;
        }
        currentDir = parentDir;
    }
    return null;
}

function getLineContinuation() {
    return process.platform === 'win32' ? ' ' : ' \\\n';
}

module.exports = {
    getActionList,
    getFilesFromSection,
    unfoldWildcards,
    ensureDirectoryExists,
    findFileInDirectoriesUp,
    getLineContinuation,
    findMatchingFiles
};
