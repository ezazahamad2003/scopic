Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"

$source = Join-Path $PSScriptRoot "..\..\white scopic.png"
$outIco = Join-Path $PSScriptRoot "icon.ico"
$outPng = Join-Path $PSScriptRoot "icon.png"

if (-not (Test-Path $source)) {
  throw "Source logo not found: $source"
}

$logo = [System.Drawing.Image]::FromFile((Resolve-Path $source))

function Add-RoundedRect(
  [System.Drawing.Drawing2D.GraphicsPath]$path,
  [System.Drawing.Rectangle]$rect,
  [int]$radius
) {
  $d = $radius * 2
  $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
  $path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
  $path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
  $path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
  $path.CloseFigure()
}

function New-IconBitmap([System.Drawing.Image]$logo, [int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RoundedRect -path $path -rect $rect -radius ([int]($size * 0.24))

  $bg = [System.Drawing.Color]::FromArgb(18, 24, 38)
  $brush = New-Object System.Drawing.SolidBrush $bg
  $g.FillPath($brush, $path)
  $brush.Dispose()
  $path.Dispose()

  $margin = [int]($size * 0.17)
  $logoSize = $size - (2 * $margin)
  $logoRect = New-Object System.Drawing.Rectangle $margin, $margin, $logoSize, $logoSize
  $g.DrawImage($logo, $logoRect)
  $g.Dispose()
  return $bmp
}

function ConvertTo-DibBytes([System.Drawing.Bitmap]$bmp) {
  $size = $bmp.Width
  $xorStride = $size * 4
  $andStride = [int]([Math]::Ceiling($size / 32.0) * 4)
  $pixelBytes = New-Object byte[] ($xorStride * $size)
  $maskBytes = New-Object byte[] ($andStride * $size)

  for ($y = 0; $y -lt $size; $y++) {
    $destY = $size - 1 - $y
    for ($x = 0; $x -lt $size; $x++) {
      $c = $bmp.GetPixel($x, $y)
      $i = ($destY * $xorStride) + ($x * 4)
      $pixelBytes[$i] = [byte]$c.B
      $pixelBytes[$i + 1] = [byte]$c.G
      $pixelBytes[$i + 2] = [byte]$c.R
      $pixelBytes[$i + 3] = [byte]$c.A
    }
  }

  $ms = New-Object System.IO.MemoryStream
  $bw = New-Object System.IO.BinaryWriter $ms
  $bw.Write([UInt32]40)          # BITMAPINFOHEADER size
  $bw.Write([Int32]$size)
  $bw.Write([Int32]($size * 2))  # XOR + AND mask height
  $bw.Write([UInt16]1)
  $bw.Write([UInt16]32)
  $bw.Write([UInt32]0)
  $bw.Write([UInt32]($pixelBytes.Length + $maskBytes.Length))
  $bw.Write([Int32]0)
  $bw.Write([Int32]0)
  $bw.Write([UInt32]0)
  $bw.Write([UInt32]0)
  $bw.Write($pixelBytes)
  $bw.Write($maskBytes)
  $bw.Flush()
  $bytes = $ms.ToArray()
  $bw.Dispose()
  $ms.Dispose()
  return ,$bytes
}

$png256 = New-IconBitmap -logo $logo -size 256
$png256.Save($outPng, [System.Drawing.Imaging.ImageFormat]::Png)
$png256.Dispose()

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$entries = @()
foreach ($s in $sizes) {
  $bmp = New-IconBitmap -logo $logo -size $s
  $entries += [PSCustomObject]@{
    Size = $s
    Bytes = ConvertTo-DibBytes -bmp $bmp
  }
  $bmp.Dispose()
}

$fs = [System.IO.File]::Open($outIco, [System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]$entries.Count)

$offset = 6 + (16 * $entries.Count)
foreach ($entry in $entries) {
  $dim = if ($entry.Size -eq 256) { 0 } else { $entry.Size }
  $bw.Write([Byte]$dim)
  $bw.Write([Byte]$dim)
  $bw.Write([Byte]0)
  $bw.Write([Byte]0)
  $bw.Write([UInt16]1)
  $bw.Write([UInt16]32)
  $bw.Write([UInt32]$entry.Bytes.Length)
  $bw.Write([UInt32]$offset)
  $offset += $entry.Bytes.Length
}

foreach ($entry in $entries) {
  $bw.Write($entry.Bytes)
}

$bw.Flush()
$bw.Dispose()
$fs.Dispose()
$logo.Dispose()

Write-Output "icon.ico written: $outIco"
Write-Output "icon.png written: $outPng"
