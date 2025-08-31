# Script to integrate with existing Claude Code observability hooks

param(
    [string]$ObservabilityServerUrl = "http://localhost:4000",
    [string]$MonitorServerUrl = "http://localhost:6003"
)

Write-Host "🔗 Integrating Dual-Agent Monitor with Observability Hooks" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Check if we're in the right directory
if (!(Test-Path "../.claude/hooks")) {
    Write-Host "❌ Claude hooks directory not found. Make sure you're running this from the dual-agent-monitor directory." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found Claude hooks directory" -ForegroundColor Green

# Create a bridge script that forwards events from observability server to our monitor
$bridgeScript = @"
# Bridge script to forward observability events to dual-agent monitor
# This script runs as a background service

`$observabilityUrl = "$ObservabilityServerUrl"
`$monitorUrl = "$MonitorServerUrl"

Write-Host "🌉 Starting event bridge: `$observabilityUrl -> `$monitorUrl" -ForegroundColor Green

# Function to forward events
function Forward-Event {
    param(`$EventData)
    
    try {
        Invoke-RestMethod -Uri "`$monitorUrl/events" -Method Post -Body (`$EventData | ConvertTo-Json -Depth 10) -ContentType "application/json"
        Write-Host "📨 Event forwarded successfully" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Failed to forward event: `$_" -ForegroundColor Yellow
    }
}

# Simple event polling (in production, you'd use a proper webhook system)
while (`$true) {
    try {
        # This is a placeholder - you'd implement actual event streaming here
        Start-Sleep -Seconds 5
    } catch {
        Write-Host "❌ Bridge error: `$_" -ForegroundColor Red
        Start-Sleep -Seconds 10
    }
}
"@

$bridgeScriptPath = "scripts/event-bridge.ps1"
$bridgeScript | Out-File -FilePath $bridgeScriptPath -Encoding UTF8

Write-Host "📝 Created event bridge script at $bridgeScriptPath" -ForegroundColor Green

# Update the existing hook scripts to also send to our monitor
$hookFiles = Get-ChildItem "../.claude/hooks/*.ps1"

foreach ($hookFile in $hookFiles) {
    Write-Host "🔧 Updating hook: $($hookFile.Name)" -ForegroundColor Yellow
    
    # Read the existing hook content
    $content = Get-Content $hookFile.FullName -Raw
    
    # Check if our monitor URL is already added
    if ($content -notmatch "localhost:6003") {
        # Add our monitor as an additional endpoint
        $additionalCode = @"

# Also send to dual-agent monitor
try {
    `$monitorPayload = `$payload
    `$monitorResponse = Invoke-RestMethod -Uri "$MonitorServerUrl/events" -Method Post -Body (`$monitorPayload | ConvertTo-Json -Depth 10) -ContentType "application/json" -TimeoutSec 2
} catch {
    # Silent fail for dual-agent monitor - don't block Claude Code
}
"@
        
        # Insert before the final exit statement
        $updatedContent = $content -replace "(exit 0\s*$)", "$additionalCode`n`$1"
        
        # Backup the original file
        Copy-Item $hookFile.FullName "$($hookFile.FullName).backup"
        
        # Write the updated content
        $updatedContent | Out-File -FilePath $hookFile.FullName -Encoding UTF8
        
        Write-Host "   ✅ Updated $($hookFile.Name) (backup created)" -ForegroundColor Green
    } else {
        Write-Host "   ⏭️  $($hookFile.Name) already integrated" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🎉 Integration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Start the dual-agent monitor: npm run dev" -ForegroundColor White
Write-Host "2. Your existing observability hooks will now also send events to the dual-agent monitor" -ForegroundColor White
Write-Host "3. Visit http://localhost:6002 to view the dual-agent interface" -ForegroundColor White
Write-Host ""
Write-Host "Note: Original hook files have been backed up with .backup extension" -ForegroundColor Yellow