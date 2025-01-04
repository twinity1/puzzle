const {exec} = require('child_process');
const path = require('path');
const fs = require('fs');

async function getModifiedGitFiles(puzzleDir) {
    return new Promise((resolve, reject) => {
        exec('git diff --name-only && git diff --cached --name-only', (err, stdout) => {
            if (err) {
                reject(err);
            } else {
                const filePaths = stdout.split('\n');
                const absoluteFilePaths = filePaths
                    .map(filePath => path.resolve(filePath.trim()))
                    .filter(filePath => filePath && !filePath.includes(puzzleDir))
                    .filter(filePath => {
                        try {
                            return !fs.lstatSync(filePath).isDirectory();
                        } catch (e) {
                            return false;
                        }
                    })
                resolve(absoluteFilePaths);
            }
        });
    });
}

function isGitReadRequested(varList) {
    return varList['GIT-R'] ||
        varList['GIT-READ'] ||
        varList['GR'];
}

function isGitWriteRequested(varList) {
    return varList['GIT-W'] ||
        varList['GIT-WRITE'] ||
        varList['GW'];
}

module.exports = {
    getModifiedGitFiles,
    isGitReadRequested,
    isGitWriteRequested
};
