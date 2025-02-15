# Puzzle 🧩 - AI powered scaffolding

![Puzzle showcase](assets/puzzle-demo.svg "Creating GET, DELETE endpoints using Puzzle")

A flexible CLI tool for code generation and scaffolding that integrates with [aider-chat](https://aider.chat) to help automate common development tasks.

## Why to use this tool?

Large Language Models (LLMs) are powerful tools for code generation, but they require proper context to be effective. Without clear examples and relevant files, LLMs often make incorrect assumptions, leading to extensive code rewrites. 

This tool solves these challenges by providing a structured framework for creating templates for common development tasks like endpoint generation, test creation, CRUD generation, documentation, etc..

With well-designed templates, software development can become a **puzzle** made up of individual **pieces**.

## Prerequisites

- Node.js (v20+)
- aider-chat (`python -m pip install aider-install && aider-install`) [aider installation](https://aider.chat/docs/install.html)
- git

## Installation
   
```bash
npm install -g puzzle-ai

cd /your/project/path

puzzle
```

- run `puzzle` command in root of your git repository to init the tool

## Usage

[Follow this guide how to create your first template and start scaffolding](USAGE.md)

or check out the [example project](https://github.com/twinity1/puzzle-example-project) for a complete demonstration of puzzle templates and usage.

## Configuration

Configuration file `.puzzle.json` is located in root of your repository

default config looks like this:

```json
{
   "puzzleDir": "puzzle",
   "aiderArgs": {
      "no-auto-commit": true,
      "no-auto-lint": true
   }
}
```

`aiderArgs` will be passed to `aider` command, check `aider --help` for more


For example you can set model like this:

```json
{
   "aiderArgs": {
      "model": "openrouter/anthropic/claude-3.5-sonnet",
   }
}
```

## Commands and Parameters

| Command | Aliases | Description                                                                          |
|---|---|--------------------------------------------------------------------------------------|
| `puzzle` |  | Runs the tool for scaffolding.                                                       |
| `puzzle create-piece` |  | Launches an interactive wizard to create a new puzzle piece template.                |
| `puzzle init` |  | Creates and initializes the configuration file without running the main application. |
| `puzzle-aider` |  | For [JetBrains IDE Integration](JETBRAINS_INTEGRATION.md).

### `puzzle` command parameters

| Parameter | Aliases | Description |
|---|---|---|
| `--chat` |  | Enables aider chat mode for interactive conversations with the LLM. |
| `--history` | `-H` | Uses command history to re-run previous actions. Shows last 10 runs and allows reusing variables. |
| `--no-update-check` |  | Skips version and dependency update checks. |
| `--help` | `-h` | Shows help information. |
| `--version` | `-v` | Shows the version number. |

### Features

- **Template-based Code Generation**: Create and use templates for repetitive coding tasks
- **History Tracking**: Use `--history` to view and reuse previous configurations
- **Interactive Selection**: Choose actions through an interactive CLI interface
- **Extensible Architecture**: Easy to add new templates and actions
- **JetBrains IDE Integration**: [Add/remove files to Aider context directly from your IDE](JETBRAINS_INTEGRATION.md)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.
