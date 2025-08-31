#!/usr/bin/env pwsh
# Security Validation Module for Agents Observability
# Provides comprehensive security validation, error handling, and environment detection

# Configuration
$MaxMessageSize = 100KB
$MaxRetries = 3
$BaseRetryDelay = 1000  # milliseconds

# Environment detection
function Get-EnvironmentInfo {
    [CmdletBinding()]
    param()
    
    $envInfo = @{
        IsDocker = $false
        IsWindows = $true
        IsWSL = $false
        Platform = "Windows"
        ServerUrl = "http://localhost:4000"
    }
    
    try {
        # Check if running in Docker
        if ($env:DOCKER_CONTAINER -or (Test-Path "/.dockerenv")) {
            $envInfo.IsDocker = $true
            $envInfo.ServerUrl = "http://host.docker.internal:4000"
        }
        
        # Check if running in WSL
        if ($env:WSL_DISTRO_NAME -or (Get-Command "wsl.exe" -ErrorAction SilentlyContinue)) {
            $envInfo.IsWSL = $true
        }
        
        # Detect platform
        if ($PSVersionTable.Platform -eq "Unix") {
            $envInfo.IsWindows = $false
            $envInfo.Platform = "Unix"
        }
        
        # Override server URL if environment variable is set
        if ($env:OBSERVABILITY_SERVER_URL) {
            $envInfo.ServerUrl = $env:OBSERVABILITY_SERVER_URL
        }
        
    } catch {
        Write-Debug "Environment detection failed: $_"
    }
    
    return $envInfo
}

