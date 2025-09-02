#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  // Get CPU usage with timeout
  let cpu = '?';
  try {
    const cpuResult = execSync('wmic cpu get loadpercentage /value', { 
      encoding: 'utf8', 
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const cpuMatch = cpuResult.match(/LoadPercentage=(\d+)/);
    if (cpuMatch) cpu = cpuMatch[1];
  } catch (e) {
    // CPU detection failed, keep default
  }
  
  // Get RAM usage with PowerShell (more reliable)
  let ram = '?';
  try {
    const ramResult = execSync('powershell -NoProfile -Command "$os = Get-WmiObject Win32_OperatingSystem; [int](($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / $os.TotalVisibleMemorySize * 100)"', {
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const ramValue = parseInt(ramResult.trim());
    if (!isNaN(ramValue)) ram = ramValue;
  } catch (e) {
    // RAM detection failed, keep default
  }
  
  console.log(`⚡${cpu}% 🧠 ${ram}%`);
  
} catch (error) {
  console.log('⚡?% 🧠 ?%');
}