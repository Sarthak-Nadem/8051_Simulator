// Browser tests: load the real site in headless Chromium and exercise every button.
// Requires a Chromium build for Playwright: `npx playwright-core install chromium` (one time).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { examples, categories } from '../public/lab/examples.js';
import { samples } from '../public/lab/samples.js';
import { instructions } from '../public/lab/instructions.js';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  try {
    const body = await readFile(join(root, path || 'index.html'));
    response.writeHead(200, { 'content-type': types[extname(path || 'index.html')] ?? 'application/octet-stream' });
    response.end(body);
  } catch { response.writeHead(404); response.end('not found'); }
});
await new Promise(resolve => server.listen(0, resolve));
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
test.after(async () => { await browser.close(); server.close(); });

async function openPage(viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/fonts\.g/.test(message.text())) errors.push(message.text()); });
  // Record what the Copy buttons send to the clipboard.
  await page.addInitScript(() => {
    window.__copied = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__copied.push(text); } } });
  });
  await page.clock.install();
  await page.goto(url);
  await page.waitForFunction(() => document.querySelectorAll('#instructionList .instruction').length > 0);
  return { page, errors, context };
}
const text = (page, selector) => page.locator(selector).first().textContent();
const hex = value => value.toString(16).toUpperCase().padStart(2, '0') + 'H';

test('original sections, content and navigation are intact with no dead links', async () => {
  const { page, errors, context } = await openPage();
  assert.equal(await page.title(), '8051 Lab — A little code. A lot of discovery.');
  for (const id of ['simulator', 'learn', 'examples', 'instructions', 'quiz', 'roadmap', 'viva']) assert.equal(await page.locator(`section#${id}`).count(), 1, id);
  const hashes = await page.$$eval('a[href^="#"]', links => links.map(link => link.getAttribute('href')).filter(href => href !== '#'));
  for (const hash of hashes) assert.equal(await page.locator(hash).count(), 1, `link target ${hash}`);
  assert.deepEqual(await page.$$eval('#navigation a', links => links.map(link => link.textContent)), ['Simulator', 'Learn', 'Examples', 'Instruction set', 'Practice', 'Project guide']);
  assert.equal(await page.locator('#instructionList .instruction').count(), 44);
  assert.equal(await page.locator('#vivaList details').count(), 12);
  assert.equal(await page.locator('#sample option').count(), 12);
  assert.equal(await page.locator('#checklist input').count(), 7);
  assert.equal(await page.locator('#learn .card').count(), 6);
  // Theme preserved.
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--mint').trim()), '#bd4b1c');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(250, 247, 239)');
  assert.deepEqual(errors, []);
  await context.close();
});

test('arithmetic lab, quiz, checklist and instruction search still work', async () => {
  const { page, context } = await openPage();
  await page.click('#arithmeticForm button[type=submit]');
  assert.match(await text(page, '#mathResult'), /37 \+ 21 = 58/);
  await page.selectOption('#mathOperation', 'div'); await page.fill('#mathSecond', '0');
  await page.click('#arithmeticForm button[type=submit]');
  assert.match(await text(page, '#mathResult'), /undefined/);
  await page.locator('#answers .answer').first().click();
  assert.match(await text(page, '#feedback'), /Exactly right/);
  assert.equal(await page.locator('#nextQuestion').isEnabled(), true);
  await page.locator('#checklist input').nth(0).check();
  assert.equal(await text(page, '#taskCount'), '1 / 7 complete');
  await page.fill('#search', 'carry');
  assert.ok(await page.locator('#instructionList .instruction').count() > 0);
  await page.selectOption('#category', 'Branching'); await page.fill('#search', '');
  assert.equal(await text(page, '#instructionCount'), '16 / 44 instructions');
  await context.close();
});

