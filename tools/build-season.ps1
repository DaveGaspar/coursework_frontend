# Saves this season's fixtures, results, teams, squads, coaches, badges and stadium photos into assets/, so the site
# works when the public APIs are slow, blocked or offline. Takes about 40 minutes because TheSportsDB allows
# only about 10 requests a minute. Run from the project folder, then commit the changed files in assets/:
#   powershell -ExecutionPolicy Bypass -File tools\build-season.ps1
param([int]$PerMinute = 8, [switch]$RefreshImages)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Drawing

$root = Split-Path $PSScriptRoot
$tsdb = 'https://www.thesportsdb.com/api/v1/json/123'
$oldb = 'https://api.openligadb.de'
$now = Get-Date
$startYear = if ($now.Month -ge 7) { $now.Year } else { $now.Year - 1 }
$season = "$startYear-$($startYear + 1)"
New-Item -ItemType Directory -Force "$root\assets\data", "$root\assets\img\teams", "$root\assets\img\venues" | Out-Null

$utf8 = New-Object Text.UTF8Encoding $false
$lastTsdb = [datetime]::MinValue
# Answers are kept for a few hours, so a stopped run can be restarted without asking again.
$cacheDir = Join-Path $env:TEMP 'sports-live-season'
New-Item -ItemType Directory -Force $cacheDir | Out-Null
$sha = New-Object Security.Cryptography.SHA1Managed

# -Optional: give up quietly (null) instead of stopping the whole download.
function Get-Json([string]$url, [switch]$Tsdb, [switch]$Optional) {
  $hash = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($url))).Replace('-', '')
  $cacheFile = Join-Path $cacheDir "$hash.json"
  if ((Test-Path $cacheFile) -and ((Get-Date) - (Get-Item $cacheFile).LastWriteTime).TotalHours -lt 6) {
    return (Get-Content $cacheFile -Raw -Encoding UTF8 | ConvertFrom-Json)
  }
  $tries = if ($Tsdb) { 40 } elseif ($Optional) { 3 } else { 6 }
  for ($try = 1; $try -le $tries; $try++) {
    if ($Tsdb) {
      $wait = (60.0 / $PerMinute) - ((Get-Date) - $script:lastTsdb).TotalSeconds
      if ($wait -gt 0) { Start-Sleep -Milliseconds ([int]($wait * 1000)) }
      $script:lastTsdb = Get-Date
    }
    $client = New-Object Net.WebClient
    $client.Encoding = [Text.Encoding]::UTF8
    $client.Headers['User-Agent'] = 'SportsLive-coursework/1.0 (https://github.com/DaveGaspar/coursework_frontend)'
    try {
      $text = $client.DownloadString($url)
      if (-not $text) { return $null }
      $json = $text | ConvertFrom-Json
      [IO.File]::WriteAllText($cacheFile, $text, $utf8)
      return $json
    } catch {
      $ex = $_.Exception
      while ($ex -and -not ($ex -is [Net.WebException])) { $ex = $ex.InnerException }
      $status = if ($ex -and $ex.Response) { [int]$ex.Response.StatusCode } else { 0 }
      if ($status -eq 404 -or $status -eq 400) { return $null }
      $pause = if ($status -eq 429) { 90 } else { 10 }
      # Another tab or computer on the same network shares the limit, so slow down after every block.
      if ($status -eq 429 -and $Tsdb -and $try -eq 1) { $script:PerMinute = [Math]::Max(6, [int]($script:PerMinute / 2)) }
      Write-Host "  $status on $url, waiting $pause s (try $try)"
      Start-Sleep -Seconds $pause
    } finally { $client.Dispose() }
  }
  if ($Optional) { Write-Host "  skipped $url"; return $null }
  throw "Gave up on $url"
}

function Pick($obj, [string[]]$names) {
  $out = [ordered]@{}
  foreach ($n in $names) { $out[$n] = $obj.$n }
  return $out
}

