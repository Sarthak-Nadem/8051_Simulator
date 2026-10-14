import { Machine, hex } from './simulator.js';
import { instructions } from './instructions.js';

export function initializeLab() {
const element = id => document.getElementById(id);
const samples = {
  add: '; Hexadecimal: 25H + 15H = 3AH\n; Decimal: 37 + 21 = 58\nMOV A, #25H\nMOV R0, #15H\nADD A, R0',
  sub: '; Decimal: 37 - 21 = 16 (10H)\n; Clear carry to subtract without an incoming borrow\nCLR C\nMOV A, #37\nSUBB A, #21',
  mul: '; Decimal: 25 * 12 = 300 (012CH)\n; Low byte A = 2CH, high byte B = 01H, OV = 1\nMOV A, #25\nMOV B, #12\nMUL AB',
  div: '; Decimal: 37 / 5 gives quotient 7, remainder 2\nMOV A, #37\nMOV B, #5\nDIV AB',
  divzero: '; Division by zero: A and B are undefined\n; Hardware sets OV = 1 and clears C\nMOV A, #37\nMOV B, #0\nDIV AB',
  logic: '; Mask, set and toggle bits\nMOV A, #0FH\nANL A, #03H\nORL A, #80H\nXRL A, #0AH',
  carry: '; F0H + 25H = 115H: A = 15H, C = 1\nMOV A, #0F0H\nADD A, #25H',
  wrap: '; INC wraps without changing carry\nMOV A, #0FFH\nINC A',
  loop: '; Sum 5 + 4 + 3 + 2 + 1 = 0FH\nMOV R0, #5\nCLR A\nagain: ADD A, R0\nDJNZ R0, again',
  memory: '; Direct and indirect RAM addressing\nMOV 30H, #42H\nMOV R0, #30H\nMOV A, @R0\nINC @R0\nMOV 31H, A',
  subroutine: '; Call a reusable subroutine\nMOV A, #5\nLCALL double\nSJMP done\ndouble: ADD A, ACC\nRET\ndone: NOP',
  bcd: '; Packed BCD: 29 + 38 = 67\nMOV A, #29H\nADD A, #38H\nDA A'
};
let machine;
let running = null;
let dirty = false;
let failed = false;
let trace = [];
let previous = new Map();

function status(message, error = false) {
  element('simStatus').textContent = message;
  element('simStatus').className = `status ${error ? 'bad' : 'good'}`;
}
function controls() {
  element('pause').disabled = running === null;
  element('run').disabled = running !== null || (!dirty && (failed || machine?.done));
  element('step').disabled = running !== null || (!dirty && (failed || machine?.done));
  element('asm').readOnly = running !== null;
}
function pause(announce = true) {
  if (running !== null) clearInterval(running);
  running = null;
  if (announce && machine && !machine.done) status(`Paused at ${hex(machine.pc, 4)}. Step or Run to continue.`);
  controls();
}
function updateValue(id, value) {
  const target = element(id);
  if (target.textContent !== value) {
    target.textContent = value;
    target.classList.remove('changed');
    void target.offsetWidth;
    target.classList.add('changed');
  }
}
function render() {
  if (!machine) return;
  for (const [id, value] of [['A', machine.undefinedDivision ? '—' : hex(machine.a)], ['B', machine.undefinedDivision ? '—' : hex(machine.b)], ['PC', hex(machine.pc, 4)], ['DPTR', hex(machine.dptr, 4)]]) updateValue(id, value);
  for (const [name, bit] of [['C', 7], ['AC', 6], ['OV', 2], ['P', 0]]) {
    updateValue(name, machine.undefinedDivision && name === 'P' ? '—' : String(machine.flag(bit)));
    element(name).parentElement.classList.toggle('on', !(machine.undefinedDivision && name === 'P') && Boolean(machine.flag(bit)));
  }
  const bank = (machine.sfr[0x50] >> 3) & 3;
  element('stackState').textContent = `SP ${hex(machine.sfr[1])} · BANK ${bank}`;
  element('executionCount').textContent = `${machine.steps} STEP${machine.steps === 1 ? '' : 'S'}`;
  const registers = Array.from({ length: 8 }, (_, index) => [`R${index}`, machine.ram[machine.register(index)]]);
  registers.push(['A', machine.a], ['B', machine.b], ['SP', machine.sfr[1]], ['PSW', machine.sfr[0x50]]);
  element('regs').innerHTML = registers.map(([name, value]) => {
    const undefinedValue = machine.undefinedDivision && ['A', 'B', 'PSW'].includes(name);
    return `<tr class="${previous.has(name) && previous.get(name) !== value ? 'changed' : ''}"><td>${name}</td><td><code>${undefinedValue ? 'undefined' : hex(value)}</code></td><td>${undefinedValue ? '—' : value}</td><td>${undefinedValue ? '—' : value.toString(2).padStart(8, '0')}</td></tr>`;
  }).join('');
  previous = new Map(registers);
  element('ram').innerHTML = Array.from({ length: 64 }, (_, index) => {
    const address = index * 2;
    return `<tr><td>${hex(address)}</td><td><code>${hex(machine.ram[address])}</code></td><td>${hex(address + 1)}</td><td><code>${hex(machine.ram[address + 1])}</code></td></tr>`;
  }).join('');
  const next = machine.lookup.get(machine.pc);
  element('nextLine').textContent = machine.done ? 'COMPLETE / All instructions executed.' : next ? `NEXT / Line ${next.source} · ${hex(next.address, 4)} · ${next.line}` : `PC / ${hex(machine.pc, 4)}`;
  element('trace').textContent = trace.length ? trace.join('\n') : 'Program loaded. Ready to explore.';
  element('trace').scrollTop = element('trace').scrollHeight;
  controls();
}
function load() {
  pause(false);
  failed = false;
  previous.clear();
  trace = [];
  element('mathResult').textContent = 'Program loaded. Run or step through the instructions to inspect the result.';
  element('mathResult').className = 'math-result';
  try {
    machine = new Machine(element('asm').value);
    dirty = false;
    render();
    status(machine.done ? 'Your workbench is empty. Write an instruction or load an example.' : `${machine.program.length} instructions ready. Step through or run your experiment.`);
    return true;
  } catch (error) {
    machine = new Machine('');
    dirty = false;
    failed = true;
    render();
    element('nextLine').textContent = 'FIX NEEDED / Edit your program and try again.';
    status(error.message, true);
    return false;
  }
}
function executeStep() {
  if ((dirty && !load()) || failed || !machine || machine.done) return;
  try {
    const instruction = machine.step();
    if (machine.undefinedDivision) {
      pause(false);
      failed = true;
      trace.push(`${hex(instruction.address, 4)} / ${instruction.line} / A and B undefined; C=0 OV=1`);
      render();
      element('nextLine').textContent = 'UNDEFINED RESULT / Reset or load another program.';
      status('Division by zero: the 8051 sets OV = 1 and C = 0. A, B and parity are undefined, not a valid quotient or remainder. Execution is paused; reset to continue.', true);
      return;
    }
    if (instruction) trace.push(`${hex(instruction.address, 4)}  ${instruction.line.padEnd(23)} → A:${hex(machine.a)} C:${machine.flag(7)} P:${machine.flag(0)}`);
    if (trace.length > 400) trace.splice(0, trace.length - 400);
    if (machine.done) { pause(false); status(`Experiment complete. ${machine.steps} steps executed. Reset to try again.`); }
    else status(`Executed line ${instruction.source} · Next address ${hex(machine.pc, 4)}.`);
    render();
  } catch (error) {
    pause(false);
    failed = true;
    trace.push(`ERROR / ${error.message}`);
    status(error.message, true);
    render();
  }
}
element('step').onclick = executeStep;
element('run').onclick = () => {
  if (dirty && !load()) return;
  if (!machine || machine.done || failed) return;
  let runSteps = 0;
  running = setInterval(() => {
    const batch = Number(element('speed').value);
    for (let index = 0; index < batch && running !== null; index++) {
      if (runSteps++ >= 10000) { pause(false); status('Paused after 10,000 steps to protect your browser. Check for an endless loop, or Run again to continue.', true); break; }
      executeStep();
    }
  }, 140);
  controls();
  status('Running your experiment. Pause any time to inspect the state.');
};
element('pause').onclick = () => pause();
element('reset').onclick = load;
element('loadSample').onclick = () => { element('asm').value = samples[element('sample').value]; load(); };
element('asm').addEventListener('input', () => { dirty = true; failed = false; element('mathResult').textContent = 'Program edited. Run your updated instructions to get a new result.'; status('Program changed. Step or Run automatically loads your edits and resets CPU state.'); controls(); });
element('asm').addEventListener('keydown', event => {
  if (event.key === 'Tab' && !element('asm').readOnly) {
    event.preventDefault();
    const editor = element('asm');
    editor.setRangeText('  ', editor.selectionStart, editor.selectionEnd, 'end');
    editor.dispatchEvent(new Event('input'));
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); element('run').click(); }
});
function download(name, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
element('exportTrace').onclick = () => {
  if (!trace.length) { status('Run or step through your program first to create a trace.'); return; }
  download('8051-execution-trace.txt', `8051 Lab · Last ${trace.length} executed instructions\n\n${trace.join('\n')}\n`);
};
element('exportProgram').onclick = () => download('experiment.asm', element('asm').value);

const tabs = [element('registerTab'), element('memoryTab')];
function selectTab(selected, focus = false) {
  tabs.forEach(tab => {
    tab.setAttribute('aria-selected', String(tab === selected));
    tab.tabIndex = tab === selected ? 0 : -1;
    element(tab.getAttribute('aria-controls')).hidden = tab !== selected;
  });
  if (focus) selected.focus();
}
tabs.forEach(tab => {
  tab.onclick = () => selectTab(tab);
  tab.onkeydown = event => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      selectTab(event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[1] : tabs.find(candidate => candidate !== tab), true);
    }
  };
});

