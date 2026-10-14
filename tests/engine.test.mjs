// Tests for the real execution engine in public/lab/simulator.js.
// Reference values come from independent models (bit-level ripple-carry ALU, decimal arithmetic,
// plain integer maths) — never from the simulator itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Machine, numeric, hex } from '../public/lab/simulator.js';
import { samples } from '../public/lab/samples.js';
import { instructions } from '../public/lab/instructions.js';

const C = 7, AC = 6, OV = 2, P = 0;
function run(source, limit = 10000) {
  const machine = new Machine(source);
  while (!machine.done) {
    if (machine.steps >= limit) throw new Error('step limit reached');
    machine.step();
  }
  return machine;
}
const flags = m => ({ C: m.flag(C), AC: m.flag(AC), OV: m.flag(OV), P: m.flag(P) });
const reg = (m, n) => m.ram[m.register(n)];
const parity = value => value.toString(2).split('').filter(bit => bit === '1').length % 2;

// Bit-level ripple models following the Intel MCS-51 definitions:
// CY = carry/borrow out of bit 7, AC = out of bit 3, OV = carry/borrow out of bit 6 XOR out of bit 7.
function rippleAdd(a, b, carryIn) {
  let carry = carryIn, result = 0; const out = [];
  for (let i = 0; i < 8; i++) {
    const x = (a >> i) & 1, y = (b >> i) & 1;
    result |= (x ^ y ^ carry) << i;
    carry = (x & y) | (x & carry) | (y & carry);
    out[i] = carry;
  }
  return { result, C: out[7], AC: out[3], OV: out[7] ^ out[6] };
}
function rippleSub(a, b, borrowIn) {
  let borrow = borrowIn, result = 0; const out = [];
  for (let i = 0; i < 8; i++) {
    const x = (a >> i) & 1, y = (b >> i) & 1;
    result |= (x ^ y ^ borrow) << i;
    borrow = ((1 - x) & y) | ((1 - x) & borrow) | (y & borrow);
    out[i] = borrow;
  }
  return { result, C: out[7], AC: out[3], OV: out[7] ^ out[6] };
}

