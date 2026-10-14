// Runs every library example on the real engine and compares the result with the hand-calculated
// expectations published in each example card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Machine } from '../public/lab/simulator.js';
import { categories, examples } from '../public/lab/examples.js';
import { traceExample } from '../public/lab/library.js';

const flagBits = { C: 7, AC: 6, OV: 2, P: 0 };
const required = ['id', 'category', 'title', 'difficulty', 'teaches', 'source', 'explanation', 'instructions', 'flagsBefore', 'expect', 'notes'];

test('library covers all seven categories with consistent layout data', () => {
  assert.deepEqual(categories.map(c => c.letter), ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  const ids = new Set();
  for (const example of examples) {
    for (const field of required) assert.ok(example[field] !== undefined && example[field] !== '', `${example.id}: missing ${field}`);
    assert.ok(categories.some(c => c.key === example.category), `${example.id}: unknown category`);
    assert.ok(['Beginner', 'Intermediate', 'Advanced'].includes(example.difficulty), example.id);
    assert.ok(!ids.has(example.id), `duplicate id ${example.id}`); ids.add(example.id);
    assert.ok(example.source.split('\n').filter(line => line.includes(';')).length >= 2, `${example.id}: source should be commented`);
    assert.ok(example.instructions.length >= 1, `${example.id}: explains instructions`);
    assert.deepEqual(Object.keys(example.expect.flags).sort(), ['AC', 'C', 'OV', 'P'], `${example.id}: all four flags listed`);
    assert.equal(example.executable, true, `${example.id}: executable`);
  }
  for (const category of categories) assert.ok(examples.filter(e => e.category === category.key).length >= 4, `${category.key} has at least four examples`);
});

for (const example of examples) {
  test(`example ${example.id}: engine result matches the published expectation`, () => {
    const machine = new Machine(example.source);
    while (!machine.done) {
      assert.ok(machine.steps < 5000, 'terminates');
      machine.step();
    }
    const { regs = {}, ram = {}, flags, pc, steps } = example.expect;
    for (const [name, value] of Object.entries(regs)) {
      const actual = name === 'A' ? machine.a : name === 'B' ? machine.b : name === 'SP' ? machine.sfr[1] : name === 'DPTR' ? machine.dptr : machine.ram[machine.register(Number(name[1]))];
      assert.equal(actual, value, `${name}`);
    }
    for (const [address, value] of Object.entries(ram)) assert.equal(machine.ram[Number(address)], value, `RAM ${Number(address).toString(16)}H`);
    for (const [name, value] of Object.entries(flags)) assert.equal(machine.flag(flagBits[name]), value, `flag ${name}`);
    if (pc !== undefined) assert.equal(machine.pc, pc, 'PC');
    if (steps !== undefined) assert.equal(machine.steps, steps, 'steps');
    const trace = traceExample(example.source);
    assert.match(trace.at(-1), /^(COMPLETE|HALTED)/);
    assert.equal(trace.length, machine.steps + 1);
  });
}
