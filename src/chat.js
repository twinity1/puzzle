#!/usr/bin/env node

const pty = require('@lydell/node-pty');
const os = require('os');
const fs = require('fs');
const path = require('path');

const filePath = path.join('.aider.context.txt');
fs.writeFileSync(filePath, '');

const isWindows = os.platform() === 'win32';
const shell = isWindows ? 'cmd.exe' : 'bash';
const shellCommandArg = isWindows ? '/c' : '-c';
const args = [shellCommandArg, `aider ${process.argv.slice(2).join(' ')}`];

const aider = pty.spawn(shell, args, {
    name: 'xterm-256color',
    cols: process.stdout.columns,
    rows: process.stdout.rows,
    cwd: process.cwd(),
    env: {
        ...process.env,
        FORCE_COLOR: '3',
        TERM: 'xterm-256color'
    },
});

// Set up terminal I/O
process.stdin.setRawMode(true);
process.stdin.on('data', data => aider.write(data));


function processPromptLines(promptContent) {
    const lines = promptContent.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        aider.write(lines[i]);

        if (lines.length !== i + 1) {
            aider.write('\x1b\x0d');
        }
    }
}

let lastOutputLines = 0;
let buffer = '';

function handleFileChange(previousContent) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content !== previousContent) {
            const newContent = content.slice(previousContent.length);
            const lines = newContent.split(/\r?\n/);

            const currentBuffer = buffer.toString();

            // Clear previous content by spamming backspace
            aider.write('\b'.repeat(currentBuffer.length));

            // Output new content and send to Aider's stdin
            for (const line of lines) {
                if (line.trim()) {  // Only send non-empty lines
                    aider.write(line + "\n");  // Write to Aider's stdin
                }
            }
            lastOutputLines = lines.length;

            // write it in a next buffer batch
            setTimeout(() => {
                processPromptLines(buffer);
            }, 100);

            return content;
        }
    } catch (err) {
        console.error(`Error reading file: ${err.message}`);
        process.exit(1);
    }
    return previousContent;
}

function watchFile() {
    let previousContent = fs.readFileSync(filePath, 'utf8');

    const isWsl = process.platform === 'linux' &&
                 fs.existsSync('/proc/version') &&
                 fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');

    if (isWsl) {
        setInterval(() => {
            previousContent = handleFileChange(previousContent);
        }, 500);
    } else {
        fs.watch(filePath, (eventType) => {
            if (eventType === 'change') {
                previousContent = handleFileChange(previousContent);
            }
        });
    }
}

let lastOutput = Date.now();

// Handle aider output with file watching
aider.onData(data => {
    process.stdout.write(data);

    lastOutput = Date.now();
});

let isProcessingInput = false;

// Handle parent process stdin
process.stdin.on('data', data => {
    // Add to buffer
    buffer += data.toString();
    // If last character is carriage return, process the complete line
    if (data.toString().endsWith('\r') || data.toString().trim().endsWith("\u001b[10;1R")) {
        if (!isProcessingInput) {
            isProcessingInput = true;

            // Clear buffer
            buffer = '';

            isProcessingInput = false;
        }
    }
});

// Handle aider process exit
aider.onExit(({ exitCode, signal }) => {
    if (exitCode !== undefined) {
        process.exit(exitCode);
    } else if (signal) {
        process.kill(process.pid, signal);
    } else {
        process.exit(0);
    }
});

// Handle termination
function shutdown() {
    process.stdin.setRawMode(false);
    aider.kill();
}

process.on('SIGINT', () => shutdown());
process.on('SIGHUP', () => shutdown());
process.on('exit', () => shutdown());

// Window resize handling
process.stdout.on('resize', () => {
    aider.resize(process.stdout.columns, process.stdout.rows);
});


let promptHandled = false;

// Handle initial prompt if provided
function checkPrompt() {
    setTimeout(() => {
        if (Date.now() - lastOutput > 2000) {
            promptHandled = true;
            processPromptLines(buffer);
        } else {
            checkPrompt();
        }
    }, 500);
}

try {
    const promptContent = process.env.PUZZLE_PROMPT;
    if (promptContent) {
        buffer = promptContent;
        checkPrompt();
    } else {
        promptHandled = true;
    }
} catch (err) {
    console.error(`Error reading prompt file: ${err.message}`);
}

watchFile();
