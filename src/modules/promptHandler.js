async function getAndProcessPrompt(modules, actionContext, puzzleDir) {
    let prompt = '';

    for (const module of modules) {
        if (module.setup && module.setup.prompt !== undefined) {
            const promptCallResult = await module.setup.prompt(actionContext);

            if (promptCallResult === null) {
                // ignore
            } else if (typeof promptCallResult === 'object') {
                if (promptCallResult.prompt.trim() !== '') {
                    prompt += promptCallResult.prompt + "\n\n";
                }
            } else if (typeof promptCallResult === 'string') {
                if ( promptCallResult.trim() !== '') {
                    prompt += promptCallResult + "\n\n";
                }
            }
            else {
                throw 'prompt() must return string or object that contains \'prompt\' string property';
            }
        }
    }

    return prompt;
}

module.exports = {
    getAndProcessPrompt
};
