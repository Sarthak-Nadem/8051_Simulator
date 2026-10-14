# 8051 Lab — with Examples Library
A browser-only 8051 assembly learning site, extended from the original 8051 Lab, with a library of 37 executable examples.
Built with plain HTML, CSS and ES modules. There is no build step. Tests use Node's test runner, plus Playwright for the browser tests.

## Run locally
- `npx serve public` (or `netlify dev --port 8889`)
- `npm test`: engine and example tests
- `npx playwright-core install chromium && npm run test:ui`: browser tests

## Roadmap
See PLAN.md. The remaining work is three browser-test fixes.
