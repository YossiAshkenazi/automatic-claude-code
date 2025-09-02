#!/usr/bin/env node

// Simple block timer - calculate time since 5-hour block started
const now = new Date();
const currentHour = now.getUTCHours();

// Determine current 5-hour block start (blocks: 0-5, 5-10, 10-15, 15-20, 20-24/0)
let blockStart;
if (currentHour >= 0 && currentHour < 5) blockStart = 0;
else if (currentHour >= 5 && currentHour < 10) blockStart = 5;
else if (currentHour >= 10 && currentHour < 15) blockStart = 10;
else if (currentHour >= 15 && currentHour < 20) blockStart = 15;
else blockStart = 20;

// Calculate time elapsed in current block
const blockStartTime = new Date(now);
blockStartTime.setUTCHours(blockStart, 0, 0, 0);

const elapsedMs = now - blockStartTime;
const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));
const elapsedMinutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));

console.log(`${elapsedHours}h ${elapsedMinutes}m`);