test('Step, Run, Reset, trace and error handling in the workbench', async () => {
  const { page, context } = await openPage();
  await page.click('#step');
  assert.equal(await text(page, '#executionCount'), '1 STEP');
  assert.equal(await text(page, '#PC'), '0002H');
  assert.equal(await text(page, '#A'), '25H');
  await page.click('#run');
  await page.clock.runFor(2000);
  assert.match(await text(page, '#simStatus'), /Experiment complete\. 3 steps/);
  assert.equal(await text(page, '#A'), '3AH');
  assert.match(await text(page, '#trace'), /ADD A, R0 .*A:3AH C:0 AC:0 OV:0 P:0/);
  assert.equal(await page.locator('#step').isDisabled(), true);
  await page.click('#reset');
  assert.equal(await text(page, '#executionCount'), '0 STEPS');
  assert.equal(await text(page, '#PC'), '0000H');
  assert.equal(await text(page, '#A'), '00H');
  // Invalid program: clear error, no stale state, editing re-enables.
  await page.fill('#asm', 'MOV A, #5\nFOO A');
  await page.click('#step');
  assert.match(await text(page, '#simStatus'), /Line 2: unknown instruction/);
  assert.equal(await page.locator('#simStatus.bad').count(), 1);
  assert.equal(await text(page, '#A'), '00H');
  await page.fill('#asm', 'MOV A, #5\nADD A, A');
  await page.click('#step'); await page.click('#step');
  assert.match(await text(page, '#simStatus'), /ADD A, ACC/);
  assert.equal(await text(page, '#A'), '05H', 'state rolled back to before the failing line');
  // Division by zero.
  await page.selectOption('#sample', 'divzero'); await page.click('#loadSample');
  await page.click('#run'); await page.clock.runFor(2000);
  assert.match(await text(page, '#simStatus'), /Division by zero/);
  // Halt idiom.
  await page.fill('#asm', 'MOV A, #7\nhere: SJMP here');
  await page.click('#run'); await page.clock.runFor(2000);
  assert.match(await text(page, '#simStatus'), /Program halted/);
  assert.match(await text(page, '#nextLine'), /HALTED/);
  await context.close();
});

test('endless loops stop at the 10,000-step safety limit with a clear message', async () => {
  const { page, context } = await openPage();
  await page.fill('#asm', 'again: INC A\nSJMP again');
  await page.selectOption('#speed', '16');
  await page.click('#run');
  await page.clock.runFor(Math.ceil(10000 / 16) * 140 + 1000);
  assert.match(await text(page, '#simStatus'), /Paused after 10,000 steps/);
  assert.equal(await text(page, '#executionCount'), '10000 STEPS');
  assert.equal(await page.locator('#run').isEnabled(), true);
  await context.close();
});

test('every Learn card “Try this concept” and “See ready-made examples” button works', async () => {
  const { page, context } = await openPage();
  const mapping = ['add', 'carry', 'memory', 'sub', 'logic', 'loop'];
  const tries = page.locator('#learn .card button', { hasText: 'Try this concept' });
  assert.equal(await tries.count(), 6);
  for (let index = 0; index < 6; index++) {
    await tries.nth(index).click();
    assert.equal(await page.inputValue('#asm'), samples[mapping[index]]);
    assert.match(await text(page, '#simStatus'), /^Loaded “/);
    assert.equal(await page.evaluate(() => location.hash), '#simulator');
  }
  const browse = page.locator('#learn .card button', { hasText: 'See ready-made examples' });
  assert.equal(await browse.count(), 5);
  const expected = ['wrap', 'memory', 'carry', 'logic', 'loop'];
  for (let index = 0; index < 5; index++) {
    await browse.nth(index).click();
    assert.equal(await page.getAttribute(`#exampleTab-${expected[index]}`, 'aria-selected'), 'true');
    const top = await page.evaluate(() => document.getElementById('examples').getBoundingClientRect().top);
    assert.ok(top >= 0 && top < 200, `examples section scrolled into view (${top})`);
  }
  await context.close();
});

test('every instruction-reference “Try in workbench” button loads and runs cleanly', async () => {
  const { page, context } = await openPage();
  await page.selectOption('#speed', '16');
  const buttons = page.locator('#instructionList .instruction .btn');
  assert.equal(await buttons.count(), 41);
  const executable = instructions.filter(item => item[5]);
  for (let index = 0; index < executable.length; index++) {
    const [name, , , , , example] = executable[index];
    await buttons.nth(index).click();
    assert.equal(await page.inputValue('#asm'), `; Explore ${name}\n${example}`);
    await page.click('#run');
    await page.clock.runFor(2000);
    assert.match(await text(page, '#simStatus'), /complete|halted/i, name);
  }
  await context.close();
});

