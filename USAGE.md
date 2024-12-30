# Usage Guide

## Create Piece Using the Wizard

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

## Creating a Piece

1. A "piece" represents a set of templates for code scaffolding. It can be used for various purposes like endpoint creation, CRUD operations, test generation, etc.
2. To create a new piece, add a new folder at `puzzle/pieces/<YOUR_PIECE_NAME>`
3. The standard piece structure is as follows:

```
repo/
└── puzzle/
    ├── pieces/           # Action/scaffolding templates
    │   └── YOUR_PIECE/
    │       ├── template/
    │       │   └── your template files with the structure of repo 
    │       └── setup.mjs # Configuration file that contains prompt
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

## Using Your Piece for Code Scaffolding

1. Run the `puzzle` command in your repository root
2. Select your piece/action using the SPACE BAR, then press ENTER to confirm (multiple selections are supported)
3. Provide values for all required variables
4. The configured `aider` command will execute, generating code based on your file structure and prompt


## Tips

### Dynamic Prompt Extension

You can dynamically extend prompts using the [inquirer.js](https://www.npmjs.com/package/inquirer) library, which handles command-line user interactions.

Here's how to extend a prompt:

```js

export async function prompt(context) {
    const {userPrompt} = await context.inquirerPrompt({
        type: 'input', // or 'editor' for multi line
        name: 'userPrompt',
        message: `Enter custom instructions:`,
    });

    return {
        prompt: `Implement the operation: ${context.vars['PIECE_NAME']} for entity ${context.vars['ENTITY_NAME']} in module ${context.vars['MODULE_NAME']}.
    Add endpoint to the controller from the example. Be precise to example files as you can.
    
    Extra requirements:
    ${userPrompt}
    `
    };
}
```

This approach prompts users to provide additional implementation requirements, such as specific validation rules or endpoint return values.

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

### History

You can re-run last 10 piece runs.

- Simply run puzzle with `--history` argument and select an action you want to rerun
- In combination with custom user prompt you can iterate on the generated code
- Or you can run different piece with common variables (e.g. ENTITY_NAME) will be automatically filled

command: `puzzle --history`


### Shared Configuration

You can define templates and prompts that are shared across all pieces by creating a `common` folder:

```
puzzle/
├── pieces/           # Action templates
├── common/
│   ├── extra/       # Shared resources
│   ├── template/    # Common templates
│   └── setup.mjs    # Common setup logic
```

- The `setup.mjs` file follows the same structure as individual pieces
  - You can define prompts that apply to all pieces
- The `extra` folder can contain additional reference files
  - These files are automatically included in all scaffolding actions
  - For example, `extra/conventions.txt` can store your codebase conventions

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

### Chat Mode

When you want to have a more interactive conversation with the LLM, you can enable chat mode by passing the CHAT variable:

```bash
puzzle --chat
```

This allows for back-and-forth conversation with the AI.
