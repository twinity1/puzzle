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
  - Basic pattern: `"src/**/*.js"` or `"components/*.tsx"`
  - Group pattern: Use `:G` modifier to group files by directory
    Example: `"src/modules/*:G/*.js"` will group files by subdirectories under modules/
  
- Message (required):
  `--msg "instruction"` or `--message-file "path"`

### Pattern Grouping

Files can be processed either individually or in groups:

1. Without `:G` modifier: Each file is processed separately
   ```bash
   puzzle-batch "src/**/*.js" --msg "add error handling"
   # Each .js file is processed individually
   ```

2. With `:G` modifier: Files are grouped by directory

```bash
# Basic grouping
puzzle-batch "src/features/*:G/*.ts" --msg "add error handling"
# Groups files by feature directories:
# - src/features/auth/*.ts as one group
# - src/features/users/*.ts as another group
# - etc.

# Deep grouping
puzzle-batch "src/domains/*:G/**/handlers/*.cs" --msg "add logging"
# Groups handlers by domain:
# - src/domains/orders/**/handlers/*.cs as one group
# - src/domains/products/**/handlers/*.cs as another group
# - etc.
```

Files are processed group by group, with all files in a group being modified together.

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
