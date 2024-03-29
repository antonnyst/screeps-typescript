/* eslint-disable */
declare global {
  namespace NodeJS {
    interface Global {
      Memory?: Memory;
    }
  }
  interface RawMemory {
    _parsed: Memory;
  }
}

// Usage:
// At top of main: import MemHack from './MemHack'
// At top of loop(): MemHack.pretick()
// Thats it!
const MemHack = {
  memory: Memory,
  parseTime: -1,
  register() {
    const start = Game.cpu.getUsed();
    this.memory = Memory;
    const end = Game.cpu.getUsed();
    this.parseTime = end - start;
    this.memory = RawMemory._parsed;
  },
  pretick() {
    delete global.Memory;
    global.Memory = this.memory;
    RawMemory._parsed = this.memory;
  }
};
MemHack.register();
export default MemHack;
