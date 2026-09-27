# Fallback web server for Windows PCs without Node.js (uses only built-in PowerShell).
# Usage: powershell -ExecutionPolicy Bypass -File server\serve.ps1 [-Port 3000] [-Open]
param([int]$Port = 3000, [switch]$Open)

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
  '.mjs' = 'text/javascript; charset=utf-8'; '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'
  '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'; '.ico' = 'image/x-icon'
  '.woff2' = 'font/woff2'; '.txt' = 'text/plain; charset=utf-8'
}

# If the port is taken, try the next few.
$listener = $null
for ($p = $Port; $p -lt $Port + 10; $p++) {
  $candidate = New-Object System.Net.HttpListener
  $candidate.Prefixes.Add("http://localhost:$p/")
  try { $candidate.Start(); $listener = $candidate; $Port = $p; break }
  catch { Write-Host "Port $p is busy, trying $($p + 1)..." }
}
if (-not $listener) { Write-Host 'No free port found.'; exit 1 }

$url = "http://localhost:$Port/"
Write-Host "Sports Live is running at $url"
Write-Host 'Press Ctrl+C to stop.'
if ($Open) { Start-Process $url }

try {
  while ($listener.IsListening) {
    # Wait in short steps so Ctrl+C can stop the server.
    $pending = $listener.GetContextAsync()
    while (-not $pending.AsyncWaitHandle.WaitOne(250)) { }
    $context = $pending.GetAwaiter().GetResult()
    $request = $context.Request
    $response = $context.Response
    try {
      $path = [Uri]::UnescapeDataString($request.Url.AbsolutePath)
      if ($path.EndsWith('/')) { $path += 'index.html' }
      $file = [System.IO.Path]::GetFullPath((Join-Path $root $path.TrimStart('/')))
      $hidden = @($path.Split('/') | Where-Object { $_.StartsWith('.') }).Count -gt 0
      $status = 200
      if ($hidden -or -not $file.StartsWith($root + '\') -or -not [System.IO.File]::Exists($file)) {
        $status = 404
        $file = Join-Path $root 'pages\NotFound\NotFound.html'
      }
      if ([System.IO.File]::Exists($file)) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ext = [System.IO.Path]::GetExtension($file).ToLower()
      } else {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not found')
        $ext = '.txt'
      }
      $response.StatusCode = $status
      $response.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
      $response.Headers['Cache-Control'] = 'no-cache'
      $response.ContentLength64 = $bytes.Length
      if ($request.HttpMethod -ne 'HEAD') { $response.OutputStream.Write($bytes, 0, $bytes.Length) }
    } catch {
      try { $response.StatusCode = 500 } catch { }
    } finally {
      $response.Close()
    }
  }
} finally {
  $listener.Stop()
}
