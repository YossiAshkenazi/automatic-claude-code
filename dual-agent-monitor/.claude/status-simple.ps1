# Enhanced Countywide Homes Status Line
# Features: Context detection, branch sync status, database health, timestamp

$input = [Console]::In.ReadToEnd()

try {
    $sessionData = $input | ConvertFrom-Json -ErrorAction SilentlyContinue
    $model = if ($sessionData.model.display_name) { $sessionData.model.display_name } else { "Claude" }
    $projectDir = if ($sessionData.workspace.project_dir) { $sessionData.workspace.project_dir } else { $PWD.Path }
    $currentDir = if ($sessionData.workspace.current_dir) { $sessionData.workspace.current_dir } else { $PWD.Path }
} catch {
    $model = "Claude"
    $projectDir = $PWD.Path
    $currentDir = $PWD.Path
}

try {
    Set-Location $projectDir -ErrorAction Stop
} catch {
    $projectDir = $PWD.Path
}

$PROJECT_NAME = "countywide-homes"

# Enhanced Git status with sync indicators
try {
    $gitBranch = git branch --show-current 2>$null
    if (-not $gitBranch) { $gitBranch = "no-git" }
    
    $gitStatus = (git status --porcelain 2>$null | Measure-Object).Count
    $gitIndicator = if ($gitStatus -gt 0) { "*" } else { "" }
    
    # Check ahead/behind status
    if ($gitBranch -ne "no-git") {
        try {
            $aheadBehind = git status --porcelain=v1 --branch 2>$null | Select-String "ahead|behind"
            if ($aheadBehind) {
                $statusLine = $aheadBehind.ToString()
                if ($statusLine -match "ahead (\d+)") {
                    $gitIndicator += "+$($matches[1])"
                }
                if ($statusLine -match "behind (\d+)") {
                    $gitIndicator += "-$($matches[1])"
                }
            }
        } catch {
            # Sync check failed
        }
    }
} catch {
    $gitBranch = "no-git"
    $gitIndicator = "!"
}

# Enhanced Docker status
$dockerRunning = 0
$dockerTotal = 0
$dockerDetails = ""
try {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        $allContainers = docker ps -a --format "{{.Names}}" 2>$null | Where-Object { $_ -match "(postgres|postgrest|frontend|countywide)" }
        $dockerTotal = ($allContainers | Measure-Object).Count
        
        $runningContainers = docker ps --format "{{.Names}}" 2>$null | Where-Object { $_ -match "(postgres|postgrest|frontend|countywide)" }
        $dockerRunning = ($runningContainers | Measure-Object).Count
        
        if ($dockerTotal -eq 0 -and (Test-Path "docker-compose.simple.yml")) {
            $composeContainers = docker-compose -f docker-compose.simple.yml ps -q 2>$null
            $dockerTotal = ($composeContainers | Measure-Object).Count
            $dockerRunning = (docker-compose -f docker-compose.simple.yml ps -q --filter "status=running" 2>$null | Measure-Object).Count
        }
        
        # Detailed container status
        if ($dockerRunning -eq $dockerTotal -and $dockerTotal -gt 0) {
            $dockerDetails = "OK"
        } elseif ($dockerRunning -gt 0) {
            $dockerDetails = "PARTIAL"
        } else {
            $dockerDetails = "DOWN"
        }
    }
} catch {
    $dockerDetails = "ERROR"
}

$dockerStatus = "docker:$dockerRunning/$dockerTotal($dockerDetails)"

# Enhanced API Health with multiple endpoints
$apiStatus = "api:DOWN"
$frontendStatus = "fe:DOWN"
$dbStatus = "db:DOWN"

# PostgREST API (port 3000)
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        $apiStatus = "api:OK"
    }
} catch {
    # Check if port is listening
    try {
        $port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
        if ($port3000) {
            $apiStatus = "api:PARTIAL"
        }
    } catch { }
}

# Frontend (port 5173)
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        $frontendStatus = "fe:OK"
    }
} catch {
    try {
        $port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
        if ($port5173) {
            $frontendStatus = "fe:PARTIAL"
        }
    } catch { }
}

# Database health check
try {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        $postgresContainer = docker ps --format "{{.Names}}" | Select-String -Pattern "postgres" | Select-Object -First 1
        if ($postgresContainer) {
            $testQuery = docker exec $postgresContainer.Line psql -U postgres -d countywide_homes -c "SELECT 1;" 2>$null
            if ($LASTEXITCODE -eq 0) {
                $dbStatus = "db:OK"
            } else {
                $dbStatus = "db:PARTIAL"
            }
        }
    }
} catch { }

# Context detection based on current directory
$contextIndicator = ""
if ($currentDir -ne $projectDir) {
    $relativePath = [System.IO.Path]::GetRelativePath($projectDir, $currentDir)
    
    if ($relativePath -match "frontend") {
        if ($relativePath -match "admin") {
            $contextIndicator = "[admin]"
        } elseif ($relativePath -match "public") {
            $contextIndicator = "[public]"
        } else {
            $contextIndicator = "[frontend]"
        }
    } elseif ($relativePath -match "backend|api") {
        $contextIndicator = "[backend]"
    } elseif ($relativePath -match "database|db") {
        $contextIndicator = "[database]"
    } elseif ($relativePath -match "docker") {
        $contextIndicator = "[docker]"
    } elseif ($relativePath -match "docs") {
        $contextIndicator = "[docs]"
    } elseif ($relativePath -match "scripts") {
        $contextIndicator = "[scripts]"
    } else {
        $dirName = Split-Path $currentDir -Leaf
        $contextIndicator = "[$dirName]"
    }
}

# Model display enhancement
$modelDisplay = ""
if ($model -match "Sonnet.*4") {
    $modelDisplay = "Sonnet4"
} elseif ($model -match "Sonnet") {
    $modelDisplay = "Sonnet3.5"
} else {
    $modelDisplay = $model
}

# Timestamp (last 2 digits of minutes for brevity)
$timestamp = (Get-Date).ToString("mm").Substring(1)

# Build enhanced status line
$username = $env:USERNAME
$hostname = $env:COMPUTERNAME
$statusLine = "$username@$hostname $PROJECT_NAME$contextIndicator [$modelDisplay] (git:$gitBranch$gitIndicator) $dockerStatus $apiStatus $frontendStatus $dbStatus :$timestamp"

Write-Host $statusLine -NoNewline