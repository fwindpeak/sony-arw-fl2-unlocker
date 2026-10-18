<#
.SYNOPSIS
    Sony ARW Creative Look Unlocker — Agent Skill Windows PowerShell Installer
.DESCRIPTION
    Installs the Agent Skill into Gemini/Antigravity global config, local workspace .agents,
    Claude, and Cursor skill directories on Windows.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$SkillName = "sony-arw-fl2-unlocker"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "⚡ [Sony ARW Unlocker] Installing Agent Skill: $SkillName..." -ForegroundColor Cyan

# Target Directories on Windows
$UserHome = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
$GeminiGlobal = Join-Path $UserHome ".gemini\config\skills\$SkillName"
$AgentsLocal  = Join-Path (Get-Location) ".agents\skills\$SkillName"
$ClaudeSkills = Join-Path $UserHome ".claude\skills\$SkillName"
$CursorSkills = Join-Path $UserHome ".cursor\skills\$SkillName"

# Create script subdirectories
New-Item -ItemType Directory -Force -Path (Join-Path $GeminiGlobal "scripts") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $AgentsLocal "scripts") | Out-Null

$SkillMd = Join-Path $ScriptDir "SKILL.md"
$CamoufPy = Join-Path $ScriptDir "scripts\camouf_arw.py"
$ExportLutPy = Join-Path $ScriptDir "scripts\export_lut_cube.py"
$PresetsDir = Join-Path $ScriptDir "presets"

if (Test-Path $SkillMd) {
    # Copy SKILL.md
    Copy-Item -Force $SkillMd (Join-Path $GeminiGlobal "SKILL.md")
    Copy-Item -Force $SkillMd (Join-Path $AgentsLocal "SKILL.md")

    # Copy camouf_arw.py
    if (Test-Path $CamoufPy) {
        Copy-Item -Force $CamoufPy (Join-Path $GeminiGlobal "scripts\camouf_arw.py")
        Copy-Item -Force $CamoufPy (Join-Path $AgentsLocal "scripts\camouf_arw.py")
    }

    # Copy export_lut_cube.py
    if (Test-Path $ExportLutPy) {
        Copy-Item -Force $ExportLutPy (Join-Path $GeminiGlobal "scripts\export_lut_cube.py")
        Copy-Item -Force $ExportLutPy (Join-Path $AgentsLocal "scripts\export_lut_cube.py")
    }

    # Copy presets
    if (Test-Path $PresetsDir) {
        $GlobalPresets = Join-Path $GeminiGlobal "presets"
        $LocalPresets  = Join-Path $AgentsLocal "presets"
        New-Item -ItemType Directory -Force -Path $GlobalPresets | Out-Null
        New-Item -ItemType Directory -Force -Path $LocalPresets | Out-Null
        Copy-Item -Force -Recurse (Join-Path $PresetsDir "*") $GlobalPresets
        Copy-Item -Force -Recurse (Join-Path $PresetsDir "*") $LocalPresets
    }
} else {
    Write-Error "❌ Error: SKILL.md not found in $ScriptDir"
    exit 1
}

# Also install to Claude / Cursor if directory exists
$ClaudeDir = Join-Path $UserHome ".claude"
if (Test-Path $ClaudeDir) {
    New-Item -ItemType Directory -Force -Path $ClaudeSkills | Out-Null
    Copy-Item -Force -Recurse (Join-Path $GeminiGlobal "*") $ClaudeSkills
}

$CursorDir = Join-Path $UserHome ".cursor"
if (Test-Path $CursorDir) {
    New-Item -ItemType Directory -Force -Path $CursorSkills | Out-Null
    Copy-Item -Force -Recurse (Join-Path $GeminiGlobal "*") $CursorSkills
}

Write-Host "✅ [Success] Skill '$SkillName' has been successfully installed!" -ForegroundColor Green
Write-Host "📍 Installed Locations:" -ForegroundColor Yellow
Write-Host "   - Global Agent Config: $GeminiGlobal"
Write-Host "   - Workspace Config:    $AgentsLocal"
Write-Host ""
Write-Host "💡 Usage in Agent chat:" -ForegroundColor Cyan
Write-Host '   "帮我把当前目录下的 ARW 照片全部解锁 FL2 / FL3 胶片创意外观"'