function renderInstructions() {
  const query = element('search').value.trim().toLowerCase();
  const category = element('category').value;
  const filtered = instructions.filter(item => (category === 'All categories' || item[1] === category) && item.slice(0, 5).join(' ').toLowerCase().includes(query));
  element('instructionCount').textContent = `${filtered.length} / 44 instructions`;
  const list = element('instructionList');
  list.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'card empty';
    empty.textContent = 'No instructions found. Try a mnemonic like MOV, or choose all categories.';
    list.append(empty);
  }
  filtered.forEach(([name, group, syntax, description, flags, example]) => {
    const card = document.createElement('article');
    card.className = 'instruction';
    card.innerHTML = '<div class="instruction-top"><code></code><span class="tag"></span></div><code class="syntax"></code><p></p><div class="flags"></div>';
    card.querySelector('code').textContent = name;
    card.querySelector('.tag').textContent = group;
    card.querySelector('.syntax').textContent = syntax;
    card.querySelector('p').textContent = description;
    card.querySelector('.flags').textContent = `FLAGS / ${flags}`;
    if (example) {
      const button = document.createElement('button');
      button.className = 'btn';
      button.textContent = 'Try in workbench ↗';
      button.setAttribute('aria-label', `Try ${name} in the workbench`);
      button.onclick = () => openExample(`; Explore ${name}\n${example}`);
      card.append(button);
    } else {
      const note = document.createElement('span');
      note.className = 'reference-only';
      note.textContent = 'REFERENCE ONLY / hardware not modeled';
      card.append(note);
    }
    list.append(card);
  });
}
element('search').addEventListener('input', renderInstructions);
element('category').addEventListener('change', renderInstructions);

