const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Detects Linux distribution
 * @returns {string} Distribution name or 'unknown'
 */
function detectLinuxDistro() {
  if (!isLinux() && !isWSL()) {
    return 'not-linux';
  }

  try {
    // Check /etc/os-release (systemd standard)
    if (fs.existsSync('/etc/os-release')) {
      const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
      const idMatch = osRelease.match(/^ID=(.+)$/m);
      if (idMatch) {
        return idMatch[1].replace(/"/g, '').toLowerCase();
      }
    }

    // Check /etc/lsb-release (Ubuntu/Debian)
    if (fs.existsSync('/etc/lsb-release')) {
      const lsbRelease = fs.readFileSync('/etc/lsb-release', 'utf8');
      const distMatch = lsbRelease.match(/^DISTRIB_ID=(.+)$/m);
      if (distMatch) {
        return distMatch[1].replace(/"/g, '').toLowerCase();
      }
    }

    // Check specific distribution files
    const distroFiles = [
      { file: '/etc/debian_version', distro: 'debian' },
      { file: '/etc/ubuntu_version', distro: 'ubuntu' },
      { file: '/etc/redhat-release', distro: 'rhel' },
      { file: '/etc/centos-release', distro: 'centos' },
      { file: '/etc/fedora-release', distro: 'fedora' },
      { file: '/etc/alpine-release', distro: 'alpine' },
      { file: '/etc/arch-release', distro: 'arch' },
      { file: '/etc/gentoo-release', distro: 'gentoo' },
      { file: '/etc/opensuse-release', distro: 'opensuse' }
    ];

    for (const { file, distro } of distroFiles) {
      if (fs.existsSync(file)) {
        return distro;
      }
    }

    // Try lsb_release command
    try {
      const lsbOutput = execSync('lsb_release -si 2>/dev/null', { encoding: 'utf8' }).trim().toLowerCase();
      if (lsbOutput) {
        return lsbOutput;
      }
    } catch (e) {
      // Command not available
    }
  } catch (e) {
    // File system access issues
  }

  return 'unknown';
}

/**
 * Detects WSL version (1 or 2)
 * @returns {string} '1', '2', or 'unknown'
 */
function detectWSLVersion() {
  if (!isWSL()) {
    return 'not-wsl';
  }

  // WSL2 indicators
  if (process.env.WSL2 || process.env.WSL_GUEST_IP) {
    return '2';
  }

  // Check kernel version for WSL2 (has "WSL2" in it)
  try {
    if (fs.existsSync('/proc/version')) {
      const procVersion = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
      if (procVersion.includes('wsl2')) {
        return '2';
      }
    }
  } catch (e) {
    // Silent fail
  }

  // Check for systemd (more common in WSL2)
  try {
    if (fs.existsSync('/run/systemd/system')) {
      return '2';
    }
  } catch (e) {
    // Silent fail
  }

  // Default to WSL1 if we can't determine
  return '1';
}

/**
 * Detects the current platform
 * @returns {string} Platform identifier: 'windows', 'wsl', 'wsl1', 'wsl2', 'linux', 'macos', 'cygwin', 'mingw', or 'unknown'
 */
function detectPlatform() {
  const platform = process.platform;
  
  // Check for Windows
  if (platform === 'win32') {
    // Check for Git Bash / MinGW
    if (process.env.MSYSTEM && process.env.MSYSTEM.startsWith('MINGW')) {
      return 'mingw';
    }
    
    // Check for Cygwin
    if (process.env.TERM === 'cygwin' || process.env.CYGWIN) {
      return 'cygwin';
    }
    
    return 'windows';
  }
  
  // Check for macOS
  if (platform === 'darwin') {
    return 'macos';
  }
  
  // Check for Linux or WSL
  if (platform === 'linux') {
    // Check for WSL
    if (isWSL()) {
      const wslVersion = detectWSLVersion();
      return wslVersion === '2' ? 'wsl2' : (wslVersion === '1' ? 'wsl1' : 'wsl');
    }
    return 'linux';
  }
  
  return 'unknown';
}

/**
 * Checks if running on Windows
 * @returns {boolean}
 */
function isWindows() {
  return process.platform === 'win32';
}

/**
 * Checks if running in WSL (Windows Subsystem for Linux)
 * @returns {boolean}
 */
function isWSL() {
  // Check WSL environment variables (most reliable)
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP || process.env.WSLENV) {
    return true;
  }
  
  // Check for WSL2 specific variable
  if (process.env.WSL2 || process.env.WSL_GUEST_IP) {
    return true;
  }
  
  // Check for WSL in /proc/version
  try {
    if (fs.existsSync('/proc/version')) {
      const procVersion = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
      if (procVersion.includes('microsoft') || procVersion.includes('wsl')) {
        return true;
      }
    }
  } catch (e) {
    // Silent fail
  }
  
  // Check for WSL in /proc/sys/kernel/osrelease
  try {
    if (fs.existsSync('/proc/sys/kernel/osrelease')) {
      const osRelease = fs.readFileSync('/proc/sys/kernel/osrelease', 'utf8').toLowerCase();
      if (osRelease.includes('microsoft') || osRelease.includes('wsl')) {
        return true;
      }
    }
  } catch (e) {
    // Silent fail
  }
  
  // Check for WSL specific mount points
  if (fs.existsSync('/mnt/c') || fs.existsSync('/mnt/wsl') || fs.existsSync('/mnt/wslg')) {
    return true;
  }
  
  // Check init process for WSL indicators
  try {
    if (fs.existsSync('/proc/1/comm')) {
      const initComm = fs.readFileSync('/proc/1/comm', 'utf8').trim().toLowerCase();
      if (initComm === 'init' || initComm === 'wsl' || initComm === 'microsoft-wsl') {
        return true;
      }
    }
  } catch (e) {
    // Silent fail
  }
  
  return false;
}

/**
 * Checks if running on Linux (not WSL)
 * @returns {boolean}
 */
function isLinux() {
  return process.platform === 'linux' && !isWSL();
}

/**
 * Checks if running on macOS
 * @returns {boolean}
 */
function isMacOS() {
  return process.platform === 'darwin';
}

/**
 * Gets the available shell type
 * @returns {string} Shell type: 'powershell', 'bash', 'zsh', 'git-bash', or 'unknown'
 */
function getShellType() {
  const platform = detectPlatform();
  
  // Windows platforms
  if (platform === 'windows') {
    // Check if PowerShell is available
    try {
      execSync('powershell -Command "Get-Host"', { stdio: 'ignore' });
      return 'powershell';
    } catch (e) {
      // PowerShell not available
    }
    
    // Check for cmd
    try {
      execSync('cmd /c echo test', { stdio: 'ignore' });
      return 'cmd';
    } catch (e) {
      // cmd not available
    }
  }
  
  // Git Bash on Windows
  if (platform === 'mingw') {
    return 'git-bash';
  }
  
  // Unix-like platforms (WSL, Linux, macOS)
  if (platform === 'wsl' || platform === 'linux' || platform === 'macos') {
    // Check current shell
    const shell = process.env.SHELL || '';
    
    if (shell.includes('zsh')) {
      return 'zsh';
    }
    
    if (shell.includes('bash')) {
      return 'bash';
    }
    
    // Default to bash for Unix-like systems
    return 'bash';
  }
  
  return 'unknown';
}

/**
 * Validates the current environment for hook execution with comprehensive diagnostics
 * @returns {object} Validation result with detailed diagnostics
 */
function validateEnvironment() {
  const platform = detectPlatform();
  const shell = getShellType();
  const warnings = [];
  const errors = [];
  const recommendations = [];
  let isValid = true;
  
  // Check for unsupported platforms
  if (platform === 'unknown') {
    errors.push('Unsupported platform detected');
    recommendations.push('This system may not be compatible with hook execution');
    isValid = false;
  }
  
  // Check for unsupported shells
  if (shell === 'unknown') {
    errors.push('No supported shell detected');
    recommendations.push('Install PowerShell (Windows) or Bash (Unix-like systems)');
    isValid = false;
  }
  
  // Warn about edge case environments
  if (platform === 'cygwin') {
    warnings.push('Cygwin detected - some features may not work correctly');
    recommendations.push('Consider using WSL2 or native Windows PowerShell for better compatibility');
  }
  
  if (platform === 'mingw') {
    warnings.push('Git Bash detected - using bash compatibility mode');
    recommendations.push('Bash scripts will be prioritized over PowerShell scripts');
  }
  
  // Enhanced command validation with detailed diagnostics
  const requiredCommands = {
    'windows': [
      { cmd: 'powershell', test: 'powershell -Command "Get-Host"', critical: true },
      { cmd: 'curl', test: 'curl --version', critical: false },
      { cmd: 'node', test: 'node --version', critical: false }
    ],
    'wsl': [
      { cmd: 'bash', test: 'bash --version', critical: true },
      { cmd: 'curl', test: 'curl --version', critical: true },
      { cmd: 'node', test: 'node --version', critical: false },
      { cmd: 'pwsh', test: 'pwsh -Command "Get-Host"', critical: false }
    ],
    'linux': [
      { cmd: 'bash', test: 'bash --version', critical: true },
      { cmd: 'curl', test: 'curl --version', critical: true },
      { cmd: 'node', test: 'node --version', critical: false }
    ],
    'macos': [
      { cmd: 'bash', test: 'bash --version', critical: true },
      { cmd: 'curl', test: 'curl --version', critical: true },
      { cmd: 'node', test: 'node --version', critical: false }
    ],
    'mingw': [
      { cmd: 'bash', test: 'bash --version', critical: true },
      { cmd: 'curl', test: 'curl --version', critical: true },
      { cmd: 'node', test: 'node --version', critical: false }
    ],
    'cygwin': [
      { cmd: 'bash', test: 'bash --version', critical: true },
      { cmd: 'curl', test: 'curl --version', critical: false },
      { cmd: 'powershell', test: 'powershell -Command "Get-Host"', critical: false }
    ]
  };
  
  const platformCommands = requiredCommands[platform] || [];
  const availableCommands = [];
  const missingCommands = [];
  
  for (const { cmd, test, critical } of platformCommands) {
    try {
      execSync(test, { stdio: 'ignore', timeout: 5000 });
      availableCommands.push(cmd);
    } catch (e) {
      missingCommands.push({ cmd, critical, error: e.message });
      
      if (critical) {
        errors.push(`Critical command '${cmd}' not found or not working`);
        recommendations.push(getInstallRecommendation(cmd, platform));
        isValid = false;
      } else {
        warnings.push(`Optional command '${cmd}' not available - fallback may be used`);
      }
    }
  }
  
  // Check for common environmental issues
  const environmentChecks = performEnvironmentChecks(platform);
  warnings.push(...environmentChecks.warnings);
  errors.push(...environmentChecks.errors);
  recommendations.push(...environmentChecks.recommendations);
  
  if (environmentChecks.errors.length > 0) {
    isValid = false;
  }
  
  return {
    isValid,
    platform,
    shell,
    warnings,
    errors,
    recommendations,
    availableCommands,
    missingCommands,
    diagnostics: {
      nodeVersion: getNodeVersion(),
      pathInfo: getPathInfo(),
      permissions: checkPermissions(),
      networkAccess: checkNetworkAccess()
    }
  };
}

/**
 * Get installation recommendation for a missing command
 * @param {string} cmd - Command name
 * @param {string} platform - Platform identifier
 * @returns {string} - Installation recommendation
 */
function getInstallRecommendation(cmd, platform) {
  const recommendations = {
    powershell: {
      windows: 'PowerShell should be pre-installed. Try restarting your terminal.',
      linux: 'Install PowerShell Core: https://docs.microsoft.com/en-us/powershell/scripting/install/install-linux',
      macos: 'Install PowerShell Core: brew install powershell',
      wsl: 'Install PowerShell Core: https://docs.microsoft.com/en-us/powershell/scripting/install/install-linux'
    },
    bash: {
      windows: 'Install Git Bash or enable WSL2',
      linux: 'Bash should be pre-installed. Check your package manager.',
      macos: 'Bash should be pre-installed. Try: brew install bash',
      wsl: 'Bash should be available in WSL. Reinstall your WSL distribution.'
    },
    curl: {
      windows: 'curl is included in Windows 10+. Try: winget install curl',
      linux: 'Install curl: sudo apt install curl (Ubuntu/Debian) or sudo yum install curl (RHEL/CentOS)',
      macos: 'curl should be pre-installed. Try: brew install curl',
      wsl: 'Install curl: sudo apt install curl'
    },
    node: {
      windows: 'Install Node.js from https://nodejs.org/ or use: winget install OpenJS.NodeJS',
      linux: 'Install Node.js: sudo apt install nodejs npm (Ubuntu/Debian)',
      macos: 'Install Node.js: brew install node',
      wsl: 'Install Node.js: sudo apt install nodejs npm'
    }
  };
  
  return recommendations[cmd]?.[platform] || `Install ${cmd} for your ${platform} system`;
}

/**
 * Perform additional environment checks
 * @param {string} platform - Platform identifier
 * @returns {object} - Environment check results
 */
function performEnvironmentChecks(platform) {
  const warnings = [];
  const errors = [];
  const recommendations = [];
  
  // Check execution policy on Windows
  if (platform === 'windows') {
    try {
      const policy = execSync('powershell -Command "Get-ExecutionPolicy"', { encoding: 'utf8' }).trim();
      if (policy === 'Restricted') {
        warnings.push('PowerShell execution policy is Restricted');
        recommendations.push('Consider setting execution policy to RemoteSigned: Set-ExecutionPolicy RemoteSigned');
      }
    } catch (e) {
      // Ignore if we can't check execution policy
    }
  }
  
  // Check for WSL version
  if (platform === 'wsl') {
    try {
      const wslVersion = execSync('wsl --version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      if (!wslVersion.includes('WSL version')) {
        warnings.push('WSL version could not be determined - you may be using WSL 1');
        recommendations.push('Consider upgrading to WSL 2 for better performance');
      }
    } catch (e) {
      warnings.push('Could not determine WSL version');
    }
  }
  
  // Check Docker environment
  if (process.env.DOCKER_CONTAINER || fs.existsSync('/.dockerenv')) {
    warnings.push('Running inside Docker container - some features may be limited');
    recommendations.push('Ensure proper volume mounts and network configuration');
  }
  
  // Check for CI/CD environment
  if (process.env.CI || process.env.GITHUB_ACTIONS || process.env.JENKINS_URL) {
    warnings.push('CI/CD environment detected');
    recommendations.push('Hook execution may have different behavior in CI environments');
  }
  
  return { warnings, errors, recommendations };
}

/**
 * Get Node.js version information
 * @returns {object} - Node version info
 */
function getNodeVersion() {
  try {
    return {
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      execPath: process.execPath
    };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Get PATH environment information
 * @returns {object} - PATH info
 */
function getPathInfo() {
  const pathEnv = process.env.PATH || process.env.Path || '';
  const paths = pathEnv.split(path.delimiter).filter(p => p.trim().length > 0);
  
  return {
    count: paths.length,
    paths: paths.slice(0, 10), // First 10 paths
    hasNodePath: paths.some(p => p.includes('node')),
    hasPowerShellPath: paths.some(p => p.toLowerCase().includes('powershell')),
    hasGitPath: paths.some(p => p.toLowerCase().includes('git'))
  };
}

/**
 * Check basic permissions
 * @returns {object} - Permission info
 */
function checkPermissions() {
  try {
    const tempFile = path.join(os.tmpdir(), 'hook-test-' + Date.now() + '.tmp');
    fs.writeFileSync(tempFile, 'test');
    fs.unlinkSync(tempFile);
    
    return {
      canWrite: true,
      tempDir: os.tmpdir()
    };
  } catch (e) {
    return {
      canWrite: false,
      error: e.message
    };
  }
}

/**
 * Check network access (basic test)
 * @returns {object} - Network info
 */
function checkNetworkAccess() {
  // This is a basic check - we don't want to make actual network requests
  // in a validation function, but we can check for obvious network-related issues
  return {
    hasNetworkInterface: Object.keys(os.networkInterfaces()).length > 0,
    hostname: os.hostname(),
    // Note: We don't test actual connectivity here to avoid delays
    note: 'Actual network connectivity not tested to avoid delays'
  };
}

/**
 * Gets comprehensive platform information
 * @returns {object} Platform information including OS, architecture, version, etc.
 */
function getPlatformInfo() {
  const platform = detectPlatform();
  const shell = getShellType();
  
  const info = {
    platform,
    isWSL: isWSL(),
    shell,
    arch: os.arch(),
    version: os.release(),
    hostname: os.hostname(),
    homedir: os.homedir(),
    tmpdir: os.tmpdir(),
    env: {
      home: process.env.HOME || process.env.USERPROFILE,
      shell: process.env.SHELL,
      path: process.env.PATH
    }
  };
  
  // Add WSL-specific information
  if (info.isWSL) {
    info.wslDistro = process.env.WSL_DISTRO_NAME;
    info.wslInterop = process.env.WSL_INTEROP;
    
    // Try to get Windows host info
    try {
      const winVer = execSync('cmd.exe /c ver', { encoding: 'utf8' }).trim();
      info.windowsHost = winVer;
    } catch (e) {
      // Silent fail
    }
  }
  
  // Add Windows-specific information
  if (platform === 'windows') {
    info.windowsVersion = os.version ? os.version() : 'Unknown';
    info.systemRoot = process.env.SystemRoot;
    info.programFiles = process.env.ProgramFiles;
  }
  
  // Add Git Bash specific information
  if (platform === 'mingw') {
    info.msystem = process.env.MSYSTEM;
    info.mingwPrefix = process.env.MINGW_PREFIX;
  }
  
  return info;
}

/**
 * Logs debug information about the platform
 * @param {boolean} verbose - Whether to include verbose output
 */
function logPlatformDebug(verbose = false) {
  console.log('=== Platform Detection Debug Info ===');
  
  const info = getPlatformInfo();
  const validation = validateEnvironment();
  
  console.log(`Platform: ${info.platform}`);
  console.log(`Shell: ${info.shell}`);
  console.log(`Architecture: ${info.arch}`);
  console.log(`OS Version: ${info.version}`);
  console.log(`Home Directory: ${info.homedir}`);
  
  if (info.isWSL) {
    console.log(`WSL Distro: ${info.wslDistro}`);
  }
  
  if (validation.warnings.length > 0) {
    console.log('\nWarnings:');
    validation.warnings.forEach(warning => {
      console.log(`  - ${warning}`);
    });
  }
  
  if (verbose) {
    console.log('\nEnvironment Variables:');
    console.log(`  HOME: ${info.env.home}`);
    console.log(`  SHELL: ${info.env.shell}`);
    console.log(`  PATH: ${info.env.path}`);
    
    if (info.isWSL) {
      console.log(`  WSL_INTEROP: ${info.wslInterop}`);
    }
  }
  
  console.log(`\nEnvironment Valid: ${validation.isValid ? 'Yes' : 'No'}`);
  console.log('=====================================');
}

/**
 * Determines the appropriate script type (.ps1 vs .sh) based on platform detection
 * @returns {string} 'ps1' for PowerShell, 'sh' for Bash, 'js' for Node.js universal
 */
function getPreferredScriptType() {
  const platform = detectPlatform();
  
  // Determine script preference with enhanced logic
  switch (platform) {
    case 'windows':
      return 'ps1';  // Native Windows - use PowerShell
      
    case 'mingw':
    case 'cygwin':
      return 'sh';   // Git Bash/Cygwin - prefer bash scripts
      
    case 'wsl':
    case 'wsl1':
    case 'wsl2':
    case 'linux':
    case 'macos':
      return 'sh';   // Unix-like - use bash scripts
      
    default:
      // Try to detect available interpreters for unknown platforms
      if (getShellType() === 'powershell') {
        return 'ps1';
      } else if (['bash', 'zsh', 'git-bash'].includes(getShellType())) {
        return 'sh';
      }
      return 'sh';   // Default to bash for maximum compatibility
  }
}

/**
 * Gets comprehensive environment detection with fallback mechanisms
 * @returns {object} Complete environment information
 */
function getEnvironmentInfo() {
  const platform = detectPlatform();
  const shell = getShellType();
  const distro = detectLinuxDistro();
  const wslVersion = detectWSLVersion();
  
  const info = {
    platform,
    shell,
    distro,
    wslVersion,
    preferredScriptType: getPreferredScriptType(),
    isWSL: isWSL(),
    arch: os.arch(),
    version: os.release(),
    hostname: os.hostname(),
    homedir: os.homedir(),
    env: {
      home: process.env.HOME || process.env.USERPROFILE,
      shell: process.env.SHELL,
      wslDistro: process.env.WSL_DISTRO_NAME,
      wslInterop: process.env.WSL_INTEROP,
      wslEnv: process.env.WSLENV,
      msystem: process.env.MSYSTEM,
      cygwin: process.env.CYGWIN,
      term: process.env.TERM
    },
    capabilities: {
      hasNodeJs: false,
      hasCurl: false,
      hasJq: false,
      hasBash: false,
      hasPowerShell: false
    }
  };
  
  // Test for command availability
  const commands = ['node', 'curl', 'jq', 'bash', 'powershell'];
  for (const cmd of commands) {
    try {
      if (cmd === 'powershell') {
        execSync('powershell -Command "Get-Host"', { stdio: 'ignore' });
        info.capabilities.hasPowerShell = true;
      } else if (cmd === 'bash') {
        execSync('bash --version', { stdio: 'ignore' });
        info.capabilities.hasBash = true;
      } else {
        execSync(`${cmd} --version`, { stdio: 'ignore' });
        info.capabilities[`has${cmd.charAt(0).toUpperCase() + cmd.slice(1)}`] = true;
      }
    } catch (e) {
      // Command not available
    }
  }
  
  return info;
}

module.exports = {
  detectPlatform,
  detectLinuxDistro,
  detectWSLVersion,
  isWindows,
  isWSL,
  isLinux,
  isMacOS,
  getShellType,
  getPreferredScriptType,
  getEnvironmentInfo,
  validateEnvironment,
  getPlatformInfo,
  logPlatformDebug
};