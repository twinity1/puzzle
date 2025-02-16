# Puzzle-Aider

A specialized command that enhances Aider with two key features:

## 1. JetBrains IDE Integration

Manage your Aider context directly from your IDE:
- Add/remove files via right-click menu
- Use keyboard shortcuts
- See [setup guide](JETBRAINS_INTEGRATION.md)

then:

```bash
puzzle-aider [aider options]
```

## 2. Dynamic Setup

Programmatically configure Aider command based on:
- Current directory context
- Project structure
- Custom variables

### Common Module Structure

The `puzzle/common` directory is automatically loaded and should be structured as:

```
puzzle/
└── common/
    ├── setup.mjs     # Core setup logic
    ├── extra/        # Shared resources - those are loaded automatically
    └── custom/       # Your custom directories, those are not loaded automatically
```

Key components:
- `setup.mjs`: Core setup logic and configuration
- `extra/`: Shared resources and conventions
- `custom/`: Your project-specific directories - those are not loaded automatically

### Examples

#### 1. Loading Directory-Specific Conventions

Control which conventions are loaded based on your current directory:

```bash
cd src/backend
puzzle-aider
```

`puzzle/common/setup.mjs`:
```javascript
export async function prepare(context) {
    // Load conventions based on current directory
    if (context.config.currentDir.includes('backend')) {
        context.addReadFile('puzzle/common/custom/backend/CONVENTIONS.md');
        context.addReadFile('puzzle/common/custom/backend/ARCHITECTURE.md');
    }
    
    if (context.config.currentDir.includes('frontend')) {
        context.addReadFile('puzzle/common/custom/frontend/CONVENTIONS.md');
        context.addReadFile('puzzle/common/custom/frontend/COMPONENTS.md');
    }
}
```

#### 2. Including Entities

```bash
# Automatically include all entities
puzzle-aider --include_entities # note the underscore
```

`puzzle/common/setup.mjs`:
```javascript
export async function prepare(context) {
    if (context.vars.INCLUDE_ENTITIES) {
        context.addReadFile('src/entities/*.cs');
    }
}
```

#### 3. Including Core Components

Include important interfaces and components automatically.

```bash
puzzle-aider
```

`puzzle/common/setup.mjs`:
```javascript
export async function prepare(context) {
    // Backend core services
    context.addReadFile('src/Core/Services/ICurrentUserService.cs');
    context.addReadFile('src/Core/Services/IDateTimeProvider.cs');
    
    // Frontend core components based on the current directory
    if (context.config.currentDir.includes('frontend')) {
        context.addReadFile('src/components/common/Button.vue');
        context.addReadFile('src/components/common/Input.vue');
    }
}
```