# Downloads a picture and stores it smaller: PNG for badges (keeps transparency), JPEG for photos.
function Save-Image([string]$url, [string]$path, [int]$maxSize, [switch]$Photo) {
  if (-not $url) { return $false }
  if ((Test-Path $path) -and -not $RefreshImages) { return $true }
  $client = New-Object Net.WebClient
  $client.Headers['User-Agent'] = 'SportsLive-coursework/1.0 (https://github.com/DaveGaspar/coursework_frontend)'
  try {
    $bytes = $client.DownloadData($url)
    $source = [Drawing.Image]::FromStream((New-Object IO.MemoryStream (, $bytes)))
    $scale = [Math]::Min(1.0, $maxSize / [double][Math]::Max($source.Width, $source.Height))
    if ($Photo) { $scale = [Math]::Min(1.0, $maxSize / [double]$source.Width) }
    $w = [Math]::Max(1, [int]($source.Width * $scale)); $h = [Math]::Max(1, [int]($source.Height * $scale))
    $format = if ($Photo) { [Drawing.Imaging.PixelFormat]::Format24bppRgb } else { [Drawing.Imaging.PixelFormat]::Format32bppArgb }
    $bmp = New-Object Drawing.Bitmap $w, $h, $format
    $g = [Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($source, 0, 0, $w, $h)
    if ($Photo) {
      $codec = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
      $params = New-Object Drawing.Imaging.EncoderParameters 1
      $params.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality, [long]72)
      $bmp.Save($path, $codec, $params)
    } else {
      $bmp.Save($path, [Drawing.Imaging.ImageFormat]::Png)
    }
    $g.Dispose(); $bmp.Dispose(); $source.Dispose()
    Start-Sleep -Milliseconds 200
    return $true
  } catch {
    Write-Host "  picture failed: $url ($($_.Exception.Message))"
    return $false
  } finally { $client.Dispose() }
}

$finished = 'FT', 'AET', 'PEN', 'AP', 'AOT', 'MATCH FINISHED', 'FINISHED'
$eventFields = 'idEvent', 'idLeague', 'strSeason', 'intRound', 'strTimestamp', 'dateEvent', 'strTime', 'idHomeTeam', 'idAwayTeam',
  'strHomeTeam', 'strAwayTeam', 'strHomeTeamBadge', 'strAwayTeamBadge', 'intHomeScore', 'intAwayScore', 'strStatus', 'strProgress',
  'strPostponed', 'idVenue', 'strVenue', 'intSpectators', 'strOfficial', 'strPoster', 'strThumb', 'strVideo'

# Matches still to be played (or being played right now) keep no score, so an old copy never shows a half-time result.
function Save-Event($e) {
  $row = Pick $e $eventFields
  $row.strThumb = $null
  if ($finished -notcontains ([string]$e.strStatus).ToUpper()) {
    $row.intHomeScore = $null; $row.intAwayScore = $null; $row.strStatus = 'NS'; $row.strProgress = $null; $row.intSpectators = $null
  }
  return $row
}

$leagues = [ordered]@{}
$teamIds = New-Object Collections.Generic.HashSet[string]
$badgeUrls = @{}

# OpenLigaDB team id -> TheSportsDB team id, from the site's own map.
$oldbToTsdb = @{}
foreach ($line in Get-Content "$root\scripts\data\sources\external\team-map.js" -Encoding UTF8) {
  if ($line -match "^\s*(\d+):\s*'(\d+)'") { $oldbToTsdb[$Matches[1]] = $Matches[2] }
}
$oldbIcons = @{}

foreach ($league in 'bl1', 'bl2') {
  $games = @()
  for ($r = 1; $r -le 34; $r++) {
    Write-Host "$league matchday $r"
    Start-Sleep -Milliseconds 1200
    foreach ($m in @(Get-Json "$oldb/getmatchdata/$league/$startYear/$r")) {
      if (-not $m -or $m.leagueShortcut -ne $league) { continue }
      $done = [bool]$m.matchIsFinished
      $team = { param($t) [ordered]@{ teamId = $t.teamId; teamName = $t.teamName; shortName = $t.shortName; teamIconUrl = $t.teamIconUrl } }
      $games += , [ordered]@{
        matchID = $m.matchID; matchDateTimeUTC = $m.matchDateTimeUTC; leagueShortcut = $m.leagueShortcut; leagueSeason = $m.leagueSeason
        group = [ordered]@{ groupOrderID = $m.group.groupOrderID; groupName = $m.group.groupName }
        team1 = (& $team $m.team1); team2 = (& $team $m.team2)
        matchIsFinished = $done
        matchResults = @(if ($done) { foreach ($x in @($m.matchResults)) { if ($x) { Pick $x 'resultTypeID', 'resultOrderID', 'pointsTeam1', 'pointsTeam2' } } })
        goals = @(if ($done) { foreach ($x in @($m.goals)) { if ($x) { Pick $x 'matchMinute', 'scoreTeam1', 'scoreTeam2', 'goalGetterName', 'isPenalty', 'isOwnGoal', 'isOvertime' } } })
        location = if ($m.location) { [ordered]@{ locationStadium = $m.location.locationStadium; locationCity = $m.location.locationCity } } else { $null }
        numberOfViewers = if ($done) { $m.numberOfViewers } else { $null }
      }
      foreach ($t in $m.team1, $m.team2) {
        $tsdbId = $oldbToTsdb[[string]$t.teamId]
        if ($tsdbId) { [void]$teamIds.Add($tsdbId); if ($t.teamIconUrl) { $oldbIcons[$t.teamIconUrl] = $tsdbId } }
      }
    }
  }
  $leagues[$league] = $games
}

