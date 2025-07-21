const fs = require('fs');
const path = require('path');
const os =require('os');
const { spawn } = require('child_process');

function replaceLast(str, find, replace) {
    const lastIndex = str.lastIndexOf(find);

    if (lastIndex === -1) {
        return str;
    }

    return str.substring(0, lastIndex) + replace + str.substring(lastIndex + find.length);
}


/**
 * Starts a watcher that monitors the Aider chat history file for changes.
 * When a new patch is detected, it reverts the changes in the corresponding
 * file and opens the IDE's merge tool to show a diff of the changes.
 * This is useful for reviewing and selectively applying AI-generated changes.
 *
 * @param {string} repoPath - The absolute path to the repository root.
 * @param {string} ideCmd - The command to launch the IDE's merge tool (e.g., 'webstorm').
 */
function start(repoPath, ideCmd) {
    const logFilePath = path.join(repoPath, 'puzzle-watcher.log');
    const log = (message) => {
        fs.appendFileSync(logFilePath, `${new Date().toISOString()}: ${message}\n`);
    };
    log('Watcher starting...');
    const historyFilePath = path.join(repoPath, '.aider.chat.history.md');
    log(`Watching history file: ${historyFilePath}`);

    if (!fs.existsSync(historyFilePath)) {
        log('History file does not exist. Exiting watcher.');
        return;
    }

    const processChanges = async (content) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        log('Processing changes...');
        // Regex for edits (non-empty search block)
        const fencedInsideEditRegex = /(````|```)(?:[\w-]+)?\s*\r?\n([^\r\n`]+?)\s*\r?\n\s*<<<<<<< SEARCH\s*\r?\n([\s\S]+?)\s*\r?\n\s*=======\s*\r?\n([\s\S]*?)\s*\r?\n\s*>>>>>>> REPLACE\s*\r?\n\s*\1/gm;
        const fencedOutsideEditRegex = /^([^\r\n`]+?)\s*\r?\n\s*(````|```)(?:[\w-]+)?\s*\r?\n\s*<<<<<<< SEARCH\s*\r?\n([\s\S]+?)\s*\r?\n\s*=======\s*\r?\n([\s\S]*?)\s*\r?\n\s*>>>>>>> REPLACE\s*\r?\n\s*\2/gm;
        const nonFencedEditRegex = /^([^\r\n`]+?)\s*\r?\n\s*<<<<<<< SEARCH\s*\r?\n([\s\S]+?)\s*\r?\n\s*=======\s*\r?\n([\s\S]*?)\s*\r?\n\s*>>>>>>> REPLACE\s*$/gm;

        // Regex for new files (empty search block)
        const fencedInsideNewFileRegex = /(````|```)(?:[\w-]+)?\s*\r?\n([^\r\n`]+?)\s*\r?\n\s*<<<<<<< SEARCH\s*\r?\n\s*=======\s*\r?\n([\s\S]*?)\s*\r?\n\s*>>>>>>> REPLACE\s*\r?\n\s*\1/gm;
        const fencedOutsideNewFileRegex = /^([^\r\n`]+?)\s*\r?\n\s*(````|```)(?:[\w-]+)?\s*\r?\n\s*<<<<<<< SEARCH\s*\r?\n\s*=======\s*\r?\n([\s\S]*?)\s*\r?\n\s*>>>>>>> REPLACE\s*\r?\n\s*\2/gm;
        const nonFencedNewFileRegex = /^([^\r\n`]+?)\s*\r?\n\s*<<<<<<< SEARCH\s*\r?\n\s*=======\s*\r?\n([\s\S]*?)\s*\r?\n\s*>>>>>>> REPLACE\s*$/gm;

        const patchesByFile = new Map();

        const addPatch = (filePath, search, replace, type) => {
            const trimmedFilePath = filePath.trim();
            if (trimmedFilePath.includes('`') || trimmedFilePath.startsWith('>')) return;

            const isNew = search.trim() === '';
            log(`Found ${isNew ? 'new file ' : ''}${type} for file: ${trimmedFilePath}`);

            if (!patchesByFile.has(trimmedFilePath)) {
                patchesByFile.set(trimmedFilePath, []);
            }
            patchesByFile.get(trimmedFilePath).push({
                search: search,
                replace: replace
            });
        };

        // Process edits first
        content = content.replace(fencedInsideEditRegex, (match, fence, filePath, searchBlock, replaceBlock) => {
            addPatch(filePath, searchBlock, replaceBlock, 'fenced patch');
            return '';
        });
        content = content.replace(fencedOutsideEditRegex, (match, filePath, fence, searchBlock, replaceBlock) => {
            addPatch(filePath, searchBlock, replaceBlock, 'fenced patch');
            return '';
        });
        content = content.replace(nonFencedEditRegex, (match, filePath, searchBlock, replaceBlock) => {
            addPatch(filePath, searchBlock, replaceBlock, 'diff patch');
            return '';
        });

        // Then process new files
        content = content.replace(fencedInsideNewFileRegex, (match, fence, filePath, replaceBlock) => {
            addPatch(filePath, '', replaceBlock, 'fenced patch');
            return '';
        });
        content = content.replace(fencedOutsideNewFileRegex, (match, filePath, fence, replaceBlock) => {
            addPatch(filePath, '', replaceBlock, 'fenced patch');
            return '';
        });
        content = content.replace(nonFencedNewFileRegex, (match, filePath, replaceBlock) => {
            addPatch(filePath, '', replaceBlock, 'diff patch');
            return '';
        });

        if (patchesByFile.size === 0) {
            log('No patches found in new content.');
            log(content);
            return;
        }

        for (const [relativeFilePath, patches] of patchesByFile.entries()) {
            try {
                log(`Processing ${patches.length} patches for ${relativeFilePath}`);
                const absoluteFilePath = path.join(repoPath, relativeFilePath);

                const isNewFileCreation = patches.length === 1 && patches[0].search.trim() === '';
                if (isNewFileCreation) {
                    log(`Handling new file creation for diff: ${relativeFilePath}`);

                    if (!fs.existsSync(absoluteFilePath)) {
                        const newContent = patches[0].replace;
                        const dir = path.dirname(absoluteFilePath);
                        if (!fs.existsSync(dir)) {
                            fs.mkdirSync(dir, { recursive: true });
                        }
                        fs.writeFileSync(absoluteFilePath, newContent, 'utf8');
                    }

                    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puzzle-watcher-'));
                    const oldFilePath = path.join(tempDir, path.basename(relativeFilePath).replace(/[^a-zA-Z0-9.-]/g, '_'));
                    fs.writeFileSync(oldFilePath, '', 'utf8');
                    log(`Wrote empty content to temp file for new file diff: ${oldFilePath}`);

                    const mergeCommand = `${ideCmd} diff "${oldFilePath}" "${absoluteFilePath}"`;
                    log(`Executing merge command: ${mergeCommand}`);

                    await new Promise((resolve, reject) => {
                        const mergeProcess = spawn(mergeCommand, { stdio: 'inherit', shell: true });

                        mergeProcess.on('close', (code) => {
                            log(`Merge command finished with code ${code}.`);
                            resolve();
                        });

                        mergeProcess.on('error', (err) => {
                            log(`Failed to process patches for ${relativeFilePath}: ${err.message}`);
                            console.error(`Failed to process patches for ${relativeFilePath}:`, err);
                            reject(err);
                        });
                    });
                    continue;
                }

                if (!fs.existsSync(absoluteFilePath)) {
                    log(`File not found, skipping: ${absoluteFilePath}`);
                    continue;
                }

                let currentContent = fs.readFileSync(absoluteFilePath, 'utf8');

                let failed = false;
                for (let i = patches.length - 1; i >= 0; i--) {
                    const patch = patches[i];
                    if (currentContent.includes(patch.replace)) {
                        log(`Applying patch ${i + 1} to ${relativeFilePath}`);
                        currentContent = replaceLast(currentContent, patch.replace, patch.search);
                    } else {
                        log(`Could not apply patch for ${relativeFilePath}. Content to replace not found.`);
                        log(`---CONTENT TO REPLACE (patch.replace)---`);
                        log(patch.replace);
                        log(`---END CONTENT TO REPLACE---`);
                        log(`---CURRENT FILE CONTENT (first 500 chars)---`);
                        log(currentContent.substring(0, 500) + (currentContent.length > 500 ? '...' : ''));
                        log(`---END CURRENT FILE CONTENT---`);
                        console.error(`Could not apply patch for ${relativeFilePath}. Content to replace not found. This may be due to truncated diffs in the history file. Skipping.`);
                        failed = true;
                        break;
                    }
                }

                if (failed) {
                    continue;
                }

                const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puzzle-watcher-'));
                const oldFilePath = path.join(tempDir, path.basename(relativeFilePath).replace(/[^a-zA-Z0-9.-]/g, '_'));
                fs.writeFileSync(oldFilePath, currentContent, 'utf8');
                log(`Wrote old content to temp file: ${oldFilePath}`);

                const mergeCommand = `${ideCmd} diff "${oldFilePath}" "${absoluteFilePath}"`;
                log(`Executing merge command: ${mergeCommand}`);

                await new Promise((resolve, reject) => {
                    const mergeProcess = spawn(mergeCommand, { stdio: 'inherit', shell: true });

                    mergeProcess.on('close', (code) => {
                        log(`Merge command finished with code ${code}.`);
                        resolve();
                    });

                    mergeProcess.on('error', (err) => {
                        log(`Failed to process patches for ${relativeFilePath}: ${err.message}`);
                        console.error(`Failed to process patches for ${relativeFilePath}:`, err);
                        reject(err);
                    });
                });

            } catch (error) {
                log(`Failed to process patches for ${relativeFilePath}: ${error.message}`);
                console.error(`Failed to process patches for ${relativeFilePath}:`, error);
            }
        }
    };

    let lastKnownSize = -1;
    try {
        lastKnownSize = fs.statSync(historyFilePath).size;
        log(`Initial history file size: ${lastKnownSize}`);
    } catch (e) {
        log(`Could not stat history file initially: ${e.message}`);
        // file might not exist yet
    }

    let contentBuffer = '';
    let isProcessing = false;
    let debounceTimeout = null;

    fs.watch(historyFilePath, (eventType) => {
        log(`Watch event: ${eventType}`);
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            if (isProcessing) {
                log('Already processing, skipping watch event.');
                return;
            }
            try {
                if (!fs.existsSync(historyFilePath)) {
                    log('History file deleted.');
                    lastKnownSize = -1;
                    contentBuffer = '';
                    return;
                }
                const stats = fs.statSync(historyFilePath);
                log(`File changed. Old size: ${lastKnownSize}, new size: ${stats.size}`);
                if (stats.size > lastKnownSize) {
                    const fd = fs.openSync(historyFilePath, 'r');
                    const toRead = stats.size - lastKnownSize;
                    const buffer = Buffer.alloc(toRead);
                    fs.readSync(fd, buffer, 0, toRead, lastKnownSize);
                    fs.closeSync(fd);
                    log(`Read ${toRead} bytes from history file.`);

                    const newContent = buffer.toString('utf8');
                    contentBuffer += newContent;
                    if (contentBuffer.includes('> Applied edit to ')) {
                        log('Found trigger for patch processing. Processing changes.');
                        isProcessing = true;
                        const contentToProcess = contentBuffer;
                        contentBuffer = '';
                        processChanges(contentToProcess).finally(() => {
                            isProcessing = false;
                            log('Finished processing event.');
                        });
                    } else {
                        log('Did not find trigger for patch processing in new content.');
                    }
                } else if (stats.size < lastKnownSize) {
                    contentBuffer = '';
                }
                lastKnownSize = stats.size;
            } catch (error) {
                log(`Error in watch callback: ${error.message}`);
                // Silently ignore errors to keep watcher alive
            }
        }, 200);
    });
}

module.exports = { start };

if (require.main === module) {
    const repoPath = process.argv[2];
    const ideCmd = process.argv[3];
    if (repoPath && ideCmd) {
        start(repoPath, ideCmd);
    }
}
