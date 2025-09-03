#!/usr/bin/env node

const { execSync } = require('child_process');

// Try to get actual ccusage data for burn rate awareness
try {
  const result = execSync('ccusage blocks --json', { 
    encoding: 'utf8', 
    timeout: 3000,
    stdio: ['ignore', 'pipe', 'ignore']
  });
  
  const data = JSON.parse(result);
  const activeBlock = data.blocks ? data.blocks.find(b => b.isActive) : null;
  
  if (activeBlock) {
    const startTime = new Date(activeBlock.startTime);
    const now = new Date();
    const elapsedHours = (now - startTime) / (1000 * 60 * 60);
    
    // Calculate burn rate
    const burnRate = activeBlock.costUSD / elapsedHours; // $/hour
    const remainingTime = 5 - elapsedHours; // hours left in block
    
    // Estimate cost if continuing at current rate
    const projectedTotal = burnRate * 5;
    
    // Warning levels based on burn rate (adjusted for $200/5h = $40/h max sustainable)
    let warning = '';
    if (burnRate > 50) warning = '🔥'; // Very high burn (>$250/block pace)
    else if (burnRate > 35) warning = '⚠️'; // High burn (>$175/block pace)  
    else if (burnRate > 25) warning = '📈'; // Elevated burn (>$125/block pace)
    else warning = '✅'; // Normal burn (sustainable pace)
    
    // Time until you should consider pausing (at $200 block limit for Pro plan)
    const timeUntilLimit = Math.max(0, (200 - activeBlock.costUSD) / burnRate);
    
    console.log(`${warning} $${burnRate.toFixed(0)}/h • ${timeUntilLimit.toFixed(1)}h left @ $200`);
  } else {
    console.log('✅ No active block');
  }
  
} catch (error) {
  // Fallback to simple time display
  const now = new Date();
  const currentHour = now.getUTCHours();
  
  let blockStart;
  if (currentHour >= 0 && currentHour < 5) blockStart = 0;
  else if (currentHour >= 5 && currentHour < 10) blockStart = 5;
  else if (currentHour >= 10 && currentHour < 15) blockStart = 10;
  else if (currentHour >= 15 && currentHour < 20) blockStart = 15;
  else blockStart = 20;
  
  const blockStartTime = new Date(now);
  blockStartTime.setUTCHours(blockStart, 0, 0, 0);
  
  const elapsedMs = now - blockStartTime;
  const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));
  const elapsedMinutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
  
  console.log(`${elapsedHours}h ${elapsedMinutes}m`);
}