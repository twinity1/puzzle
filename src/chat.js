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

function watchFile() {
    // Watch for changes
    let previousContent = fs.readFileSync(filePath, 'utf8');
    fs.watch(filePath, (eventType, filename) => {
        if (eventType === 'change') {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                // Only print new content that wasn't in previous read
                if (content !== previousContent) {
                    const newContent = content.slice(previousContent.length);
                    const lines = newContent.split(/\r?\n/);

                    const currentBuffer = buffer.toString();

                    // Clear previous content by spamming backspace
                    process.stdout.write('\b'.repeat(currentBuffer.length)); // just in case

                    for (const line of lines) {
                        process.stdout.write(line + "\n");
                    }

                    processPromptLines(currentBuffer);

                    previousContent = content;
                }
            } catch (err) {
                console.error(`Error reading file: ${err.message}`);
                process.exit(1);
            }
        }
    });
}

// Handle termination signals
process.on('SIGINT', () => {
    process.exit(0);
});

function processPromptLines(promptContent) {
    const lines = promptContent.split(/\r?\n/);
    for (const line of lines) {
        process.stdout.write(line);
        process.stdout.write('\x1b\x0d'); // Send Alt+Enter after each line
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

