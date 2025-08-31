declare module 'blessed' {
  const blessed: any;
  export = blessed;
}

declare module 'blessed-contrib' {
  const contrib: any;
  export = contrib;
}

declare module 'cli-progress' {
  const cliProgress: any;
  export = cliProgress;
}

declare module 'ora' {
  const ora: any;
  export = ora;
}

declare module 'cli-highlight' {
  export function highlight(code: string, options?: any): string;
}

declare module 'boxen' {
  function boxen(text: string, options?: any): string;
  export = boxen;
}

declare module 'cli-table3' {
  class Table {
    constructor(options?: any);
    push(...args: any[]): void;
    toString(): string;
  }
  export = Table;
}