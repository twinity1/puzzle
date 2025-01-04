const fs = require('fs');
const path = require('path');

function toggleFileInContext(filePath) {
    // Check if argument is provided
    if (!filePath) {
        console.error('Error: No file path provided');
        process.exit(1);
    }

    // Check if file exists in context to determine prefix
    const contextFilePath = process.argv[2];
    // Create context file if it doesn't exist
    if (!fs.existsSync(contextFilePath)) {
        fs.writeFileSync(contextFilePath, '');
    }
    const contextContent = fs.readFileSync(contextFilePath, 'utf8');

    // Split into lines and filter empty ones
    let lines = contextContent.split('\n').filter(line => line.trim() !== '');

    // Filter and keep only records for this exact filePath
    const fileRecords = lines.filter(line => {
        const [, pathInRecord] = line.split(' ');
        return pathInRecord === filePath;
    });
    const otherRecords = lines.filter(line => {
        const [, pathInRecord] = line.split(' ');
        return pathInRecord !== filePath;
    });

    // Determine prefix based on last action (toggle between add/drop)
    const prefix = fileRecords.length > 0 && fileRecords[fileRecords.length - 1].startsWith('/add')
        ? '/drop'
        : '/add';
    const file = `${prefix} ${filePath}`;

    try {
        // Append new record and keep total under 10
        const allRecords = [...lines, file];

        console.log(file);

        // Write updated content back to file
        fs.writeFileSync(contextFilePath, allRecords.join("\n"));
    } catch (err) {
        console.error(`Error processing context file: ${err.message}`);
        process.exit(1);
    }
}

// Get file path from command line arguments
const filePath = process.argv[3];
toggleFileInContext(filePath);