function exhaustive(op) {
  const machine = new Machine(`${op} A, R0`);
  let checked = 0;
  for (let a = 0; a < 256; a++) for (let b = 0; b < 256; b++) for (const carry of [0, 1]) {
    machine.pc = 0; machine.done = false; machine.sfr[0x50] = 0;
    machine.a = a; machine.ram[0] = b; machine.flag(C, carry);
    machine.step();
    const expected = op === 'SUBB' ? rippleSub(a, b, carry) : rippleAdd(a, b, op === 'ADD' ? 0 : carry);
    const actual = { result: machine.a, C: machine.flag(C), AC: machine.flag(AC), OV: machine.flag(OV) };
    if (actual.result !== expected.result || actual.C !== expected.C || actual.AC !== expected.AC || actual.OV !== expected.OV || machine.flag(P) !== parity(expected.result)) {
      assert.fail(`${op} A=${hex(a)} src=${hex(b)} C=${carry}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    }
    checked++;
  }
  return checked;
}

test('1. ADD: carry generation (exhaustive, all 65,536 operand pairs)', () => {
  assert.equal(exhaustive('ADD'), 131072);
  const m = run('MOV A, #0F0H\nADD A, #25H');
  assert.equal(m.a, 0x15); assert.deepEqual(flags(m), { C: 1, AC: 0, OV: 0, P: 1 });
  const m2 = run('SETB C\nMOV A, #10H\nADD A, #10H');
  assert.equal(m2.a, 0x20); assert.equal(m2.flag(C), 0, 'ADD ignores and overwrites the incoming carry');
});

test('2. ADDC: addition with carry (exhaustive, C = 0 and C = 1)', () => {
  assert.equal(exhaustive('ADDC'), 131072);
  const m = run('MOV A, #0FFH\nSETB C\nADDC A, #00H');
  assert.equal(m.a, 0x00); assert.deepEqual(flags(m), { C: 1, AC: 1, OV: 0, P: 0 });
});

test('3. SUBB: subtraction includes the incoming borrow (exhaustive)', () => {
  assert.equal(exhaustive('SUBB'), 131072);
  assert.equal(run('CLR C\nMOV A, #50H\nSUBB A, #20H').a, 0x30);
  assert.equal(run('SETB C\nMOV A, #50H\nSUBB A, #20H').a, 0x2F, 'SUBB must subtract C');
  const m = run('CLR C\nMOV A, #10H\nSUBB A, #11H');
  assert.equal(m.a, 0xFF); assert.equal(m.flag(C), 1);
  const ov = run('CLR C\nMOV A, #80H\nSUBB A, #01H');
  assert.equal(ov.a, 0x7F); assert.equal(ov.flag(OV), 1, '-128 - 1 overflows'); assert.equal(ov.flag(C), 0);
});

test('4. Wraparound: INC/DEC wrap modulo 256 and leave C, AC, OV untouched', () => {
  const inc = run('MOV PSW, #0C4H\nMOV A, #0FFH\nINC A\nMOV R0, #0FFH\nINC R0\nMOV 30H, #0FFH\nINC 30H\nMOV R1, #31H\nMOV @R1, #0FFH\nINC @R1');
  assert.equal(inc.a, 0); assert.equal(reg(inc, 0), 0); assert.equal(inc.ram[0x30], 0); assert.equal(inc.ram[0x31], 0);
  assert.deepEqual(flags(inc), { C: 1, AC: 1, OV: 1, P: 0 });
  const dec = run('CLR A\nDEC A\nMOV R2, #0\nDEC R2\nMOV 40H, #0\nDEC 40H');
  assert.equal(dec.a, 0xFF); assert.equal(reg(dec, 2), 0xFF); assert.equal(dec.ram[0x40], 0xFF);
  assert.deepEqual(flags(dec), { C: 0, AC: 0, OV: 0, P: 0 });
  const add = run('MOV A, #0FAH\nADD A, #0AH');
  assert.equal(add.a, 0x04); assert.equal(add.flag(C), 1);
  assert.equal(run('MOV DPTR, #0FFFFH\nINC DPTR').dptr, 0);
});

test('5. Auxiliary carry and signed overflow are independent of carry', () => {
  let m = run('MOV A, #7FH\nADD A, #01H');
  assert.deepEqual(flags(m), { C: 0, AC: 1, OV: 1, P: 1 });
  m = run('MOV A, #0FFH\nADD A, #01H');
  assert.deepEqual(flags(m), { C: 1, AC: 1, OV: 0, P: 0 });
  m = run('MOV A, #80H\nADD A, #80H');
  assert.deepEqual(flags(m), { C: 1, AC: 0, OV: 1, P: 0 });
  m = run('MOV A, #08H\nADD A, #08H');
  assert.deepEqual(flags(m), { C: 0, AC: 1, OV: 0, P: 1 });
});

test('6. Parity follows A after every instruction (even / odd numbers of 1 bits)', () => {
  for (let value = 0; value < 256; value++) assert.equal(run(`MOV A, #${value}`).flag(P), parity(value), `A = ${hex(value)}`);
  assert.equal(run('MOV A, #03H').flag(P), 0, 'two 1 bits = even = P 0');
  assert.equal(run('MOV A, #07H').flag(P), 1, 'three 1 bits = odd = P 1');
  assert.equal(run('MOV A, #07H\nMOV PSW, #00H').flag(P), 1, 'P cannot be overwritten: it always reflects A');
});

test('7. ANL, ORL, XRL and CPL in every byte form, plus carry-bit forms', () => {
  for (const [a, b] of [[0xB7, 0x0F], [0x55, 0xAA], [0xFF, 0x00], [0x3C, 0x5A]]) {
    assert.equal(run(`MOV A, #${a}\nANL A, #${b}`).a, a & b);
    assert.equal(run(`MOV A, #${a}\nORL A, #${b}`).a, a | b);
    assert.equal(run(`MOV A, #${a}\nXRL A, #${b}`).a, a ^ b);
    assert.equal(run(`MOV A, #${a}\nMOV R3, #${b}\nANL A, R3`).a, a & b);
    assert.equal(run(`MOV A, #${a}\nMOV 30H, #${b}\nORL A, 30H`).a, a | b);
    assert.equal(run(`MOV A, #${a}\nMOV R0, #30H\nMOV 30H, #${b}\nXRL A, @R0`).a, a ^ b);
    assert.equal(run(`MOV 30H, #${a}\nANL 30H, #${b}`).ram[0x30], a & b);
    assert.equal(run(`MOV 30H, #${a}\nMOV A, #${b}\nORL 30H, A`).ram[0x30], a | b);
    assert.equal(run(`MOV 30H, #${a}\nXRL 30H, #${b}`).ram[0x30], a ^ b);
    assert.equal(run(`MOV A, #${a}\nCPL A`).a, a ^ 0xFF);
  }
  const keep = run('MOV PSW, #0C4H\nMOV A, #0FH\nANL A, #03H\nORL A, #80H\nXRL A, #0AH\nCPL A');
  assert.equal(keep.a, 0x76); assert.equal(keep.flag(C), 1); assert.equal(keep.flag(AC), 1); assert.equal(keep.flag(OV), 1);
  assert.equal(run('SETB C\nCLR 20H.0\nANL C, 20H.0').flag(C), 0);
  assert.equal(run('SETB C\nCLR 20H.0\nANL C, /20H.0').flag(C), 1);
  assert.equal(run('CLR C\nSETB 20H.1\nORL C, 20H.1').flag(C), 1);
  assert.equal(run('CLR C\nCPL C').flag(C), 1);
  assert.equal(run('SETB 20H.3\nCPL 20H.3\nCPL 20H.5').ram[0x20], 0x20);
});

test('8. Direct and indirect RAM access, register banks and limits', () => {
  const m = run('MOV 30H, #42H\nMOV R0, #30H\nMOV A, @R0\nINC @R0\nMOV 31H, A\nMOV R1, #32H\nMOV @R1, #77H\nMOV 33H, 32H');
  assert.equal(m.a, 0x42); assert.equal(m.ram[0x30], 0x43); assert.equal(m.ram[0x31], 0x42); assert.equal(m.ram[0x32], 0x77); assert.equal(m.ram[0x33], 0x77);
  const bank = run('MOV PSW, #08H\nMOV R0, #5AH\nMOV PSW, #00H\nMOV R0, #0A5H');
  assert.equal(bank.ram[0x08], 0x5A, 'bank 1 R0 is RAM 08H'); assert.equal(bank.ram[0x00], 0xA5, 'bank 0 R0 is RAM 00H');
  assert.equal(run('MOV A, #30H').a, 0x30, 'immediate');
  assert.equal(run('MOV 30H, #99H\nMOV A, 30H').a, 0x99, 'direct');
  assert.equal(run('MOV B, #12H\nMOV A, 0F0H').a, 0x12, 'direct SFR address');
  assert.throws(() => run('MOV R0, #80H\nMOV A, @R0'), /00H–7FH/);
  assert.equal(run('MOV R0, #7FH\nMOV @R0, #1').ram[0x7F], 1);
});

test('9. Labels, conditional jumps, loops and program counter', () => {
  const loop = run(samples.loop);
  assert.equal(loop.a, 0x0F); assert.equal(reg(loop, 0), 0);
  assert.equal(run('MOV A, #0\nJZ yes\nMOV R0, #1\nyes: NOP').ram[0], 0);
  assert.equal(run('MOV A, #1\nJZ yes\nMOV R0, #1\nyes: NOP').ram[0], 1);
  assert.equal(run('MOV A, #1\nJNZ yes\nMOV R0, #1\nyes: NOP').ram[0], 0);
  assert.equal(run('SETB C\nJC yes\nMOV R0, #1\nyes: NOP').ram[0], 0);
  assert.equal(run('CLR C\nJC yes\nMOV R0, #1\nyes: NOP').ram[0], 1);
  assert.equal(run('CLR C\nJNC yes\nMOV R0, #1\nyes: NOP').ram[0], 0);
  assert.equal(run('SETB 20H.0\nJB 20H.0, yes\nMOV R0, #1\nyes: NOP').ram[0], 0);
  assert.equal(run('JNB 20H.0, yes\nMOV R0, #1\nyes: NOP').ram[0], 0);
  const jbc = run('SETB 20H.0\nJBC 20H.0, yes\nMOV R0, #1\nyes: NOP');
  assert.equal(jbc.ram[0], 0); assert.equal(jbc.ram[0x20], 0, 'JBC clears the bit');
  const cjne = run('MOV A, #3\nCJNE A, #5, less\nless: NOP');
  assert.equal(cjne.flag(C), 1);
  const djnz = run('MOV 30H, #3\nCLR A\nagain: INC A\nDJNZ 30H, again');
  assert.equal(djnz.a, 3); assert.equal(djnz.ram[0x30], 0);
  // Byte addresses and PC values.
  const m = new Machine('MOV A, #1\nMOV 30H, #2\nMOV DPTR, #1234H\nINC A\nSJMP end\nNOP\nend: NOP');
  assert.deepEqual(m.program.map(i => i.address), [0, 2, 5, 8, 9, 0x0B, 0x0C]);
  m.step(); assert.equal(m.pc, 2); m.step(); assert.equal(m.pc, 5); m.step(); assert.equal(m.pc, 8);
  m.step(); m.step(); assert.equal(m.pc, 0x0C, 'SJMP skips the NOP');
  const org = run('ORG 0100H\nMOV A, #1\nSJMP done\nINC A\ndone: NOP');
  assert.equal(org.a, 1); assert.equal(org.pc, 0x0106, "ORG 0100H + 2 + 2 + 1 + 1 bytes");
  assert.equal(run('MOV DPTR, #0007H\nCLR A\nJMP @A+DPTR\nINC A\nINC A\nNOP').a, 0);
});

test('9b. Jump-to-self halts cleanly ($ and label forms)', () => {
  const m = run('MOV A, #5\nhere: SJMP here\nINC A');
  assert.equal(m.halted, true); assert.equal(m.a, 5); assert.equal(m.pc, 2); assert.equal(m.steps, 2);
  const dollar = run('MOV A, #5\nSJMP $');
  assert.equal(dollar.halted, true); assert.equal(dollar.pc, 2);
  const loop = new Machine('again: INC A\nSJMP again');
  for (let i = 0; i < 1000; i++) loop.step();
  assert.equal(loop.done, false, 'a real loop is not mistaken for a halt');
});

test('10. CALL, RET, PUSH and POP use real stack semantics', () => {
  const m = new Machine('MOV A, #5\nLCALL double\nSJMP done\ndouble: ADD A, ACC\nRET\ndone: NOP');
  m.step(); m.step();
  assert.equal(m.pc, 7, 'LCALL jumps to the subroutine');
  assert.equal(m.sfr[1], 0x09); assert.equal(m.ram[0x08], 0x05, 'low byte of return address first'); assert.equal(m.ram[0x09], 0x00);
  m.step(); m.step();
  assert.equal(m.pc, 5, 'RET restores the return address'); assert.equal(m.sfr[1], 0x07);
  while (!m.done) m.step();
  assert.equal(m.a, 10);
  const a = new Machine('ACALL sub\nSJMP done\nsub: RET\ndone: NOP');
  a.step(); assert.equal(a.ram[0x08], 0x02); assert.equal(a.sfr[1], 9);
  const stack = run('MOV A, #12H\nMOV B, #34H\nPUSH ACC\nPUSH B\nMOV A, #0\nMOV B, #0\nPOP B\nPOP ACC');
  assert.equal(stack.a, 0x12); assert.equal(stack.b, 0x34); assert.equal(stack.sfr[1], 7); assert.equal(stack.ram[8], 0x12); assert.equal(stack.ram[9], 0x34);
  const sp = run('MOV SP, #2FH\nMOV 40H, #0ABH\nPUSH 40H');
  assert.equal(sp.sfr[1], 0x30); assert.equal(sp.ram[0x30], 0xAB);
  assert.throws(() => run('MOV SP, #7FH\nPUSH ACC'), /Stack exceeds/);
  assert.throws(() => new Machine('NOP\nACALL far').step(), /Undefined label/);
});

test('11. DA A: decimal adjust after ADD and ADDC (all valid packed-BCD pairs)', () => {
  const bcd = n => ((Math.floor(n / 10) % 10) << 4) | (n % 10);
  const machine = new Machine('ADDC A, R0\nDA A');
  for (let x = 0; x < 100; x++) for (let y = 0; y < 100; y++) for (const carry of [0, 1]) {
    machine.pc = 0; machine.done = false; machine.sfr[0x50] = 0;
    machine.a = bcd(x); machine.ram[0] = bcd(y); machine.flag(C, carry);
    machine.step(); machine.step();
    const sum = x + y + carry;
    assert.equal(machine.a, bcd(sum % 100), `${x} + ${y} + ${carry}`);
    assert.equal(machine.flag(C), Number(sum >= 100), `carry for ${x} + ${y} + ${carry}`);
  }
  const ac = run('MOV A, #29H\nADD A, #38H\nDA A');
  assert.equal(ac.a, 0x67); assert.equal(ac.flag(AC), 1, 'DA A leaves AC unchanged');
  const ov = run('MOV A, #75H\nADD A, #48H\nDA A');
  assert.equal(ov.a, 0x23); assert.equal(ov.flag(C), 1); assert.equal(ov.flag(OV), 1, 'DA A leaves OV from ADD');
});

test('MUL AB and DIV AB follow the specification (exhaustive)', () => {
  const mul = new Machine('MUL AB'), div = new Machine('DIV AB');
  for (let a = 0; a < 256; a++) for (let b = 0; b < 256; b++) {
    mul.pc = 0; mul.done = false; mul.sfr[0x50] = 0x80; mul.a = a; mul.b = b; mul.step();
    const product = a * b;
    assert.equal(mul.a, product & 255); assert.equal(mul.b, product >> 8);
    assert.equal(mul.flag(C), 0); assert.equal(mul.flag(OV), Number(product > 255));
    if (b === 0) continue;
    div.pc = 0; div.done = false; div.sfr[0x50] = 0x84; div.a = a; div.b = b; div.step();
    assert.equal(div.a, Math.floor(a / b)); assert.equal(div.b, a % b);
    assert.equal(div.flag(C), 0); assert.equal(div.flag(OV), 0);
  }
  const zero = new Machine('SETB C\nMOV A, #37\nMOV B, #0\nDIV AB\nNOP');
  while (!zero.done && !zero.undefinedDivision) zero.step();
  assert.equal(zero.undefinedDivision, true); assert.equal(zero.flag(OV), 1); assert.equal(zero.flag(C), 0);
  assert.throws(() => zero.step(), /undefined/, 'execution is blocked until reset');
});

test('Other instructions keep their specified flag behaviour', () => {
  const base = 'MOV PSW, #0C4H\n';
  for (const program of ['MOV A, #12H', 'MOV R0, #1\nXCH A, R0', 'SWAP A', 'RL A', 'RR A', 'NOP', 'MOV 30H, #1\nPUSH 30H\nPOP 31H', 'MOV R1, #2\nDJNZ R1, $']) {
    if (program.includes('DJNZ')) continue;
    const m = run(base + program);
    assert.equal(m.flag(C), 1, program); assert.equal(m.flag(AC), 1, program); assert.equal(m.flag(OV), 1, program);
  }
  const djnz = new Machine(base + 'MOV R1, #2\nloop: DJNZ R1, loop');
  while (!djnz.done) djnz.step();
  assert.deepEqual([djnz.flag(C), djnz.flag(AC), djnz.flag(OV)], [1, 1, 1], 'DJNZ affects no flags');
  assert.equal(run('MOV A, #81H\nRL A').a, 0x03);
  assert.equal(run('MOV A, #81H\nRR A').a, 0xC0);
  const rlc = run('CLR C\nMOV A, #80H\nRLC A'); assert.equal(rlc.a, 0); assert.equal(rlc.flag(C), 1);
  const rrc = run('SETB C\nMOV A, #01H\nRRC A'); assert.equal(rrc.a, 0x80); assert.equal(rrc.flag(C), 1);
  assert.equal(run('MOV A, #0A5H\nSWAP A').a, 0x5A);
  assert.equal(run('MOV R0, #30H\nMOV 30H, #34H\nMOV A, #12H\nXCHD A, @R0').a, 0x14);
});

test('12. Step, run-to-end, reset and error rollback', () => {
  const source = 'MOV A, #25H\nMOV R0, #15H\nADD A, R0';
  const m = new Machine(source);
  assert.equal(m.pc, 0); assert.equal(m.done, false);
  assert.equal(m.step().line, 'MOV A, #25H'); assert.equal(m.pc, 2); assert.equal(m.steps, 1);
  m.step(); m.step();
  assert.equal(m.done, true); assert.equal(m.a, 0x3A); assert.equal(m.step(), null, 'stepping a finished program does nothing');
  const fresh = new Machine(source);
  assert.equal(fresh.a, 0); assert.equal(fresh.sfr[1], 7); assert.equal(fresh.sfr[0x50], 0); assert.equal(fresh.steps, 0, 'reset = a new machine');
  const failing = new Machine('MOV A, #5\nMOV R0, #90H\nMOV @R0, A');
  failing.step(); failing.step();
  const before = { a: failing.a, pc: failing.pc, ram: failing.ram.slice() };
  assert.throws(() => failing.step(), /Line 3/);
  assert.equal(failing.a, before.a); assert.equal(failing.pc, before.pc); assert.deepEqual(failing.ram, before.ram, 'state rolls back after an error');
});

test('13. Invalid syntax and unsupported instructions are rejected with clear messages', () => {
  const load = source => new Machine(source);
  const exec = source => run(source);
  assert.throws(() => load('FOO A, #1'), /unknown instruction/);
  assert.throws(() => load('ADD A'), /expects 2 operands/);
  assert.throws(() => load('NOP A'), /expects 0 operands/);
  assert.throws(() => load('CJNE A, #1'), /expects 3 operands/);
  assert.throws(() => load('SJMP nowhere'), /Line 1: Undefined label “NOWHERE”/);
  assert.throws(() => load('a: NOP\na: NOP'), /duplicate label/);
  assert.throws(() => exec('ADD A, A'), /ADD A, ACC/);
  assert.throws(() => exec('ANL A, A'), /not an 8051 instruction/);
  assert.equal(exec('MOV A, #3\nADD A, ACC').a, 6, 'ADD A, ACC is the valid form');
  assert.throws(() => exec('MOV R0, R1'), /Invalid 8051 operand form/);
  assert.throws(() => exec('MOV #5, A'), /Invalid 8051 operand form/);
  assert.throws(() => exec('MOV A, #256'), /00H–FFH/);
  assert.throws(() => exec('MOV A, R8'), /R8 is not a register/);
  assert.throws(() => exec('MOV A, @R2'), /Only @R0 and @R1/);
  assert.throws(() => exec('PUSH A'), /PUSH ACC/);
  assert.throws(() => exec('POP R0'), /direct address/);
  assert.throws(() => exec('DEC DPTR'), /Only INC DPTR/);
  assert.throws(() => exec('MOV A, #12G'), /Invalid number/);
  assert.throws(() => exec('MOV 30H.0, C\nSETB 30H.1'), /not bit-addressable/);
  for (const op of ['MOVC A, @A+DPTR', 'MOVX A, @DPTR', 'RETI']) assert.throws(() => exec(op), /reference-only/);
  const far = Array.from({ length: 70 }, () => 'MOV 30H, #1').join('\n');
  assert.throws(() => load(`SJMP done\n${far}\ndone: NOP`), /out of range/);
  assert.equal(numeric('0x1F'), 31); assert.equal(numeric('1FH'), 31); assert.equal(numeric('00011111B'), 31); assert.equal(numeric('31'), 31);
});

test('Every original workbench sample runs and matches its comment', () => {
  const expected = { add: [0x3A], sub: [0x10], mul: [0x2C, 0x01], div: [7, 2], logic: [0x89], carry: [0x15], wrap: [0x00], loop: [0x0F], memory: [0x42], subroutine: [0x0A], bcd: [0x67] };
  for (const [name, [a, b]] of Object.entries(expected)) {
    const m = run(samples[name]);
    assert.equal(m.a, a, name);
    if (b !== undefined) assert.equal(m.b, b, name);
  }
  assert.equal(run(samples.carry).flag(C), 1);
  assert.equal(run(samples.mul).flag(OV), 1);
  const zero = new Machine(samples.divzero);
  while (!zero.done && !zero.undefinedDivision) zero.step();
  assert.equal(zero.undefinedDivision, true);
});

test('Every instruction-reference “Try in workbench” example runs without errors', () => {
  const executable = instructions.filter(item => item[5]);
  assert.equal(instructions.length, 44);
  assert.equal(executable.length, 41);
  for (const [name, , , , , example] of executable) assert.doesNotThrow(() => run(`; Explore ${name}\n${example}`), name);
});