# Input validation and sanitization
function Test-InputSafety {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Input,
        [string]$Context = "general"
    )
    
    $result = @{
        IsSafe = $true
        Issues = @()
        SanitizedInput = $Input
    }
    
    try {
        # Check message size
        if ($Input.Length -gt $MaxMessageSize) {
            $result.IsSafe = $false
            $result.Issues += "Input exceeds maximum size limit of $($MaxMessageSize) bytes"
            $result.SanitizedInput = $Input.Substring(0, $MaxMessageSize) + "...[TRUNCATED]"
        }
        
        # Check for potential code injection patterns
        $dangerousPatterns = @(
            @{ Pattern = '(?i)eval\s*\('; Severity = "High"; Description = "Potential eval() injection" },
            @{ Pattern = '(?i)exec\s*\('; Severity = "High"; Description = "Potential exec() injection" },
            @{ Pattern = '(?i)system\s*\('; Severity = "High"; Description = "Potential system() call" },
            @{ Pattern = '(?i)powershell\s+-enc\s+'; Severity = "High"; Description = "Encoded PowerShell command" },
            @{ Pattern = '(?i)cmd\s*/c\s+'; Severity = "Medium"; Description = "Command execution pattern" },
            @{ Pattern = '(?i)invoke-expression'; Severity = "High"; Description = "PowerShell code injection" },
            @{ Pattern = '(?i)iex\s+'; Severity = "High"; Description = "PowerShell IEX command" },
            @{ Pattern = '[\x00-\x1F\x7F-\x9F]'; Severity = "Medium"; Description = "Control characters detected" }
        )
        
        foreach ($pattern in $dangerousPatterns) {
            if ($Input -match $pattern.Pattern) {
                $result.Issues += "$($pattern.Severity): $($pattern.Description)"
                if ($pattern.Severity -eq "High") {
                    $result.IsSafe = $false
                }
            }
        }
        
        # Sanitize input by removing/escaping dangerous characters
        $sanitized = $Input -replace '[\x00-\x1F\x7F-\x9F]', ''  # Remove control characters
        $sanitized = $sanitized -replace '[\"\''`]', '\"'        # Escape quotes
        $result.SanitizedInput = $sanitized
        
    } catch {
        $result.IsSafe = $false
        $result.Issues += "Input validation failed: $_"
    }
    
    return $result
}

# Dangerous command detection
function Test-DangerousCommand {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ToolName,
        [Parameter(Mandatory)]
        [PSCustomObject]$ToolInput
    )
    
    $result = @{
        IsDangerous = $false
        RiskLevel = "Low"
        Reason = ""
        BlockExecution = $false
        Recommendations = @()
    }
    
    try {
        # Define comprehensive dangerous patterns by tool
        $dangerousPatterns = @{
            "Bash" = @(
                @{ Pattern = '(?i)rm\s+-rf?\s+(/|~|\$HOME|\*)'; Risk = "Critical"; Message = "Recursive deletion of critical directories"; Block = $true },
                @{ Pattern = '(?i)del\s+/s\s+/q\s+[a-z]:\\'; Risk = "Critical"; Message = "Recursive deletion of Windows drive"; Block = $true },
                @{ Pattern = '(?i)format\s+[a-z]:'; Risk = "Critical"; Message = "Disk format operation"; Block = $true },
                @{ Pattern = '(?i)fdisk|mkfs|parted'; Risk = "Critical"; Message = "Disk partitioning operation"; Block = $true },
                @{ Pattern = '(?i)dd\s+.*of=/dev/'; Risk = "Critical"; Message = "Direct disk device write"; Block = $true },
                @{ Pattern = '(?i)>\s*/dev/sd[a-z]'; Risk = "Critical"; Message = "Direct disk write operation"; Block = $true },
                @{ Pattern = '(?i)chmod\s+777\s+/'; Risk = "High"; Message = "Dangerous permission change"; Block = $false },
                @{ Pattern = '(?i)sudo\s+rm'; Risk = "High"; Message = "Privileged deletion command"; Block = $false },
                @{ Pattern = '(?i)curl.*\|\s*(bash|sh|powershell)'; Risk = "High"; Message = "Remote code execution pattern"; Block = $true },
                @{ Pattern = '(?i)wget.*\|\s*(bash|sh)'; Risk = "High"; Message = "Remote code execution pattern"; Block = $true },
                @{ Pattern = '(?i)(nc|netcat).*-e'; Risk = "High"; Message = "Reverse shell pattern"; Block = $true },
                @{ Pattern = '(?i):(){ :|:& };:'; Risk = "Critical"; Message = "Fork bomb detected"; Block = $true },
                @{ Pattern = '(?i)kill\s+-9\s+1'; Risk = "High"; Message = "Attempting to kill init process"; Block = $true }
            )
            "Write" = @(
                @{ Pattern = '\.exe$|\.bat$|\.cmd$|\.ps1$|\.sh$'; Risk = "Medium"; Message = "Writing executable file"; Block = $false },
                @{ Pattern = '(?i)autorun\.inf|desktop\.ini'; Risk = "High"; Message = "Windows autorun file"; Block = $false },
                @{ Pattern = '(?i)/etc/passwd|/etc/shadow'; Risk = "Critical"; Message = "Writing to system authentication files"; Block = $true },
                @{ Pattern = '(?i)C:\\Windows\\System32'; Risk = "High"; Message = "Writing to Windows system directory"; Block = $false },
                @{ Pattern = '(?i)\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup'; Risk = "Medium"; Message = "Writing to startup folder"; Block = $false }
            )
            "Edit" = @(
                @{ Pattern = '(?i)/etc/(passwd|shadow|sudoers)'; Risk = "Critical"; Message = "Editing system security files"; Block = $true },
                @{ Pattern = '(?i)\.ssh/(authorized_keys|id_rsa)'; Risk = "High"; Message = "Editing SSH authentication files"; Block = $false },
                @{ Pattern = '(?i)hosts$'; Risk = "Medium"; Message = "Editing hosts file"; Block = $false }
            )
            "Grep" = @(
                @{ Pattern = '(?i)password|secret|api[_-]?key|token'; Risk = "Medium"; Message = "Searching for sensitive information"; Block = $false }
            )
        }
        
        # Tool-specific validation
        if ($dangerousPatterns.ContainsKey($ToolName)) {
            $content = ""
            
            # Extract content based on tool type
            switch ($ToolName) {
                "Bash" { $content = $ToolInput.command }
                "Write" { $content = "$($ToolInput.file_path) $($ToolInput.content)" }
                "Edit" { $content = "$($ToolInput.file_path) $($ToolInput.old_string) $($ToolInput.new_string)" }
                "Grep" { $content = "$($ToolInput.pattern) $($ToolInput.path)" }
                default { $content = ($ToolInput | ConvertTo-Json -Compress) }
            }
            
            foreach ($rule in $dangerousPatterns[$ToolName]) {
                if ($content -match $rule.Pattern) {
                    $result.IsDangerous = $true
                    $result.RiskLevel = $rule.Risk
                    $result.Reason = $rule.Message
                    $result.BlockExecution = $rule.Block
                    
                    # Add recommendations based on risk level
                    switch ($rule.Risk) {
                        "Critical" {
                            $result.Recommendations += "This operation is extremely dangerous and should not be executed"
                            $result.Recommendations += "Consider using safer alternatives or manual review"
                        }
                        "High" {
                            $result.Recommendations += "This operation has high security risks"
                            $result.Recommendations += "Ensure you understand the implications before proceeding"
                        }
                        "Medium" {
                            $result.Recommendations += "This operation has moderate security implications"
                            $result.Recommendations += "Review the operation for unintended consequences"
                        }
                    }
                    break
                }
            }
        }
        
        # Tool replacement recommendations
        if ($ToolName -eq "Bash" -and $ToolInput.command -match '(?i)grep') {
            $result.Recommendations += "Consider using the Grep tool instead of bash grep for better performance"
        }
        
        # Size validation for file operations
        if ($ToolName -in @("Write", "Edit") -and $ToolInput.content -and $ToolInput.content.Length -gt 1MB) {
            $result.Recommendations += "Large file operation detected - consider chunking for better performance"
        }
        
    } catch {
        Write-Debug "Dangerous command validation failed: $_"
        $result.IsDangerous = $false
        $result.Reason = "Validation error occurred"
    }
    
    return $result
}

# Enhanced HTTP request with retry logic and exponential backoff
function Invoke-SecureRestMethod {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Uri,
        [Parameter(Mandatory)]
        [string]$Method,
        [Parameter(Mandatory)]
        [string]$Body,
        [string]$ContentType = "application/json",
        [int]$TimeoutSec = 5,
        [int]$MaxRetries = $MaxRetries
    )
    
    $attempt = 0
    $lastError = $null
    
    while ($attempt -lt $MaxRetries) {
        $attempt++
        $delay = $BaseRetryDelay * [Math]::Pow(2, $attempt - 1)  # Exponential backoff
        
        try {
            Write-Debug "HTTP request attempt $attempt to $Uri"
            
            # Validate and sanitize the request body
            $validation = Test-InputSafety -Input $Body -Context "http_body"
            if (-not $validation.IsSafe) {
                throw "Request body failed security validation: $($validation.Issues -join ', ')"
            }
            
            $response = Invoke-RestMethod -Uri $Uri -Method $Method -Body $validation.SanitizedInput -ContentType $ContentType -TimeoutSec $TimeoutSec
            
            Write-Debug "HTTP request successful on attempt $attempt"
            return @{ Success = $true; Response = $response; Attempt = $attempt }
            
        } catch [System.Net.WebException] {
            $lastError = $_
            Write-Debug "HTTP request failed on attempt $attempt`: $($_.Exception.Message)"
            
            # Don't retry on client errors (4xx)
            if ($_.Exception.Response.StatusCode -ge 400 -and $_.Exception.Response.StatusCode -lt 500) {
                break
            }
            
        } catch {
            $lastError = $_
            Write-Debug "HTTP request failed on attempt $attempt`: $($_.Exception.Message)"
        }
        
        # Wait before retry (except on last attempt)
        if ($attempt -lt $MaxRetries) {
            Start-Sleep -Milliseconds $delay
        }
    }
    
    Write-Debug "All HTTP retry attempts failed. Last error: $($lastError.Exception.Message)"
    return @{ Success = $false; Error = $lastError; TotalAttempts = $attempt }
}

