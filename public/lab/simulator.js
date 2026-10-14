export const hex = (value, width = 2) => value.toString(16).toUpperCase().padStart(width, '0') + 'H';

const special = { P0: 0x80, SP: 0x81, DPL: 0x82, DPH: 0x83, P1: 0x90, P2: 0xA0, P3: 0xB0, PSW: 0xD0, A: 0xE0, ACC: 0xE0, B: 0xF0 };
const unsupported = new Set(['MOVC', 'MOVX', 'RETI']);
const mnemonics = new Set('ACALL ADD ADDC AJMP ANL CJNE CLR CPL DA DEC DIV DJNZ INC JB JBC JC JMP JNB JNC JNZ JZ LCALL LJMP MOV MOVC MOVX MUL NOP ORL POP PUSH RET RETI RL RLC RR RRC SETB SJMP SUBB SWAP XCH XCHD XRL'.split(' '));
const operandCounts = { NOP: 0, RET: 0, RETI: 0, CJNE: 3 };
for (const op of 'ADD ADDC SUBB ANL ORL XRL MOV MOVC MOVX XCH XCHD DJNZ JB JNB JBC'.split(' ')) operandCounts[op] = 2;
// Operand index holding a code label, checked when the program loads.
const targetOperand = { SJMP: 0, AJMP: 0, LJMP: 0, ACALL: 0, LCALL: 0, JZ: 0, JNZ: 0, JC: 0, JNC: 0, JB: 1, JNB: 1, JBC: 1, DJNZ: 1, CJNE: 2 };