const questions = [
  ['What does the # in MOV A, #25H mean?', ['An immediate constant', 'A direct RAM address', 'A comment', 'A register number'], 0, '# means immediate addressing: A receives the value 25H, not the contents of RAM address 25H.'],
  ['A = FFH. What happens after INC A?', ['A becomes 100H', 'A becomes 00H; C is unchanged', 'A stays FFH', 'C is always set'], 1, 'A is 8-bit, so FFH wraps to 00H. INC does not change the carry flag.'],
  ['Which instruction adds the incoming carry to A?', ['ADD', 'INC', 'ADDC', 'ANL'], 2, 'ADDC computes A + source + C, making it useful for multi-byte addition.'],
  ['MOV A, 30H reads what?', ['The constant 30H', 'Register R3', 'Program address 30H', 'The contents of internal RAM address 30H'], 3, 'Without #, 30H is a direct address. MOV A,#30H would load the constant instead.'],
  ['When is the 8051 parity flag P set?', ['When A contains an odd number of 1 bits', 'When A is even', 'When A is zero', 'When carry is set'], 0, 'P = 1 for odd parity in A. A = 00H has zero 1 bits, so P = 0.'],
  ['What does DJNZ R0, again do?', ['Double R0 and jump', 'Jump only if A is zero', 'Decrement R0 and jump if it is not zero', 'Clear R0 and carry'], 2, 'DJNZ decrements its register or direct-byte operand, then branches if the result is nonzero. C is unaffected.'],
  ['What does ANL A, #0FH keep?', ['Only the upper nibble', 'Only the lower nibble', 'All eight bits', 'Only the carry flag'], 1, 'Bitwise AND with 00001111B clears the upper four bits and preserves the lower four.'],
  ['After MUL AB, where is the 16-bit result?', ['Only in A', 'In DPTR', 'In R0 and R1', 'Low byte in A, high byte in B'], 3, 'MUL AB stores the low byte in A and the high byte in B. It clears C and sets OV if the result exceeds FFH.'],
  ['Before a plain subtraction with SUBB, what should you do?', ['Set C', 'Clear C', 'Clear OV', 'Set B to zero'], 1, 'SUBB subtracts source + carry from A. CLR C removes an unwanted incoming borrow.'],
  ['A = 25 decimal and B = 4. What does DIV AB produce?', ['A = 6, B = 1', 'A = 1, B = 6', 'A = 6.25, B = 0', 'A = 100, B = 0'], 0, 'Integer division stores the quotient 6 in A and the remainder 1 in B. C and OV are cleared for a nonzero divisor.'],
  ['What happens when DIV AB executes with B = 0?', ['A becomes zero', 'The program computes infinity', 'OV = 1, C = 0; A and B are undefined', 'The remainder becomes 1'], 2, 'Division by zero has no valid quotient or remainder. This lab pauses and marks undefined values instead of showing a misleading answer.'],
  ['MOV A,#25H followed by ADD A,#15H gives which result?', ['40 decimal', '58 decimal (3AH)', '25 decimal', '3AH means 310 decimal'], 1, 'The H suffix means hexadecimal: 25H is 37 decimal and 15H is 21 decimal. Their sum is 58 decimal, or 3AH.']
];
let questionIndex = 0;
let score = 0;
let answered = false;
function renderQuiz() {
  const [question, answers, correct, explanation] = questions[questionIndex];
  answered = false;
  element('quizCount').textContent = `QUESTION ${questionIndex + 1} / ${questions.length}`;
  element('quizScore').textContent = `${score} / ${questions.length} correct`;
  element('quizProgress').style.width = `${questionIndex / questions.length * 100}%`;
  element('question').textContent = question;
  element('feedback').textContent = 'Choose an answer to see the explanation.';
  element('nextQuestion').disabled = true;
  element('nextQuestion').textContent = questionIndex === questions.length - 1 ? 'See your result →' : 'Next question →';
  element('answers').replaceChildren();
  answers.forEach((answer, index) => {
    const button = document.createElement('button');
    button.className = 'answer';
    const letter = document.createElement('span');
    letter.className = 'answer-letter';
    letter.textContent = String.fromCharCode(65 + index);
    const text = document.createElement('span');
    text.textContent = answer;
    button.append(letter, text);
    button.onclick = () => {
      if (answered) return;
      answered = true;
      if (index === correct) score++;
      [...element('answers').children].forEach((option, optionIndex) => {
        option.disabled = true;
        if (optionIndex === correct) option.classList.add('correct');
        else if (optionIndex === index) option.classList.add('wrong');
      });
      element('feedback').textContent = `${index === correct ? 'Exactly right. ' : 'Not quite — here’s why. '}${explanation}`;
      element('quizScore').textContent = `${score} / ${questions.length} correct`;
      element('quizProgress').style.width = `${(questionIndex + 1) / questions.length * 100}%`;
      element('nextQuestion').disabled = false;
    };
    element('answers').append(button);
  });
}
element('nextQuestion').onclick = () => {
  if (!answered) return;
  if (questionIndex < questions.length - 1) { questionIndex++; renderQuiz(); element('question').focus({ preventScroll: true }); }
  else {
    element('quizCount').textContent = 'KNOWLEDGE CHECK COMPLETE';
    element('question').textContent = `${score} out of ${questions.length}. ${score === questions.length ? 'You know your way around the chip.' : 'Every experiment makes it click.'}`;
    element('answers').replaceChildren();
    element('feedback').textContent = 'Revisit the instruction library, try an example, or restart for another round.';
    element('nextQuestion').disabled = true;
    element('restartQuiz').focus();
  }
};
element('restartQuiz').onclick = () => { questionIndex = 0; score = 0; renderQuiz(); element('question').focus({ preventScroll: true }); };
const tasks = [...document.querySelectorAll('[data-task]')];
function updateTasks() {
  const done = tasks.filter(task => task.checked).length;
  element('taskCount').textContent = `${done} / ${tasks.length} complete`;
  element('taskProgress').style.width = `${done / tasks.length * 100}%`;
}
tasks.forEach(task => task.addEventListener('change', updateTasks));
questions.forEach(([question, answers, correct, explanation], index) => {
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = `${String(index + 1).padStart(2, '0')} / ${question}`;
  const answer = document.createElement('p');
  answer.textContent = `${answers[correct]}. ${explanation}`;
  details.append(summary, answer);
  element('vivaList').append(details);
});

