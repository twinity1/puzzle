# Usage Guide

---
## 🧙‍♂️ Create Piece Using the Wizard

To create a new piece, use the `puzzle create-piece` command to launch the interactive wizard.

While the generated result may require some refinement, it provides a great starting point.

Here's an example of what your piece creation prompt might look like:

```
Create scaffolding for entity creation with the following requirements:

- Use an editor prompt to collect entity details from the user
- Reference these example files:
  => src/Data/Entities/User.cs 
  => src/Data/EntityConfigurations/UserEntityTypeConfiguration.cs
```

For a detailed explanation of the piece structure, please refer to the following chapters.

---
## 🔨 Piece structure

1. A "piece" represents a set of templates for code scaffolding. It can be used for various purposes like endpoint creation, CRUD operations, test generation, etc.
2. To create a new piece, add a new folder at `puzzle/pieces/<YOUR_PIECE_NAME>`
3. The standard piece structure is as follows:

```
repo/
└── puzzle/
    ├── pieces/           # Action/scaffolding templates
    │   └── YOUR_PIECE/ 
    │       ├── extra/
    │       │   ├── examples/     # Example files for reference
    │       │   └── conventions/  # Piece-specific conventions
    │       └── setup.mjs         # Configuration file that contains prompt
```

4. The `template` folder contains files that serve as references for LLM scaffolding:

- Files in this directory must mirror the repository's folder structure
- You can define custom variables in folder and file names

Example:

```
repo
├── puzzle/
│   └── pieces/           # Action/scaffolding templates
│       └── CreateResourceEndpoint /
│           ├── setup.mjs
│           └── template/
│               └── src/
│                   ├── {MODULE_NAME}/
│                   │   └── UseCases/
│                   │       └── {PLURAL_ENTITY_NAME}/
│                   │           ├── Create{ENTITY_NAME}Command.cs
│                   │           ├── Create{ENTITY_NAME}CommandHandler.cs
│                   │           ├── Create{ENTITY_NAME}Dto.cs
│                   │           └── {ENTITY_NAME}CreateMappingExtensions.cs
│                   └── Gateway/
│                       └── Controllers/
│                           └── {MODULE_NAME}/
│                               └── {PLURAL_ENTITY_NAME}Controller.cs
└── src/ # Result with filled variables
    ├── UserManagement/ # originally was {MODULE_NAME}
    │   └── UseCases/
    │       └── Users/  # originally was {PLURAL_ENTITY_NAME}
    │           ├── CreateUserCommand.cs # {ENTITY_NAME} is filled
    │           ├── CreateUserCommandHandler.cs
    │           ├── CreateUserDto.cs
    │           └── UserCreateMappingExtensions.cs
    └── Gateway/
        └── Controllers/
            └── UserManagement/
                └── UsersController.cs # {PLURAL_ENTITY_NAME} is filled
```

Here's an example of what a template file might look like:


`{PLURAL_ENTITY_NAME}Controller.cs`
```csharp
namespace SomeNamespace;

[ApiController]
[Authorize]
public class ExampleController : ControllerBase
{
    [HttpPost(Name = "api.v1.admin.examples.create")]
    [ProducesResponseType<IEnvelope<ExampleDetailDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult> CreateAsync([FromBody] CreateExampleDto dto, CancellationToken cancellationToken)
    {
        var result = await Sender.Send(new CreateExampleCommand(dto), cancellationToken);

        return result;
    }
}
```

You can often be lazy - the LLM will intelligently determine details like the correct namespace based on the folder structure.

5. Define the prompt for your piece in setup.mjs:

```
repo
├── puzzle/
│   └── pieces/           
│       └── CreateResourceEndpoint /
│           ├── setup.mjs
```

For a "Create endpoint" action, the prompt might look like this:

`setup.mjs`
```js

export async function prompt(context) {
    return {
        prompt: `Implement the operation: ${context.vars['PIECE_NAME']} for entity ${context.vars['ENTITY_NAME']} in module ${context.vars['MODULE_NAME']}.
    Add endpoint to the controller from the example. Be precise to example files as you can.`
    };
}
```

TIP: The `context.vars` object contains variables populated during scaffolding. The `PIECE_NAME` variable is built-in. In our example, this would be `CreateResourceEndpoint`.

---
## 🏗️ Using Your Piece for Code Scaffolding

1. Run the `puzzle` command in your repository root
2. Select your piece/action using the SPACE BAR, then press ENTER to confirm (multiple selections are supported)
3. Provide values for all required variables
4. The configured `aider` command will execute, generating code based on your file structure and prompt

---
## 💡 Tips

### Providing Additional Context

In some cases, you'll need to provide the LLM with more context. For instance, when building CRUD operations, the LLM typically requires an entity definition to work with.

In `setup.mjs`, you can add read-only files within the `prepare` function:

