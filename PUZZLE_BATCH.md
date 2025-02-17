# Puzzle Batch Mode 🔄

Apply AI-powered modifications to multiple files at once using a single command.


1. The AI focuses on one file at a time, leading to more accurate and consistent changes
2. Changes to each file are isolated, preventing cross-file confusion

![Puzzle showcase](assets/puzzle-batch-demo.svg "Modify multiple files at once")

## Usage

```bash
puzzle-batch <pattern> --msg "your instruction" [aider options]
```

### Parameters

- `<pattern>`: Glob pattern to match files (required)
  Example: `"src/**/*.js"` or `"components/*.tsx"`
  
- Message (required):
  `--msg "instruction"` or `--message-file "path"`

### Examples

```bash
# Add JSDoc comments
puzzle-batch "src/**/*.js" --msg "add JSDoc comments to all functions" --model sonnet

# Add error handling
puzzle-batch "controllers/*.ts" --msg "add try/catch blocks" --no-cache-prompts

# Update imports
puzzle-batch "components/*.tsx" --msg "update imports to use @utils alias"
```

## How It Works

Puzzle Batch processes each file individually, running a separate Aider command for each file. This approach, while potentially slower, ensures:

This is more reliable than processing all files at once, where the AI might get overwhelmed or make inconsistent changes across files.