function openExample(program) {
  element('asm').value = program;
  load();
  window.location.hash = 'simulator';
  element('simulator').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  element('asm').focus({ preventScroll: true });
}

document.querySelectorAll('#learn .card').forEach((card, index) => {
  const button = document.createElement('button');
  button.className = 'text-button';
  button.textContent = 'Try this concept →';
  button.onclick = () => {
    const sample = ['add', 'carry', 'memory', 'sub', 'logic', 'loop'][index];
    element('sample').value = sample;
    openExample(samples[sample]);
  };
  card.append(button);
});

element('arithmeticForm').onsubmit = event => {
  event.preventDefault();
  const result = element('mathResult');
  try {
    const base = Number(element('mathBase').value);
    const values = ['mathFirst', 'mathSecond'].map(id => {
      const input = element(id);
      const text = input.value.trim();
      const valid = base === 16 ? /^(?:0x)?[0-9a-f]{1,2}(?:h)?$/i.test(text) : /^\d{1,3}$/.test(text);
      const value = base === 16 ? parseInt(text.replace(/^0x/i, '').replace(/h$/i, ''), 16) : Number(text);
      if (!valid || value < 0 || value > 255) {
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        throw new Error(base === 16 ? 'Enter a hexadecimal byte from 00 to FF (for example 25 or 0x25).' : 'Enter a whole decimal number from 0 to 255. Use the base selector for hexadecimal.');
      }
      input.removeAttribute('aria-invalid');
      return value;
    });
    const [first, second] = values;
    const operation = element('mathOperation').value;
    const symbols = { add: '+', sub: '−', mul: '×', div: '÷' };
    const lines = [`; Decimal: ${first} ${symbols[operation]} ${second}`];
    if (operation === 'sub') lines.push('CLR C');
    lines.push(`MOV A, #${first}`);
    if (operation === 'mul' || operation === 'div') lines.push(`MOV B, #${second}`, operation === 'mul' ? 'MUL AB' : 'DIV AB');
    else lines.push(`${operation === 'sub' ? 'SUBB' : 'ADD'} A, #${second}`);
    element('asm').value = lines.join('\n');
    if (!load()) return;
    while (!machine.done && !failed) executeStep();
    if (machine.undefinedDivision) {
      result.className = 'math-result error';
      result.textContent = `${first} ÷ 0 is undefined. No valid quotient or remainder. OV = 1; C = 0. Try a nonzero divisor.`;
      return;
    }
    let summary;
    if (operation === 'div') summary = `${first} ÷ ${second} = ${machine.a}, remainder ${machine.b}. A = ${hex(machine.a)} · B = ${hex(machine.b)}.`;
    else if (operation === 'mul') summary = `${first} × ${second} = ${machine.b * 256 + machine.a} (${hex(machine.b * 256 + machine.a, 4)}). Low byte A = ${hex(machine.a)} · High byte B = ${hex(machine.b)}.`;
    else {
      const full = operation === 'add' ? first + second : first - second;
      summary = `${first} ${symbols[operation]} ${second} = ${full}. A = ${hex(machine.a)} (${machine.a} decimal).`;
      if (full > 255) summary += ' The 8-bit result wraps; C = 1 records the carry.';
      if (full < 0) summary += ' The 8-bit result wraps; C = 1 records the borrow.';
    }
    result.className = 'math-result success';
    result.textContent = `${summary} All values in the equation are decimal.`;
  } catch (error) {
    result.className = 'math-result error';
    result.textContent = error.message;
  }
};

