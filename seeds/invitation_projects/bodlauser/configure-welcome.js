/** Compatibility entry point: the cocktail scene now uses biblical_quote. */
const { run } = require('./configure-quote-scene');
run().catch(error => { console.error(error.message); process.exitCode = 1; });
