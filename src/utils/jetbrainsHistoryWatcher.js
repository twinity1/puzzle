const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const binaryExtensions = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.pdf', '.zip', '.gz', '.tar', '.rar', '.7z',
    '.exe', '.dll', '.so', '.class', '.jar', '.pyc', '.db', '.sqlite3', '.DS_Store'
]);

// A map to store the original content of files.
const fileContentsCache = new Map();

async function showDiff(repoPath, relativeFilePath, ideCmd, log) {
    const normalizedRelativePath = path.normalize(relativeFilePath);
    const originalContent = fileContentsCache.get(normalizedRelativePath) || '';
    if (!fileContentsCache.has(normalizedRelativePath)) {
        log(`No cached content for ${normalizedRelativePath}. Assuming new file.`);
    }
    const absoluteFilePath = path.join(repoPath, normalizedRelativePath);

    if (!fs.existsSync(absoluteFilePath)) {
        log(`File not found, cannot show diff: ${absoluteFilePath}`);
        return;
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puzzle-watcher-'));
    const oldFilePath = path.join(tempDir, path.basename(normalizedRelativePath).replace(/[^a-zA-Z0-9.-]/g, '_'));
    fs.writeFileSync(oldFilePath, originalContent, 'utf8');
    log(`Wrote old content to temp file: ${oldFilePath}`);

    const mergeCommand = `${ideCmd} diff "${oldFilePath}" "${absoluteFilePath}"`;
    log(`Executing merge command: ${mergeCommand}`);

    await new Promise((resolve, reject) => {
        const mergeProcess = spawn(mergeCommand, { stdio: 'inherit', shell: true });

        mergeProcess.on('close', (code) => {
            log(`Merge command finished with code ${code}.`);
            // Reload file content after showing diff
            if (fs.existsSync(absoluteFilePath)) {
                const extension = path.extname(absoluteFilePath).toLowerCase();
                if (binaryExtensions.has(extension)) {
                    log(`Skipping binary file, not re-caching: ${normalizedRelativePath}`);
                } else {
                    const newContent = fs.readFileSync(absoluteFilePath, 'utf8');
                    fileContentsCache.set(normalizedRelativePath, newContent);
                    log(`Reloaded and cached new content of ${normalizedRelativePath}`);
                }
            }
            resolve();
        });

        mergeProcess.on('error', (err) => {
            log(`Failed to execute merge command for ${normalizedRelativePath}: ${err.message}`);
            console.error(`Failed to execute merge command for ${normalizedRelativePath}:`, err);
            reject(err);
        });
    });
}

function watchFileForEdits(repoPath, filePath, ideCmd, log) {
    let lastKnownSize = -1;
    try {
        if (fs.existsSync(filePath)) {
            lastKnownSize = fs.statSync(filePath).size;
            log(`Initial chat history file size: ${lastKnownSize}`);
        }
    } catch (e) {
        log(`Could not stat chat history file initially: ${e.message}`);
    }

    let debounceTimeout = null;
    fs.watch(filePath, (eventType) => {
        log(`Chat history watch event: ${eventType}`);
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            try {
                if (!fs.existsSync(filePath)) {
                    log('Chat history file deleted.');
                    lastKnownSize = -1;
                    return;
                }
                const stats = fs.statSync(filePath);
                if (stats.size > lastKnownSize) {
                    const fd = fs.openSync(filePath, 'r');
                    const readFrom = lastKnownSize === -1 ? 0 : lastKnownSize;
                    const toRead = stats.size - readFrom;
                    const buffer = Buffer.alloc(toRead);
                    if (toRead > 0) {
                        fs.readSync(fd, buffer, 0, toRead, readFrom);
                    }
                    fs.closeSync(fd);
                    
                    const newContent = buffer.toString('utf8');
                    log(`Read ${toRead} bytes from chat history file.`);

                    const appliedEditRegex = /> Applied edit to (.+)/g;
                    let match;
                    while ((match = appliedEditRegex.exec(newContent)) !== null) {
                        const filePaths = match[1].trim().split(', ');
                        for (const relativeFilePath of filePaths) {
                            log(`Detected applied edit for ${relativeFilePath}. Showing diff.`);
                            showDiff(repoPath, relativeFilePath.trim(), ideCmd, log);
                        }
                    }
                }
                lastKnownSize = stats.size;
            } catch (error) {
                log(`Error in chat history watch callback: ${error.message}`);
            }
        }, 200);
    });
}

