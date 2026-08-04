<#
  Million desktop rehearsal helper.

  This is intentionally a *non-posting* tool.  It can capture the Million
  window and, when explicitly enabled, exercise only the top-level menu.
  It cannot create, edit, or save an accounting document.

  Examples:
    .\tools\million-rehearsal.ps1 -Mode Capture
    .\tools\million-rehearsal.ps1 -Mode PurchaseMenu -AllowUiInput
    .\tools\million-rehearsal.ps1 -Mode SalesMenu -AllowUiInput
#>
[CmdletBinding()]
param(
  [ValidateSet('Capture', 'PurchaseMenu', 'SalesMenu')]
  [string] $Mode = 'Capture',
  [switch] $AllowUiInput,
  [string] $OutputDirectory = $env:TEMP
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not ('MillionRehearsalNative' -as [type])) {
  Add-Type -AssemblyName System.Drawing
  Add-Type @'
using System;
using System.Runtime.InteropServices;

public static class MillionRehearsalNative {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

  [DllImport("user32.dll")]
  public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint flags);

  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int x, int y);

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extraInfo);

  [DllImport("user32.dll")]
  public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);
}
'@
}

function Get-MillionProcess {
  $candidates = @(Get-Process -Name 'account' -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -match 'Million Accounting' })

  if ($candidates.Count -ne 1) {
    throw "Expected exactly one open Million Accounting window; found $($candidates.Count)."
  }

  return $candidates[0]
}

function Get-MillionBounds([IntPtr] $Handle) {
  $rect = New-Object MillionRehearsalNative+RECT
  if (-not [MillionRehearsalNative]::GetWindowRect($Handle, [ref] $rect)) {
    throw 'Unable to read Million window bounds.'
  }
  return $rect
}

function Save-MillionSnapshot($Process, $Directory) {
  if (-not (Test-Path -LiteralPath $Directory)) {
    New-Item -ItemType Directory -Path $Directory -Force | Out-Null
  }

  $bounds = Get-MillionBounds $Process.MainWindowHandle
  $width = $bounds.Right - $bounds.Left
  $height = $bounds.Bottom - $bounds.Top
  if ($width -lt 100 -or $height -lt 100) {
    throw 'Million appears to be minimized. Restore it before running a rehearsal.'
  }

  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $dc = $graphics.GetHdc()
    try {
      if (-not [MillionRehearsalNative]::PrintWindow($Process.MainWindowHandle, $dc, 2)) {
        throw 'Million did not provide a window capture.'
      }
    }
    finally {
      $graphics.ReleaseHdc($dc)
    }

    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $path = Join-Path $Directory "million-rehearsal-$timestamp.png"
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    return $path
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Click-MillionRelative($Process, [int] $X, [int] $Y) {
  # Never send physical input to a background window.  Windows can refuse an
  # automation process's focus request, in which case the click would hit a
  # different application at the same screen coordinate.
  if ([MillionRehearsalNative]::GetForegroundWindow() -ne $Process.MainWindowHandle) {
    throw 'Million is not the active window. Click its title bar yourself, then re-run the menu rehearsal.'
  }

  $bounds = Get-MillionBounds $Process.MainWindowHandle
  $screenX = $bounds.Left + $X
  $screenY = $bounds.Top + $Y
  if (-not [MillionRehearsalNative]::SetCursorPos($screenX, $screenY)) {
    throw 'Unable to position the mouse on Million.'
  }
  Start-Sleep -Milliseconds 100
  [MillionRehearsalNative]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero) # left down
  [MillionRehearsalNative]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero) # left up
}

function Activate-MillionWindow($Process) {
  # A short Alt tap satisfies Windows' foreground-lock rule for this local,
  # user-session automation process. It is used only for non-posting rehearsal
  # modes and is immediately verified below.
  [MillionRehearsalNative]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
  [MillionRehearsalNative]::keybd_event(0x12, 0, 0x0002, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 80
  if (-not [MillionRehearsalNative]::SetForegroundWindow($Process.MainWindowHandle)) {
    throw 'Windows refused to activate Million.'
  }
  Start-Sleep -Milliseconds 150
  if ([MillionRehearsalNative]::GetForegroundWindow() -ne $Process.MainWindowHandle) {
    throw 'Million could not be made the active window. No input was sent.'
  }
}

$million = Get-MillionProcess

if ($Mode -ne 'Capture' -and -not $AllowUiInput) {
  throw 'UI input is disabled. Re-run with -AllowUiInput to perform the menu-only rehearsal.'
}

if ($Mode -ne 'Capture') {
  Activate-MillionWindow $million
}

switch ($Mode) {
  'Capture' { }
  'PurchaseMenu' {
    # Creditors is the Purchase Invoice area. This only opens the top-level menu.
    Click-MillionRelative $million 148 40
    Start-Sleep -Milliseconds 500
  }
  'SalesMenu' {
    # Debtors is the Sales Invoice area. This only opens the top-level menu.
    Click-MillionRelative $million 89 40
    Start-Sleep -Milliseconds 500
  }
}

$snapshot = Save-MillionSnapshot $million $OutputDirectory
[pscustomobject]@{
  mode = $Mode
  safety = 'No document fields were entered; no document was saved.'
  process_id = $million.Id
  title = $million.MainWindowTitle
  snapshot = $snapshot
} | ConvertTo-Json -Depth 3
