const fs = require('fs');
const path = require('path');
const { execSync } = require("child_process");

function getRepoPath(filePath) {
    try {
        // Get the root path of the repository
        const repoPath = execSync("git rev-parse --show-toplevel", {
            cwd: path.dirname(filePath),
            encoding: "utf-8",
	    stdio: ["ignore", "pipe"]
        }).trim();
        return repoPath;
    } catch (error) {
        return null;
    }
}

function isIgnoredInRepo(filePath, repoPath) {
    try {
        // Run git check-ignore to determine if the file is ignored in the current repo
        execSync(`git check-ignore -q "${filePath}"`, {
            cwd: repoPath,
            stdio: "ignore"
        });
        return true; // If git check-ignore returns 0, the file is ignored
    } catch (error) {
        return false; // If git check-ignore returns a non-zero exit code, file is not ignored
    }
}

function isIgnored(filePath) {
    let currentPath = filePath;
    let visitedRepos = new Set(); // Set to track visited repositories

    while (true) {
        const repoPath = getRepoPath(currentPath);
        
        if (!repoPath) {
            return false; // If repository is not found, return false
        }

        if (visitedRepos.has(repoPath)) {
            // If we've already visited this repo, it means we're stuck in a loop, so stop
            return false;
        }

        // Add the current repository to the visited set
        visitedRepos.add(repoPath);

        // Check if the file is ignored in the current repository
        if (isIgnoredInRepo(currentPath, repoPath)) {
            return true;
        }

        // Move one level up in the directory structure
        currentPath = path.dirname(repoPath);
    }
}

function toggleFileInContext(filePath) {
    // Check if argument is provided
    if (!filePath) {
        console.error('Error: No file path provided');
        process.exit(1);
    }

    // Check if file exists in context to determine prefix
    const contextFilePath = process.argv[2];
    const contextDir = path.dirname(contextFilePath);

    // Convert absolute path to relative path based on context file's directory
    if (path.isAbsolute(filePath)) {
        filePath = path.relative(contextDir, filePath);
    }
    // Create context file if it doesn't exist
    if (!fs.existsSync(contextFilePath)) {
        fs.writeFileSync(contextFilePath, '');
    }

    filePath = filePath.replace('\\', '/');

    const contextContent = fs.readFileSync(contextFilePath, 'utf8');

    // Split into lines and filter empty ones
    let lines = contextContent.split('\n').filter(line => line.trim() !== '');

    // Filter and keep only records for this exact filePath
    const fileRecords = lines.filter(line => {
        const [, pathInRecord] = line.split(' ');
        return pathInRecord === filePath;
    });

    const addPrefix = isIgnored(filePath) ? '/read-only' : '/add';

    // Determine prefix based on last action (toggle between add/drop)
    const prefix = fileRecords.length > 0 && (fileRecords[fileRecords.length - 1].startsWith('/add') || fileRecords[fileRecords.length - 1].startsWith('/read-only'))
        ? '/drop'
        : addPrefix;
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
