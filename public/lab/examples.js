// Ready-made 8051 example programs.
// Every `expect` block is calculated by hand from the MCS-51 instruction set rules and is
// checked against the real simulator engine by tests/examples.test.mjs.
// Flags: C = carry/borrow (PSW.7), AC = auxiliary carry (PSW.6), OV = overflow (PSW.2), P = parity (PSW.0).

export const categories = [
  {
    key: 'logic', letter: 'A', name: 'Logical operations',
    intro: 'ANL, ORL and XRL work on all eight bits at once, bit by bit. Combined with a mask (a constant that selects bits), they set, clear, test or toggle exactly the bits you choose. Byte-wide logical instructions never change C, AC or OV; P always follows the accumulator.',
    points: ['ANL with 0 clears a bit, with 1 keeps it', 'ORL with 1 sets a bit, with 0 keeps it', 'XRL with 1 toggles a bit, with 0 keeps it', 'CPL A flips every bit of A (one’s complement)']
  },
  {
    key: 'carry', letter: 'B', name: 'Carry & borrow',
    intro: 'Four PSW flags describe an arithmetic result, and they answer different questions. C (carry) is the unsigned carry out of bit 7 for ADD/ADDC, and the borrow for SUBB. AC (auxiliary carry) is the carry or borrow between bit 3 and bit 4, used by DA A. OV (overflow) means the signed (two’s-complement, −128…+127) result does not fit. P (parity) is 1 when A holds an odd number of 1 bits.',
    points: ['ADD ignores the old C; ADDC adds it', 'SUBB always subtracts C too — use CLR C first for a plain subtraction', 'Multi-byte maths: ADD/SUBB on the low byte, then ADDC/SUBB on higher bytes', 'C is about unsigned numbers, OV is about signed numbers']
  },
  {
    key: 'wrap', letter: 'C', name: '8-bit wraparound',
    intro: 'Every 8051 register and RAM byte holds 8 bits, so results are kept modulo 256: anything above FFH loses its ninth bit, and anything below 00H wraps around from the top. Whether that is reported depends on the instruction: ADD, ADDC and SUBB record it in C and OV, while INC and DEC wrap silently and leave C, AC and OV unchanged.',
    points: ['Register result = full result mod 256', 'FFH + 1 = 00H, 00H − 1 = FFH', 'INC / DEC never change C, AC or OV', 'Unsigned carry (C) and signed overflow (OV) are independent']
  },
  {
    key: 'loop', letter: 'D', name: 'Labels, loops & jumps',
    intro: 'A label names a code address. Jumps load that address into the program counter (PC). SJMP and the conditional jumps use a signed 8-bit offset (−128…+127 bytes from the next instruction). The 8051 has no zero flag: JZ and JNZ test the accumulator directly, while JC and JNC test the carry flag. DJNZ decrements and branches in one instruction and leaves every flag unchanged.',
    points: ['Every loop needs a counter or condition that ends it', 'DJNZ Rn, label is the classic counted loop', 'CJNE compares and sets C when the first operand is smaller', 'HERE: SJMP HERE (or SJMP $) is a common “stop” at the end of a program']
  },
  {
    key: 'memory', letter: 'E', name: 'RAM & indirect addressing',
    intro: 'The classic 8051 has 128 bytes of internal RAM (00H–7FH). 00H–1FH hold the four register banks (R0–R7 of bank 0 live at 00H–07H), 20H–2FH are bit-addressable (bit addresses 00H–7FH), and 30H–7FH are general-purpose scratchpad. Direct addresses 80H–FFH reach the special function registers (A, B, PSW, SP, DPL, DPH, ports). Indirect addressing (@R0, @R1) reaches 00H–7FH on the 8051; the 8052’s extra upper 128 bytes are not part of this simulator.',
    points: ['MOV A, #30H loads the number 30H', 'MOV A, 30H loads the byte stored at RAM address 30H', 'MOV A, @R0 loads the byte at the address held in R0', 'Only R0 and R1 can be used as pointers']
  },
  {
    key: 'stack', letter: 'F', name: 'Subroutines & stack',
    intro: 'The stack lives in internal RAM and grows upwards. SP starts at 07H after reset, so the first byte goes to 08H. PUSH increments SP and then stores a byte; POP reads the byte at SP and then decrements SP. ACALL and LCALL push the 16-bit return address (low byte first, then high byte) and jump; RET pops it back into PC. PUSH and POP take a direct address, so the accumulator is written ACC.',
    points: ['ACALL: 2 bytes, target in the same 2 KB page', 'LCALL: 3 bytes, target anywhere in 64 KB', 'POP in the reverse order of PUSH', 'Values are not erased from RAM when popped']
  },
  {
    key: 'bcd', letter: 'G', name: 'BCD arithmetic',
    intro: 'Packed BCD stores two decimal digits in one byte: 47H means decimal 47. ADD and ADDC work in binary, so the sum of two BCD bytes may contain a nibble above 9. DA A (decimal adjust) corrects the accumulator after ADD or ADDC: it adds 06H when the low nibble is above 9 or AC = 1, then adds 60H when the high nibble is above 9 or C = 1. It is not a general binary-to-decimal converter and does not work after SUBB.',
    points: ['Use DA A immediately after ADD or ADDC', 'AC = 1 means the low digit overflowed even if it now looks valid', 'C = 1 after DA A is a carry into the next decimal digit (hundreds)', 'DA A leaves AC and OV unchanged']
  }
];

const RESET_FLAGS = 'After reset: C = 0 · AC = 0 · OV = 0 · P = 0.';