# JSON validation and parsing
function ConvertFrom-JsonSafely {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$InputObject,
        [int]$MaxDepth = 10
    )
    
    try {
        # Validate JSON structure
        $validation = Test-InputSafety -Input $InputObject -Context "json"
        if (-not $validation.IsSafe) {
            throw "JSON input failed security validation: $($validation.Issues -join ', ')"
        }
        
        # Attempt to parse JSON
        $parsed = $validation.SanitizedInput | ConvertFrom-Json -Depth $MaxDepth
        return @{ Success = $true; Data = $parsed }
        
    } catch {
        Write-Debug "JSON parsing failed: $($_.Exception.Message)"
        return @{ Success = $false; Error = $_.Exception.Message }
    }
}

# Enhanced project name detection with security considerations
function Get-SecureProjectName {
    [CmdletBinding()]
    param()
    
    try {
        # Priority 1: Environment variable (most secure)
        if ($env:CLAUDE_PROJECT_PATH) {
            $projectPath = $env:CLAUDE_PROJECT_PATH
            # Validate the path for security
            if ($projectPath -match '^[a-zA-Z0-9\\_\-\.\:/\\]+$') {
                return Split-Path -Leaf $projectPath
            }
        }
        
        # Priority 2: Git remote origin (if in git repo)
        try {
            $originUrl = git config --get remote.origin.url 2>$null
            if ($originUrl) {
                # Extract repo name from URL (handle both HTTPS and SSH formats)
                if ($originUrl -match '([^/]+)\.git$') {
                    $repoName = $matches[1]
                    # Validate repo name
                    if ($repoName -match '^[a-zA-Z0-9\\_\-\.]+$') {
                        return $repoName
                    }
                } elseif ($originUrl -match '/([^/]+)/?$') {
                    $repoName = $matches[1]
                    if ($repoName -match '^[a-zA-Z0-9\\_\-\.]+$') {
                        return $repoName
                    }
                }
            }
        } catch {
            Write-Debug "Git detection failed: $_"
        }
        
        # Priority 3: Current directory name (with validation)
        try {
            $currentDir = Get-Location | Select-Object -ExpandProperty Path
            $dirName = Split-Path -Leaf $currentDir
            
            # Special handling for known project patterns
            if ($currentDir -match "agents-observability") {
                return "agents-observability"
            }
            
            # Validate directory name
            if ($dirName -match '^[a-zA-Z0-9\\_\-\.]+$' -and $dirName.Length -le 100) {
                return $dirName
            }
        } catch {
            Write-Debug "Directory detection failed: $_"
        }
        
    } catch {
        Write-Debug "Project name detection failed: $_"
    }
    
    return "unknown-project"
}

