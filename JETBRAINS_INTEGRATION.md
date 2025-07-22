# JetBrains IDE Integration

The Puzzle CLI tool provides seamless integration with JetBrains IDEs (IntelliJ IDEA, WebStorm, PyCharm, etc.). This integration offers two main features:

1.  **Context File Management**: Add or remove files from Aider's context directly from your IDE's UI.
2.  **Automatic Diff Viewer**: Automatically see diffs of AI-generated changes within your IDE.

---

## 1. Context File Management (Add/Drop Files)

This feature allows you to right-click on a file in your JetBrains IDE and add it to (or remove it from) Aider's context.

https://github.com/user-attachments/assets/19590216-9a94-429b-a769-d617dcad566d

### Features

- Add/remove files to Aider context with a single click
- Available in right-click context menus
- Can be bound to keyboard shortcuts
- Works with all JetBrains IDEs

### Installation

**Platform Support**: This integration currently works on MacOS, Windows, and Linux.

1.  Run the installation command:
    ```bash
    puzzle-jetbrains-install
    ```
2.  Follow the prompts to select your JetBrains IDE configuration directory.
3.  Restart your IDE after installation.

### Usage

Once installed, you can access the tool in several ways:

1.  **Right-click Menu**:
    -   Right-click any file in the Project or Editor view.
    -   Select "External Tools" > "Add/Drop file to Aider context".
2.  **Main Menu**:
    -   Go to Tools > External Tools > "Add/Drop file to Aider context".
3.  **Keyboard Shortcut** (recommended):
    -   Go to Preferences > Keymap.
    -   Search for "Add/Drop file to Aider context".
    -   Assign your preferred shortcut (e.g., `Ctrl+Alt+A`).

### How It Works

The integration uses JetBrains' External Tools feature to run a Node.js script (`fileHook.js`). Each time you run the command, it will:
- Add the file to `.aider.context.txt` if it's not already there.
- Remove the file from `.aider.context.txt` if it's already in context.

---

## 2. Automatic AI Change Diffs

When working in a JetBrains IDE, `puzzle-aider` can automatically show you a diff of the changes made by the AI after each edit. This provides an immediate, visual way to review and validate the AI's work.

### How it Works

1.  **Detection**: The first time you run `puzzle-aider` from a JetBrains terminal, it will detect your IDE.
2.  **Confirmation**: It will ask if you want to enable the automatic diff feature.
3.  **IDE Selection**: The tool determines which IDE to use for showing diffs based on the following priority:
    1.  `--ide` command-line argument (e.g., `puzzle-aider --ide webstorm`).
    2.  `PUZZLE_IDE` environment variable.
    3.  `ide` setting in `~/.puzzle/config.yaml`.
    If none of these are set, it will prompt you to choose an IDE the first time.
4.  **Configuration**: Your preferences are saved to `~/.puzzle/config.yaml` in a `jetbrains` section:
    ```yaml
    jetbrains:
      ide: webstorm # Can be: idea, webstorm, pycharm, rider, phpstorm, goland, clion
      showDiffs: true
    ```
5.  **Watcher**: A background process is started to watch for file modifications made by Aider.
6.  **Diff View**: When Aider applies an edit, a diff window will automatically open in your IDE, showing the changes.

**Important**: In the diff view, the left side is your original file content, and the right side is the file with AI changes. **Only edit the right side to keep your changes.**

### Disabling the Feature

You can disable this feature at any time by editing `~/.puzzle/config.yaml` and setting `showDiffs` to `false`.

---

## General Usage with `puzzle-aider`

**Important**: When using either of these integrations, you must run `puzzle-aider` instead of the regular `aider` command. The `puzzle-aider` command is automatically installed with Puzzle and is required for these features to work correctly.

```bash
cd your/repository
puzzle-aider [optional aider options, see aider --help]
```

You can force a specific IDE using the `--ide` flag:
```bash
puzzle-aider --ide rider
```

The `puzzle-aider` command does more than just enable IDE features. It can:
- Dynamically include files based on your current directory
- Load project-specific conventions automatically
- Include core interfaces and components programmatically
- Configure context based on custom variables

See [PUZZLE_AIDER.md](PUZZLE_AIDER.md) for detailed examples of dynamic context configuration.

---
## 🔧 Troubleshooting

**Q: The "Add/Drop file" tool isn't showing up in my IDE**
- Make sure you restarted your IDE after running `puzzle-jetbrains-install`.
- Verify the External Tools configuration XML file was created in your IDE's config directory.

**Q: I'm getting errors when running the "Add/Drop file" tool**
- Ensure Node.js is installed and available in your system's PATH.
- Make sure you have write permissions to the project directory.

**Q: Automatic diffs are not appearing.**
- Ensure you are running `puzzle-aider` from within the JetBrains terminal.
- Check your `~/.puzzle/config.yaml` to ensure `showDiffs` is `true`.
- Look for `puzzle-watcher.log` in your project root for debug information (requires `PUZZLE_DEBUG=1`).

**Q: Can I use this with multiple IDEs?**
- Yes! Run the `puzzle-jetbrains-install` command for each IDE you want to configure.

---
## 🗑️ Uninstallation

### Context File Management (Add/Drop)
1.  Delete the External Tools configuration XML file from your IDE's config directory.
2.  Remove any keyboard shortcuts you assigned in the IDE.

### Automatic Diffs
This feature runs on-demand and doesn't require uninstallation. You can simply disable it by setting `showDiffs: false` in `~/.puzzle/config.yaml`.
