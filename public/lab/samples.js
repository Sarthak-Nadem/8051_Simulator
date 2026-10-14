// Programs offered by the workbench “Example program” menu and the Learn cards.
export const samples = {
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