foreach ($league in @(@{ key = 'epl'; id = '4328'; rounds = 38; from = $null }, @{ key = 'ucl'; id = '4480'; rounds = 8; from = (Get-Date -Year $startYear -Month 9 -Day 1) })) {
  $events = @()
  for ($r = 1; $r -le $league.rounds; $r++) {
    Write-Host "$($league.key) round $r"
    $json = Get-Json "$tsdb/eventsround.php?id=$($league.id)&r=$r&s=$season" -Tsdb
    foreach ($e in @($json.events)) {
      if (-not $e -or [string]$e.idLeague -ne $league.id) { continue }
      if ($league.from -and [datetime]$e.dateEvent -lt $league.from) { continue }
      $events += , (Save-Event $e)
      foreach ($side in 'Home', 'Away') {
        $id = [string]$e."id$($side)Team"
        [void]$teamIds.Add($id)
        $badge = $e."str$($side)TeamBadge"
        if ($badge) { $badgeUrls[$badge] = $id }
      }
    }
  }
  $leagues[$league.key] = $events
}

$teams = [ordered]@{}
$images = [ordered]@{}
$teamFields = 'idTeam', 'strTeam', 'strTeamShort', 'strSport', 'strCountry', 'strLeague', 'strBadge', 'strColour1', 'idVenue',
  'strStadium', 'intStadiumCapacity', 'strLocation'

