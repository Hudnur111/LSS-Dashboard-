param(
  [Parameter(Mandatory = $true)][string]$TargetPath,
  [string]$ShortcutName = "LSS Dashboard",
  [switch]$DesktopShortcut,
  [switch]$StartMenuShortcut
)

$ErrorActionPreference = "Stop"
$shell = New-Object -ComObject WScript.Shell

function New-AppShortcut {
  param([string]$Directory)
  $linkPath = Join-Path $Directory "$ShortcutName.lnk"
  $shortcut = $shell.CreateShortcut($linkPath)
  $shortcut.TargetPath = $TargetPath
  $shortcut.WorkingDirectory = Split-Path $TargetPath
  $shortcut.IconLocation = $TargetPath
  $shortcut.Save()
}

if ($DesktopShortcut) {
  New-AppShortcut -Directory ([Environment]::GetFolderPath("Desktop"))
}

if ($StartMenuShortcut) {
  $startMenuPrograms = Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs"
  New-AppShortcut -Directory $startMenuPrograms
}
