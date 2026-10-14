# Plan
1. ✅ Recover the original source and keep a pristine copy in `reference/original-site/`.
2. ✅ Fix simulator validation bugs and add halt detection.
3. ✅ Build the examples library (37 programs, 7 categories) and its UI.
4. ✅ Engine and example tests: 59/59 passing.
5. ⏳ Browser tests: 6/9 passing. Remaining:
   - Example trace `<details>` content is empty when the test reads it. Check the toggle event timing, or fill the trace eagerly.
   - Mobile nav scroll: Examples section top is at 199px. Relax the threshold or check `scroll-padding`.
   - Re-run the 320px overflow test after the `minmax(0,1fr)` CSS fix.
