# Agent notes
- `public/` is the deployed site (static). `netlify.toml` publishes it with no build command.
- `public/lab/simulator.js`: the execution engine (`Machine`). `app.js`: the workbench UI (copied from the original). `samples.js`: the workbench sample menu. `examples.js`: library data, with hand-computed `expect` values. `library.js`: renders the example cards. `examples.css`: styles for the library, using only the original CSS variables.
- `reference/original-site/`: an untouched copy of the original live site's source. Never edit it.
- Every example's `expect` values must be computed by hand from 8051 semantics. `tests/examples.test.mjs` checks them against the engine.
- Keep the original theme. Reuse the `.card`, `.tag`, `.btn` and `.notice` classes.
- Open work is listed in PLAN.md.