# Full squads come from ESPN's public site data (TheSportsDB's free key returns only 10 players per club).
$espn = 'https://site.api.espn.com/apis/site/v2/sports/soccer'
$espnSlugs = @{ 'English Premier League' = 'eng.1'; 'German Bundesliga' = 'ger.1'; 'German 2. Bundesliga' = 'ger.2' }
function Norm([string]$s) {
  $s = $s.Replace([string][char]0xF8, 'o').Replace([string][char]0xE6, 'ae').Replace([string][char]0xDF, 'ss')
  return ($s.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', '' -replace '[^A-Za-z0-9 ]', ' ' -replace '\b(FC|CF|SC|AC|AS|SK|FK|SL|1|SV)\b', '' -replace '\s+', ' ').Trim().ToLower()
}
$espnTeams = foreach ($slug in 'uefa.champions', 'eng.1', 'ger.1', 'ger.2') {
  foreach ($e in @((Get-Json "$espn/$slug/teams" -Optional).sports[0].leagues[0].teams.team)) {
    if ($e) { [pscustomobject]@{ id = [string]$e.id; slug = $slug; names = @($e.displayName, $e.shortDisplayName, $e.name, $e.location | ForEach-Object { Norm $_ }) } }
  }
}
function Get-EspnSquad($t) {
  $names = @($t.strTeam) + @(([string]$t.strTeamAlternate -split ',') | Where-Object { $_.Trim() }) | ForEach-Object { Norm $_ } | Where-Object { $_ }
  $match = $espnTeams | Where-Object { $e = $_; $names | Where-Object { $e.names -contains $_ } } | Select-Object -First 1
  # ESPN's own list wins: TheSportsDB's ESPN id is sometimes missing or wrong.
  $espnId = if ($match) { $match.id } elseif ($t.idESPN -and [string]$t.idESPN -ne '0') { [string]$t.idESPN } else { $null }
  if (-not $espnId) { return @() }
  $slugs = @($espnSlugs[[string]$t.strLeague], $(if ($match) { $match.slug }), 'uefa.champions') | Where-Object { $_ } | Select-Object -Unique
  foreach ($slug in $slugs) {
    $roster = Get-Json "$espn/$slug/teams/$espnId/roster" -Optional
    Start-Sleep -Milliseconds 250
    $players = @($roster.athletes | Where-Object { $_ -and $_.displayName })
    if ($players.Count) {
      return @($players | ForEach-Object {
        [ordered]@{ idPlayer = "espn-$($_.id)"; idTeam = $t.idTeam; strPlayer = $_.displayName; strPosition = $_.position.name; strNumber = $_.jersey }
      })
    }
  }
  return @()
}
$wikiItems = @{}
# The site's name without its country ending, so fcbarcelona.com and fcbarcelona.cat count as the same club.
function Domain([string]$url) {
  $labels = @(($url.ToLower() -replace '^https?://', '' -replace '/.*$', '').Trim().Split('.') | Where-Object { $_ -and $_ -ne 'www' })
  if ($labels.Count -lt 2) { return ($labels -join '.') }
  $labels = $labels[0..($labels.Count - 2)]
  if ($labels.Count -ge 2 -and @('co', 'com', 'org', 'net', 'ac') -contains $labels[-1]) { $labels = $labels[0..($labels.Count - 2)] }
  return $labels[-1]
}

$i = 0
foreach ($id in $teamIds) {
  $i++
  if (-not $id) { continue }
  $json = Get-Json "$tsdb/lookupteam.php?id=$id" -Tsdb
  $t = @($json.teams) | Where-Object { $_ -and [string]$_.idTeam -eq $id } | Select-Object -First 1
  if (-not $t) { Write-Host "  no details for team $id"; continue }
  Write-Host "team $i/$($teamIds.Count): $($t.strTeam)"
  $row = Pick $t $teamFields
  $row.strFanart1 = $null
  if ($t.idVenue) {
    $v = @((Get-Json "$tsdb/lookupvenue.php?id=$($t.idVenue)" -Tsdb).venues) | Where-Object { $_ -and [string]$_.idVenue -eq [string]$t.idVenue } | Select-Object -First 1
    if ($v) {
      $row.venue = Pick $v 'idVenue', 'strVenue', 'intCapacity', 'strLocation', 'strThumb', 'strFanart1'
      $photo = if ($v.strThumb) { $v.strThumb } else { $v.strFanart1 }
      $file = "assets/img/venues/$($v.idVenue).jpg"
      if ($photo -and (Save-Image $photo "$root\$file" 1024 -Photo)) { $images[$photo] = $file }
    }
  }
  $squad = @((Get-Json "$tsdb/lookup_all_players.php?id=$id" -Tsdb).player) | Where-Object { $_ -and [string]$_.idTeam -eq $id }
  $row.squad = @($squad | ForEach-Object { Pick $_ 'idPlayer', 'idTeam', 'strPlayer', 'strPosition', 'strNumber' })
  $full = @(Get-EspnSquad $t)
  if ($full.Count -gt $row.squad.Count) {
    $managers = @($row.squad | Where-Object { $_.strPosition -match '^(manager|head coach|coach)$' })
    $row.squad = @($full) + $managers
  }
  # Wikipedia articles found by the club's names lead to Wikidata items, which name the current head coach.
  $alternate = (([string]$t.strTeamAlternate -split ',')[0]).Trim()
  $found = foreach ($name in @($t.strTeam, $alternate) | Where-Object { $_ } | Select-Object -Unique) {
    $search = Get-Json ('https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=0&gsrlimit=3&prop=pageprops&ppprop=wikibase_item&gsrsearch=' + [Uri]::EscapeDataString("$name football club")) -Optional
    Start-Sleep -Milliseconds 1000
    $search.query.pages.PSObject.Properties.Value | Sort-Object index | ForEach-Object { $_.pageprops.wikibase_item } | Where-Object { $_ }
  }
  $wikiItems[$id] = @{ items = @($found | Select-Object -Unique); site = Domain $t.strWebsite }
  Write-Host "  $($row.squad.Count) in squad"
  $file = "assets/img/teams/$id.png"
  if ($t.strBadge -and (Save-Image "$($t.strBadge)/small" "$root\$file" 192)) {
    $images[$t.strBadge] = $file
    foreach ($url in @($badgeUrls.Keys)) { if ($badgeUrls[$url] -eq $id) { $images[$url] = $file } }
    foreach ($url in @($oldbIcons.Keys)) { if ($oldbIcons[$url] -eq $id) { $images[$url] = $file } }
  }
  $teams[$id] = $row
}

# Head coaches: the current (not ended) head coach statement of each club, the latest one if there are several.
# A found club counts only when its official website matches TheSportsDB's. Reserve and women's teams share that
# website, so the most notable match (most Wikipedia languages) is the club. A coach still listed at two clubs
# stays only at the one he joined last.
$picks = @{}
$items = @($wikiItems.Values | ForEach-Object { $_.items } | Sort-Object -Unique)
if ($items.Count) {
  $query = 'SELECT ?item ?site ?links ?coachLabel ?start WHERE { VALUES ?item { ' + (($items | ForEach-Object { "wd:$_" }) -join ' ') + ' } ' +
    '?item wdt:P31/wdt:P279* wd:Q476028 . ?item wdt:P856 ?site . ?item wikibase:sitelinks ?links . ' +
    'OPTIONAL { ?item p:P286 ?st . ?st ps:P286 ?coach . FILTER NOT EXISTS { ?st pq:P582 ?end } ' +
    'OPTIONAL { ?st pq:P580 ?start } } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }'
  $rows = @((Get-Json ('https://query.wikidata.org/sparql?format=json&query=' + [Uri]::EscapeDataString($query)) -Optional).results.bindings)
  foreach ($id in @($teams.Keys)) {
    $want = $wikiItems[$id]
    if (-not $want.site) { continue }
    $matching = @($rows | Where-Object { $r = $_; ($want.items | Where-Object { $r.item.value -like "*/$_" }) -and (Domain $r.site.value) -eq $want.site })
    if (-not $matching.Count) { continue }
    $club = ($matching | Sort-Object { [int]$_.links.value } -Descending | Select-Object -First 1).item.value
    $best = $rows | Where-Object { $_.item.value -eq $club -and $_.coachLabel.value -and $_.coachLabel.value -notmatch '^Q\d+$' } |
      Sort-Object { if ($_.start) { $_.start.value } else { '' } } -Descending | Select-Object -First 1
    if ($best) { $picks[$id] = [pscustomobject]@{ coach = $best.coachLabel.value; start = $(if ($best.start) { $best.start.value } else { '' }) } }
  }
  foreach ($id in @($picks.Keys)) {
    $squad = @($teams[$id].squad | Where-Object { $_.strPosition -notmatch '^(manager|head coach|coach)$' })
    $teams[$id].squad = $squad + @([ordered]@{ idPlayer = $null; idTeam = $id; strPlayer = $picks[$id].coach; strPosition = 'Manager'; strNumber = $null })
  }
}
# The same person as coach of two clubs (from either source): keep the club with the newest appointment.
$isCoach = { param($p) $p.strPosition -match '^(manager|head coach|coach)$' }
$byCoach = @{}
foreach ($id in @($teams.Keys)) { foreach ($p in @($teams[$id].squad | Where-Object { & $isCoach $_ })) { $byCoach[$p.strPlayer] = @($byCoach[$p.strPlayer]) + $id } }
foreach ($name in @($byCoach.Keys)) {
  $clubs = @($byCoach[$name] | Where-Object { $_ })
  if ($clubs.Count -lt 2) { continue }
  $keep = $clubs | Sort-Object { if ($picks[$_] -and $picks[$_].coach -eq $name) { $picks[$_].start } else { '' } } -Descending | Select-Object -First 1
  foreach ($id in ($clubs | Where-Object { $_ -ne $keep })) { $teams[$id].squad = @($teams[$id].squad | Where-Object { -not (& $isCoach $_) -or $_.strPlayer -ne $name }) }
  Write-Host "  $name is listed at $($clubs.Count) clubs; kept at $($teams[$keep].strTeam)"
}
$coaches = @($teams.Values | Where-Object { $_.squad | Where-Object { & $isCoach $_ } }).Count
Write-Host "Head coaches found for $coaches of $($teams.Count) clubs."

$data = [ordered]@{ capturedAt = $now.ToUniversalTime().ToString('o'); season = $season; leagues = $leagues; teams = $teams; images = $images }
[IO.File]::WriteAllText("$root\assets\data\season.json", ($data | ConvertTo-Json -Depth 12 -Compress), $utf8)
$size = [int]((Get-Item "$root\assets\data\season.json").Length / 1KB)
Write-Host "Saved assets\data\season.json ($size KB): $($leagues.epl.Count) + $($leagues.ucl.Count) + $($leagues.bl1.Count) + $($leagues.bl2.Count) matches, $($teams.Count) teams, $($images.Count) pictures."
