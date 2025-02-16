# JetBrains IDE Integration

The Puzzle CLI tool provides seamless integration with JetBrains IDEs (IntelliJ IDEA, WebStorm, PyCharm, etc.) through an external tool configuration. This allows you to quickly add/remove files from to Aider context directly from your IDE.



https://github.com/user-attachments/assets/19590216-9a94-429b-a769-d617dcad566d



---
## ✨ Features

- Add/remove files to Aider context with a single click
- Available in right-click context menus
- Can be bound to keyboard shortcuts
- Works with all JetBrains IDEs

---
## 💾 Installation

**Platform Support**: This integration currently works on:
- MacOS
- Windows
- Linux

1. Run the installation command:

```bash
puzzle-jetbrains-install
```

2. Follow the prompts to select your JetBrains IDE configuration directory
3. Restart your IDE after installation

Then run in your repository:

```bash
cd your/repository
puzzle-aider [optional aider options, see aider --help]
```

---
## 🚀 Usage

**Important**: When using this integration, you must run `puzzle-aider` instead of the regular `aider` command. The `puzzle-aider` command is automatically installed with Puzzle and handles the context file management.

Once installed, you can access the tool in several ways:

1. **Right-click Menu**:
   - Right-click any file in the Project or Editor view
   - Select "External Tools" > "Add/Drop file to Aider context"

2. **Main Menu**:
   - Go to Tools > External Tools > Add/Drop file to Aider context

3. **Keyboard Shortcut** (recommended):
   - Go to Preferences > Keymap
   - Search for "Add/Drop file to Aider context"
   - Assign your preferred shortcut (e.g. Ctrl+Alt+A)

---
## 🔥 Enhanced Features with puzzle-aider

The `puzzle-aider` command does more than just manage files through IDE. It can:
- Dynamically include files based on your current directory
- Load project-specific conventions automatically
- Include core interfaces and components programmatically
- Configure context based on custom variables

See [PUZZLE_AIDER.md](PUZZLE_AIDER.md) for detailed examples of dynamic context configuration.

---
## ⚙️ How It Works

The integration uses JetBrains' External Tools feature to run a Node.js script (`fileHook.js`) that:

**Important Note**: When using this integration, you must run `puzzle-aider` instead of the regular `aider` command. The `puzzle-aider` command is automatically installed with Puzzle and handles the context file management.

1. Tracks which files are in context using `.aider.context.txt`
2. Toggles files between added/dropped states
3. Maintains a history of the last 10 actions

Each time you run the command, it will:
- Add the file if it's not in context
- Drop the file if it's already in context
- Update the context file accordingly

---
## 🔧 Troubleshooting

**Q: The tool isn't showing up in my IDE**
- Make sure you restarted your IDE after installation
- Verify the External Tools configuration exists in your IDE's config directory

**Q: I'm getting errors when running the tool**
- Ensure Node.js is installed and in your PATH
- Make sure you have write permissions to the project directory
- Check that `.aider.context.txt` exists in your project root

**Q: Can I use this with multiple IDEs?**
- Yes! Run the installer for each IDE you want to configure

---
## 🗑️ Uninstallation

To remove the integration:
1. Delete the External Tools configuration from your IDE's config directory
2. Remove any keyboard shortcuts you assigned
3. Delete `.aider.context.txt` from your project if desired
