$ErrorActionPreference = 'Continue'

$results = @()

function Add-Result {
  param([string]$Check, [bool]$Ok, [string]$Detail)
  $script:results += [PSCustomObject]@{
    check = $Check
    ok = $Ok
    detail = $Detail
  }
}

function Load-EnvFile {
  param([string]$Path)
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ([string]::IsNullOrWhiteSpace($line)) { return }
    if ($line.StartsWith('#')) { return }
    $pair = $line -split '=', 2
    if ($pair.Count -ne 2) { return }
    [Environment]::SetEnvironmentVariable($pair[0].Trim(), $pair[1].Trim(), 'Process')
  }
}

function Decode-JwtPayload {
  param([string]$Token)
  try {
    $parts = $Token -split '\.'
    if ($parts.Count -lt 2) { return $null }
    $payload = $parts[1].Replace('-', '+').Replace('_', '/')
    switch ($payload.Length % 4) {
      2 { $payload += '==' }
      3 { $payload += '=' }
      1 { $payload += '===' }
    }
    $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload))
    return ($json | ConvertFrom-Json)
  } catch {
    return $null
  }
}

Load-EnvFile '.env.local'

$required = @(
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL',
  'RESEND_API_KEY',
  'NOMINATIM_BASE_URL',
  'NOMINATIM_USER_AGENT',
  'SUPABASE_STORAGE_CV_BUCKET',
  'SUPABASE_STORAGE_COMPANY_MEDIA_BUCKET'
)

foreach ($k in $required) {
  $val = [Environment]::GetEnvironmentVariable($k, 'Process')
  Add-Result "env:$k" (-not [string]::IsNullOrWhiteSpace($val)) $(if ([string]::IsNullOrWhiteSpace($val)) { 'missing' } else { 'present' })
}

$supabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL.TrimEnd('/')

try {
  $resp = Invoke-WebRequest -Uri $supabaseUrl -Method GET -TimeoutSec 20
  Add-Result 'supabase:host-reachable' $true "HTTP $($resp.StatusCode)"
} catch {
  if ($_.Exception.Response -ne $null) {
    $code = $_.Exception.Response.StatusCode.value__
    Add-Result 'supabase:host-reachable' $true "reachable (HTTP $code)"
  } else {
    Add-Result 'supabase:host-reachable' $false 'network failure'
  }
}

$projRef = ([uri]$supabaseUrl).Host.Split('.')[0]
$anonPayload = Decode-JwtPayload $env:NEXT_PUBLIC_SUPABASE_ANON_KEY
$servicePayload = Decode-JwtPayload $env:SUPABASE_SERVICE_ROLE_KEY

if ($null -ne $anonPayload) {
  Add-Result 'supabase:anon-role' ($anonPayload.role -eq 'anon') "role=$($anonPayload.role)"
  Add-Result 'supabase:anon-ref' ($anonPayload.ref -eq $projRef) "ref=$($anonPayload.ref), expected=$projRef"
} else {
  Add-Result 'supabase:anon-jwt' $false 'cannot decode'
}

if ($null -ne $servicePayload) {
  Add-Result 'supabase:service-role' ($servicePayload.role -eq 'service_role') "role=$($servicePayload.role)"
  Add-Result 'supabase:service-ref' ($servicePayload.ref -eq $projRef) "ref=$($servicePayload.ref), expected=$projRef"
} else {
  Add-Result 'supabase:service-jwt' $false 'cannot decode'
}

try {
  $headersAnon = @{ apikey = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY; Authorization = "Bearer $($env:NEXT_PUBLIC_SUPABASE_ANON_KEY)" }
  $resp = Invoke-WebRequest -Uri "$supabaseUrl/rest/v1/categories?select=id&limit=1" -Headers $headersAnon -Method GET -TimeoutSec 20
  Add-Result 'supabase:rest-anon-categories' ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) "HTTP $($resp.StatusCode)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Add-Result 'supabase:rest-anon-categories' $false "HTTP $code"
}

try {
  $headersServiceProbe = @{ apikey = $env:SUPABASE_SERVICE_ROLE_KEY; Authorization = "Bearer $($env:SUPABASE_SERVICE_ROLE_KEY)" }
  $resp = Invoke-WebRequest -Uri "$supabaseUrl/rest/v1/categories?select=id&limit=1" -Headers $headersServiceProbe -Method GET -TimeoutSec 20
  Add-Result 'supabase:rest-service-categories' ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) "HTTP $($resp.StatusCode)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Add-Result 'supabase:rest-service-categories' $false "HTTP $code"
}

try {
  $headersService = @{ apikey = $env:SUPABASE_SERVICE_ROLE_KEY; Authorization = "Bearer $($env:SUPABASE_SERVICE_ROLE_KEY)" }
  $buckets = Invoke-RestMethod -Uri "$supabaseUrl/storage/v1/bucket" -Headers $headersService -Method GET -TimeoutSec 20
  Add-Result 'supabase:storage-service' $true 'bucket list fetched'

  $bucketNames = @($buckets | ForEach-Object { $_.name })
  Add-Result 'supabase:bucket-candidate-cv' ($bucketNames -contains $env:SUPABASE_STORAGE_CV_BUCKET) "expected=$($env:SUPABASE_STORAGE_CV_BUCKET)"
  Add-Result 'supabase:bucket-company-media' ($bucketNames -contains $env:SUPABASE_STORAGE_COMPANY_MEDIA_BUCKET) "expected=$($env:SUPABASE_STORAGE_COMPANY_MEDIA_BUCKET)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Add-Result 'supabase:storage-service' $false "HTTP $code"
}

try {
  $dbUri = [uri]$env:SUPABASE_DB_URL
  $tcpOk = Test-NetConnection -ComputerName $dbUri.Host -Port $dbUri.Port -InformationLevel Quiet
  Add-Result 'supabase:db-tcp' $tcpOk "$($dbUri.Host):$($dbUri.Port)"
} catch {
  Add-Result 'supabase:db-tcp' $false 'cannot parse SUPABASE_DB_URL'
}

try {
  $resendHeaders = @{ Authorization = "Bearer $($env:RESEND_API_KEY)" }
  $resp = Invoke-WebRequest -Uri 'https://api.resend.com/domains' -Headers $resendHeaders -Method GET -TimeoutSec 20
  Add-Result 'resend:domains' ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) "HTTP $($resp.StatusCode)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Add-Result 'resend:domains' $false "HTTP $code"
}

try {
  $nmBase = $env:NOMINATIM_BASE_URL.TrimEnd('/')
  $nmHeaders = @{ 'User-Agent' = $env:NOMINATIM_USER_AGENT }
  $resp = Invoke-WebRequest -Uri "$nmBase/search?q=Casablanca&format=json&limit=1" -Headers $nmHeaders -Method GET -TimeoutSec 20
  Add-Result 'nominatim:search' ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) "HTTP $($resp.StatusCode)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Add-Result 'nominatim:search' $false "HTTP $code"
}

$results | ConvertTo-Json -Depth 4
