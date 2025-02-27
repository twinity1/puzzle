/**
 * Use it to set up the context, add files to read/write
 * 
 * This code will be executed when running either:
 * - puzzle-aider
 * - puzzle
 */
export async function prepare(context) {
    // Examples:
    
    // 📁 1️⃣ ADD FILES TO READ FOR CONTEXT (can use wildcards)
    // context.addReadFile('src/models/*.js');
    // context.addReadFile('src/views/**/*.html');
    // context.addReadFile('src/config/database.js');
    
    // ✏️ 2️⃣ ADD FILES THAT WILL BE MODIFIED
    // context.addWriteFile('src/controllers/userController.js');
    
    // 📂 3️⃣ LOAD DIFFERENT FILES BASED ON CURRENT DIRECTORY
    // if (context.config.currentDir.includes('backend')) {
    //     context.addReadFile('conventions/BACKEND.md');
    // } else if (context.config.currentDir.includes('frontend')) {
    //     context.addReadFile('conventions/FRONTEND.md');
    // }
    
    // 🚩 4️⃣ HANDLE YOUR CUSTOM COMMAND-LINE FLAGS (puzzle-aider --include-entities)
    // if (context.vars['INCLUDE-ENTITIES']) {
    //     // Load all entity files for context
    //     context.addReadFile('src/models/entities/*.js');
    // }
    
    // 🔍 5️⃣ DEBUG CONTEXT OBJECT
    // To see all available properties and methods in the context object:
    // throw context; // and then run puzzle-aider
    //
    // This will show the full context object in the console, including:
    // - vars: All variables and flags
    // - config: Configuration settings
    // - readFiles: Files added for reading
    // - writeFiles: Files added for writing
}

/**
 * The setup function runs after the user has provided all variables.
 * Use it for final adjustments to the context based on the complete set of variables.
 * 
 * This code will be executed when running command:
 * - puzzle
 */
export async function setup(context) {
}

/**
 * The prompt function returns the initial prompt to send to the Aider.
 */
export async function prompt(context) {
    return null; // or return string
}
