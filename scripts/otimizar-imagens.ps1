<#
  Gera versões leves das fotos para o site (pasta img/).

  - Lê todas as .jpg da raiz do site (os originais NÃO são alterados).
  - Corrige a orientação EXIF (fotos de celular "deitadas").
  - Cria duas larguras: <nome>-800.jpg (celular) e <nome>-1600.jpg (telas grandes).
    Fotos menores que a largura pedida não são ampliadas.
  - Gera os ícones a partir de images/logo.png.

  Uso (na raiz do projeto):
    powershell -ExecutionPolicy Bypass -File scripts\otimizar-imagens.ps1

  Ao adicionar uma foto nova: coloque a .jpg na raiz e rode o script de novo.
#>
param(
  [int[]]$Larguras = @(800, 1600),
  [int]$LadoMaximo = 1600,   # nenhum lado passa disso (evita retratos de 1600x2844)
  [int]$Qualidade = 78
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$raiz  = Split-Path -Parent $PSScriptRoot
$saida = Join-Path $raiz 'img'
New-Item -ItemType Directory -Force $saida | Out-Null

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' }
$jpegParams = New-Object System.Drawing.Imaging.EncoderParameters 1
$jpegParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
  [System.Drawing.Imaging.Encoder]::Quality, [long]$Qualidade)

function Corrigir-Orientacao([System.Drawing.Image]$img) {
  if ($img.PropertyIdList -notcontains 0x0112) { return }
  $o = [int]$img.GetPropertyItem(0x0112).Value[0]
  $t = [System.Drawing.RotateFlipType]
  switch ($o) {
    2 { $img.RotateFlip($t::RotateNoneFlipX) }
    3 { $img.RotateFlip($t::Rotate180FlipNone) }
    4 { $img.RotateFlip($t::Rotate180FlipX) }
    5 { $img.RotateFlip($t::Rotate90FlipX) }
    6 { $img.RotateFlip($t::Rotate90FlipNone) }
    7 { $img.RotateFlip($t::Rotate270FlipX) }
    8 { $img.RotateFlip($t::Rotate270FlipNone) }
  }
}

function Redimensionar([System.Drawing.Image]$img, [int]$w, [int]$h, $fundo = $null) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  if ($fundo) { $g.Clear($fundo) }
  $attr = New-Object System.Drawing.Imaging.ImageAttributes
  $attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $w, $h)),
    0, 0, $img.Width, $img.Height, [System.Drawing.GraphicsUnit]::Pixel, $attr)
  $attr.Dispose(); $g.Dispose()
  return $bmp
}

# --- Fotos ---------------------------------------------------------------
$relatorio = @()
Get-ChildItem (Join-Path $raiz '*.jpg') | ForEach-Object {
  $img = [System.Drawing.Image]::FromFile($_.FullName)
  try {
    Corrigir-Orientacao $img
    foreach ($larg in $Larguras) {
      $escala = [Math]::Min(1.0, [Math]::Min($larg / $img.Width, $LadoMaximo / [Math]::Max($img.Width, $img.Height)))
      $w = [int][Math]::Round($img.Width * $escala)
      $h = [int][Math]::Round($img.Height * $escala)
      $destino = Join-Path $saida ("{0}-{1}.jpg" -f $_.BaseName, $larg)
      $bmp = Redimensionar $img $w $h
      $bmp.Save($destino, $jpegCodec, $jpegParams)
      $bmp.Dispose()
      $relatorio += [pscustomobject]@{
        Arquivo = Split-Path $destino -Leaf
        Tamanho = "${w}x${h}"
        KB      = [Math]::Round((Get-Item $destino).Length / 1KB)
      }
    }
  } finally { $img.Dispose() }
}

# --- Ícones (logo) -------------------------------------------------------
$logoPath = Join-Path $raiz 'images\logo.png'
if (Test-Path $logoPath) {
  $logo = [System.Drawing.Image]::FromFile($logoPath)
  try {
    # Recorta um quadrado centralizado para o selo não ficar achatado.
    $lado = [Math]::Max($logo.Width, $logo.Height)
    $quadrado = New-Object System.Drawing.Bitmap($lado, $lado)
    $g = [System.Drawing.Graphics]::FromImage($quadrado)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($logo, [int](($lado - $logo.Width) / 2), [int](($lado - $logo.Height) / 2), $logo.Width, $logo.Height)
    $g.Dispose()

    foreach ($s in 96, 192, 512) {
      $b = Redimensionar $quadrado $s $s
      $b.Save((Join-Path $saida "logo-$s.png"), [System.Drawing.Imaging.ImageFormat]::Png)
      $b.Dispose()
    }
    $papel = [System.Drawing.ColorTranslator]::FromHtml('#F6F1E7')
    $b = Redimensionar $quadrado 180 180 $papel
    $b.Save((Join-Path $saida 'apple-touch-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $b.Dispose()
    $b = Redimensionar $quadrado 48 48
    $b.Save((Join-Path $saida 'favicon-48.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $b.Dispose()
    $quadrado.Dispose()
  } finally { $logo.Dispose() }
}

$relatorio | Format-Table -AutoSize
"Total img/: {0} KB" -f [Math]::Round(((Get-ChildItem $saida -File | Measure-Object Length -Sum).Sum) / 1KB)