# Enhanced git branch detection
function Get-SecureGitBranch {
    [CmdletBinding()]
    param()
    
    try {
        $branch = git branch --show-current 2>$null
        if ($branch) {
            $cleanBranch = $branch.Trim()
            # Validate branch name
            if ($cleanBranch -match '^[a-zA-Z0-9\\_\-\./]+$' -and $cleanBranch.Length -le 100) {
                return $cleanBranch
            }
        }
    } catch {
        Write-Debug "Git branch detection failed: $_"
    }
    
    return "unknown"
}

# Event payload creation with validation
function New-SecureEventPayload {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$HookEventType,
        [Parameter(Mandatory)]
        [hashtable]$PayloadData,
        [string]$SessionId,
        [string]$ProjectName
    )
    
    try {
        # Get secure project name if not provided
        if (-not $ProjectName) {
            $ProjectName = Get-SecureProjectName
        }
        
        # Generate secure session ID if not provided
        if (-not $SessionId) {
            $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
            $randomId = [System.Guid]::NewGuid().ToString("N").Substring(0, 8)
            $SessionId = "$env:USERNAME-$timestamp-$randomId"
        }
        
        # Create base event structure
        $event = @{
            source_app = $ProjectName
            session_id = $SessionId
            hook_event_type = $HookEventType
            payload = $PayloadData
        }
        
        # Add metadata
        $event.payload.metadata = @{
            timestamp = (Get-Date -Format "yyyy-MM-dd'T'HH:mm:ss.fff'Z'")
            user = $env:USERNAME
            hostname = $env:COMPUTERNAME
            git_branch = Get-SecureGitBranch
            hook_version = "2.0.0"
            security_validated = $true
        }
        
        # Convert to JSON with validation
        $jsonPayload = $event | ConvertTo-Json -Depth 10 -Compress
        $validation = Test-InputSafety -Input $jsonPayload -Context "event_payload"
        
        if (-not $validation.IsSafe) {
            throw "Event payload failed security validation: $($validation.Issues -join ', ')"
        }
        
        return $validation.SanitizedInput
        
    } catch {
        Write-Debug "Event payload creation failed: $_"
        throw
    }
}

# Safe background job execution
function Invoke-SecureBackgroundJob {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [scriptblock]$ScriptBlock,
        [hashtable]$ArgumentList = @{},
        [int]$TimeoutSeconds = 5
    )
    
    try {
        Write-Debug "Starting secure background job with timeout: $TimeoutSeconds seconds"
        
        $job = Start-Job -ScriptBlock $ScriptBlock -ArgumentList $ArgumentList.Values
        
        # Wait for job completion with timeout
        $completed = Wait-Job -Job $job -Timeout $TimeoutSeconds
        
        if ($completed) {
            $result = Receive-Job -Job $job -ErrorAction SilentlyContinue
            Write-Debug "Background job completed successfully"
            return @{ Success = $true; Result = $result }
        } else {
            Write-Debug "Background job timed out after $TimeoutSeconds seconds"
            return @{ Success = $false; Error = "Job timed out" }
        }
        
    } catch {
        Write-Debug "Background job failed: $($_.Exception.Message)"
        return @{ Success = $false; Error = $_.Exception.Message }
        
    } finally {
        # Always clean up the job
        if ($job) {
            Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
        }
    }
}

# Export functions
Export-ModuleMember -Function @(
    'Get-EnvironmentInfo',
    'Test-InputSafety', 
    'Test-DangerousCommand',
    'Invoke-SecureRestMethod',
    'ConvertFrom-JsonSafely',
    'Get-SecureProjectName',
    'Get-SecureGitBranch',
    'New-SecureEventPayload',
    'Invoke-SecureBackgroundJob'
)