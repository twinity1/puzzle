const fs = require('fs');
const path = require('path');
const { ensureDirectoryExists, getFilesFromSection} = require('../utils/fileUtils');
const {scanVariablesInFilePath, updateFilePaths} = require("./variableHandler");

function getWriteAndReadFilesFromTemplateFiles(repoPath, modules, varList) {
    const resultWriteFiles = [];
    const resultReadFiles = [];

    for (const module of modules) {
        if (!module.dir) {
            continue;
        }

        const templateFiles = getFilesFromSection(module.dir, 'template')
        resultReadFiles.push(...templateFiles);

        let targetFileList = updateFilePaths(templateFiles, varList);

        targetFileList = targetFileList.map(filePath => {
            const strippedPath = filePath.replace(`${module.dir}${path.sep}template`, '');
            return path.join(repoPath, strippedPath);
        });

        resultWriteFiles.push(...targetFileList);
    }

    return {resultWriteFiles, resultReadFiles};
}

function resolveVarsAndUpdateFilePath(puzzleConfig, file, varList) {
    const fullFilePath = path.isAbsolute(file) ? file : path.join(puzzleConfig.repoPath, file);
    scanVariablesInFilePath(fullFilePath, varList);
    return fullFilePath;
}

module.exports = {
    getWriteAndReadFilesFromTemplateFiles,
    resolveVarsAndUpdateFilePath
};
