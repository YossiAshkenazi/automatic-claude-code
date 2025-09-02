declare module 'cli-progress' {
  export interface BarOptions {
    format?: string;
    barCompleteChar?: string;
    barIncompleteChar?: string;
    hideCursor?: boolean;
    clearOnComplete?: boolean;
    stopOnComplete?: boolean;
    etaBuffer?: number;
    fps?: number;
    stream?: any;
    terminal?: any;
    barsize?: number;
    position?: 'left' | 'center' | 'right';
    barGlue?: string;
    barCompleteString?: string;
    barIncompleteString?: string;
    noTTYOutput?: boolean;
    notTTYSchedule?: number;
    synchronousUpdate?: boolean;
    linewrap?: boolean;
    autopadding?: boolean;
  }

  export interface Presets {
    legacy: BarOptions;
    rect: BarOptions;
    shades_classic: BarOptions;
    shades_grey: BarOptions;
  }

  export class SingleBar {
    constructor(options?: BarOptions, preset?: BarOptions);
    start(total: number, startValue?: number, payload?: any): void;
    update(current: number, payload?: any): void;
    increment(step?: number, payload?: any): void;
    setTotal(total: number): void;
    stop(): void;
    getProgress(): number;
  }

  export class MultiBar {
    constructor(options?: BarOptions, preset?: BarOptions);
    create(total: number, startValue?: number, payload?: any, barOptions?: BarOptions): SingleBar;
    update(): void;
    stop(): void;
    log(data: string): void;
  }

  export const Presets: Presets;
}

declare module 'blessed' {
  export interface IOptions {
    top?: number | string;
    left?: number | string;
    width?: number | string;
    height?: number | string;
    right?: number | string;
    bottom?: number | string;
    position?: {
      top?: number | string;
      left?: number | string;
      width?: number | string;
      height?: number | string;
      right?: number | string;
      bottom?: number | string;
    };
    tags?: boolean;
    content?: string;
    clickable?: boolean;
    input?: boolean;
    focusable?: boolean;
    hidden?: boolean;
    label?: string | { text: string; side: 'left' | 'right' };
    hoverText?: string;
    mouse?: boolean;
    keys?: boolean;
    style?: any;
    border?: any;
    scrollbar?: any;
    wrap?: boolean;
    valign?: 'top' | 'middle' | 'bottom';
    align?: 'left' | 'center' | 'right';
    shrink?: boolean;
    padding?: number | { left?: number; right?: number; top?: number; bottom?: number };
    margin?: number | { left?: number; right?: number; top?: number; bottom?: number };
    name?: string;
    title?: string;
    smartCSR?: boolean;
    dockBorders?: boolean;
    fullUnicode?: boolean;
    autoPadding?: boolean;
  }

  export interface ScreenOptions extends IOptions {
    program?: any;
    cursor?: any;
    log?: string;
    debug?: boolean;
    dump?: boolean;
    warnings?: boolean;
    terminal?: string;
    term?: string;
    tput?: boolean;
    resizeTimeout?: number;
    sendFocus?: boolean;
    forceUnicode?: boolean;
    zero?: boolean;
    tabSize?: number;
  }

  export interface NodeOptions extends IOptions {
    parent?: any;
    children?: any[];
    inputOnFocus?: boolean;
    alwaysScroll?: boolean;
    scrollable?: boolean;
    vi?: boolean;
    emacs?: boolean;
    keyable?: boolean;
  }

  export interface Screen {
    program: any;
    focused: any;
    width: number;
    height: number;
    alloc(): void;
    realloc(): void;
    draw(start: number, end: number): void;
    render(): void;
    clearRegion(x1: number, y1: number, x2: number, y2: number): void;
    fillRegion(attr: number, ch: string, x1: number, y1: number, x2: number, y2: number): void;
    focusNext(): void;
    focusPrevious(): void;
    focusFirst(): void;
    focusLast(): void;
    key(keys: string | string[], listener: (ch: any, key: any) => void): void;
    onceKey(keys: string | string[], listener: (ch: any, key: any) => void): void;
    unkey(keys: string | string[], listener?: Function): void;
    spawn(file: string, args?: string[], options?: any): any;
    exec(file: string, args?: string[], options?: any, callback?: Function): any;
    readEditor(options?: any, callback?: Function): void;
    setTitle(title: string): void;
    cursorShape(shape: any, blink?: boolean): void;
    cursorColor(color: any): void;
    cursorReset(): void;
    screenshot(xi?: number, xl?: number, yi?: number, yl?: number): string;
    destroy(): void;
    log(msg: string): void;
    debug(msg: string): void;
    append(element: any): void;
    prepend(element: any): void;
    insertBefore(element: any, other: any): void;
    insertAfter(element: any, other: any): void;
    remove(element: any): any;
  }

