# Puzzle 🧩

A flexible CLI tool for code generation and scaffolding that integrates with [aider-chat](https://aider.chat) to help automate common development tasks.

## Why to use this tool?


Large Language Models (LLMs) are powerful tools for code generation, but they require proper context to be effective. Without clear examples and relevant files, LLMs often make incorrect assumptions, leading to extensive code rewrites. 

This tool solves these challenges by providing a structured framework for creating templates for common development tasks like endpoint generation, test creation, CRUD generation, documentation, etc..


With well-designed templates, software development can become a **puzzle** made up of individual **pieces**.

## Prerequisites

- Node.js (v20 or higher)
- aider-chat (`pip install aider-chat`)

## Installation
   
```bash
npm install puzzle
```

## Usage

[Follow this guide how to create your first template and start scaffolding](USAGE.md)

### Features

- **Template-based Code Generation**: Create and use templates for repetitive coding tasks
- **History Tracking**: Use `--history` to view and reuse previous configurations
- **Interactive Selection**: Choose actions through an interactive CLI interface
- **Extensible Architecture**: Easy to add new templates and actions

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.