function addPathToCache(repoPath, relativePath, log) {
    const normalizedRelativePath = path.normalize(relativePath);
    const absolutePath = path.join(repoPath, normalizedRelativePath);
    if (!fs.existsSync(absolutePath)) {
        log(`Path to add not found: ${absolutePath}`);
        return;
    }

    const stats = fs.statSync(absolutePath);
    if (stats.isDirectory()) {
        log(`Caching directory: ${normalizedRelativePath}`);
        const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
        for (const entry of entries) {
            const newRelativePath = path.join(normalizedRelativePath, entry.name);
            addPathToCache(repoPath, newRelativePath, log);
        }
    } else if (stats.isFile()) {
        const extension = path.extname(absolutePath).toLowerCase();
        if (binaryExtensions.has(extension)) {
            log(`Skipping binary file, not caching: ${normalizedRelativePath}`);
            return;
        }
        const content = fs.readFileSync(absolutePath, 'utf8');
        fileContentsCache.set(normalizedRelativePath, content);
        log(`Cached content of ${normalizedRelativePath}`);
    }
}

function watchFileForAdds(repoPath, filePath, log) {
    let lastKnownSize = -1;
    try {
        if (fs.existsSync(filePath)) {
            lastKnownSize = fs.statSync(filePath).size;
            log(`Initial input history file size: ${lastKnownSize}`);
        }
    } catch (e) {
        log(`Could not stat input history file initially: ${e.message}`);
    }

    let debounceTimeout = null;
    fs.watch(filePath, (eventType) => {
        log(`Input history watch event: ${eventType}`);
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            try {
                if (!fs.existsSync(filePath)) {
                    log('Input history file deleted.');
                    lastKnownSize = -1;
                    return;
                }
                const stats = fs.statSync(filePath);
                if (stats.size > lastKnownSize) {
                    const fd = fs.openSync(filePath, 'r');
                    const readFrom = lastKnownSize === -1 ? 0 : lastKnownSize;
                    const toRead = stats.size - readFrom;
                    const buffer = Buffer.alloc(toRead);
                    if (toRead > 0) {
                        fs.readSync(fd, buffer, 0, toRead, readFrom);
                    }
                    fs.closeSync(fd);
                    
                    const newContent = buffer.toString('utf8');
                    log(`Read ${toRead} bytes from input history file.`);
                    
                    const addFileRegex = /^\+\/add\s+(.+)/gm;
                    let match;
                    while ((match = addFileRegex.exec(newContent)) !== null) {
                        const relativePath = match[1].trim();
                        addPathToCache(repoPath, relativePath, log);
                    }
                }
                lastKnownSize = stats.size;
            } catch (error) {
                log(`Error in input history watch callback: ${error.message}`);
            }
        }, 200);
    });
}

/**
 * Starts watchers that monitor Aider's input and chat history files.
 * When a file is added to the chat via `+/add`, its content is cached.
 * When Aider applies an edit, it opens the IDE's merge tool to show a diff
 * of the changes.
 *
 * @param {string} repoPath - The absolute path to the repository root.
 * @param {string} ideCmd - The command to launch the IDE's merge tool (e.g., 'webstorm').
 */
function start(repoPath, ideCmd) {
    const logFilePath = path.join(repoPath, 'puzzle-watcher.log');
    const log = (message) => {
        if (process.env.PUZZLE_DEBUG === '1') {
            fs.appendFileSync(logFilePath, `${new Date().toISOString()}: ${message}\n`);
        }
    };
    log('Watcher starting...');

    const inputHistoryPath = path.join(repoPath, '.aider.input.history');
    const chatHistoryPath = path.join(repoPath, '.aider.chat.history.md');

    if (!fs.existsSync(inputHistoryPath)) {
        fs.writeFileSync(inputHistoryPath, '');
        log(`Created empty file: ${inputHistoryPath}`);
    }
    if (!fs.existsSync(chatHistoryPath)) {
        fs.writeFileSync(chatHistoryPath, '');
        log(`Created empty file: ${chatHistoryPath}`);
    }

    log(`Watching input history: ${inputHistoryPath}`);
    log(`Watching chat history: ${chatHistoryPath}`);

    watchFileForAdds(repoPath, inputHistoryPath, log);
    watchFileForEdits(repoPath, chatHistoryPath, ideCmd, log);
}

module.exports = { start };

if (require.main === module) {
    const repoPath = process.argv[2];
    const ideCmd = process.argv[3];
    if (repoPath && ideCmd) {
        start(repoPath, ideCmd);
    }
}
