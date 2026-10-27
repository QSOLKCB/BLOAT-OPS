// Explicit xorshift32 state; gameplay never calls Math.random or wall-clock APIs.
export class Random {
  constructor(seed = 0xB10A7001) { this.state = seed >>> 0 || 1; }
  next() { let x=this.state; x^=x<<13; x^=x>>>17; x^=x<<5; this.state=x>>>0; return this.state/4294967296; }
}