export function numeric(text) {
  const token = text.trim().toUpperCase().replace(/^#/, '');
  let value;
  if (/^0X[\dA-F]+$/.test(token)) value = parseInt(token.slice(2), 16);
  else if (/^[\dA-F]+H$/.test(token)) value = parseInt(token.slice(0, -1), 16);
  else if (/^[01]+B$/.test(token)) value = parseInt(token.slice(0, -1), 2);
  else if (/^\d+$/.test(token)) value = Number(token);
  else throw new Error(`Invalid number “${text}”. Use decimal, 25H, 0x25 or 00100101B.`);
  if (!Number.isSafeInteger(value) || value > 65535) throw new Error('Value must be between 0 and 65535.');
  return value;
}

function kind(token) {
  if (/^#/.test(token)) return 'immediate';
  if (/^R[0-7]$/.test(token)) return 'register';
  if (/^@R[01]$/.test(token)) return 'indirect';
  if (token === 'A') return 'accumulator';
  return 'direct';
}

function byteLength(op, args) {
  if (['LJMP', 'LCALL', 'CJNE'].includes(op)) return 3;
  if (['JB', 'JNB', 'JBC'].includes(op)) return 3;
  if (['SJMP', 'AJMP', 'ACALL', 'JZ', 'JNZ', 'JC', 'JNC', 'PUSH', 'POP'].includes(op)) return 2;
  if (op === 'DJNZ') return kind(args[0]) === 'register' ? 2 : 3;
  if (op === 'MOV') {
    if (args[0] === 'DPTR') return 3;
    if (args.includes('C')) return 2;
    const dest = kind(args[0]), source = kind(args[1]);
    if (dest === 'direct' && ['direct', 'immediate'].includes(source)) return 3;
    return dest === 'direct' || ['direct', 'immediate'].includes(source) ? 2 : 1;
  }
  if (['ADD', 'ADDC', 'SUBB', 'ANL', 'ORL', 'XRL'].includes(op)) {
    if (args[0] === 'C') return 2;
    if (kind(args[0]) === 'direct') return kind(args[1]) === 'immediate' ? 3 : 2;
    return ['direct', 'immediate'].includes(kind(args[1])) ? 2 : 1;
  }
  if (['CLR', 'CPL', 'SETB'].includes(op)) return ['A', 'C'].includes(args[0]) ? 1 : 2;
  if (['INC', 'DEC', 'XCH'].includes(op)) return kind(args.at(-1)) === 'direct' && args[0] !== 'DPTR' ? 2 : 1;
  return 1;
}

export class Machine {
  constructor(source) {
    this.ram = new Uint8Array(128);
    this.sfr = new Uint8Array(128);
    this.sfr[1] = 7;
    for (const address of [0x80, 0x90, 0xA0, 0xB0]) this.sfr[address - 128] = 255;
    this.program = [];
    this.labels = new Map();
    this.steps = 0;
    this.done = false;
    this.undefinedDivision = false;
    this.pc = 0;
    let address = 0;
    for (const [index, raw] of source.split(/\r?\n/).entries()) {
      let line = raw.split(';')[0].trim().toUpperCase();
      if (!line) continue;
      const label = line.match(/^([A-Z_][\w]*):/);
      if (label) {
        if (this.labels.has(label[1])) throw new Error(`Line ${index + 1}: duplicate label ${label[1]}.`);
        this.labels.set(label[1], address);
        line = line.slice(label[0].length).trim();
      }
      if (!line) continue;
      if (line === 'END') break;
      if (line.startsWith('ORG ')) {
        if (this.program.length || this.labels.size) throw new Error('ORG is only supported before the first instruction and label.');
        address = numeric(line.slice(4));
        this.pc = address;
        continue;
      }
      const match = line.match(/^([A-Z]+)(?:\s+(.*))?$/);
      if (!match || !mnemonics.has(match[1])) throw new Error(`Line ${index + 1}: unknown instruction “${line}”.`);
      const args = match[2] ? match[2].split(',').map(operand => operand.trim()) : [];
      const size = byteLength(match[1], args);
      if (address + size > 65536) throw new Error('Program exceeds the 16-bit code address space.');
      this.program.push({ op: match[1], args, line, source: index + 1, address, size });
      address += size;
    }
    this.end = address;
    this.lookup = new Map(this.program.map(instruction => [instruction.address, instruction]));
    for (const instruction of this.program) {
      const { op, args, source } = instruction;
      const count = operandCounts[op] ?? 1;
      if (args.length !== count || args.some(operand => !operand)) throw new Error(`Line ${source}: ${op} expects ${count} operand${count === 1 ? '' : 's'}.`);
      if (op in targetOperand) {
        try { this.target(args[targetOperand[op]], instruction); } catch (error) { throw new Error(`Line ${source}: ${error.message}`); }
      }
    }
    this.halted = false;
    this.done = this.program.length === 0;
  }

  get a() { return this.sfr[0x60]; }
  set a(value) { this.sfr[0x60] = value; }
  get b() { return this.sfr[0x70]; }
  set b(value) { this.sfr[0x70] = value; }
  get dptr() { return this.sfr[2] | (this.sfr[3] << 8); }
  set dptr(value) { this.sfr[2] = value; this.sfr[3] = value >> 8; }
  flag(bit, value) {
    if (value !== undefined) this.sfr[0x50] = (this.sfr[0x50] & ~(1 << bit)) | (Number(Boolean(value)) << bit);
    return (this.sfr[0x50] >> bit) & 1;
  }
  register(index) { return ((this.sfr[0x50] >> 3) & 3) * 8 + index; }
  direct(token) {
    if (token.startsWith('#')) throw new Error('A direct address cannot use the immediate # prefix.');
    if (token.startsWith('@')) throw new Error(`Only @R0 and @R1 can address RAM indirectly (found ${token}).`);
    if (/^R\d+$/.test(token)) throw new Error(`${token} is not a register. The active bank has R0–R7.`);
    const address = special[token] ?? numeric(token);
    if (address > 255) throw new Error('Direct addresses must be 00H–FFH.');
    return address;
  }
  memory(address, value) {
    const store = address < 128 ? this.ram : this.sfr;
    const offset = address < 128 ? address : address - 128;
    if (value !== undefined) store[offset] = value;
    return store[offset];
  }
  indirect(token) {
    const address = this.ram[this.register(Number(token[2]))];
    if (address > 127) throw new Error('Classic 8051 indirect RAM addresses are limited to 00H–7FH.');
    return address;
  }
  read(token) {
    if (kind(token) === 'immediate') {
      const value = numeric(token);
      if (value > 255) throw new Error('Byte immediates must be 00H–FFH.');
      return value;
    }
    if (kind(token) === 'register') return this.ram[this.register(Number(token[1]))];
    if (kind(token) === 'indirect') return this.ram[this.indirect(token)];
    return this.memory(this.direct(token));
  }
  write(token, value) {
    if (kind(token) === 'immediate') throw new Error('Cannot write to an immediate value.');
    if (kind(token) === 'register') this.ram[this.register(Number(token[1]))] = value;
    else if (kind(token) === 'indirect') this.ram[this.indirect(token)] = value;
    else this.memory(this.direct(token), value);
  }
  bit(token, value) {
    let address, offset;
    if (token === 'C') { return this.flag(7, value); }
    if (token.startsWith('#')) throw new Error('A bit address cannot use the immediate # prefix.');
    const match = token.match(/^(.+)\.([0-7])$/);
    if (match) {
      address = this.direct(match[1]);
      offset = Number(match[2]);
      if (!(address >= 0x20 && address <= 0x2F) && !(address >= 128 && address % 8 === 0)) throw new Error('This byte is not bit-addressable.');
    } else {
      const bitAddress = numeric(token);
      if (bitAddress > 255) throw new Error('Bit addresses must be 00H–FFH.');
      address = bitAddress < 128 ? 0x20 + (bitAddress >> 3) : bitAddress & 0xF8;
      offset = bitAddress & 7;
    }
    if (value !== undefined) this.memory(address, (this.memory(address) & ~(1 << offset)) | (Number(Boolean(value)) << offset));
    return (this.memory(address) >> offset) & 1;
  }
  target(token, instruction) {
    let address;
    if (token === '$') address = instruction.address;
    else if (this.labels.has(token)) address = this.labels.get(token);
    else if (/^[A-Z_]\w*$/.test(token) && !/^[\dA-F]+H$/.test(token)) throw new Error(`Undefined label “${token}”.`);
    else address = numeric(token);
    if (!this.lookup.has(address) && address !== this.end) throw new Error(`Jump target ${token} is not an instruction boundary.`);
    if (['SJMP', 'JZ', 'JNZ', 'JC', 'JNC', 'JB', 'JNB', 'JBC', 'DJNZ', 'CJNE'].includes(instruction.op)) {
      const relative = address - instruction.address - instruction.size;
      if (relative < -128 || relative > 127) throw new Error('Relative jump is out of range (−128 to +127 bytes). Use LJMP.');
    }
    if (['AJMP', 'ACALL'].includes(instruction.op) && (address & 0xF800) !== ((instruction.address + 2) & 0xF800)) throw new Error('AJMP / ACALL target must be in the same 2 KB page.');
    return address;
  }
  push(value) {
    const address = this.sfr[1] + 1;
    if (address > 127) throw new Error('Stack exceeds classic 8051 internal RAM.');
    this.sfr[1] = address;
    this.ram[address] = value;
  }
  pop() {
    const address = this.sfr[1];
    if (address > 127) throw new Error('Stack pointer is outside internal RAM.');
    const value = this.ram[address];
    this.sfr[1] = (address - 1) & 255;
    return value;
  }
  step() {
    if (this.undefinedDivision) throw new Error('Division by zero left A and B undefined. Reset or load a program before continuing.');
    if (this.done) return null;
    const instruction = this.lookup.get(this.pc);
    if (!instruction) throw new Error(`No instruction at ${hex(this.pc, 4)}.`);
    const before = { ram: this.ram.slice(), sfr: this.sfr.slice(), pc: this.pc };
    try {
      this.pc += instruction.size;
      this.execute(instruction);
      if (!this.undefinedDivision) this.flag(0, this.a.toString(2).replace(/0/g, '').length % 2);
      this.steps++;
      // SJMP $ / HERE: SJMP HERE is the usual way to end an 8051 program; treat it as a halt.
      this.halted = ['SJMP', 'AJMP', 'LJMP'].includes(instruction.op) && this.pc === instruction.address;
      this.done = this.halted || this.pc === this.end;
      return instruction;
    } catch (error) {
      this.ram = before.ram;
      this.sfr = before.sfr;
      this.pc = before.pc;
      throw new Error(`Line ${instruction.source}: ${error.message}`);
    }
  }
  execute(instruction) {
    const { op, args } = instruction;
    const [dest, source] = args;
    const expect = count => { if (args.length !== count || args.some(operand => !operand)) throw new Error(`${op} expects ${count} operand${count === 1 ? '' : 's'}.`); };
    const invalid = () => { throw new Error(`Invalid 8051 operand form: ${instruction.line}.`); };
    const requireA = () => { if (dest !== 'A') invalid(); };
    if (unsupported.has(op)) throw new Error(`${op} is reference-only: code/external memory and interrupt hardware are not emulated.`);
    if (op === 'MOV') {
      expect(2);
      if (dest === 'DPTR') { if (kind(source) !== 'immediate') invalid(); this.dptr = numeric(source); }
      else if (dest === 'C') { this.flag(7, this.bit(source)); }
      else if (source === 'C') { this.bit(dest, this.flag(7)); }
      else {
        const destKind = kind(dest), sourceKind = kind(source);
        if (destKind === 'immediate' || (['register', 'indirect'].includes(destKind) && ['register', 'indirect'].includes(sourceKind)) || (destKind === 'accumulator' && sourceKind === 'accumulator')) invalid();
        this.write(dest, this.read(source));
      }
    } else if (['ADD', 'ADDC', 'SUBB'].includes(op)) {
      expect(2); requireA();
      if (source === 'A') throw new Error(`${op} A, A is not an 8051 instruction. Use ${op} A, ACC to use the accumulator as the source.`);
      const original = this.a, value = this.read(source), carry = op === 'ADD' ? 0 : this.flag(7);
      const result = op === 'SUBB' ? original - value - carry : original + value + carry;
      this.flag(7, op === 'SUBB' ? result < 0 : result > 255);
      this.flag(6, op === 'SUBB' ? (original & 15) < (value & 15) + carry : (original & 15) + (value & 15) + carry > 15);
      this.flag(2, (op === 'SUBB' ? (original ^ value) & (original ^ result) : ~(original ^ value) & (original ^ result)) & 128);
      this.a = result;
    } else if (['ANL', 'ORL', 'XRL'].includes(op)) {
      expect(2);
      if (dest === 'C' && op !== 'XRL') {
        const value = source.startsWith('/') ? 1 - this.bit(source.slice(1)) : this.bit(source);
        this.flag(7, op === 'ANL' ? this.flag(7) & value : this.flag(7) | value);
      } else {
        if (dest === 'A' && source === 'A') throw new Error(`${op} A, A is not an 8051 instruction. Use ${op} A, ACC to use the accumulator as the source.`);
        if (dest !== 'A' && (kind(dest) !== 'direct' || !['A', 'immediate'].includes(source === 'A' ? 'A' : kind(source)))) invalid();
        const original = this.read(dest), value = this.read(source);
        this.write(dest, op === 'ANL' ? original & value : op === 'ORL' ? original | value : original ^ value);
      }
    } else if (['INC', 'DEC'].includes(op)) {
      expect(1);
      if (dest === 'DPTR' && op === 'DEC') throw new Error('DEC DPTR is not an 8051 instruction. Only INC DPTR exists.');
      if (dest === 'DPTR') this.dptr = (this.dptr + 1) & 65535;
      else { if (kind(dest) === 'immediate') invalid(); this.write(dest, this.read(dest) + (op === 'INC' ? 1 : -1)); }
    } else if (['CLR', 'CPL', 'SETB'].includes(op)) {
      expect(1);
      if (dest === 'A' && op !== 'SETB') this.a = op === 'CLR' ? 0 : this.a ^ 255;
      else this.bit(dest, op === 'CLR' ? 0 : op === 'SETB' ? 1 : 1 - this.bit(dest));
    } else if (['RL', 'RR', 'RLC', 'RRC', 'SWAP', 'DA'].includes(op)) {
      expect(1); requireA();
      const original = this.a, carry = this.flag(7);
      if (op === 'RL') this.a = (original << 1) | (original >> 7);
      if (op === 'RR') this.a = (original >> 1) | (original << 7);
      if (op === 'RLC') { this.a = (original << 1) | carry; this.flag(7, original >> 7); }
      if (op === 'RRC') { this.a = (original >> 1) | (carry << 7); this.flag(7, original & 1); }
      if (op === 'SWAP') this.a = (original << 4) | (original >> 4);
      if (op === 'DA') {
        let result = original;
        if ((result & 15) > 9 || this.flag(6)) result += 6;
        const intermediateCarry = carry || result > 255;
        if (((result & 255) >> 4) > 9 || intermediateCarry) result += 0x60;
        this.flag(7, intermediateCarry || result > 255);
        this.a = result;
      }
    } else if (['MUL', 'DIV'].includes(op)) {
      expect(1); if (dest !== 'AB') invalid(); this.flag(7, 0);
      if (op === 'MUL') { const result = this.a * this.b; this.a = result; this.b = result >> 8; this.flag(2, result > 255); }
      else {
        this.flag(2, this.b === 0);
        if (this.b) {
          const original = this.a;
          this.a = Math.floor(original / this.b);
          this.b = original % this.b;
        } else {
          this.undefinedDivision = true;
        }
      }
    } else if (['XCH', 'XCHD'].includes(op)) {
      expect(2); requireA();
      if (op === 'XCHD' ? kind(source) !== 'indirect' : !['direct', 'register', 'indirect'].includes(kind(source))) invalid();
      const original = this.a, value = this.read(source);
      this.a = op === 'XCH' ? value : (original & 0xF0) | (value & 15);
      this.write(source, op === 'XCH' ? original : (value & 0xF0) | (original & 15));
    } else if (['PUSH', 'POP'].includes(op)) {
      expect(1);
      if (dest === 'A') throw new Error(`${op} A is not valid 8051 syntax. ${op} needs a direct address: use ${op} ACC.`);
      if (kind(dest) === 'register') throw new Error(`${op} ${dest} is not valid 8051 syntax. Use the register's direct address, e.g. ${op} ${hex(Number(dest[1]))} for ${dest} in bank 0.`);
      if (kind(dest) !== 'direct') invalid();
      if (op === 'PUSH') { const address = this.direct(dest); this.push(0); this.ram[this.sfr[1]] = this.memory(address); }
      else {
        const address = this.direct(dest), stackAddress = this.sfr[1];
        if (stackAddress > 127) throw new Error('Stack pointer is outside internal RAM.');
        this.memory(address, this.ram[stackAddress]);
        this.sfr[1] = (this.sfr[1] - 1) & 255;
      }
    } else if (['SJMP', 'AJMP', 'LJMP', 'ACALL', 'LCALL'].includes(op)) {
      expect(1); const address = this.target(dest, instruction);
      if (['ACALL', 'LCALL'].includes(op)) { const returnAddress = this.pc; this.push(returnAddress & 255); this.push(returnAddress >> 8); }
      this.pc = address;
    } else if (op === 'RET') { expect(0); const high = this.pop(); this.pc = (high << 8) | this.pop(); }
    else if (op === 'JMP') { expect(1); if (dest !== '@A+DPTR') invalid(); this.pc = this.target(String((this.a + this.dptr) & 65535), instruction); }
    else if (['JZ', 'JNZ', 'JC', 'JNC'].includes(op)) {
      expect(1); const address = this.target(dest, instruction);
      if ((op === 'JZ' && this.a === 0) || (op === 'JNZ' && this.a !== 0) || (op === 'JC' && this.flag(7)) || (op === 'JNC' && !this.flag(7))) this.pc = address;
    } else if (['JB', 'JNB', 'JBC'].includes(op)) {
      expect(2); const address = this.target(source, instruction), value = this.bit(dest);
      if (op === 'JNB' ? !value : value) { if (op === 'JBC') this.bit(dest, 0); this.pc = address; }
    } else if (op === 'DJNZ') {
      expect(2); if (!['direct', 'register'].includes(kind(dest))) invalid();
      const address = this.target(source, instruction); this.write(dest, this.read(dest) - 1);
      if (this.read(dest)) this.pc = address;
    } else if (op === 'CJNE') {
      expect(3);
      if (!((dest === 'A' && ['direct', 'immediate'].includes(kind(source))) || (['register', 'indirect'].includes(kind(dest)) && kind(source) === 'immediate'))) invalid();
      const address = this.target(args[2], instruction), first = this.read(dest), second = this.read(source);
      this.flag(7, first < second); if (first !== second) this.pc = address;
    } else if (op === 'NOP') expect(0);
    else invalid();
  }
}

export const traceLine = (instruction, machine) => `${hex(instruction.address, 4)}  ${instruction.line.padEnd(23)} → A:${hex(machine.a)} C:${machine.flag(7)} AC:${machine.flag(6)} OV:${machine.flag(2)} P:${machine.flag(0)}`;
