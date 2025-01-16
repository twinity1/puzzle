#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const filePath = path.join('.aider.context.txt');
fs.writeFileSync(filePath, '');

// Set stdin to raw mode for character-by-character input
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

let buffer = '';

// Handle each character as it comes in
process.stdin.on('data', (key) => {
    // Allow Ctrl+C to exit
    if (key === '\u0003') {
        process.exit();
    }

    // Reset buffer on newline
    if (key === '\n' || key === '\r') {
        buffer = '';
    } else {
        buffer += key;
    }

    // Write each character to stdout
    process.stdout.write(key);
});

function handleFileChange(previousContent) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content !== previousContent) {
            const newContent = content.slice(previousContent.length);
            const lines = newContent.split(/\r?\n/);

            const currentBuffer = buffer.toString();

            // Clear previous content by spamming backspace
            process.stdout.write('\b'.repeat(currentBuffer.length));

            for (const line of lines) {
                process.stdout.write(line + "\n");
            }

            processPromptLines(currentBuffer);

            return content; // Return new content to update previousContent
        }
    } catch (err) {
        console.error(`Error reading file: ${err.message}`);
        process.exit(1);
    }
    return previousContent;
}

function watchFile() {
    // Watch for changes
    let previousContent = fs.readFileSync(filePath, 'utf8');

    // Check if running in WSL
    const isWsl = process.platform === 'linux' &&
                 fs.existsSync('/proc/version') &&
                 fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');

    if (isWsl) {
        // Use interval-based polling for WSL
        setInterval(() => {
            previousContent = handleFileChange(previousContent);
        }, 500); // Check every 500ms
    } else {
        // Use native fs.watch for non-WSL systems
        fs.watch(filePath, (eventType, filename) => {
            if (eventType === 'change') {
                previousContent = handleFileChange(previousContent);
            }
        });
    }
}

// Handle termination signals
process.on('SIGINT', () => {
    process.exit(0);
});

function processPromptLines(promptContent) {
    const lines = promptContent.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        process.stdout.write(lines[i]);
        
        // Send Alt+Enter after each line except the last
        if (i < lines.length - 1) {
            process.stdout.write('\x1b\x0d');
        }
    }
}

try {
    // Read content from stdin as string
    const promptContent = process.env.PROMPT;

    if (promptContent) {
        buffer = promptContent;
        processPromptLines(promptContent);
    }
} catch (err) {
    console.error(`Error reading prompt file: ${err.message}`);
}

watchFile();

