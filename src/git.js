const {exec} = require('child_process');
const path = require('path');

async function getModifiedGitFiles() {
    return new Promise((resolve, reject) => {
        exec('git diff --diff-filter=d --name-only', (err, stdout) => {
            if (err) {
                reject(err);
            } else {
                const filePaths = stdout.split('\n');
                const absoluteFilePaths = filePaths
                    .filter(path => path)
                    .map(filePath => path.resolve(filePath));
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