  export interface Node {
    screen: Screen;
    parent: Node;
    children: Node[];
    $: any;
    _: any;
    data: any;
    type: string;
    options: NodeOptions;
    position: any;
    style: any;
    border: any;
    content: string;
    hidden: boolean;
    visible: boolean;
    detached: boolean;
    name: string;
    uid: number;
    index: number;
    padding: any;
    margin: any;
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
    aleft: number;
    atop: number;
    aright: number;
    abottom: number;
    awidth: number;
    aheight: number;
    dwidth: number;
    dheight: number;
    scrollable: boolean;
    childOffset: number;
    scrollTop: number;
    scrollHeight: number;
    childBase: number;
    baseLimit: number;
    focused: boolean;
    select: boolean;
    clickable: boolean;
    keyable: boolean;
    mouse: boolean;
    destroyed: boolean;
    destroyed_: boolean;
    rendering: boolean;
    shrink: boolean;
    wrap: boolean;
    parseTags: boolean;
    ch: string;
    attr: number;
    lines: any[];
    content_: string;
    parsedContent: string;
    lpos: any;
    emit(type: string, ...args: any[]): boolean;
    on(type: string, listener: Function): any;
    once(type: string, listener: Function): any;
    removeListener(type: string, listener: Function): any;
    removeAllListeners(type?: string): any;
    setMaxListeners(n: number): any;
    listeners(type: string): Function[];
    append(element: Node): void;
    prepend(element: Node): void;
    insertBefore(element: Node, other: Node): void;
    insertAfter(element: Node, other: Node): void;
    remove(element: Node): Node;
    detach(): Node;
    free(): void;
    destroy(): void;
    setIndex(z: number): void;
    setFront(): void;
    setBack(): void;
    setLabel(options: string | { text: string; side: 'left' | 'right' }): void;
    removeLabel(): void;
    setHover(options: string | { text: string }): void;
    removeHover(): void;
    enableMouse(): void;
    enableKeys(): void;
    enableInput(): void;
    enableDrag(): void;
    disableDrag(): void;
    screenshot(xi?: number, xl?: number, yi?: number, yl?: number): string;
    hide(): void;
    show(): void;
    toggle(): void;
    focus(): void;
    key(keys: string | string[], listener: (ch: any, key: any) => void): void;
    onceKey(keys: string | string[], listener: (ch: any, key: any) => void): void;
    unkey(keys: string | string[], listener?: Function): void;
    scroll(offset: number, always?: boolean): void;
    scrollTo(offset: number): void;
    getScroll(): number;
    setScroll(offset: number): void;
    resetScroll(): void;
    getScrollHeight(): number;
    getScrollPerc(): number;
    setScrollPerc(i: number): void;
    render(): any;
    parseContent(content?: boolean | string): string;
    parseAttr(lines: any): any;
    parseANSI(text: string): any;
    parseSGR(text: string): any;
    wrapContent(content?: string, width?: number): string;
    textLength(text: string): number;
    strWidth(text: string): number;
    measureText(text: string): { width: number; height: number };
    deleteTop(i: number): void;
    deleteBottom(i: number): void;
    insertTop(i: number, lines: any): void;
    insertBottom(i: number, lines: any): void;
    insertLine(i: number, lines: any): void;
    deleteLine(i: number): void;
    clearLine(i: number): void;
    clearBaseLine(i: number): void;
    clearLines(): void;
    getCoords(getter?: boolean): any;
    getLine(i: number): string;
    getBaseLine(i: number): string;
    setLine(i: number, line: any): void;
    setBaseLine(i: number, line: any): void;
    pushLine(line: any): number;
    popLine(): any;
    unshiftLine(line: any): number;
    shiftLine(i: number): any;
    getLines(): string[];
    getScreenLines(): string[];
    getContent(): string;
    getText(): string;
    setContent(content: string): void;
    setText(content: string): void;
    insertText(text: string, i: number): void;
    deleteText(text: string, i: number): void;
  }

  export function screen(options?: ScreenOptions): Screen;
  export function element(options?: NodeOptions): Node;
  export function box(options?: NodeOptions): Node;
  export function text(options?: NodeOptions): Node;
  export function line(options?: any): Node;
  export function scrollablebox(options?: NodeOptions): Node;
  export function scrollabletext(options?: NodeOptions): Node;
  export function bigtext(options?: any): Node;
  export function list(options?: any): Node;
  export function filemanager(options?: any): Node;
  export function listbar(options?: any): Node;
  export function listtable(options?: any): Node;
  export function table(options?: any): Node;
  export function listbox(options?: any): Node;
  export function form(options?: any): Node;
  export function input(options?: any): Node;
  export function textbox(options?: any): Node;
  export function textarea(options?: any): Node;
  export function button(options?: any): Node;
  export function checkbox(options?: any): Node;
  export function radiobutton(options?: any): Node;
  export function radioset(options?: any): Node;
  export function prompt(options?: any): Node;
  export function question(options?: any): Node;
  export function message(options?: any): Node;
  export function loading(options?: any): Node;
  export function progressbar(options?: any): Node;
  export function log(options?: any): Node;
}

declare module 'blessed-contrib' {
  export interface GaugeOptions {
    label?: string;
    top?: number | string;
    left?: number | string;
    width?: number | string;
    height?: number | string;
    right?: number | string;
    bottom?: number | string;
    stroke?: string;
    fill?: string;
    percent?: number;
    data?: any;
    showLabel?: boolean;
    [key: string]: any; // Allow any additional properties
  }

  export function gauge(options?: GaugeOptions): any;
  export function donut(options?: any): any;
  export function line(options?: any): any;
  export function bar(options?: any): any;
  export function stackedBar(options?: any): any;
  export function map(options?: any): any;
  export function table(options?: any): any;
  export function tree(options?: any): any;
  export function markdown(options?: any): any;
  export function sparkline(options?: any): any;
  export function log(options?: any): any;
  export function grid(options?: any): any;
  export function carousel(options?: any): any;
}