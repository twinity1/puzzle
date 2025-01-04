#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {describe} = require("node:test");
const inquirer = require('inquirer').createPromptModule();

// Color codes
const colors = {
    reset: '\x1b[0m',
    error: '\x1b[31m', // red
    warn: '\x1b[33m', // yellow
    info: '\x1b[36m', // cyan
    success: '\x1b[32m', // green
    debug: '\x1b[35m' // magenta
};

// Common JetBrains IDE config paths by OS
const DEFAULT_PATHS = {
    darwin: [
        path.join(process.env.HOME || '', 'Library/Application Support/JetBrains'),
        path.join(process.env.HOME || '', 'Library/Preferences/JetBrains')
    ],
    win32: [
        path.join(process.env.APPDATA || '', 'JetBrains'),
        path.join(process.env.LOCALAPPDATA || '', 'JetBrains')
    ],
    linux: [
        path.join(process.env.HOME || '', '.config/JetBrains'),
        path.join(process.env.HOME || '', '.local/share/JetBrains')
    ]
};

async function suggestJetBrainsPath() {
    const osPaths = DEFAULT_PATHS[process.platform] || [];
    const existingPaths = osPaths.filter(p => fs.existsSync(p));

    // Scan for actual IDE installations
    const ideChoices = [];
    for (const basePath of existingPaths) {
        try {
            const entries = fs.readdirSync(basePath);
            for (const entry of entries) {
                const fullPath = path.join(basePath, entry);
                // Look for directories matching IDE patterns
                if (fs.statSync(fullPath).isDirectory() &&
                    /^(IntelliJIdea|WebStorm|PhpStorm|PyCharm|Rider|GoLand|CLion)\d{4}\.\d+$/.test(entry)) {
                    ideChoices.push({ name: entry, value: fullPath });
                }
            }
        } catch (err) {
            console.warn(`${colors.warn}⚠️  Could not scan directory ${basePath}: ${err.message}${colors.reset}`);
        }
    }

    // Sort IDE choices by version (newest first) and then by name
    ideChoices.sort((a, b) => {
        const [aName, aVersion] = a.name.match(/^([A-Za-z]+)(\d{4}\.\d+)$/).slice(1);
        const [bName, bVersion] = b.name.match(/^([A-Za-z]+)(\d{4}\.\d+)$/).slice(1);

        // Compare versions first
        if (bVersion !== aVersion) {
            return bVersion.localeCompare(aVersion);
        }
        // If versions are equal, compare names
        return aName.localeCompare(bName);
    });

    const choices = [
        ...ideChoices,
        { name: 'Enter custom path...', value: 'custom' }
    ];

    const { selectedPath } = await inquirer([{
        type: 'list',
        name: 'selectedPath',
        message: 'Select JetBrains config directory:',
        choices
    }]);

    if (selectedPath === 'custom') {
        const { customPath } = await inquirer([{
            type: 'input',
            name: 'customPath',
            message: 'Enter custom JetBrains config path:'
        }]);
        return customPath;
    }

    return selectedPath;
}


function createJetBrainsToolConfig(idePath, scriptPath) {
    // Create the external tool configuration
    const config = {
        name: "Add/Drop file in Aider context",
        description: "Toggles file in context",
        group: "File Context",
        program: process.execPath, // Node.js executable
        parameters: `"${scriptPath}" .aider.context.txt "$FilePath$"`,
        workingDirectory: "$ProjectFileDir$",
        showIn: "Editor"
    };

    // Determine config path based on IDE
    const configDir = path.join(idePath, 'tools');
    const configPath = path.join(configDir, 'External Tools.xml');

    // Create tool XML content with proper escaping
    const toolXml = `  <tool name="${config.name}" description="${config.description}" showInMainMenu="true" showInEditor="true" showInProject="false" showInSearchPopup="true" disabled="false" useConsole="false" showConsoleOnStdOut="false" showConsoleOnStdErr="false" synchronizeAfterRun="true">
    <exec>
      <option name="COMMAND" value="${process.execPath}" />
      <option name="PARAMETERS" value="${config.parameters.replace(/"/g, '&quot;')}" />
      <option name="WORKING_DIRECTORY" value="${config.workingDirectory}" />
    </exec>
  </tool>`;

    // Ensure directory exists
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }

    let xmlContent;
    if (fs.existsSync(configPath)) {
        console.log(`${colors.info}🔄  Updating existing External Tools configuration...${colors.reset}`);
        // Read existing file
        const existingXml = fs.readFileSync(configPath, 'utf8');

        if (existingXml.includes('<toolSet name="External Tools">')) {
            xmlContent = replaceTool(existingXml, config.name, toolXml);
        } else {
            // Create new toolSet with our tool
            xmlContent = `<toolSet name="External Tools">\n${toolXml}\n</toolSet>`;
        }
    } else {
        // Create new file with toolSet and our tool
        xmlContent = `<toolSet name="External Tools">\n${toolXml}\n</toolSet>`;
        console.log(`${colors.info}✨  Creating new External Tools configuration file...${colors.reset}`);
    }

    // Write configuration
    fs.writeFileSync(configPath, xmlContent);

    console.log(`${colors.success}✅  External tool successfully installed! ${configPath}${colors.reset}`);
    console.log(`${colors.warn}❗️🔄  Please restart your JetBrains IDE for the changes to take effect.${colors.reset}`);
    console.log(`${colors.info}💡  You can run this action from:${colors.reset}`);
    console.log(`${colors.info}   - Right-click menu in the Project/Editor${colors.reset}`);
    console.log(`${colors.info}   - Tools > External Tools menu${colors.reset}`);
    console.log(`${colors.info}   - Or bind it to a keyboard shortcut in Preferences > Keymap${colors.reset}`);
    console.log(`${colors.info}     Search for "Add/Drop file in Aider context" to set up your shortcut${colors.reset}`);
}

function replaceTool(xmlContent, toolNameToReplace, newToolContent) {
    // Find the start and end positions of the existing tool
    const startTag = `<tool name="${toolNameToReplace}"`;
    const startIdx = xmlContent.indexOf(startTag);

    if (startIdx === -1) {
        // If tool not found, find the toolSet start and insert after opening tag
        const toolSetStart = xmlContent.indexOf('<toolSet name="External Tools">');
        if (toolSetStart !== -1) {
            const insertPoint = xmlContent.indexOf('>', toolSetStart) + 1;
            return xmlContent.slice(0, insertPoint) + '\n' + newToolContent + xmlContent.slice(insertPoint);
        }
        // Fallback to appending if toolSet not found
        const toolSetEnd = xmlContent.indexOf('</toolSet>');
        return xmlContent.slice(0, toolSetEnd) + '\n' + newToolContent + '\n' + xmlContent.slice(toolSetEnd);
    }

    // Find the closing </tool> tag
    const endIdx = xmlContent.indexOf('</tool>', startIdx) + '</tool>'.length;

    // Replace the existing tool content
    return xmlContent.slice(0, startIdx) + newToolContent + xmlContent.slice(endIdx);
}

async function main() {
    try {
        const idePath = await suggestJetBrainsPath();
        const scriptPath = path.join(__dirname, 'fileHook.js');
        createJetBrainsToolConfig(idePath, scriptPath);
    } catch (err) {
        console.error(`${colors.error}❌  Error: ${err.message}${colors.reset}`);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}