export const examples = [
  // ── Category A: Logical operations ───────────────────────────────────────
  {
    id: 'logic-anl', category: 'logic', title: 'Keep the low nibble with ANL', difficulty: 'Beginner',
    teaches: 'How a bitwise AND with a mask clears unwanted bits, in both the accumulator and the direct-RAM form.',
    source: `; ANL = bitwise AND. A result bit is 1 only if both input bits are 1.
MOV A, #0B7H      ; A = 1011 0111B
ANL A, #0FH       ; mask 0000 1111B keeps the low nibble -> A = 07H
MOV R0, A         ; R0 = 07H (save the result)
MOV 30H, #0F5H    ; RAM 30H = 1111 0101B
ANL 30H, #3CH     ; direct form: 30H = 30H AND 0011 1100B = 34H`,
    explanation: 'The mask 0FH has 1s in the four low bits, so only those bits of A can survive. The upper four bits are forced to 0. ANL also works directly on a RAM byte without passing through A.',
    instructions: [['ANL A, #0FH', 'AND the accumulator with an immediate mask. Bits where the mask is 0 become 0.'], ['ANL 30H, #3CH', 'AND a direct RAM byte with an immediate mask; the result stays in RAM 30H.']],
    math: ['B7H AND 0FH: 1011 0111B AND 0000 1111B = 0000 0111B = 07H', 'F5H AND 3CH: 1111 0101B AND 0011 1100B = 0011 0100B = 34H'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x07, R0: 0x07 }, ram: { 0x30: 0x34 }, flags: { C: 0, AC: 0, OV: 0, P: 1 } },
    notes: 'ANL never affects C, AC or OV. P = 1 because A = 07H has three 1 bits (odd).'
  },
  {
    id: 'logic-orl', category: 'logic', title: 'Set bits with ORL', difficulty: 'Beginner',
    teaches: 'How a bitwise OR forces selected bits to 1 and leaves the rest unchanged, using immediate, register and direct forms.',
    source: `; ORL = bitwise OR. A result bit is 1 if either input bit is 1.
MOV A, #41H       ; A = 0100 0001B
ORL A, #0A0H      ; OR with 1010 0000B sets bits 7 and 5 -> A = E1H
MOV R1, #0CH      ; R1 = 0000 1100B
ORL A, R1         ; register form: sets bits 3 and 2 -> A = EDH
MOV 31H, #01H     ; RAM 31H = 0000 0001B
ORL 31H, A        ; direct form: 31H = 01H OR EDH = EDH`,
    explanation: 'Wherever the mask has a 1, the result has a 1. Bits that are already 1 stay 1, so ORL is the safe way to switch something on without disturbing other bits.',
    instructions: [['ORL A, #0A0H', 'OR the accumulator with an immediate mask.'], ['ORL A, R1', 'OR the accumulator with a register of the active bank.'], ['ORL 31H, A', 'OR a direct RAM byte with the accumulator; the result is stored in RAM.']],
    math: ['41H OR A0H = 0100 0001B OR 1010 0000B = 1110 0001B = E1H', 'E1H OR 0CH = 1110 1101B = EDH'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0xED, R1: 0x0C }, ram: { 0x31: 0xED }, flags: { C: 0, AC: 0, OV: 0, P: 0 } },
    notes: 'EDH = 1110 1101B has six 1 bits, an even count, so P = 0.'
  },
  {
    id: 'logic-xrl', category: 'logic', title: 'Toggle and compare with XRL', difficulty: 'Beginner',
    teaches: 'How XOR inverts selected bits, and why XOR-ing a value with itself always gives zero.',
    source: `; XRL = bitwise exclusive OR. A result bit is 1 if the input bits differ.
MOV A, #5AH       ; A = 0101 1010B
XRL A, #0FFH      ; XOR with all 1s inverts every bit -> A = A5H
MOV R2, A         ; R2 = A5H
XRL A, #0A5H      ; XOR a value with itself -> A = 00H
MOV 32H, #3CH     ; RAM 32H = 0011 1100B
XRL 32H, #0FH     ; toggle the low nibble of RAM 32H -> 33H`,
    explanation: 'XOR with 1 flips a bit, XOR with 0 leaves it alone. Because x XOR x = 0, XRL is also a quick equality test: the result is 00H only when both values are identical.',
    instructions: [['XRL A, #0FFH', 'Invert all eight bits of A (same result as CPL A).'], ['XRL A, #0A5H', 'Compare A with A5H: identical values give 00H.'], ['XRL 32H, #0FH', 'Toggle the four low bits of a RAM byte in place.']],
    math: ['5AH XOR FFH = 0101 1010B XOR 1111 1111B = 1010 0101B = A5H', '3CH XOR 0FH = 0011 1100B XOR 0000 1111B = 0011 0011B = 33H'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x00, R2: 0xA5 }, ram: { 0x32: 0x33 }, flags: { C: 0, AC: 0, OV: 0, P: 0 } },
    notes: 'XRL has no carry-bit form on the 8051 (XRL C, bit does not exist). The 8051 has no zero flag; test A with JZ / JNZ instead.'
  },
  {
    id: 'logic-cpl', category: 'logic', title: 'Complement bytes and bits with CPL', difficulty: 'Beginner',
    teaches: 'How CPL inverts the accumulator, the carry flag, or a single bit in bit-addressable RAM.',
    source: `; CPL = complement (invert). Works on A, on C, or on one addressable bit.
MOV A, #3CH       ; A = 0011 1100B
CPL A             ; A = 1100 0011B = C3H (one's complement)
MOV R3, A         ; R3 = C3H
CLR C             ; C = 0
CPL C             ; C = 1
SETB 20H.0        ; bit 0 of RAM 20H = 1  -> 20H = 01H
CPL 20H.0         ; toggle it back to 0   -> 20H = 00H
CPL 20H.1         ; toggle bit 1 to 1     -> 20H = 02H`,
    explanation: 'CPL A turns every 0 into 1 and every 1 into 0. The bit forms change a single bit and leave the rest of the byte alone. RAM 20H–2FH is bit-addressable, so 20H.1 means “bit 1 of RAM 20H”.',
    instructions: [['CPL A', 'Invert all bits of the accumulator. Flags other than P are unchanged.'], ['CPL C', 'Invert the carry flag.'], ['CPL 20H.1', 'Invert one bit of a bit-addressable byte.']],
    math: ['NOT 3CH = NOT 0011 1100B = 1100 0011B = C3H'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0xC3, R3: 0xC3 }, ram: { 0x20: 0x02 }, flags: { C: 1, AC: 0, OV: 0, P: 0 } },
    notes: 'CPL A is the one’s complement. For the two’s complement (negation) you would follow it with INC A.'
  },
  {
    id: 'logic-mask', category: 'logic', title: 'Bit masking: set, clear, toggle and test', difficulty: 'Intermediate',
    teaches: 'How to manipulate individual bits of a status byte with the right mask, then test one bit and branch on it.',
    source: `; Status byte in RAM 30H. Set bit 7, clear bit 0, toggle bit 4, then test bit 2.
MOV 30H, #25H      ; 0010 0101B
MOV A, 30H
ORL A, #80H        ; SET bit 7     -> 1010 0101B (A5H)
ANL A, #0FEH       ; CLEAR bit 0   -> 1010 0100B (A4H)
XRL A, #10H        ; TOGGLE bit 4  -> 1011 0100B (B4H)
MOV 30H, A         ; store the new status byte
ANL A, #04H        ; TEST bit 2: A = 04H if set, 00H if clear
JZ bit_clear
MOV R7, #1         ; bit 2 was set
SJMP done
bit_clear: MOV R7, #0
done: NOP`,
    explanation: 'Each operation uses a mask with a 1 only at the bit being changed (or a 0 for ANL). For the test, ANL keeps only bit 2, so A becomes zero exactly when that bit was clear, and JZ can decide.',
    instructions: [['ORL A, #80H', 'Set bit 7 (mask 1000 0000B).'], ['ANL A, #0FEH', 'Clear bit 0 (mask 1111 1110B).'], ['XRL A, #10H', 'Toggle bit 4 (mask 0001 0000B).'], ['ANL A, #04H / JZ', 'Isolate bit 2, then jump if the result is zero.']],
    math: ['25H → A5H → A4H → B4H', 'B4H AND 04H = 1011 0100B AND 0000 0100B = 04H, so bit 2 is set'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x04, R7: 0x01 }, ram: { 0x30: 0xB4 }, flags: { C: 0, AC: 0, OV: 0, P: 1 } },
    notes: 'The 8051 can also do this one bit at a time in bit-addressable RAM with SETB, CLR, CPL and JB/JNB. Address 30H is not bit-addressable, so masks are needed here.'
  },

  // ── Category B: Carry and borrow ─────────────────────────────────────────
  {
    id: 'carry-add', category: 'carry', title: 'Carry flag generation during ADD', difficulty: 'Beginner',
    teaches: 'How ADD sets C when an unsigned sum is larger than 255, and how to save the carry before it is overwritten.',
    source: `; ADD sets C when the unsigned sum does not fit in 8 bits (> 255).
MOV A, #0C8H      ; 200 decimal
ADD A, #64H       ; 200 + 100 = 300 = 12CH -> A = 2CH, C = 1
MOV R0, A         ; R0 = 2CH (the low 8 bits of the sum)
MOV 20H.0, C      ; copy C into bit 20H.0 -> RAM 20H = 01H`,
    explanation: '300 needs nine bits (1 0010 1100B). A keeps the low eight bits (2CH) and the ninth bit goes into C. MOV bit, C saves the carry in bit-addressable RAM so later instructions can’t overwrite it.',
    instructions: [['ADD A, #64H', 'A = A + 64H. C, AC, OV and P are all recalculated.'], ['MOV 20H.0, C', 'Copy the carry flag into a bit of RAM 20H.']],
    math: ['C8H + 64H = 200 + 100 = 300 = 12CH → A = 2CH, C = 1', 'Low nibbles: 8H + 4H = CH (no carry into bit 4) → AC = 0', 'Signed: −56 + 100 = +44 (fits) → OV = 0'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x2C, R0: 0x2C }, ram: { 0x20: 0x01 }, flags: { C: 1, AC: 0, OV: 0, P: 1 } },
    notes: 'C = 1 means the unsigned result was 256 too small. A positive and a negative signed operand can never overflow, so OV = 0.'
  },
  {
    id: 'carry-addc', category: 'carry', title: 'Addition with carry using ADDC', difficulty: 'Beginner',
    teaches: 'How ADDC adds the incoming carry flag, and why it equals ADD only when C = 0.',
    source: `; ADDC computes A = A + source + C.
SETB C            ; C = 1 (incoming carry)
MOV A, #25H
ADDC A, #10H      ; 25H + 10H + 1 = 36H, then C = 0
MOV R1, A         ; R1 = 36H
CLR C             ; C = 0
MOV A, #25H
ADDC A, #10H      ; 25H + 10H + 0 = 35H (same as ADD)
MOV R2, A         ; R2 = 35H`,
    explanation: 'The same ADDC instruction produces 36H or 35H depending only on the carry flag before it runs. ADDC uses the carry and then replaces it with the carry out of the new sum.',
    instructions: [['SETB C / CLR C', 'Force the carry flag to 1 or 0.'], ['ADDC A, #10H', 'Add the immediate value and the old C to A; recalculate C, AC, OV, P.']],
    math: ['First ADDC: 25H + 10H + 1 = 36H (C before = 1, after = 0)', 'Second ADDC: 25H + 10H + 0 = 35H (C before = 0, after = 0)'],
    flagsBefore: `${RESET_FLAGS} Before the first ADDC: C = 1. Before the second ADDC: C = 0.`,
    expect: { regs: { A: 0x35, R1: 0x36, R2: 0x35 }, flags: { C: 0, AC: 0, OV: 0, P: 0 } },
    notes: 'Forgetting to clear C before a single-byte ADDC is a common bug. Use ADD for the first (lowest) byte.'
  },
  {
    id: 'carry-subb', category: 'carry', title: 'Subtraction with borrow using SUBB', difficulty: 'Beginner',
    teaches: 'How SUBB always subtracts the carry (borrow) flag, and how C reports a borrow out of the result.',
    source: `; SUBB computes A = A - source - C. C is the incoming borrow.
CLR C              ; no incoming borrow
MOV A, #50H
SUBB A, #20H       ; 50H - 20H - 0 = 30H, C = 0
MOV R0, A          ; R0 = 30H
SETB C             ; pretend an earlier byte borrowed
MOV A, #50H
SUBB A, #20H       ; 50H - 20H - 1 = 2FH, C = 0, AC = 1
MOV R1, A          ; R1 = 2FH
CLR C
MOV A, #20H
SUBB A, #50H       ; 20H - 50H = -30H -> A = D0H, C = 1 (borrow)`,
    explanation: 'There is no plain SUB instruction on the 8051. SUBB subtracts the source and the carry flag, so clear C first for an ordinary subtraction. When the true result is negative, A holds it modulo 256 and C = 1 signals the borrow.',
    instructions: [['CLR C', 'Remove any incoming borrow before a single-byte subtraction.'], ['SUBB A, #20H', 'A = A − 20H − C. C = 1 if a borrow out of bit 7 was needed.']],
    math: ['50H − 20H − 0 = 30H', '50H − 20H − 1 = 2FH (low nibble 0 − 0 − 1 borrows from bit 4 → AC = 1)', '20H − 50H − 0 = 32 − 80 = −48 → −48 + 256 = 208 = D0H, C = 1'],
    flagsBefore: `${RESET_FLAGS} Before the second SUBB: C = 1 (set by SETB C).`,
    expect: { regs: { A: 0xD0, R0: 0x30, R1: 0x2F }, flags: { C: 1, AC: 0, OV: 0, P: 1 } },
    notes: 'Signed: +32 − +80 = −48 fits in −128…+127, so OV = 0 even though C = 1.'
  },
  {
    id: 'carry-16bit', category: 'carry', title: '16-bit addition with ADD and ADDC', difficulty: 'Intermediate',
    teaches: 'How the carry from the low byte propagates into the high byte to add two 16-bit numbers.',
    source: `; 16-bit addition: 12FFH + 0E01H = 2100H
; Low bytes use ADD, high bytes use ADDC to include the carry.
MOV A, #0FFH       ; low byte of 12FFH
ADD A, #01H        ; FFH + 01H = 100H -> A = 00H, C = 1
MOV R6, A          ; R6 = low byte of the result (00H)
MOV A, #12H        ; high byte of 12FFH
ADDC A, #0EH       ; 12H + 0EH + C(1) = 21H, C = 0
MOV R7, A          ; R7 = high byte of the result (21H)`,
    explanation: 'An 8-bit CPU adds big numbers one byte at a time, exactly like column addition. The carry out of the low byte is kept in C and ADDC adds it to the next column.',
    instructions: [['ADD A, #01H', 'Add the low bytes; any carry is left in C.'], ['ADDC A, #0EH', 'Add the high bytes plus the carry from the low byte.']],
    math: ['Low: FFH + 01H = 100H → 00H, C = 1', 'High: 12H + 0EH + 1 = 21H (2H + EH + 1 = 17 → AC = 1)', 'Result R7:R6 = 2100H = 4863 + 3585 = 8448 decimal'],
    flagsBefore: `${RESET_FLAGS} Before ADDC: C = 1 (from the low-byte ADD).`,
    expect: { regs: { A: 0x21, R6: 0x00, R7: 0x21 }, flags: { C: 0, AC: 1, OV: 0, P: 0 } },
    notes: 'C = 0 at the end means the 16-bit result fits. If C were 1, the sum would need a third byte.'
  },
  {
    id: 'carry-24bit', category: 'carry', title: 'Carry propagation across three bytes', difficulty: 'Advanced',
    teaches: 'How a loop with ADDC and indirect addressing carries through any number of bytes stored in RAM.',
    source: `; 24-bit addition in RAM: 01FFFFH + 000001H = 020000H
; Numbers are stored low byte first (little-endian).
MOV 30H, #0FFH     ; first number: 30H = low byte
MOV 31H, #0FFH
MOV 32H, #01H      ;               32H = high byte
MOV 40H, #01H      ; second number: 40H = low byte
MOV 41H, #00H
MOV 42H, #00H
MOV R0, #30H       ; R0 -> first number (also receives the result)
MOV R1, #40H       ; R1 -> second number
MOV R2, #3         ; three bytes to add
CLR C              ; no carry into the lowest byte
next: MOV A, @R0
ADDC A, @R1        ; add one byte pair plus the carry from the previous pair
MOV @R0, A         ; store the result byte
INC R0             ; INC and DJNZ do not change C,
INC R1             ; so the carry survives to the next pass
DJNZ R2, next`,
    explanation: 'Using CLR C and ADDC for every byte (instead of ADD for the first) lets one loop body handle all bytes. The carry ripples from byte to byte because INC and DJNZ leave C untouched.',
    instructions: [['MOV A, @R0', 'Read the byte whose address is in R0.'], ['ADDC A, @R1', 'Add the byte addressed by R1 plus the carry.'], ['DJNZ R2, next', 'Repeat until all three bytes are done; flags are unaffected.']],
    math: ['Byte 0: FFH + 01H + 0 = 100H → 00H, C = 1', 'Byte 1: FFH + 00H + 1 = 100H → 00H, C = 1', 'Byte 2: 01H + 00H + 1 = 02H, C = 0', 'Result 32H:31H:30H = 02H 00H 00H = 020000H'],
    flagsBefore: `${RESET_FLAGS} C is cleared before the loop; it is 1 entering the 2nd and 3rd passes.`,
    expect: { regs: { A: 0x02, R0: 0x33, R1: 0x43, R2: 0x00 }, ram: { 0x30: 0x00, 0x31: 0x00, 0x32: 0x02 }, flags: { C: 0, AC: 0, OV: 0, P: 1 } },
    notes: 'The final C = 0 shows the 24-bit result did not overflow into a fourth byte.'
  },
  {
    id: 'carry-16bit-sub', category: 'carry', title: '16-bit subtraction with borrow', difficulty: 'Intermediate',
    teaches: 'How SUBB passes a borrow from the low byte to the high byte.',
    source: `; 16-bit subtraction: 2000H - 0001H = 1FFFH
CLR C              ; no incoming borrow for the low byte
MOV A, #00H        ; low byte of 2000H
SUBB A, #01H       ; 00H - 01H - 0 -> A = FFH, C = 1 (borrow)
MOV R6, A          ; R6 = FFH
MOV A, #20H        ; high byte of 2000H
SUBB A, #00H       ; 20H - 00H - C(1) = 1FH, C = 0
MOV R7, A          ; R7 = 1FH -> result R7:R6 = 1FFFH`,
    explanation: 'The low byte needs to borrow, so it wraps to FFH and sets C. The high-byte SUBB subtracts that borrow, just like borrowing from the next column on paper.',
    instructions: [['SUBB A, #01H', 'Low-byte subtraction; C = 1 records the borrow.'], ['SUBB A, #00H', 'High-byte subtraction that consumes the borrow.']],
    math: ['Low: 00H − 01H = −1 → FFH, C = 1', 'High: 20H − 00H − 1 = 1FH (low nibble 0 − 0 − 1 borrows → AC = 1)', '2000H − 0001H = 8192 − 1 = 8191 = 1FFFH'],
    flagsBefore: `${RESET_FLAGS} Before the high-byte SUBB: C = 1.`,
    expect: { regs: { A: 0x1F, R6: 0xFF, R7: 0x1F }, flags: { C: 0, AC: 1, OV: 0, P: 1 } },
    notes: 'Always CLR C before the lowest byte; never between bytes.'
  },
  {
    id: 'carry-set-clear', category: 'carry', title: 'When carry is set and cleared', difficulty: 'Beginner',
    teaches: 'Which instructions recalculate C, which force it, and how carry differs from signed overflow.',
    source: `; Watch C: set by an unsigned overflow, cleared by the next ADD, forced by SETB/CLR/CPL.
MOV A, #80H
ADD A, #80H       ; 80H + 80H = 100H -> A = 00H, C = 1, OV = 1
MOV 20H.0, C      ; save C (1) in bit 20H.0
ADD A, #01H       ; 00H + 01H = 01H -> C = 0, OV = 0 (ADD recalculates both)
MOV 20H.1, C      ; save C (0) in bit 20H.1
SETB C            ; C = 1 by hand
MOV 20H.2, C      ; save C (1) in bit 20H.2
CLR C             ; C = 0 by hand
CPL C             ; C = 1 again`,
    explanation: 'ADD, ADDC and SUBB always rewrite C. SETB C, CLR C and CPL C set it directly. MOV, INC, DEC and logical byte instructions leave it alone. Saving C into bits 20H.0–20H.2 records its value at each point.',
    instructions: [['ADD A, #80H', '128 + 128 = 256: unsigned carry (C = 1) and signed overflow (−128 + −128) at once.'], ['MOV 20H.n, C', 'Snapshot C into bit-addressable RAM.'], ['SETB C / CLR C / CPL C', 'Set, clear or invert the carry flag directly.']],
    math: ['80H + 80H = 100H → A = 00H, C = 1, OV = 1', '00H + 01H = 01H → C = 0, OV = 0', 'RAM 20H = 0000 0101B = 05H (bits 0 and 2 set)'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x01 }, ram: { 0x20: 0x05 }, flags: { C: 1, AC: 0, OV: 0, P: 1 } },
    notes: 'OV is only meaningful for signed numbers; C only for unsigned numbers. The first ADD sets both, the second clears both.'
  },

  // ── Category C: 8-bit wraparound ─────────────────────────────────────────
  {
    id: 'wrap-add', category: 'wrap', title: 'Addition beyond FFH', difficulty: 'Beginner',
    teaches: 'Why an 8-bit register keeps the sum modulo 256, and how C reports the lost ninth bit.',
    source: `; 8-bit registers keep only the low 8 bits: result mod 256.
MOV A, #0FAH      ; 250 decimal
ADD A, #0AH       ; 250 + 10 = 260 = 104H -> A = 04H, C = 1`,
    explanation: 'The full result 260 needs nine bits. The register keeps 260 − 256 = 4, and C = 1 tells you that 256 was carried out.',
    instructions: [['ADD A, #0AH', 'Add and keep the low 8 bits in A; the ninth bit goes to C.']],
    math: ['Full result: 250 + 10 = 260 = 104H = 1 0000 0100B', 'Register result: 260 mod 256 = 4 = 04H, C = 1', 'Low nibbles: AH + AH = 20 > 15 → AC = 1'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x04 }, flags: { C: 1, AC: 1, OV: 0, P: 1 } },
    notes: 'Signed view: FAH is −6, so −6 + 10 = +4 fits and OV = 0.'
  },
  {
    id: 'wrap-inc', category: 'wrap', title: 'FFH increments to 00H', difficulty: 'Beginner',
    teaches: 'That INC wraps FFH to 00H in A, a register or RAM, without touching the carry flag.',
    source: `; INC wraps FFH -> 00H and does NOT change C, AC or OV.
MOV A, #0FFH
INC A             ; A = 00H
MOV R0, #0FFH
INC R0            ; R0 = 00H
MOV 30H, #0FFH
INC 30H           ; RAM 30H = 00H`,
    explanation: 'FFH + 1 = 100H, and only the low 8 bits (00H) are kept. Unlike ADD, INC does not report the wrap in C — the carry stays exactly as it was.',
    instructions: [['INC A / INC R0 / INC 30H', 'Add 1 to a byte. Only P can change (when the target is A).']],
    math: ['FFH + 1 = 100H → 00H in every case'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x00, R0: 0x00 }, ram: { 0x30: 0x00 }, flags: { C: 0, AC: 0, OV: 0, P: 0 } },
    notes: 'To detect the wrap you must test the result (e.g. JZ), or use ADD A, #1, which sets C.'
  },
  {
    id: 'wrap-dec', category: 'wrap', title: '00H decrements to FFH', difficulty: 'Beginner',
    teaches: 'That DEC wraps 00H to FFH and leaves C unchanged, even when C is 1.',
    source: `; DEC wraps 00H -> FFH. Set C first to prove DEC leaves it alone.
SETB C            ; C = 1
CLR A             ; A = 00H (CLR A does not touch C)
DEC A             ; 00H - 1 wraps to FFH; C is still 1
MOV R1, #00H
DEC R1            ; R1 = FFH
MOV 31H, #00H
DEC 31H           ; RAM 31H = FFH`,
    explanation: '0 − 1 = −1, and −1 modulo 256 is 255 (FFH). DEC never sets or clears C, so the C = 1 from SETB is still there at the end.',
    instructions: [['DEC A / DEC R1 / DEC 31H', 'Subtract 1 from a byte. C, AC and OV are not affected.']],
    math: ['00H − 1 = −1 → −1 + 256 = 255 = FFH'],
    flagsBefore: `${RESET_FLAGS} SETB C makes C = 1 before the DEC instructions.`,
    expect: { regs: { A: 0xFF, R1: 0xFF }, ram: { 0x31: 0xFF }, flags: { C: 1, AC: 0, OV: 0, P: 0 } },
    notes: 'FFH has eight 1 bits (even), so P = 0. DEC DPTR does not exist on the 8051.'
  },
  {
    id: 'wrap-with-carry', category: 'wrap', title: 'Wraparound with and without carry', difficulty: 'Intermediate',
    teaches: 'How ADD, ADDC and INC treat the same overflow differently.',
    source: `; Same operands, different instructions.
MOV A, #0FFH
ADD A, #01H       ; FFH + 01H = 100H -> A = 00H, C = 1 (ADD ignores the old C)
MOV R0, A         ; R0 = 00H
MOV A, #0FFH
ADDC A, #01H      ; FFH + 01H + C(1) = 101H -> A = 01H, C = 1
MOV R1, A         ; R1 = 01H
MOV A, #0FFH
INC A             ; wraps to 00H; C, AC and OV keep their previous values`,
    explanation: 'ADD and ADDC both wrap and set C, but ADDC also includes the old C, so its result is one higher. INC wraps without reporting anything — the flags still show the ADDC result.',
    instructions: [['ADD A, #01H', 'Wrap to 00H and set C.'], ['ADDC A, #01H', 'Add the carry as well: FFH + 01H + 1 = 101H.'], ['INC A', 'Wrap to 00H, flags unchanged except P.']],
    math: ['ADD: 255 + 1 = 256 → 00H, C = 1', 'ADDC: 255 + 1 + 1 = 257 → 01H, C = 1', 'INC: 255 + 1 = 256 → 00H, C stays 1'],
    flagsBefore: `${RESET_FLAGS} Before ADDC: C = 1 (from ADD).`,
    expect: { regs: { A: 0x00, R0: 0x00, R1: 0x01 }, flags: { C: 1, AC: 1, OV: 0, P: 0 } },
    notes: 'AC = 1 is left over from ADDC (FH + 1H + 1 > FH); INC does not clear it.'
  },
  {
    id: 'wrap-signed', category: 'wrap', title: 'Unsigned carry vs signed overflow', difficulty: 'Intermediate',
    teaches: 'That C and OV answer different questions and can each be set without the other.',
    source: `; Case 1: 7FH + 01H = 80H.
;   Unsigned: 127 + 1 = 128 fits        -> C  = 0
;   Signed:  +127 + 1 = +128 too large  -> OV = 1
MOV A, #7FH
ADD A, #01H
MOV R0, A          ; R0 = 80H
MOV 20H.0, C       ; bit 20H.0 = C  (0)
MOV C, PSW.2       ; PSW.2 is the OV flag
MOV 20H.1, C       ; bit 20H.1 = OV (1)
; Case 2: FFH + 01H = 100H.
;   Unsigned: 255 + 1 = 256 too large   -> C  = 1
;   Signed:    -1 + 1 = 0 fits          -> OV = 0
MOV A, #0FFH
ADD A, #01H`,
    explanation: 'The same bit pattern means different numbers: 80H is 128 unsigned but −128 signed. C reports an unsigned result outside 0…255. OV reports a signed result outside −128…+127.',
    instructions: [['ADD A, #01H', 'Recalculates both C and OV.'], ['MOV C, PSW.2', 'Copy the OV bit (PSW bit 2) into C so it can be stored.']],
    math: ['Case 1: 7FH + 01H = 80H → C = 0, OV = 1 (saved in RAM 20H = 02H)', 'Case 2: FFH + 01H = 100H → A = 00H, C = 1, OV = 0'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x00, R0: 0x80 }, ram: { 0x20: 0x02 }, flags: { C: 1, AC: 1, OV: 0, P: 0 } },
    notes: 'Signed overflow happens only when two operands of the same sign give a result of the opposite sign.'
  },

  // ── Category D: Labels, loops and conditional jumps ──────────────────────
  {
    id: 'loop-counter', category: 'loop', title: 'Counter loop with CJNE', difficulty: 'Beginner',
    teaches: 'How a label and a compare-and-jump instruction build a loop that ends at a chosen count.',
    source: `; Count from 0 up to 5. CJNE jumps back until R0 equals 5.
MOV R0, #0         ; counter
up: INC R0         ; R0 = R0 + 1
CJNE R0, #5, up    ; jump to "up" while R0 is not 5
MOV A, R0          ; A = 05H`,
    explanation: 'CJNE (Compare and Jump if Not Equal) checks R0 against 5 every time around the loop. While they differ it jumps back; on the fifth pass they are equal and execution falls through.',
    instructions: [['up:', 'A label: a name for the address of INC R0.'], ['CJNE R0, #5, up', 'Compare R0 with 5; jump if not equal. C = 1 when R0 < 5.']],
    math: ['R0 takes the values 1, 2, 3, 4, 5', 'Steps: 1 + 5 × 2 + 1 = 12'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x05, R0: 0x05 }, flags: { C: 0, AC: 0, OV: 0, P: 0 }, steps: 12 },
    notes: 'The final CJNE sees R0 = 5, which is not less than 5, so it clears C.'
  },
  {
    id: 'loop-incdec', category: 'loop', title: 'Increment and decrement loops', difficulty: 'Beginner',
    teaches: 'How one counter can count up while another counts down to zero and ends the loop.',
    source: `; R2 counts up, R3 counts down. The loop ends when R3 reaches 0.
MOV R2, #00H
MOV R3, #04H
loop: INC R2       ; up-counter
DEC R3             ; down-counter
MOV A, R3          ; JNZ tests A, so copy R3 into A
JNZ loop           ; repeat while A is not zero
MOV A, R2          ; A = 04H: the loop ran four times`,
    explanation: 'The 8051 has no zero flag. JNZ looks at the accumulator itself, so the down-counter is copied into A before the test.',
    instructions: [['INC R2 / DEC R3', 'Count up and down; neither changes C.'], ['JNZ loop', 'Jump back while A ≠ 0.']],
    math: ['R3: 4 → 3 → 2 → 1 → 0 (four passes)', 'R2: 0 → 1 → 2 → 3 → 4'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x04, R2: 0x04, R3: 0x00 }, flags: { C: 0, AC: 0, OV: 0, P: 1 } },
    notes: 'DJNZ R3, loop would do the decrement and test in one instruction — see the next example.'
  },
  {
    id: 'loop-djnz', category: 'loop', title: 'Counted loops with DJNZ', difficulty: 'Beginner',
    teaches: 'How DJNZ decrements and branches in one instruction, using a register or a RAM byte as the counter.',
    source: `; Multiply 7 x 3 by repeated addition.
MOV R1, #3         ; repeat 3 times
CLR A
again: ADD A, #7
DJNZ R1, again     ; R1 = R1 - 1; jump back while R1 is not 0
; DJNZ also works on a direct RAM byte:
MOV 35H, #2
wait: DJNZ 35H, wait   ; loops twice, then 35H = 00H`,
    explanation: 'DJNZ subtracts 1 from its counter and jumps if the result is not zero. Starting at 3, the body runs exactly three times. DJNZ does not change any flags.',
    instructions: [['DJNZ R1, again', 'Decrement R1; jump to "again" if R1 ≠ 0.'], ['DJNZ 35H, wait', 'The same with a RAM counter (a 3-byte instruction).']],
    math: ['0 + 7 + 7 + 7 = 21 = 15H', 'Last ADD: 0EH + 07H = 15H; EH + 7H = 21 > 15 → AC = 1'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x15, R1: 0x00 }, ram: { 0x35: 0x00 }, flags: { C: 0, AC: 1, OV: 0, P: 1 } },
    notes: 'A counter that starts at 0 would run 256 times, because 00H − 1 wraps to FFH.'
  },
  {
    id: 'loop-sjmp', category: 'loop', title: 'Unconditional jumps with SJMP', difficulty: 'Beginner',
    teaches: 'How SJMP skips code, how the PC follows labels, and the standard “stop here” loop.',
    source: `; SJMP jumps by a signed 8-bit offset (-128 to +127 bytes).
MOV A, #01H        ; 0000H
SJMP skip          ; 0002H: jump over the next instruction
MOV A, #0FFH       ; 0004H: never executed
skip: ADD A, #01H  ; 0006H: A = 02H
SJMP finish        ; 0008H
INC A              ; 000AH: never executed
finish: MOV R0, A  ; 000BH: R0 = 02H
here: SJMP here    ; 000CH: jump to itself = end of program`,
    explanation: 'Each instruction occupies one to three bytes, so labels resolve to byte addresses. HERE: SJMP HERE is how real 8051 programs stop; the workbench recognises it and halts instead of looping forever.',
    instructions: [['SJMP skip', 'PC = address of "skip". The relative offset is calculated by the assembler.'], ['here: SJMP here', 'A jump to itself: the program stays here. The simulator reports “halted”.']],
    math: ['Executed: MOV, SJMP, ADD, SJMP, MOV, SJMP = 6 steps', 'Final PC = 000CH (the halt loop)'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x02, R0: 0x02 }, flags: { C: 0, AC: 0, OV: 0, P: 1 }, pc: 0x000C, steps: 6 },
    notes: 'SJMP $ means the same as HERE: SJMP HERE. On hardware the CPU keeps running this loop until reset or an interrupt.'
  },
  {
    id: 'loop-conditional', category: 'loop', title: 'Conditional jumps: JC, JNC, JZ, JNZ', difficulty: 'Intermediate',
    teaches: 'How to branch on the carry flag after a comparison and on the accumulator being zero.',
    source: `; Compare unsigned numbers with SUBB, then branch on C and on A.
MOV A, #30H
CLR C
SUBB A, #50H        ; 30H - 50H borrows -> C = 1
JC smaller          ; taken: 30H < 50H
MOV R0, #0          ; skipped
SJMP check_equal
smaller: MOV R0, #1     ; R0 = 1 means "first value was smaller"
check_equal: MOV A, #50H
CLR C
SUBB A, #50H        ; equal values -> A = 00H, C = 0
JNC no_borrow       ; taken: no borrow
MOV R1, #0FFH       ; skipped
no_borrow: JZ equal     ; taken: A = 0
MOV R2, #0          ; skipped
SJMP done
equal: MOV R2, #1       ; R2 = 1 means "values were equal"
JNZ done            ; not taken: A is still 0
MOV R3, #1          ; runs because JNZ fell through
done: NOP`,
    explanation: 'Subtracting is a way to compare: a borrow (C = 1) means the first number was smaller, and a zero result means they were equal. JC/JNC look at C; JZ/JNZ look at A.',
    instructions: [['JC / JNC label', 'Jump if C = 1 / if C = 0.'], ['JZ / JNZ label', 'Jump if A = 0 / if A ≠ 0 (there is no zero flag).'], ['SUBB A, #50H', 'Used here as a compare: only the flags and A = 0 matter.']],
    math: ['30H − 50H → borrow, C = 1 → JC taken → R0 = 1', '50H − 50H = 00H, C = 0 → JNC taken, JZ taken → R2 = 1', 'JNZ not taken → R3 = 1; R1 is never written'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x00, R0: 0x01, R1: 0x00, R2: 0x01, R3: 0x01 }, flags: { C: 0, AC: 0, OV: 0, P: 0 } },
    notes: 'CJNE is a shorter alternative: it compares, sets C when the first operand is smaller, and jumps if not equal.'
  },
  {
    id: 'loop-accumulate', category: 'loop', title: 'Loop that accumulates a total', difficulty: 'Intermediate',
    teaches: 'How to walk through an array with a pointer and a counter, adding each element.',
    source: `; Add the five bytes at RAM 40H-44H. The total is stored at 45H.
MOV 40H, #10
MOV 41H, #20
MOV 42H, #30
MOV 43H, #40
MOV 44H, #50
MOV R0, #40H       ; pointer to the first element
MOV R2, #5         ; number of elements
CLR A              ; running total = 0
sum: ADD A, @R0    ; add the element R0 points to
INC R0             ; move to the next element
DJNZ R2, sum       ; repeat five times
MOV 45H, A         ; total = 150 = 96H`,
    explanation: 'R0 is the pointer and R2 the counter. Each pass adds one element and moves on. The loop ends after exactly five passes because DJNZ counts R2 down to zero.',
    instructions: [['ADD A, @R0', 'Add the RAM byte addressed by R0.'], ['INC R0', 'Advance the pointer by one byte.'], ['DJNZ R2, sum', 'Loop until five elements have been added.']],
    math: ['10 + 20 + 30 + 40 + 50 = 150 = 96H (no unsigned carry, C = 0)', 'Last ADD: 100 + 50 → as signed numbers +100 + +50 = +150 > +127 → OV = 1'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x96, R0: 0x45, R2: 0x00 }, ram: { 0x45: 0x96 }, flags: { C: 0, AC: 0, OV: 1, P: 0 } },
    notes: 'OV = 1 is correct here: 96H read as a signed byte is −106. If the data are unsigned, ignore OV and watch C.'
  },

  // ── Category E: RAM and indirect addressing ──────────────────────────────
  {
    id: 'mem-direct', category: 'memory', title: 'Direct RAM writes and reads', difficulty: 'Beginner',
    teaches: 'The difference between an address and a constant: MOV A, 30H versus MOV A, #30H.',
    source: `; Direct addressing: the operand is a RAM address (no # sign).
MOV 30H, #5AH     ; write the constant 5AH into RAM address 30H
MOV A, 30H        ; read RAM 30H into A -> A = 5AH
MOV 31H, A        ; write A into RAM 31H -> 31H = 5AH
MOV A, #30H       ; with # this loads the NUMBER 30H, not the RAM byte`,
    explanation: 'Without # the number is an address, so the CPU fetches what is stored there. With # the number itself is the data. Open the Internal RAM tab after running to see 30H and 31H.',
    instructions: [['MOV 30H, #5AH', 'Direct ← immediate: store a constant in RAM.'], ['MOV A, 30H', 'A ← direct: read RAM.'], ['MOV 31H, A', 'Direct ← A: write RAM.']],
    math: ['RAM 30H = 5AH, RAM 31H = 5AH, A = 30H'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x30 }, ram: { 0x30: 0x5A, 0x31: 0x5A }, flags: { C: 0, AC: 0, OV: 0, P: 0 } },
    notes: 'Direct addresses 80H–FFH are special function registers, not RAM. MOV A, 0E0H reads the accumulator itself.'
  },
  {
    id: 'mem-registers', category: 'memory', title: 'Moving data between registers and RAM', difficulty: 'Beginner',
    teaches: 'How registers and RAM exchange data, and that bank-0 registers R0–R7 are RAM addresses 00H–07H.',
    source: `; Registers <-> RAM. Bank 0 registers live at RAM 00H-07H.
MOV R0, #11H
MOV R1, #22H
MOV 40H, R0       ; register -> RAM: 40H = 11H
MOV 41H, R1       ; 41H = 22H
MOV R2, 40H       ; RAM -> register: R2 = 11H
MOV A, 41H        ; A = 22H
MOV R3, A         ; R3 = 22H
XCH A, 40H        ; swap A and RAM 40H: A = 11H, 40H = 22H`,
    explanation: 'Registers are just fast-to-name bytes inside the same internal RAM. With bank 0 selected, R0 is RAM 00H, R1 is 01H and so on — the RAM tab shows them changing too.',
    instructions: [['MOV 40H, R0', 'Copy a register into a RAM byte.'], ['MOV R2, 40H', 'Copy a RAM byte into a register.'], ['XCH A, 40H', 'Exchange A with a RAM byte in one instruction.']],
    math: ['After XCH: A = 11H, RAM 40H = 22H', 'RAM 00H–03H = 11H 22H 11H 22H (R0–R3)'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x11, R0: 0x11, R1: 0x22, R2: 0x11, R3: 0x22 }, ram: { 0x00: 0x11, 0x01: 0x22, 0x02: 0x11, 0x03: 0x22, 0x40: 0x22, 0x41: 0x22 }, flags: { C: 0, AC: 0, OV: 0, P: 0 } },
    notes: 'MOV R2, R0 does not exist on the 8051; move through A or use the direct address (MOV R2, 00H in bank 0).'
  },
  {
    id: 'mem-indirect', category: 'memory', title: 'Indirect addressing with @R0 and @R1', difficulty: 'Intermediate',
    teaches: 'How R0 and R1 act as pointers: the register holds an address, and @ means “the byte at that address”.',
    source: `; R0 and R1 can hold an ADDRESS; @R0 means "the RAM byte R0 points to".
MOV R0, #50H      ; R0 points to RAM 50H
MOV R1, #51H      ; R1 points to RAM 51H
MOV @R0, #0AAH    ; RAM 50H = AAH
MOV A, #55H
MOV @R1, A        ; RAM 51H = 55H
MOV A, @R0        ; read through the pointer: A = AAH`,
    explanation: 'R0 itself still contains 50H; it is the RAM byte at 50H that changes. Changing R0 would make the same instruction reach a different address — the basis of tables and arrays.',
    instructions: [['MOV @R0, #0AAH', 'Store a constant at the address in R0.'], ['MOV @R1, A', 'Store A at the address in R1.'], ['MOV A, @R0', 'Load A from the address in R0.']],
    math: ['RAM 50H = AAH, RAM 51H = 55H, A = AAH (1010 1010B)'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0xAA, R0: 0x50, R1: 0x51 }, ram: { 0x50: 0xAA, 0x51: 0x55 }, flags: { C: 0, AC: 0, OV: 0, P: 0 } },
    notes: 'Only @R0 and @R1 exist. On the classic 8051 the pointer must be 00H–7FH; the simulator reports an error above 7FH.'
  },
  {
    id: 'mem-readback', category: 'memory', title: 'Write through a pointer and read it back', difficulty: 'Intermediate',
    teaches: 'How to verify an indirect write, modify RAM in place with INC @R0, and read it via another pointer.',
    source: `; Write to an indirect address, clear A, then read the value back.
MOV R0, #60H
MOV A, #3CH
MOV @R0, A        ; RAM 60H = 3CH
CLR A             ; destroy A so the read-back proves something
MOV A, @R0        ; A = 3CH again
INC @R0           ; increment RAM 60H in place -> 3DH
MOV R1, #60H      ; a second pointer to the same address
MOV B, @R1        ; B = 3DH`,
    explanation: 'Clearing A before reading back shows the value really came from RAM. INC @R0 changes the RAM byte without touching A, and a second pointer reads the new value into B.',
    instructions: [['MOV @R0, A', 'Write A to the address in R0.'], ['INC @R0', 'Increment the byte at the address in R0.'], ['MOV B, @R1', 'Direct ← indirect: copy the byte R1 points to into register B (F0H).']],
    math: ['RAM 60H: 3CH → 3DH; A = 3CH; B = 3DH'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x3C, B: 0x3D, R0: 0x60, R1: 0x60 }, ram: { 0x60: 0x3D }, flags: { C: 0, AC: 0, OV: 0, P: 0 } },
    notes: 'P reflects A only: 3CH has four 1 bits, so P = 0.'
  },
  {
    id: 'mem-block-copy', category: 'memory', title: 'Copy a block of RAM', difficulty: 'Intermediate',
    teaches: 'How two pointers and a counter move data from one RAM area to another.',
    source: `; Copy 4 bytes from RAM 30H-33H to 40H-43H.
MOV 30H, #11H
MOV 31H, #22H
MOV 32H, #33H
MOV 33H, #44H
MOV R0, #30H      ; source pointer
MOV R1, #40H      ; destination pointer
MOV R2, #4        ; byte count
copy: MOV A, @R0  ; read source byte
MOV @R1, A        ; write destination byte
INC R0
INC R1
DJNZ R2, copy
MOV 50H, 30H      ; direct-to-direct copy needs no register at all`,
    explanation: 'There is no MOV @R1, @R0, so each byte goes through A. After the loop both pointers have moved past the end of their blocks. A direct-to-direct MOV copies a single byte without touching A.',
    instructions: [['MOV A, @R0 / MOV @R1, A', 'Copy one byte via the accumulator.'], ['INC R0 / INC R1', 'Advance both pointers.'], ['MOV 50H, 30H', 'Direct → direct copy (3-byte instruction).']],
    math: ['RAM 40H–43H = 11H 22H 33H 44H', 'R0 = 34H, R1 = 44H, R2 = 0, RAM 50H = 11H'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x44, R0: 0x34, R1: 0x44, R2: 0x00 }, ram: { 0x40: 0x11, 0x41: 0x22, 0x42: 0x33, 0x43: 0x44, 0x50: 0x11 }, flags: { C: 0, AC: 0, OV: 0, P: 0 } },
    notes: 'Moving data never changes C, AC or OV.'
  },

  // ── Category F: Subroutines and stack ────────────────────────────────────
  {
    id: 'stack-acall', category: 'stack', title: 'Call a subroutine with ACALL', difficulty: 'Beginner',
    teaches: 'How ACALL saves the return address on the stack, and RET restores it into PC.',
    source: `; ACALL: 2-byte call to a subroutine in the same 2 KB page.
MOV A, #03H        ; 0000H
ACALL triple       ; 0002H: push return address 0004H, jump to "triple"
MOV R0, A          ; 0004H: runs after RET -> R0 = 09H
SJMP done          ; 0005H
triple: MOV B, A   ; 0007H: subroutine starts here
ADD A, B           ; A = 2 x original
ADD A, B           ; A = 3 x original
RET                ; pop 0004H back into PC
done: NOP`,
    explanation: 'ACALL pushes the address of the next instruction (0004H): low byte 04H to RAM 08H, high byte 00H to 09H. RET pops both bytes back into PC, so execution continues at MOV R0, A.',
    instructions: [['ACALL triple', 'SP + 1 ← PC low, SP + 1 ← PC high, then PC ← triple.'], ['RET', 'PC high ← (SP), SP − 1, PC low ← (SP), SP − 1.']],
    math: ['Stack after ACALL: SP = 09H, RAM 08H = 04H, 09H = 00H', 'After RET: SP = 07H, PC = 0004H', 'A = 3 + 3 + 3 = 9 = 09H'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x09, B: 0x03, R0: 0x09, SP: 0x07 }, ram: { 0x08: 0x04, 0x09: 0x00 }, flags: { C: 0, AC: 0, OV: 0, P: 0 } },
    notes: 'RET does not erase RAM 08H–09H; the old return address remains visible in the RAM tab.'
  },
  {
    id: 'stack-lcall', category: 'stack', title: 'Reusable subroutine with LCALL', difficulty: 'Beginner',
    teaches: 'How one subroutine can be called twice and always returns to the right place.',
    source: `; LCALL: 3-byte call that can reach anywhere in 64 KB.
MOV A, #10H          ; 0000H
LCALL add_five       ; 0002H: return address 0005H
LCALL add_five       ; 0005H: return address 0008H
SJMP done            ; 0008H
add_five: ADD A, #05H    ; 000AH
RET                  ; 000CH
done: MOV R7, A      ; R7 = 1AH`,
    explanation: 'Each LCALL pushes its own return address, so the same RET goes back to a different place each time. The second call overwrites the stack bytes left by the first.',
    instructions: [['LCALL add_five', 'Push the 16-bit return address and jump.'], ['RET', 'Return to whichever address is on top of the stack.']],
    math: ['10H + 05H + 05H = 1AH', 'RAM 08H = 08H, 09H = 00H (left by the second call)'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x1A, R7: 0x1A, SP: 0x07 }, ram: { 0x08: 0x08, 0x09: 0x00 }, flags: { C: 0, AC: 0, OV: 0, P: 1 } },
    notes: 'Use ACALL when the target is in the same 2 KB page to save one byte; LCALL always works.'
  },
  {
    id: 'stack-nested', category: 'stack', title: 'Nested calls and RET', difficulty: 'Intermediate',
    teaches: 'How the stack holds several return addresses at once, and how each RET unwinds one level.',
    source: `; A subroutine that calls another subroutine.
MOV A, #01H        ; 0000H
LCALL outer        ; 0002H: push 0005H
SJMP done          ; 0005H
outer: INC A       ; 0007H
LCALL inner        ; 0008H: push 000BH (two return addresses on the stack)
INC A              ; 000BH
RET                ; 000CH: back to 0005H
inner: INC A       ; 000DH
MOV R5, SP         ; record SP while both calls are active -> 0BH
RET                ; back to 000BH
done: NOP`,
    explanation: 'Inside "inner" the stack holds two return addresses (4 bytes, 08H–0BH). Each RET removes the most recent one, so control returns to outer first and then to the main program.',
    instructions: [['LCALL inner', 'A second call while the first is still active.'], ['MOV R5, SP', 'Copy the stack pointer (direct address 81H) into R5.'], ['RET', 'Pops the latest return address — last in, first out.']],
    math: ['RAM 08H–09H = 05H 00H (first call), 0AH–0BH = 0BH 00H (second call)', 'R5 = 0BH, final SP = 07H, A = 1 + 3 = 04H'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x04, R5: 0x0B, SP: 0x07 }, ram: { 0x08: 0x05, 0x09: 0x00, 0x0A: 0x0B, 0x0B: 0x00 }, flags: { C: 0, AC: 0, OV: 0, P: 1 } },
    notes: 'Each call level costs two bytes of stack. Deep nesting can run the stack into other data.'
  },
  {
    id: 'stack-push', category: 'stack', title: 'Pushing bytes onto the stack', difficulty: 'Beginner',
    teaches: 'That PUSH increments SP first and then stores a direct-addressed byte.',
    source: `; PUSH: SP = SP + 1, then RAM[SP] = the direct byte.
MOV 30H, #0A1H
MOV A, #0B2H
MOV B, #0C3H
PUSH 30H          ; SP 07H -> 08H, RAM 08H = A1H
PUSH ACC          ; SP -> 09H, RAM 09H = B2H  (write ACC, not A)
PUSH B            ; SP -> 0AH, RAM 0AH = C3H`,
    explanation: 'PUSH takes a direct address. The accumulator’s direct name is ACC (E0H); PUSH A is not valid 8051 syntax. Watch SP climb by one with each PUSH.',
    instructions: [['PUSH 30H', 'Push a RAM byte.'], ['PUSH ACC', 'Push the accumulator using its SFR name.'], ['PUSH B', 'Push register B (direct address F0H).']],
    math: ['SP: 07H → 08H → 09H → 0AH', 'RAM 08H–0AH = A1H B2H C3H'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0xB2, B: 0xC3, SP: 0x0A }, ram: { 0x08: 0xA1, 0x09: 0xB2, 0x0A: 0xC3 }, flags: { C: 0, AC: 0, OV: 0, P: 0 } },
    notes: 'With SP = 07H the stack overlaps register bank 1 (08H–0FH). Programs that use bank 1 usually move SP higher first.'
  },
  {
    id: 'stack-pop', category: 'stack', title: 'Restoring bytes with POP', difficulty: 'Beginner',
    teaches: 'How to save values, overwrite them, and restore them by popping in reverse order.',
    source: `; Save A and B, overwrite them, then restore them (last in, first out).
MOV A, #12H
MOV B, #34H
PUSH ACC          ; RAM 08H = 12H, SP = 08H
PUSH B            ; RAM 09H = 34H, SP = 09H
MOV A, #0FFH      ; overwrite both
MOV B, #00H
POP B             ; B = 34H (last pushed), SP = 08H
POP ACC           ; A = 12H, SP = 07H`,
    explanation: 'The stack returns bytes in the opposite order they went in. Popping in reverse order puts every value back where it came from.',
    instructions: [['POP B', 'B ← RAM[SP], then SP = SP − 1.'], ['POP ACC', 'Restore the accumulator.']],
    math: ['SP: 07H → 09H → 07H', 'A = 12H, B = 34H restored'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x12, B: 0x34, SP: 0x07 }, ram: { 0x08: 0x12, 0x09: 0x34 }, flags: { C: 0, AC: 0, OV: 0, P: 0 } },
    notes: 'Popping in the same order as pushing would swap A and B. POP ACC also updates P because A changes.'
  },
  {
    id: 'stack-pointer', category: 'stack', title: 'Watching the stack pointer move', difficulty: 'Advanced',
    teaches: 'How to relocate the stack, and how PUSH, CALL, RET and POP move SP and fill stack memory.',
    source: `; Move the stack to 30H so it no longer overlaps register bank 1.
MOV SP, #2FH       ; first push will go to 30H
MOV R0, #01H
MOV R1, #02H
PUSH 00H           ; push R0 (bank 0 R0 = direct 00H): RAM 30H = 01H, SP = 30H
PUSH 01H           ; push R1: RAM 31H = 02H, SP = 31H
LCALL show_sp      ; return address 000EH -> RAM 32H = 0EH, 33H = 00H, SP = 33H
POP 03H            ; R3 = 02H, SP = 30H
POP 04H            ; R4 = 01H, SP = 2FH
SJMP done
show_sp: MOV R7, SP    ; R7 = 33H inside the subroutine
RET                ; SP back to 31H
done: NOP`,
    explanation: 'PUSH and LCALL both grow the stack, RET and POP shrink it. Data pushed before a call is still there after the return. Popping into 03H and 04H puts the values in R3 and R4.',
    instructions: [['MOV SP, #2FH', 'Choose where the stack starts (SP points to the last used byte).'], ['PUSH 00H', 'Registers are pushed by their direct address.'], ['POP 03H', 'Pop into R3 of bank 0.']],
    math: ['SP: 07H → 2FH → 30H → 31H → 33H (call) → 31H (RET) → 30H → 2FH', 'RAM 30H–33H = 01H 02H 0EH 00H'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x00, R0: 0x01, R1: 0x02, R3: 0x02, R4: 0x01, R7: 0x33, SP: 0x2F }, ram: { 0x30: 0x01, 0x31: 0x02, 0x32: 0x0E, 0x33: 0x00 }, flags: { C: 0, AC: 0, OV: 0, P: 0 } },
    notes: 'The classic 8051 stack must stay within 00H–7FH. The simulator stops with an error if it would grow past 7FH.'
  },
  {
    id: 'stack-preserve', category: 'stack', title: 'Subroutine that preserves registers', difficulty: 'Advanced',
    teaches: 'How a subroutine saves the caller’s registers, does its work, returns a result, and restores them.',
    source: `; "work" uses A and R0 internally but restores the caller's values.
; It returns its result in B (deliberately modified).
MOV A, #77H
MOV R0, #88H
LCALL work
SJMP done
work: PUSH ACC      ; save the caller's A
PUSH 00H            ; save the caller's R0 (bank 0 R0 = direct 00H)
MOV A, #0           ; scratch work that destroys A and R0
MOV R0, #40H
MOV @R0, #99H       ; useful output in RAM 40H
MOV B, @R0          ; return value in B = 99H
POP 00H             ; restore in reverse order
POP ACC
RET
done: MOV R1, A     ; R1 = 77H proves A was preserved`,
    explanation: 'The caller’s A and R0 survive the call because the subroutine pushes them first and pops them before RET. B is the agreed output register, so it is changed on purpose.',
    instructions: [['PUSH ACC / PUSH 00H', 'Save the caller’s values on top of the return address.'], ['POP 00H / POP ACC', 'Restore them in reverse order before RET.'], ['RET', 'Works because every PUSH inside the subroutine has a matching POP.']],
    math: ['Stack during work: 08H–09H = return address 0007H, 0AH = 77H, 0BH = 88H', 'After return: A = 77H, R0 = 88H, B = 99H, RAM 40H = 99H'],
    flagsBefore: RESET_FLAGS,
    expect: { regs: { A: 0x77, B: 0x99, R0: 0x88, R1: 0x77, SP: 0x07 }, ram: { 0x08: 0x07, 0x09: 0x00, 0x0A: 0x77, 0x0B: 0x88, 0x40: 0x99 }, flags: { C: 0, AC: 0, OV: 0, P: 0 } },
    notes: 'An unmatched PUSH would make RET pop data instead of the return address — a classic crash.'
  },

  // ── Category G: BCD arithmetic ───────────────────────────────────────────
  {
    id: 'bcd-simple', category: 'bcd', title: 'BCD addition with ADD and DA A', difficulty: 'Beginner',
    teaches: 'What packed BCD is, and that DA A changes nothing when the binary sum is already valid BCD.',
    source: `; Packed BCD: 23H means decimal 23 (one digit per nibble).
; 23 + 45 = 68: no digit exceeds 9, so DA A has nothing to fix.
MOV A, #23H
ADD A, #45H       ; binary result 68H (already valid BCD)
DA A              ; A = 68H = decimal 68`,
    explanation: 'Each nibble sum (3 + 5 and 2 + 4) stays below 10 and AC = 0, so DA A leaves A unchanged. It is still good practice to use DA A after every BCD addition.',
    instructions: [['ADD A, #45H', 'Binary addition of two packed-BCD bytes.'], ['DA A', 'Decimal adjust: adds 06H and/or 60H only when needed.']],
    math: ['Binary: 23H + 45H = 68H', 'DA A: low 8 ≤ 9, AC = 0; high 6 ≤ 9, C = 0 → no change', 'Result: 68H = decimal 68'],
    flagsBefore: `${RESET_FLAGS} After ADD (before DA A): C = 0, AC = 0.`,
    expect: { regs: { A: 0x68 }, flags: { C: 0, AC: 0, OV: 0, P: 1 } },
    notes: 'DA A assumes both operands were valid packed BCD (each nibble 0–9).'
  },
  {
    id: 'bcd-adjust', category: 'bcd', title: 'BCD addition that needs adjustment', difficulty: 'Intermediate',
    teaches: 'How DA A repairs a low nibble that went above 9.',
    source: `; 38 + 45 = 83 decimal
MOV A, #38H
ADD A, #45H       ; binary: 38H + 45H = 7DH (D is not a decimal digit)
DA A              ; low nibble > 9 -> add 06H: 7DH + 06H = 83H`,
    explanation: 'In binary, 8 + 5 = 13 = DH, which is not a decimal digit. Adding 6 skips the six unused codes AH–FH, turning D into 3 and carrying 1 into the tens digit.',
    instructions: [['ADD A, #45H', 'Binary sum 7DH.'], ['DA A', 'Low nibble DH > 9, so 06H is added.']],
    math: ['Binary: 38H + 45H = 7DH, AC = 0 (8H + 5H = DH has no carry out of bit 3)', 'DA A: 7DH + 06H = 83H; high nibble 8 ≤ 9 and C = 0 → done', 'Result: 83H = decimal 83'],
    flagsBefore: `${RESET_FLAGS} After ADD (before DA A): C = 0, AC = 0.`,
    expect: { regs: { A: 0x83 }, flags: { C: 0, AC: 0, OV: 0, P: 1 } },
    notes: 'OV is left from the ADD and has no meaning for BCD numbers.'
  },
  {
    id: 'bcd-carry', category: 'bcd', title: 'BCD carry into a third digit', difficulty: 'Intermediate',
    teaches: 'How DA A produces a decimal carry, and how to turn that carry into a hundreds digit.',
    source: `; 75 + 48 = 123 decimal: the answer needs three digits.
MOV A, #75H
ADD A, #48H       ; binary BDH: both nibbles are above 9
DA A              ; +06H -> C3H, then +60H -> 123H: A = 23H, C = 1
MOV R0, A         ; R0 = 23H (tens and units)
CLR A             ; CLR A does not change C
ADDC A, #00H      ; A = 0 + 0 + C = 01H (hundreds digit)
MOV R1, A         ; R1 = 01H -> result R1:R0 = 01 23`,
    explanation: 'DA A first fixes the low digit (D → 3, +06H), then the high digit (C → 2, +60H). The second correction carries out of bit 7, so C = 1 means “add 100”. ADDC captures that carry as the hundreds digit.',
    instructions: [['DA A', 'Two corrections here: +06H for the low nibble and +60H for the high nibble.'], ['ADDC A, #00H', 'Turn the decimal carry into a BCD digit.']],
    math: ['Binary: 75H + 48H = BDH', 'DA A: BDH + 06H = C3H; C3H + 60H = 123H → A = 23H, C = 1', 'Result: R1:R0 = 01H 23H = decimal 123'],
    flagsBefore: `${RESET_FLAGS} After ADD (before DA A): C = 0, AC = 0. After DA A: C = 1.`,
    expect: { regs: { A: 0x01, R0: 0x23, R1: 0x01 }, flags: { C: 0, AC: 0, OV: 0, P: 1 } },
    notes: 'The final flags come from ADDC (0 + 0 + 1 = 1). The decimal carry from DA A is preserved in R1.'
  },
  {
    id: 'bcd-ac', category: 'bcd', title: 'Why auxiliary carry matters in DA A', difficulty: 'Intermediate',
    teaches: 'That a low nibble can look valid but still be wrong, and AC is how DA A knows.',
    source: `; 29 + 38 = 67 decimal
MOV A, #29H
ADD A, #38H       ; binary 61H. The low digit 1 looks valid, but 9 + 8 = 17
                  ; overflowed the nibble, so AC = 1
DA A              ; AC = 1 -> add 06H: 61H + 06H = 67H`,
    explanation: 'The low nibble 1 is below 10, so on its own it looks fine. But 9 + 8 = 17 wrapped past 15, and AC records that. DA A checks AC as well as the nibble value and adds 06H.',
    instructions: [['ADD A, #38H', 'Sets AC because the low nibbles carry out of bit 3.'], ['DA A', 'Low nibble 1 ≤ 9, but AC = 1 → add 06H.']],
    math: ['Binary: 29H + 38H = 61H; 9H + 8H = 11H → AC = 1', 'DA A: 61H + 06H = 67H', 'Result: 67H = decimal 67'],
    flagsBefore: `${RESET_FLAGS} After ADD (before DA A): C = 0, AC = 1.`,
    expect: { regs: { A: 0x67 }, flags: { C: 0, AC: 1, OV: 0, P: 1 } },
    notes: 'DA A does not clear AC; it stays 1 from the ADD.'
  },
  {
    id: 'bcd-multibyte', category: 'bcd', title: '4-digit BCD addition with ADDC', difficulty: 'Advanced',
    teaches: 'How the carry from DA A on the low byte flows into the high byte through ADDC.',
    source: `; 4-digit BCD: 1999 + 0001 = 2000
MOV A, #99H       ; low two digits of 1999
ADD A, #01H       ; 99H + 01H = 9AH
DA A              ; -> A = 00H, C = 1 (decimal carry into the next byte)
MOV R6, A         ; R6 = 00H
MOV A, #19H       ; high two digits of 1999
ADDC A, #00H      ; 19H + 00H + C = 1AH
DA A              ; -> 20H, C = 0
MOV R7, A         ; R7 = 20H -> result R7:R6 = 2000`,
    explanation: 'Multi-digit BCD works like multi-byte binary: ADD then DA A for the lowest byte, then ADDC then DA A for every higher byte. The decimal carry travels in C between the bytes.',
    instructions: [['ADD + DA A', 'Lowest byte: 99 + 01 = 100 → 00, carry 1.'], ['ADDC + DA A', 'Next byte: 19 + 00 + 1 = 20.']],
    math: ['Low byte: 9AH + 06H = A0H, + 60H = 100H → 00H, C = 1', 'High byte: 19H + 00H + 1 = 1AH, + 06H = 20H, C = 0', 'Result: R7:R6 = 20H 00H = decimal 2000'],
    flagsBefore: `${RESET_FLAGS} Before ADDC: C = 1 (from the first DA A).`,
    expect: { regs: { A: 0x20, R6: 0x00, R7: 0x20 }, flags: { C: 0, AC: 0, OV: 0, P: 1 } },
    notes: 'DA A is only correct after ADD or ADDC. For BCD subtraction you need a different method (such as ten’s-complement addition).'
  }
];

// Every example in this library runs on the simulator; reference-only examples would set executable: false.
for (const example of examples) example.executable ??= true;