```js
export async function prepare(context) {
    // include entity - you can use variables in the path (or introduce the new variables!)
    context.addReadFile('src/Data/Entities/{ENTITY_NAME}.cs');
    
    // or to include all entites
    context.addReadFile('src/Data/Entities/*.cs');
    
    // or to include whole Data layer (but this can get pretty expensive)
    context.addReadFile('src/Data/**/*.cs');
}

export async function prompt(context) {
    ...
}
```

- **All paths are relative to the git repository root path (same as in aider)**

### Chat Mode

When you want to have a more interactive conversation, you can enable chat mode by passing the CHAT argument:

```bash
puzzle --chat
```

This allows for back-and-forth conversation in the aider chat.

Before submitting your prompt to the LLM, you can add more files to the context using the JetBrains IDE integration:
- Right-click a file and select "Add/Drop file in Aider context"
- Or use your configured keyboard shortcut

For setup instructions, see [JetBrains IDE Integration](JETBRAINS_INTEGRATION.md).

### Shared Configuration

You can define templates and prompts that are shared across all pieces by creating a `common` folder:

```
puzzle/
├── pieces/           # Action templates
├── common/
│   ├── extra/       # Shared resources
│   └── setup.mjs    # Common setup logic
│   └── custom       # You can create your own directories and use them dynamically in prepare()
```

- The `setup.mjs` file follows the same structure as individual pieces
  - You for example add common files for all pieces
  - Or you can define common variables that are used in all pieces

```js
export async function prepare(context) {
  //EXAMPLE 1:
    
  // for example User entity is important so we want to include it in all pieces
  context.addReadFile('src/Data/Entities/User.cs');

  //EXAMPLE 2:
  
  // We have pieces "CreateEndpoint", "UpdateEndpoint", "DeleteEndpoint" and we want to have a short variable PIECE_ENDPOINT_NAME that is "Create", "Update", "Delete"
  if (context.vars['PIECE_NAME'].includes('Endpoint')) {
    context.vars['PIECE_ENDPOINT_NAME'] = context.vars['PIECE_NAME'].replace('Endpoint', '');
  }
  
  // now variable PIECE_ENDPOINT_NAME will be filled automatically without need to ask user for it

  //EXAMPLE 3:
  
  // you can add conventions based from which directory you are running puzzle-aider or puzzle
  if (context.config.currentDir.includes('frontend')) {
      context.addReadFile('puzzle/common/custom/FRONTEND_CONVENTIONS.MD');
  }
  
  if (context.config.currentDir.includes('backend')) {
      context.addReadFile('puzzle/common/custom/BACKEND_CONVENTIONS.MD');
  }
  
  // EXAMPLE 4:
  
  // you can add file that will be written to based on some condition
  if (someCondition) {
      context.addReadFile('some/path/ValidatorExample.cs'); // provide example of the Validator
      context.addWriteFile('some/other/path/{ENTITY_NAME}Validator.cs'); // provide path where will be the validator created
  }
 
  // if you want to see all available parameters then just `throw context` and run puzzle-aider command;
  throw context;
}

export async function setup(context) {
    // variables are already resolved here (in context.vars)
    
}
```


- The `extra` folder can contain additional reference files
  - These files are automatically included in all scaffolding actions
  - For example `extra/conventions.txt` can store your codebase conventions

**Note: the `common` setup will be also included automatically when you run `puzzle-aider`**

### Custom variables

You can pass custom variables or pre-resolve variables using the command line:

`puzzle --my-custom-variable`

These variables are accessible in `setup.mjs` through the `context.vars` object. Note that variable names are automatically converted to uppercase.

```js
export async function prompt(context) {
    return {
        prompt: `${context.vars['MY-CUSTOM-VARIABLE']}`
    }
}
```

#### Variable Types

You can configure how variables are prompted by setting their type in `setup.mjs`. There are three types available:

1. **search (default)** - Shows a searchable list of choices based on existing directories/files:
```js
context.varListTypes.ENTITY_NAME = {
    type: 'search',
    onlyDirs: true,  // Only show directories as choices (default false)
};
```

2. **list** - Shows a fixed list of choices:
```js
context.varListTypes.SERVICE_NAME = {
    type: 'list',
    choices: [
        'finance',
        'stock',
    ]
};
```

3. **input** - Shows a simple text input field:
```js
context.varListTypes.CUSTOM_NAME = {
    type: 'input'
};
```

- The `onlyDirs` option (available for search type) will only show directories as choices when scanning the repository.
- You can add those to common setup.js into `prepare` function

### History

You can re-run last 10 piece runs.

- Simply run puzzle with `--history` argument and select an action you want to rerun
- In combination with custom user prompt you can iterate on the generated code
- Or you can run different piece with common variables (e.g. ENTITY_NAME) will be automatically filled

command: `puzzle --history`
