import blessed from 'blessed';
import contrib from 'blessed-contrib';
import * as path from 'path';
import * as os from 'os';
import { LogViewer, SessionSummary, ParsedLogEntry } from './logViewer';

export interface TUIState {
  selectedSession: number;
  selectedIteration: number;
  viewMode: 'sessions' | 'iterations' | 'details';
  searchQuery: string;
  filteredSessions: SessionSummary[];
  currentSessionLogs: ParsedLogEntry[];
}

export class TUIBrowser {
  private screen: any;
  private logViewer: LogViewer;
  private state: TUIState;
  private sessionList: any;
  private iterationList: any;
  private detailsBox: any;
  private statusBar: any;
  private searchBox: any;
  private progressBar: any;

  constructor(repoName?: string) {
    this.logViewer = new LogViewer(repoName);
    this.state = {
      selectedSession: 0,
      selectedIteration: 0,
      viewMode: 'sessions',
      searchQuery: '',
      filteredSessions: [],
      currentSessionLogs: []
    };

    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Automatic Claude Code - Log Browser',
      dockBorders: true,
      fullUnicode: true,
      autoPadding: false
    });

    this.initializeUI();
    this.setupEventHandlers();
    this.loadData();
  }

  private initializeUI(): void {
    // Header
    const header = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}🚀 Automatic Claude Code - Interactive Log Browser{/bold}{/center}',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'blue',
        border: {
          fg: 'cyan'
        }
      }
    });

    // Session List (Left Panel)
    this.sessionList = blessed.list({
      label: ' Sessions ',
      top: 3,
      left: 0,
      width: '40%',
      height: '70%',
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'cyan'
        },
        selected: {
          bg: 'blue',
          fg: 'white'
        }
      },
      keys: true,
      vi: true,
      mouse: true,
      tags: true,
      scrollable: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'yellow'
        },
        style: {
          inverse: true
        }
      }
    });

    // Iteration List (Top Right Panel)
    this.iterationList = blessed.list({
      label: ' Iterations ',
      top: 3,
      left: '40%',
      width: '60%',
      height: '35%',
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'cyan'
        },
        selected: {
          bg: 'green',
          fg: 'white'
        }
      },
      keys: true,
      vi: true,
      mouse: true,
      tags: true,
      scrollable: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'yellow'
        },
        style: {
          inverse: true
        }
      }
    });

    // Details Box (Bottom Right Panel)
    this.detailsBox = blessed.box({
      label: ' Details ',
      top: '38%',
      left: '40%',
      width: '60%',
      height: '35%',
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'cyan'
        }
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'yellow'
        },
        style: {
          inverse: true
        }
      },
      keys: true,
      vi: true,
      mouse: true,
      tags: true
    });

    // Search Box
    this.searchBox = blessed.textbox({
      label: ' Search ',
      top: '73%',
      left: 0,
      width: '40%',
      height: 3,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'yellow'
        }
      },
      inputOnFocus: true
    });

    // Progress Bar
    this.progressBar = contrib.gauge({
      label: 'Session Progress',
      left: '40%',
      width: '30%',
      height: 4,
      stroke: 'green',
      fill: 'white'
    });

    // Status Bar
    this.statusBar = blessed.text({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: 'Press "q" to quit | Arrow keys to navigate | Enter to select | "s" to search | "e" to export | "h" for help',
      style: {
        fg: 'white',
        bg: 'blue'
      },
      tags: true
    });

    // Add all elements to screen
    this.screen.append(header);
    this.screen.append(this.sessionList);
    this.screen.append(this.iterationList);
    this.screen.append(this.detailsBox);
    this.screen.append(this.searchBox);
    this.screen.append(this.progressBar);
    this.screen.append(this.statusBar);

    // Focus on session list initially
    this.sessionList.focus();
  }

  private setupEventHandlers(): void {
    // Global key handlers
    this.screen.key(['q', 'C-c'], () => {
      process.exit(0);
    });

    this.screen.key(['h'], () => {
      this.showHelp();
    });

    this.screen.key(['s'], () => {
      this.searchBox.focus();
    });

    this.screen.key(['e'], () => {
      this.exportCurrentSession();
    });

    this.screen.key(['r'], () => {
      this.refreshData();
    });

    this.screen.key(['tab'], () => {
      this.switchFocus();
    });

    // Session list handlers
    this.sessionList.on('select', (item: any, index: number) => {
      this.state.selectedSession = index;
      this.loadSessionIterations();
      this.updateProgressBar();
    });

    this.sessionList.key(['enter'], () => {
      this.state.viewMode = 'iterations';
      this.iterationList.focus();
    });

    // Iteration list handlers
    this.iterationList.on('select', (item: any, index: number) => {
      this.state.selectedIteration = index;
      this.loadIterationDetails();
    });

    this.iterationList.key(['enter'], () => {
      this.state.viewMode = 'details';
      this.detailsBox.focus();
    });

    this.iterationList.key(['escape'], () => {
      this.state.viewMode = 'sessions';
      this.sessionList.focus();
    });

    // Details box handlers
    this.detailsBox.key(['escape'], () => {
      this.state.viewMode = 'iterations';
      this.iterationList.focus();
    });

    // Search box handlers
    this.searchBox.on('submit', (value: string) => {
      this.state.searchQuery = value;
      this.filterSessions();
      this.sessionList.focus();
    });

    this.searchBox.key(['escape'], () => {
      this.sessionList.focus();
    });
  }

  private loadData(): void {
    const summaries = this.logViewer.getSessionSummaries();
    this.state.filteredSessions = summaries;
    this.updateSessionList();
    this.updateStatusBar(`Loaded ${summaries.length} sessions`);
  }

  private updateSessionList(): void {
    const items = this.state.filteredSessions.map((session, _index) => {
      const duration = Math.round(session.duration / 1000);
      const durationStr = duration > 3600 ? `${Math.floor(duration/3600)}h ${Math.floor((duration%3600)/60)}m` :
                         duration > 60 ? `${Math.floor(duration/60)}m ${duration%60}s` :
                         `${duration}s`;

      let statusIcon = '';
      switch (session.status) {
        case 'completed':
          statusIcon = '{green-fg}✅{/green-fg}';
          break;
        case 'failed':
          statusIcon = '{red-fg}❌{/red-fg}';
          break;
        case 'ongoing':
          statusIcon = '{yellow-fg}⏳{/yellow-fg}';
          break;
      }

      const shortId = session.sessionId.substring(0, 8);
      const shortTask = session.initialPrompt.substring(0, 30) + (session.initialPrompt.length > 30 ? '...' : '');

      return `${statusIcon} {bold}${shortId}{/bold} | ${durationStr} | ${session.iterations}i | ${shortTask}`;
    });

    this.sessionList.setItems(items);
    
    if (this.state.selectedSession < items.length) {
      this.sessionList.select(this.state.selectedSession);
    }
    
    this.screen.render();
  }

  private loadSessionIterations(): void {
    if (this.state.filteredSessions.length === 0) return;

    const selectedSession = this.state.filteredSessions[this.state.selectedSession];
    if (!selectedSession) return;

    const logFile = `${selectedSession.sessionId}.log`;
    const logViewer = new LogViewer();
    
    try {
      this.state.currentSessionLogs = logViewer.parseLogFile(
        path.join(os.homedir(), '.automatic-claude-code', 'logs', logViewer['repoName'], logFile)
      );

      // Group by iterations
      const iterationGroups: Map<number, ParsedLogEntry[]> = new Map();
      
      this.state.currentSessionLogs.forEach(entry => {
        if (entry.iteration !== undefined) {
          if (!iterationGroups.has(entry.iteration)) {
            iterationGroups.set(entry.iteration, []);
          }
          iterationGroups.get(entry.iteration)!.push(entry);
        }
      });

      const items = Array.from(iterationGroups.keys())
        .sort((a, b) => a - b)
        .map(iteration => {
          const iterEntries = iterationGroups.get(iteration)!;
          const errors = iterEntries.filter(e => e.level === 'ERROR').length;
          const warnings = iterEntries.filter(e => e.level === 'WARNING').length;
          const successes = iterEntries.filter(e => e.level === 'SUCCESS').length;

          let statusIcon = '🔄';
          if (errors > 0) statusIcon = '{red-fg}❌{/red-fg}';
          else if (warnings > 0) statusIcon = '{yellow-fg}⚠️{/yellow-fg}';
          else if (successes > 0) statusIcon = '{green-fg}✅{/green-fg}';

          const mainEntry = iterEntries.find(e => e.level === 'INFO' || e.level === 'PROGRESS') || iterEntries[0];
          const shortMessage = mainEntry ? mainEntry.message.substring(0, 40) + (mainEntry.message.length > 40 ? '...' : '') : '';

          return `${statusIcon} {bold}Iteration ${iteration}{/bold} | E:${errors} W:${warnings} S:${successes} | ${shortMessage}`;
        });

      this.iterationList.setItems(items);
      this.iterationList.select(0);
      this.state.selectedIteration = 0;
      this.screen.render();

    } catch (error) {
      this.updateStatusBar(`Error loading iterations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private loadIterationDetails(): void {
    if (this.state.currentSessionLogs.length === 0) return;

    // Group by iterations
    const iterationGroups: Map<number, ParsedLogEntry[]> = new Map();
    
    this.state.currentSessionLogs.forEach(entry => {
      if (entry.iteration !== undefined) {
        if (!iterationGroups.has(entry.iteration)) {
          iterationGroups.set(entry.iteration, []);
        }
        iterationGroups.get(entry.iteration)!.push(entry);
      }
    });

    const sortedIterations = Array.from(iterationGroups.keys()).sort((a, b) => a - b);
    const selectedIteration = sortedIterations[this.state.selectedIteration];
    
    if (!selectedIteration) return;

    const iterEntries = iterationGroups.get(selectedIteration)!;
    let content = `{bold}Iteration ${selectedIteration} Details:{/bold}\n\n`;
    
    iterEntries.forEach(entry => {
      let levelColor = 'white';
      let levelIcon = '📝';
      
      switch (entry.level) {
        case 'DEBUG':
          levelColor = 'gray';
          levelIcon = '🐛';
          break;
        case 'INFO':
          levelColor = 'blue';
          levelIcon = 'ℹ️';
          break;
        case 'PROGRESS':
          levelColor = 'yellow';
          levelIcon = '⏳';
          break;
        case 'SUCCESS':
          levelColor = 'green';
          levelIcon = '✅';
          break;
        case 'WARNING':
          levelColor = 'yellow';
          levelIcon = '⚠️';
          break;
        case 'ERROR':
          levelColor = 'red';
          levelIcon = '❌';
          break;
      }

      const timestamp = entry.timestamp.toTimeString().split(' ')[0];
      
      content += `{gray}${timestamp}{/gray} ${levelIcon} {${levelColor}-fg}${entry.level}{/${levelColor}-fg} ${entry.message}\n`;
      
      if (entry.details && typeof entry.details === 'object') {
        const detailsStr = JSON.stringify(entry.details, null, 2);
        const indentedDetails = detailsStr.split('\n').map(line => `  ${line}`).join('\n');
        content += `{gray}${indentedDetails}{/gray}\n`;
      }
      content += '\n';
    });

    this.detailsBox.setContent(content);
    this.detailsBox.setScrollPerc(0);
    this.screen.render();
  }

  private updateProgressBar(): void {
    if (this.state.filteredSessions.length === 0) return;

    const selectedSession = this.state.filteredSessions[this.state.selectedSession];
    if (!selectedSession) return;

    let progress = 0;
    if (selectedSession.status === 'completed') {
      progress = 100;
    } else if (selectedSession.status === 'failed') {
      progress = Math.min(selectedSession.iterations * 10, 90); // Show some progress even for failed
    } else {
      progress = Math.min(selectedSession.iterations * 10, 80); // Ongoing sessions
    }

    this.progressBar.setPercent(progress);
    this.screen.render();
  }

  private filterSessions(): void {
    if (!this.state.searchQuery.trim()) {
      this.state.filteredSessions = this.logViewer.getSessionSummaries();
    } else {
      const query = this.state.searchQuery.toLowerCase();
      this.state.filteredSessions = this.logViewer.getSessionSummaries().filter(session => 
        session.initialPrompt.toLowerCase().includes(query) ||
        session.sessionId.toLowerCase().includes(query) ||
        session.status.toLowerCase().includes(query)
      );
    }
    
    this.state.selectedSession = 0;
    this.updateSessionList();
    this.updateStatusBar(`Filtered to ${this.state.filteredSessions.length} sessions`);
  }

  private switchFocus(): void {
    if (this.sessionList.focused) {
      this.iterationList.focus();
    } else if (this.iterationList.focused) {
      this.detailsBox.focus();
    } else if (this.detailsBox.focused) {
      this.searchBox.focus();
    } else {
      this.sessionList.focus();
    }
  }

  private showHelp(): void {
    const helpBox = blessed.box({
      top: 'center',
      left: 'center',
      width: '80%',
      height: '80%',
      content: `{center}{bold}Automatic Claude Code - Log Browser Help{/bold}{/center}

{bold}Navigation:{/bold}
• Arrow Keys / j,k    - Navigate lists
• Enter              - Select item / Drill down
• Escape            - Go back / Cancel
• Tab               - Switch between panels
• q / Ctrl+C        - Quit application

{bold}Actions:{/bold}
• s                 - Open search box
• e                 - Export current session to HTML
• r                 - Refresh data
• h                 - Show this help

{bold}Panels:{/bold}
• {blue-fg}Sessions{/blue-fg}    - List of all Claude Code sessions
• {green-fg}Iterations{/green-fg} - Iterations within selected session  
• {cyan-fg}Details{/cyan-fg}     - Detailed log entries for selected iteration
• {yellow-fg}Search{/yellow-fg}      - Filter sessions by keyword

{bold}Session Status Icons:{/bold}
• ✅ - Completed successfully
• ❌ - Failed with errors  
• ⏳ - Currently ongoing

{bold}Iteration Status Icons:{/bold}
• ✅ - Successful completion
• ❌ - Contains errors
• ⚠️  - Contains warnings
• 🔄 - In progress

Press any key to close this help...`,
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'cyan'
        }
      }
    });

    this.screen.append(helpBox);
    helpBox.focus();

    helpBox.key(['escape', 'enter', 'space'], () => {
      this.screen.remove(helpBox);
      this.sessionList.focus();
      this.screen.render();
    });

    this.screen.render();
  }

  private exportCurrentSession(): void {
    if (this.state.filteredSessions.length === 0) {
      this.updateStatusBar('No session to export');
      return;
    }

    const selectedSession = this.state.filteredSessions[this.state.selectedSession];
    if (!selectedSession) return;

    try {
      this.logViewer.exportToHTML(selectedSession.sessionId);
      this.updateStatusBar(`Exported session ${selectedSession.sessionId.substring(0, 8)}... to HTML`);
    } catch (error) {
      this.updateStatusBar(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private refreshData(): void {
    this.updateStatusBar('Refreshing data...');
    this.loadData();
    if (this.state.filteredSessions.length > this.state.selectedSession) {
      this.loadSessionIterations();
      this.updateProgressBar();
    }
    this.updateStatusBar('Data refreshed');
  }

  private updateStatusBar(message?: string): void {
    const baseMessage = 'Press "q" to quit | Arrow keys to navigate | Enter to select | "s" to search | "e" to export | "h" for help';
    const content = message ? `${message} | ${baseMessage}` : baseMessage;
    this.statusBar.setContent(content);
    this.screen.render();
  }

  public start(): void {
    // Initial render
    this.screen.render();

    // Start the event loop
    this.sessionList.focus();
    
    // Auto-load first session if available
    if (this.state.filteredSessions.length > 0) {
      this.loadSessionIterations();
      this.updateProgressBar();
    }
  }

  public destroy(): void {
    this.screen.destroy();
  }
}

// Export function to launch the TUI
export function launchTUI(repoName?: string): void {
  const browser = new TUIBrowser(repoName);
  
  // Handle cleanup
  process.on('SIGINT', () => {
    browser.destroy();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    browser.destroy();
    process.exit(0);
  });

  browser.start();
}

export default TUIBrowser;