element('mathBase').onchange = () => {
  const base = Number(element('mathBase').value);
  for (const id of ['mathFirst', 'mathSecond']) {
    const input = element(id);
    const text = input.value.trim();
    const previousBase = base === 16 ? 10 : 16;
    const valid = previousBase === 10 ? /^\d{1,3}$/.test(text) : /^(?:0x)?[0-9a-f]{1,2}(?:h)?$/i.test(text);
    const value = parseInt(text.replace(/^0x/i, '').replace(/h$/i, ''), previousBase);
    if (valid && value <= 255) input.value = base === 16 ? value.toString(16).toUpperCase().padStart(2, '0') : String(value);
    input.removeAttribute('aria-invalid');
  }
  element('mathHint').textContent = base === 16 ? 'Enter hexadecimal bytes from 00 to FF. The result also explains the decimal calculation.' : 'Use whole numbers from 0 to 255. The generated assembly and its results appear in the workbench below.';
};
for (const id of ['mathFirst', 'mathSecond', 'mathOperation']) {
  element(id).addEventListener('input', () => {
    element('mathResult').className = 'math-result';
    element('mathResult').textContent = 'Values changed. Select Calculate & run to update the program and result.';
  });
}
const navigation = element('navigation');
element('menuToggle').onclick = () => {
  const open = navigation.classList.toggle('open');
  element('menuToggle').setAttribute('aria-expanded', String(open));
};
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  navigation.classList.remove('open');
  element('menuToggle').setAttribute('aria-expanded', 'false');
}));
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    navigation.querySelectorAll('a').forEach(link => {
      const active = link.hash === `#${entry.target.id}`;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  });
}, { rootMargin: '-15% 0px -65% 0px' });
document.querySelectorAll('section[id]').forEach(section => observer.observe(section));
load();
renderInstructions();
renderQuiz();
updateTasks();

return () => {
  if (running !== null) clearInterval(running);
  observer.disconnect();
};
}
