import { Machine, hex, traceLine } from './simulator.js';
import { categories, examples } from './examples.js';

const TRACE_LIMIT = 2000;
const flagNames = ['C', 'AC', 'OV', 'P'];
const registerOrder = ['A', 'B', 'R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'SP', 'DPTR'];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
const binary = value => value.toString(2).padStart(8, '0') + 'B';

function table(headings, rows) {
  const wrap = el('div', 'tablewrap example-table');
  const grid = el('table');
  const head = el('tr');
  headings.forEach(heading => head.append(el('th', '', heading)));
  grid.append(el('thead'));
  grid.tHead.append(head);
  const body = el('tbody');
  rows.forEach(cells => {
    const row = el('tr');
    cells.forEach((cell, index) => {
      const td = el('td');
      if (index === 1) td.append(el('code', '', cell)); else td.textContent = cell;
      row.append(td);
    });
    body.append(row);
  });
  grid.append(body);
  wrap.append(grid);
  return wrap;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = el('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(area);
    area.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { copied = false; }
    area.remove();
    return copied;
  }
}

// Runs the program on the real engine to produce the execution trace shown in each card.
export function traceExample(source) {
  const machine = new Machine(source);
  const lines = [];
  while (!machine.done && machine.steps < TRACE_LIMIT) {
    const instruction = machine.step();
    lines.push(traceLine(instruction, machine));
  }
  if (machine.halted) lines.push(`HALTED / ${hex(machine.pc, 4)} jumps to itself · ${machine.steps} steps`);
  else if (machine.done) lines.push(`COMPLETE / ${machine.steps} steps · PC ${hex(machine.pc, 4)}`);
  else lines.push(`STOPPED / safety limit of ${TRACE_LIMIT} steps reached`);
  return lines;
}

function exampleCard(example, category, number, openExample) {
  const label = `${category.letter}${number}`;
  const card = el('article', 'card example-card');
  card.id = `example-${example.id}`;
  card.dataset.example = example.id;

  const top = el('div', 'example-top');
  top.append(el('span', 'tag', `EXAMPLE ${label}`), el('span', 'tag', example.executable ? 'Executable' : 'Reference only'));
  const title = el('h3', '', example.title);
  const meta = el('dl', 'example-meta');
  for (const [term, value] of [['Processor', '8051'], ['Category', category.name], ['Difficulty', example.difficulty]]) {
    const item = el('div');
    item.append(el('dt', '', term), el('dd', '', value));
    meta.append(item);
  }
  const teaches = el('p', 'example-teaches');
  teaches.append(el('b', '', 'What it teaches: '), document.createTextNode(example.teaches));

  // Left column: source, actions, explanation.
  const left = el('div', 'example-code');
  const editor = el('div', 'editor-wrap');
  const editorTop = el('div', 'editor-top');
  editorTop.append(el('span', '', `${example.id}.asm`), el('span', '', `${example.source.split('\n').length} lines`));
  const pre = el('pre', 'example-source');
  pre.tabIndex = 0;
  pre.setAttribute('aria-label', `${example.title} source code`);
  pre.append(el('code', '', example.source));
  editor.append(editorTop, pre);

  const actions = el('div', 'toolbar example-actions');
  const feedback = el('p', 'hint example-feedback');
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  if (example.executable) {
    const tryButton = el('button', 'btn primary', 'Try example ↗');
    tryButton.type = 'button';
    tryButton.dataset.action = 'try';
    tryButton.setAttribute('aria-label', `Try ${example.title} in the workbench`);
    tryButton.onclick = () => openExample(example.source, example.title);
    actions.append(tryButton);
  }
  const copyButton = el('button', 'btn', 'Copy code');
  copyButton.type = 'button';
  copyButton.dataset.action = 'copy';
  copyButton.setAttribute('aria-label', `Copy ${example.title} source code`);
  let resetLabel;
  copyButton.onclick = async () => {
    const copied = await copyText(example.source);
    copyButton.textContent = copied ? 'Copied ✓' : 'Copy failed';
    feedback.textContent = copied ? `Copied ${example.source.split('\n').length} lines, including comments.` : 'The browser blocked clipboard access. Select the code above and copy it manually.';
    clearTimeout(resetLabel);
    resetLabel = setTimeout(() => { copyButton.textContent = 'Copy code'; }, 2000);
  };
  actions.append(copyButton);
  if (!example.executable) actions.append(el('span', 'reference-only', 'REFERENCE ONLY / not executable in this simulator'));

  left.append(editor, actions, feedback, el('h4', '', 'How it works'), el('p', '', example.explanation), el('h4', '', 'Important instructions'));
  const list = el('ul', 'example-instructions');
  example.instructions.forEach(([syntax, text]) => {
    const item = el('li');
    item.append(el('code', '', syntax), el('span', '', text));
    list.append(item);
  });
  left.append(list);

  // Right column: expected results.
  const right = el('div', 'example-results');
  if (example.math?.length) {
    right.append(el('h4', '', 'Expected result'));
    const math = el('ul', 'example-math');
    example.math.forEach(line => math.append(el('li', '', line)));
    right.append(math);
  }
  const { regs = {}, ram = {}, flags, pc, steps } = example.expect;
  right.append(el('h4', '', 'Registers after execution'));
  const registerRows = registerOrder.filter(name => name in regs).map(name => {
    const value = regs[name];
    return name === 'DPTR' ? [name, hex(value, 4), '—', String(value)] : [name, hex(value), binary(value), String(value)];
  });
  if (pc !== undefined) registerRows.push(['PC', hex(pc, 4), '—', String(pc)]);
  right.append(table(['Register', 'Hex', 'Binary', 'Decimal'], registerRows));
  const ramRows = Object.entries(ram).map(([address, value]) => [hex(Number(address)), hex(value), binary(value), String(value)]);
  right.append(el('h4', '', 'Memory changes'));
  if (ramRows.length) right.append(table(['RAM address', 'Hex', 'Binary', 'Decimal'], ramRows));
  else right.append(el('p', 'hint', 'No internal RAM bytes outside the registers are changed.'));

  right.append(el('h4', '', 'Flags'));
  right.append(el('p', 'hint example-flags-before', `Before: ${example.flagsBefore}`));
  const flagRow = el('div', 'flag-row example-flag-row');
  flagRow.append(el('span', '', 'AFTER'));
  flagNames.forEach(name => {
    const pill = el('span', `flag-pill${flags[name] ? ' on' : ''}`, `${name} `);
    pill.append(el('b', '', String(flags[name])));
    flagRow.append(pill);
  });
  if (steps !== undefined) flagRow.append(el('span', 'hint', `${steps} steps`));
  right.append(flagRow);
  right.append(el('h4', '', 'Notes'), el('div', 'notice example-notes', example.notes));

  const body = el('div', 'example-body');
  body.append(left, right);

  const trace = el('details', 'example-trace');
  const summary = el('summary', '', 'Execution trace');
  const log = el('div', 'log');
  log.tabIndex = 0;
  log.setAttribute('aria-label', `${example.title} execution trace`);
  trace.append(summary, el('p', 'hint', 'Each executed instruction with its address and the state of A and the PSW flags afterwards, computed by the workbench engine.'), log);
  trace.addEventListener('toggle', () => {
    if (!trace.open || log.textContent) return;
    try { log.textContent = traceExample(example.source).join('\n'); } catch (error) { log.textContent = `ERROR / ${error.message}`; }
  });

  card.append(top, title, meta, teaches, body, trace);
  return card;
}

export function renderLibrary({ openExample }) {
  const element = id => document.getElementById(id);
  const tabs = element('exampleTabs');
  const intro = element('exampleIntro');
  const picker = element('examplePicker');
  const detail = element('exampleDetail');
  if (!tabs) return { showCategory() {} };
  element('exampleCount').textContent = `${examples.length} examples · ${categories.length} categories`;
  let current;

  function showExample(category, example) {
    const number = examples.filter(item => item.category === category.key).indexOf(example) + 1;
    [...picker.children].forEach(button => button.setAttribute('aria-pressed', String(button.dataset.example === example.id)));
    detail.replaceChildren(exampleCard(example, category, number, openExample));
  }

  function showCategory(key, scroll = false) {
    const category = categories.find(item => item.key === key) ?? categories[0];
    current = category.key;
    [...tabs.children].forEach(tab => {
      const selected = tab.dataset.category === current;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    intro.replaceChildren(el('span', 'tag', `CATEGORY ${category.letter}`), el('h3', '', category.name), el('p', '', category.intro));
    const points = el('ul', 'example-points');
    category.points.forEach(point => points.append(el('li', '', point)));
    intro.append(points);
    const items = examples.filter(item => item.category === category.key);
    picker.replaceChildren(...items.map((example, index) => {
      const button = el('button', 'example-pick');
      button.type = 'button';
      button.dataset.example = example.id;
      button.append(el('span', 'example-pick-number', `${category.letter}${index + 1}`), el('span', '', example.title));
      button.onclick = () => showExample(category, example);
      return button;
    }));
    showExample(category, items[0]);
    if (scroll) element('examples').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }

  categories.forEach(category => {
    const tab = el('button', 'example-tab');
    tab.type = 'button';
    tab.id = `exampleTab-${category.key}`;
    tab.dataset.category = category.key;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', 'examplePanel');
    tab.append(el('b', '', category.letter), document.createTextNode(` ${category.name}`));
    tab.onclick = () => showCategory(category.key);
    tab.onkeydown = event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = categories.findIndex(item => item.key === current);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? categories.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + categories.length) % categories.length;
      showCategory(categories[next].key);
      tabs.children[next].focus();
    };
    tabs.append(tab);
  });
  showCategory(categories[0].key);
  return { showCategory, showExample: id => { const example = examples.find(item => item.id === id); if (example) { showCategory(example.category); showExample(categories.find(item => item.key === example.category), example); } } };
}
