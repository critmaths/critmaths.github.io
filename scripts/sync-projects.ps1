$ErrorActionPreference = "Stop"
$PortfolioDir = Split-Path -Parent $PSScriptRoot
$ProjectsPath = Join-Path $PortfolioDir "projects.json"

$data = Get-Content $ProjectsPath -Raw -Encoding UTF8 | ConvertFrom-Json
$reposJson = gh repo list critmaths --limit 100 --json name,description,url,updatedAt,pushedAt,isPrivate,isFork,primaryLanguage,stargazerCount,homepageUrl,latestRelease,repositoryTopics
$repos = $reposJson | ConvertFrom-Json

$ignored = @("critmaths.github.io", "critmaths")
$existingMap = @{}
foreach ($item in $data.flagship) {
  $existingMap[$item.repo.ToLower()] = $item
}

$updatedList = New-Object System.Collections.ArrayList
foreach ($item in $data.flagship) {
  [void]$updatedList.Add($item)
}

foreach ($r in $repos) {
  if ($r.isPrivate -or $r.isFork -or ($ignored -contains $r.name)) { continue }
  $key = $r.name.ToLower()
  $ver = if ($r.latestRelease -and $r.latestRelease.tagName) { $r.latestRelease.tagName } else { $null }

  if ($existingMap.ContainsKey($key)) {
    $entry = $existingMap[$key]
    $entry.stars = $r.stargazerCount
    $entry.pushedAt = $r.pushedAt
    if ($ver) { $entry.version = $ver }
  } else {
    $lang = if ($r.primaryLanguage -and $r.primaryLanguage.name) { $r.primaryLanguage.name } else { "Multi-Language" }
    $topics = @()
    if ($r.repositoryTopics) {
      foreach ($t in $r.repositoryTopics) { $topics += $t.name }
    }
    if ($topics.Count -eq 0) { $topics = @($lang) }

    $newObj = [PSCustomObject]@{
      repo        = $r.name
      title       = ($r.name -replace '[-_]', ' ')
      subtitle    = if ($r.description) { $r.description } else { "Active Open-Source Engineering Repository" }
      category    = if ($lang -eq "Rust") { "rust-security" } else { "web-security" }
      featured    = $false
      badge       = if ($ver) { "Release $ver" } else { "Live Repository" }
      version     = if ($ver) { $ver } else { "Active" }
      language    = $lang
      stars       = $r.stargazerCount
      pushedAt    = $r.pushedAt
      repoUrl     = $r.url
      liveUrl     = if ($r.homepageUrl) { $r.homepageUrl } else { $r.url }
      downloadUrl = if ($r.latestRelease -and $r.latestRelease.url) { $r.latestRelease.url } else { $r.url }
      summary     = if ($r.description) { $r.description } else { "Newly published engineering repository by Scott Forest (@critmaths)." }
      highlights  = @(
        "Automatically synced from GitHub repository critmaths/$($r.name)",
        "Primary language: $lang"
      )
      stack       = $topics
      blueprint   = "[GitHub: critmaths/$($r.name)] --> Automated Portfolio Sync"
    }
    [void]$updatedList.Add($newObj)
  }
}

$data.flagship = $updatedList
$data.generatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$jsonOut = $data | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($ProjectsPath, $jsonOut, [System.Text.UTF8Encoding]::new($false))
Write-Output "Synced $($data.flagship.Count) public projects in projects.json at $($data.generatedAt)"