test('every example: Copy copies the full source and Try loads, resets, scrolls and runs it', async () => {
  const { page, errors, context } = await openPage();
  await page.selectOption('#speed', '16');
  assert.equal(await page.locator('#exampleTabs [role=tab]').count(), categories.length);
  let checked = 0;
  for (const category of categories) {
    await page.click(`#exampleTab-${category.key}`);
    const items = examples.filter(example => example.category === category.key);
    assert.equal(await page.locator('#examplePicker .example-pick').count(), items.length);
    for (const example of items) {
      await page.click(`#examplePicker [data-example="${example.id}"]`);
      const card = page.locator(`#example-${example.id}`);
      assert.equal(await card.locator('h3').textContent(), example.title);
      for (const label of ['Processor', 'Category', 'Difficulty']) assert.equal(await card.locator('dt', { hasText: label }).count(), 1);
      assert.equal(await card.locator('.example-source').textContent(), example.source);
      // Copy.
      await card.locator('[data-action=copy]').click();
      assert.equal(await page.evaluate(() => window.__copied.at(-1)), example.source);
      assert.equal(await card.locator('[data-action=copy]').textContent(), 'Copied ✓');
      // Trace.
      await card.locator('.example-trace summary').click();
      assert.match(await card.locator('.example-trace .log').textContent(), /(COMPLETE|HALTED) \//);
      // Try: dirty the CPU state first so the reset is observable.
      await page.fill('#asm', 'MOV A, #0EEH'); await page.click('#step');
      await page.click(`#examplePicker [data-example="${example.id}"]`);
      await card.locator('[data-action=try]').click();
      assert.equal(await page.inputValue('#asm'), example.source);
      assert.equal(await text(page, '#simStatus'), `Loaded “${example.title}”. CPU reset — Step or Run to execute it.`);
      assert.equal(await text(page, '#executionCount'), '0 STEPS');
      assert.equal(await text(page, '#A'), '00H');
      const top = await page.evaluate(() => document.getElementById('simulator').getBoundingClientRect().top);
      assert.ok(Math.abs(top) < 120, `simulator scrolled into view (${top})`);
      await page.click('#run');
      await page.clock.runFor(4000);
      assert.match(await text(page, '#simStatus'), /complete|halted/i, example.id);
      assert.equal(await text(page, '#A'), hex(example.expect.regs.A ?? 0), `${example.id} A register in the UI`);
      for (const flag of ['C', 'AC', 'OV', 'P']) assert.equal(await text(page, `#${flag}`), String(example.expect.flags[flag]), `${example.id} ${flag}`);
      await page.click('#examples .example-tabs [aria-selected=true]');
      checked++;
    }
  }
  assert.equal(checked, examples.length);
  assert.deepEqual(errors, []);
  await context.close();
});

test('mobile: menu toggle, navigation, scrolling and no horizontal overflow', async () => {
  const { page, context } = await openPage({ width: 390, height: 844 });
  assert.equal(await page.isVisible('#menuToggle'), true);
  assert.equal(await page.isVisible('#navigation'), false);
  await page.click('#menuToggle');
  assert.equal(await page.getAttribute('#menuToggle', 'aria-expanded'), 'true');
  assert.equal(await page.isVisible('#navigation'), true);
  await page.click('#navigation a[href="#examples"]');
  assert.equal(await page.isVisible('#navigation'), false, 'menu closes after choosing a link');
  assert.equal(await page.getAttribute('#menuToggle', 'aria-expanded'), 'false');
  const top = await page.evaluate(() => document.getElementById('examples').getBoundingClientRect().top);
  assert.ok(top >= 0 && top < 160, `examples section at top (${top})`);
  for (const category of categories) {
    await page.click(`#exampleTab-${category.key}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `no horizontal page overflow in ${category.key} (${overflow}px)`);
  }
  await page.locator('#exampleDetail [data-action=try]').click();
  const simTop = await page.evaluate(() => document.getElementById('simulator').getBoundingClientRect().top);
  assert.ok(Math.abs(simTop) < 120, `Try scrolls to the simulator on mobile (${simTop})`);
  await context.close();
});

test('responsive layout has no horizontal overflow at common widths', async () => {
  for (const width of [320, 440, 600, 768, 1000, 1440]) {
    const { page, context } = await openPage({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `${width}px overflow ${overflow}`);
    const pickerVisible = await page.isVisible('#examplePicker .example-pick');
    assert.ok(pickerVisible, `${width}px example picker visible`);
    await context.close();
  }
});
