Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"

$source = Join-Path $PSScriptRoot "..\..\black scopic.png"
$outIco = Join-Path $PSScriptRoot "icon.ico"
$outPng = Join-Path $PSScriptRoot "icon.png"

if (-not (Test-Path $source)) {
  throw "Source logo not found: $source"
}

$logo = [System.Drawing.Image]::FromFile((Resolve-Path $source))

function New-IconPng([System.Drawing.Image]$logo, [int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g   = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  # Rounded square background — warm cream like the app sidebar.
  $radius = [int]($size * 0.18)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
  $d = $radius * 2
  $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
  $path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
  $path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
  $path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
  $path.CloseFigure()

  $bg = [System.Drawing.Color]::FromArgb(243, 239, 230)
  $brush = New-Object System.Drawing.SolidBrush $bg
  $g.FillPath($brush, $path)
  $brush.Dispose()

  # Logo with margin, drawn black-on-cream.
  $margin   = [int]($size * 0.16)
  $logoSize = $size - (2 * $margin)
  $logoRect = New-Object System.Drawing.Rectangle $margin, $margin, $logoSize, $logoSize
  $g.DrawImage($logo, $logoRect)

  $g.Dispose()
  return $bmp
}

# 256x256 PNG copy for BrowserWindow icon in dev mode.
$png256 = New-IconPng -logo $logo -size 256
$png256.Save($outPng, [System.Drawing.Imaging.ImageFormat]::Png)
$png256.Dispose()

# Single-image 256x256 PNG-encoded ICO (modern Windows handles this).
$png = New-IconPng -logo $logo -size 256
$ms  = New-Object System.IO.MemoryStream
$png.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBytes = $ms.ToArray()
$ms.Dispose()
$png.Dispose()

$fs = [System.IO.File]::Open($outIco, [System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter $fs
# ICONDIR
$bw.Write([UInt16]0)   # reserved
$bw.Write([UInt16]1)   # type: 1 = ICO
$bw.Write([UInt16]1)   # image count
# ICONDIRENTRY
$bw.Write([Byte]0)     # width (0 = 256)
$bw.Write([Byte]0)     # height (0 = 256)
$bw.Write([Byte]0)     # color count
$bw.Write([Byte]0)     # reserved
$bw.Write([UInt16]1)   # color planes
$bw.Write([UInt16]32)  # bits per pixel
$bw.Write([UInt32]$pngBytes.Length) # data size
$bw.Write([UInt32]22)  # data offset (6 + 16)
$bw.Write($pngBytes)
$bw.Flush()
$bw.Dispose()
$fs.Dispose()

$logo.Dispose()

Write-Output "icon.ico written: $outIco ($($pngBytes.Length) bytes)"
Write-Output "icon.png written: $outPng"
