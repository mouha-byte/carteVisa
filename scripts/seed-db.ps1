$ErrorActionPreference = 'Stop'

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

function Assert-Env {
  param([string[]]$Keys)
  $missing = @()
  foreach ($k in $Keys) {
    $v = [Environment]::GetEnvironmentVariable($k, 'Process')
    if ([string]::IsNullOrWhiteSpace($v)) {
      $missing += $k
    }
  }

  if ($missing.Count -gt 0) {
    throw "Missing required env vars: $($missing -join ', ')"
  }
}

function Invoke-SupabaseRest {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null,
    [string]$OnConflict = $null,
    [string]$Prefer = 'return=representation'
  )

  $uri = "$script:SupabaseUrl/rest/v1/$Path"
  if (-not [string]::IsNullOrWhiteSpace($OnConflict)) {
    $sep = if ($uri.Contains('?')) { '&' } else { '?' }
    $uri = "$uri$sep" + 'on_conflict=' + [uri]::EscapeDataString($OnConflict)
  }

  $headers = @{
    apikey = $script:ServiceKey
    Authorization = "Bearer $($script:ServiceKey)"
  }

  if (-not [string]::IsNullOrWhiteSpace($Prefer)) {
    $headers['Prefer'] = $Prefer
  }

  if ($Method -ne 'GET' -and $Method -ne 'HEAD' -and $Method -ne 'DELETE') {
    $headers['Content-Type'] = 'application/json'
  }

  if ($null -ne $Body) {
    $json = $Body | ConvertTo-Json -Depth 20
    return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body $json -TimeoutSec 60
  }

  return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -TimeoutSec 60
}

function Invoke-AuthAdmin {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null
  )

  $uri = "$script:SupabaseUrl/auth/v1/$Path"
  $headers = @{
    apikey = $script:ServiceKey
    Authorization = "Bearer $($script:ServiceKey)"
  }

  if ($Method -ne 'GET' -and $Method -ne 'HEAD' -and $Method -ne 'DELETE') {
    $headers['Content-Type'] = 'application/json'
  }

  if ($null -ne $Body) {
    $json = $Body | ConvertTo-Json -Depth 20
    return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body $json -TimeoutSec 60
  }

  return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -TimeoutSec 60
}

function Get-OrCreate-AuthUser {
  param(
    [string]$Email,
    [string]$Password,
    [string]$FullName
  )

  $usersResponse = Invoke-AuthAdmin -Method 'GET' -Path 'admin/users?page=1&per_page=1000'
  $users = @()
  if ($null -ne $usersResponse.users) {
    $users = @($usersResponse.users)
  }

  $existing = $users | Where-Object { $_.email -ieq $Email } | Select-Object -First 1
  if ($null -ne $existing) {
    return [PSCustomObject]@{ id = $existing.id; email = $existing.email; created = $false }
  }

  $payload = @{
    email = $Email
    password = $Password
    email_confirm = $true
    user_metadata = @{ full_name = $FullName }
  }

  $created = Invoke-AuthAdmin -Method 'POST' -Path 'admin/users' -Body $payload
  $createdUser = if ($null -ne $created.user) { $created.user } else { $created }

  return [PSCustomObject]@{ id = $createdUser.id; email = $createdUser.email; created = $true }
}

function Ensure-JobOffer {
  param(
    [string]$CompanyId,
    [string]$Title,
    [string]$Description,
    [string]$City,
    [string]$ContractType,
    [string]$CreatedBy,
    [string]$Status = 'published'
  )

  $encodedTitle = [uri]::EscapeDataString($Title)
  $existing = Invoke-SupabaseRest -Method 'GET' -Path "job_offers?select=id,title&company_id=eq.$CompanyId&title=eq.$encodedTitle"
  if ($existing.Count -gt 0) {
    return [PSCustomObject]@{ id = $existing[0].id; created = $false }
  }

  $payload = @{
    company_id = $CompanyId
    title = $Title
    description = $Description
    contract_type = $ContractType
    location_city = $City
    status = $Status
    published_at = (Get-Date).ToUniversalTime().ToString('o')
    created_by = $CreatedBy
  }

  $inserted = Invoke-SupabaseRest -Method 'POST' -Path 'job_offers' -Body @($payload) -Prefer 'return=representation'
  return [PSCustomObject]@{ id = $inserted[0].id; created = $true }
}

function Ensure-CompanyService {
  param(
    [string]$CompanyId,
    [string]$Title,
    [string]$Description,
    [string]$PriceLabel
  )

  $encodedTitle = [uri]::EscapeDataString($Title)
  $existing = Invoke-SupabaseRest -Method 'GET' -Path "company_services?select=id,title&company_id=eq.$CompanyId&title=eq.$encodedTitle"
  if ($existing.Count -gt 0) {
    return $false
  }

  $payload = @{
    company_id = $CompanyId
    title = $Title
    description = $Description
    price_label = $PriceLabel
    is_active = $true
  }
  Invoke-SupabaseRest -Method 'POST' -Path 'company_services' -Body @($payload) -Prefer 'return=minimal' | Out-Null
  return $true
}

function Ensure-CompanyNews {
  param(
    [string]$CompanyId,
    [string]$Title,
    [string]$Content,
    [string]$ImageUrl = $null
  )

  $encodedTitle = [uri]::EscapeDataString($Title)
  $existing = Invoke-SupabaseRest -Method 'GET' -Path "company_news?select=id,title&company_id=eq.$CompanyId&title=eq.$encodedTitle"
  if ($existing.Count -gt 0) {
    return $false
  }

  $payload = @{
    company_id = $CompanyId
    title = $Title
    content = $Content
    image_url = $ImageUrl
    is_published = $true
    published_at = (Get-Date).ToUniversalTime().ToString('o')
  }
  Invoke-SupabaseRest -Method 'POST' -Path 'company_news' -Body @($payload) -Prefer 'return=minimal' | Out-Null
  return $true
}

function Ensure-Application {
  param(
    [string]$JobOfferId,
    [string]$CompanyId,
    [string]$CandidateEmail,
    [string]$CandidateName,
    [string]$CandidatePhone,
    [string]$CvPath
  )

  $encodedEmail = [uri]::EscapeDataString($CandidateEmail)
  $existing = Invoke-SupabaseRest -Method 'GET' -Path "applications?select=id,candidate_email&job_offer_id=eq.$JobOfferId&candidate_email=eq.$encodedEmail"
  if ($existing.Count -gt 0) {
    return $false
  }

  $payload = @{
    job_offer_id = $JobOfferId
    company_id = $CompanyId
    candidate_name = $CandidateName
    candidate_email = $CandidateEmail
    candidate_phone = $CandidatePhone
    cover_letter = 'I am interested in this role and available immediately.'
    cv_path = $CvPath
    cv_file_name = 'demo-cv.pdf'
    status = 'pending'
  }

  Invoke-SupabaseRest -Method 'POST' -Path 'applications' -Body @($payload) -Prefer 'return=minimal' | Out-Null
  return $true
}

Load-EnvFile '.env.local'
Assert-Env -Keys @('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY')

$script:SupabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL.TrimEnd('/')
$script:ServiceKey = $env:SUPABASE_SERVICE_ROLE_KEY

$summary = [ordered]@{
  users_created = 0
  users_existing = 0
  categories_upserted = 0
  companies_upserted = 0
  profiles_upserted = 0
  company_categories_upserted = 0
  jobs_created = 0
  jobs_existing = 0
  services_created = 0
  news_created = 0
  applications_created = 0
  ad_campaigns_created = 0
  contact_messages_created = 0
  website_requests_created = 0
}

# 1) Create or get seed auth users
$seedUsers = @(
  @{ email = 'seed.admin@cartevisite.app'; password = 'SeedAdmin#2026!'; full_name = 'Seed Super Admin' },
  @{ email = 'seed.atlas@cartevisite.app'; password = 'SeedAtlas#2026!'; full_name = 'Seed Atlas Owner' },
  @{ email = 'seed.health@cartevisite.app'; password = 'SeedHealth#2026!'; full_name = 'Seed Health Owner' },
  @{ email = 'seed.finance@cartevisite.app'; password = 'SeedFinance#2026!'; full_name = 'Seed Finance Owner' },
  @{ email = 'seed.edu@cartevisite.app'; password = 'SeedEdu#2026!'; full_name = 'Seed Education Owner' },
  @{ email = 'seed.retail@cartevisite.app'; password = 'SeedRetail#2026!'; full_name = 'Seed Retail Owner' },
  @{ email = 'seed.industrie@cartevisite.app'; password = 'SeedIndustrie#2026!'; full_name = 'Seed Industrie Owner' }
)

$userMap = @{}
$userFullNameByEmail = @{}
foreach ($u in $seedUsers) {
  $res = Get-OrCreate-AuthUser -Email $u.email -Password $u.password -FullName $u.full_name
  $userMap[$u.email] = $res
  $userFullNameByEmail[$u.email] = $u.full_name
  if ($res.created) { $summary.users_created++ } else { $summary.users_existing++ }
}

# 2) Upsert categories
$categories = @(
  @{ name = 'Technologie'; slug = 'technologie'; is_active = $true },
  @{ name = 'Sante'; slug = 'sante'; is_active = $true },
  @{ name = 'Education'; slug = 'education'; is_active = $true },
  @{ name = 'Finance'; slug = 'finance'; is_active = $true },
  @{ name = 'Commerce'; slug = 'commerce'; is_active = $true },
  @{ name = 'Industrie'; slug = 'industrie'; is_active = $true },
  @{ name = 'Marketing'; slug = 'marketing'; is_active = $true }
)
Invoke-SupabaseRest -Method 'POST' -Path 'categories' -Body $categories -OnConflict 'slug' -Prefer 'resolution=merge-duplicates,return=representation' | Out-Null
$summary.categories_upserted = $categories.Count

$categorySlugsCsv = ($categories | ForEach-Object { $_.slug }) -join ','
$categoriesData = Invoke-SupabaseRest -Method 'GET' -Path "categories?select=id,slug&slug=in.($categorySlugsCsv)"
$categoryBySlug = @{}
foreach ($c in $categoriesData) {
  $categoryBySlug[$c.slug] = $c.id
}

# 3) Upsert companies with dominant visual media
$companySeeds = @(
  @{
    owner_email = 'seed.atlas@cartevisite.app'
    name = 'Atlas Tech SARL'
    slug = 'atlas-tech'
    sector = 'Technologie'
    description = 'Software services, IA, integration cloud et transformation digitale pour PME et ETI.'
    address = 'Bd Zerktouni 120'
    city = 'Casablanca'
    country = 'Morocco'
    phone = '+212600000001'
    email = 'contact@atlas-tech.ma'
    website_url = 'https://atlas-tech.example'
    logo_url = 'https://images.unsplash.com/photo-1633419461186-7d40a38105ec?auto=format&fit=crop&w=200&q=80'
    cover_url = 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80'
    status = 'active'
    is_featured = $true
  },
  @{
    owner_email = 'seed.health@cartevisite.app'
    name = 'Maghreb Health Plus'
    slug = 'maghreb-health-plus'
    sector = 'Sante'
    description = 'Reseau de services cliniques et solutions RH specialisees pour les etablissements de sante.'
    address = 'Avenue Hassan II 88'
    city = 'Rabat'
    country = 'Morocco'
    phone = '+212600000002'
    email = 'hello@maghrebhealth.ma'
    website_url = 'https://maghreb-health.example'
    logo_url = 'https://images.unsplash.com/photo-1612277795421-9bc7706a4a41?auto=format&fit=crop&w=200&q=80'
    cover_url = 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1600&q=80'
    status = 'active'
    is_featured = $true
  },
  @{
    owner_email = 'seed.finance@cartevisite.app'
    name = 'Nova Finance Group'
    slug = 'nova-finance-group'
    sector = 'Finance'
    description = 'Conseil financier, pilotage de croissance et solutions de financement des entreprises.'
    address = 'Tour Finance City 14'
    city = 'Casablanca'
    country = 'Morocco'
    phone = '+212600000003'
    email = 'contact@novafinance.ma'
    website_url = 'https://nova-finance.example'
    logo_url = 'https://images.unsplash.com/photo-1556155092-490a1ba16284?auto=format&fit=crop&w=200&q=80'
    cover_url = 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1600&q=80'
    status = 'active'
    is_featured = $false
  },
  @{
    owner_email = 'seed.edu@cartevisite.app'
    name = 'EduBridge Academy'
    slug = 'edubridge-academy'
    sector = 'Education'
    description = 'Formation continue, upskilling digital et academie professionnelle pour talents.'
    address = 'Quartier Agdal 52'
    city = 'Rabat'
    country = 'Morocco'
    phone = '+212600000004'
    email = 'admission@edubridge.ma'
    website_url = 'https://edubridge.example'
    logo_url = 'https://images.unsplash.com/photo-1571260899304-425eee4c7efc?auto=format&fit=crop&w=200&q=80'
    cover_url = 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1600&q=80'
    status = 'active'
    is_featured = $false
  },
  @{
    owner_email = 'seed.retail@cartevisite.app'
    name = 'Urban Retail Hub'
    slug = 'urban-retail-hub'
    sector = 'Commerce'
    description = 'Distribution omni-canal, merchandising et acceleration des ventes en retail.'
    address = 'Zone Ain Sebaa Lot 41'
    city = 'Casablanca'
    country = 'Morocco'
    phone = '+212600000005'
    email = 'sales@urbanretail.ma'
    website_url = 'https://urban-retail.example'
    logo_url = 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=200&q=80'
    cover_url = 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1600&q=80'
    status = 'active'
    is_featured = $false
  },
  @{
    owner_email = 'seed.industrie@cartevisite.app'
    name = 'Atlas Industrie Services'
    slug = 'atlas-industrie-services'
    sector = 'Industrie'
    description = 'Maintenance industrielle, automatisation et support technique 24/7 sur sites de production.'
    address = 'Parc Industriel Bouskoura 7'
    city = 'Bouskoura'
    country = 'Morocco'
    phone = '+212600000006'
    email = 'operations@atlasindustrie.ma'
    website_url = 'https://atlas-industrie.example'
    logo_url = 'https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?auto=format&fit=crop&w=200&q=80'
    cover_url = 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1600&q=80'
    status = 'active'
    is_featured = $false
  }
)

$companies = @()
foreach ($companySeed in $companySeeds) {
  $companies += @{
    owner_user_id = $userMap[$companySeed.owner_email].id
    name = $companySeed.name
    slug = $companySeed.slug
    sector = $companySeed.sector
    description = $companySeed.description
    address = $companySeed.address
    city = $companySeed.city
    country = $companySeed.country
    phone = $companySeed.phone
    email = $companySeed.email
    website_url = $companySeed.website_url
    logo_url = $companySeed.logo_url
    cover_url = $companySeed.cover_url
    status = $companySeed.status
    is_featured = $companySeed.is_featured
  }
}

Invoke-SupabaseRest -Method 'POST' -Path 'companies' -Body $companies -OnConflict 'slug' -Prefer 'resolution=merge-duplicates,return=representation' | Out-Null
$summary.companies_upserted = $companies.Count

$companySlugsCsv = ($companySeeds | ForEach-Object { $_.slug }) -join ','
$companiesData = Invoke-SupabaseRest -Method 'GET' -Path "companies?select=id,slug,name&slug=in.($companySlugsCsv)"
$companyBySlug = @{}
foreach ($c in $companiesData) {
  $companyBySlug[$c.slug] = $c.id
}

# 4) Upsert profiles with roles and company links
$profiles = @(
  @{ id = $userMap['seed.admin@cartevisite.app'].id; role = 'super_admin'; full_name = 'Seed Super Admin'; company_id = $null }
)

foreach ($companySeed in $companySeeds) {
  $ownerEmail = $companySeed.owner_email
  $profiles += @{
    id = $userMap[$ownerEmail].id
    role = 'entreprise'
    full_name = $userFullNameByEmail[$ownerEmail]
    company_id = $companyBySlug[$companySeed.slug]
  }
}

Invoke-SupabaseRest -Method 'POST' -Path 'profiles' -Body $profiles -OnConflict 'id' -Prefer 'resolution=merge-duplicates,return=representation' | Out-Null
$summary.profiles_upserted = $profiles.Count

# 5) Upsert company category assignments
$companyCategorySeeds = @(
  @{ company_slug = 'atlas-tech'; categories = @('technologie', 'marketing') },
  @{ company_slug = 'maghreb-health-plus'; categories = @('sante') },
  @{ company_slug = 'nova-finance-group'; categories = @('finance') },
  @{ company_slug = 'edubridge-academy'; categories = @('education', 'technologie') },
  @{ company_slug = 'urban-retail-hub'; categories = @('commerce', 'marketing') },
  @{ company_slug = 'atlas-industrie-services'; categories = @('industrie') }
)

$companyCategories = @()
foreach ($entry in $companyCategorySeeds) {
  foreach ($categorySlug in $entry.categories) {
    if ($companyBySlug.ContainsKey($entry.company_slug) -and $categoryBySlug.ContainsKey($categorySlug)) {
      $companyCategories += @{
        company_id = $companyBySlug[$entry.company_slug]
        category_id = $categoryBySlug[$categorySlug]
      }
    }
  }
}

Invoke-SupabaseRest -Method 'POST' -Path 'company_categories' -Body $companyCategories -OnConflict 'company_id,category_id' -Prefer 'resolution=merge-duplicates,return=representation' | Out-Null
$summary.company_categories_upserted = $companyCategories.Count

# 6) Ensure job offers
$jobSeeds = @(
  @{ key = 'atlas-dev'; company_slug = 'atlas-tech'; owner_email = 'seed.atlas@cartevisite.app'; title = 'Developpeur Full Stack'; description = 'Build and maintain web features using Next.js and Supabase.'; city = 'Casablanca'; contract_type = 'CDI' },
  @{ key = 'atlas-sales'; company_slug = 'atlas-tech'; owner_email = 'seed.atlas@cartevisite.app'; title = 'Commercial Terrain'; description = 'Develop B2B partnerships and onboard new companies.'; city = 'Casablanca'; contract_type = 'CDI' },
  @{ key = 'health-nurse'; company_slug = 'maghreb-health-plus'; owner_email = 'seed.health@cartevisite.app'; title = 'Infirmier Diplome'; description = 'Provide patient care and support clinic activities.'; city = 'Rabat'; contract_type = 'CDD' },
  @{ key = 'finance-analyst'; company_slug = 'nova-finance-group'; owner_email = 'seed.finance@cartevisite.app'; title = 'Analyste Financier'; description = 'Prepare budgets, projections and investment recommendations.'; city = 'Casablanca'; contract_type = 'CDI' },
  @{ key = 'edu-trainer'; company_slug = 'edubridge-academy'; owner_email = 'seed.edu@cartevisite.app'; title = 'Formateur Digital'; description = 'Deliver practical training in web, IA and data tools.'; city = 'Rabat'; contract_type = 'Freelance' },
  @{ key = 'retail-manager'; company_slug = 'urban-retail-hub'; owner_email = 'seed.retail@cartevisite.app'; title = 'Responsable Magasin'; description = 'Manage retail operations and optimize sales performance.'; city = 'Casablanca'; contract_type = 'CDI' },
  @{ key = 'industry-tech'; company_slug = 'atlas-industrie-services'; owner_email = 'seed.industrie@cartevisite.app'; title = 'Technicien Maintenance'; description = 'Ensure preventive and corrective maintenance on production lines.'; city = 'Bouskoura'; contract_type = 'CDI' }
)

$jobByKey = @{}
foreach ($jobSeed in $jobSeeds) {
  $job = Ensure-JobOffer -CompanyId $companyBySlug[$jobSeed.company_slug] -Title $jobSeed.title -Description $jobSeed.description -City $jobSeed.city -ContractType $jobSeed.contract_type -CreatedBy $userMap[$jobSeed.owner_email].id
  $jobByKey[$jobSeed.key] = $job.id
  if ($job.created) { $summary.jobs_created++ } else { $summary.jobs_existing++ }
}

# 7) Ensure services and news
$serviceSeeds = @(
  @{ company_slug = 'atlas-tech'; title = 'Creation de site web pro'; description = 'Sites corporate, e-commerce et landing pages haute conversion.'; price_label = 'A partir de 2500 MAD' },
  @{ company_slug = 'atlas-tech'; title = 'Automatisation IA'; description = 'Automatisation des flux commerciaux et support client.'; price_label = 'A partir de 1800 MAD' },
  @{ company_slug = 'maghreb-health-plus'; title = 'Gestion RH sante'; description = 'Staffing medical et planification de remplacement.'; price_label = 'Sur devis' },
  @{ company_slug = 'nova-finance-group'; title = 'Audit financier'; description = 'Diagnostic de performance et recommandations strategiques.'; price_label = 'A partir de 3500 MAD' },
  @{ company_slug = 'edubridge-academy'; title = 'Bootcamp employabilite'; description = 'Formation acceleree et accompagnement insertion.'; price_label = 'A partir de 1200 MAD' },
  @{ company_slug = 'urban-retail-hub'; title = 'Accompagnement retail'; description = 'Optimisation du merchandising et parcours client.'; price_label = 'A partir de 2200 MAD' },
  @{ company_slug = 'atlas-industrie-services'; title = 'Maintenance industrielle'; description = 'Intervention preventive et curative 24/7.'; price_label = 'Contrat mensuel' }
)

foreach ($serviceSeed in $serviceSeeds) {
  if (Ensure-CompanyService -CompanyId $companyBySlug[$serviceSeed.company_slug] -Title $serviceSeed.title -Description $serviceSeed.description -PriceLabel $serviceSeed.price_label) {
    $summary.services_created++
  }
}

$newsSeeds = @(
  @{ company_slug = 'atlas-tech'; title = 'Lancement Studio IA 2026'; content = 'Notre studio IA accompagne les PMEs sur la productivite et la relation client.'; image_url = 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1400&q=80' },
  @{ company_slug = 'maghreb-health-plus'; title = 'Nouveau partenariat clinique'; content = 'Deux nouveaux partenaires hospitaliers rejoignent notre reseau national.'; image_url = 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=1400&q=80' },
  @{ company_slug = 'nova-finance-group'; title = 'Pack croissance PME'; content = 'Un nouveau pack de pilotage financier mensuel est disponible.'; image_url = 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1400&q=80' },
  @{ company_slug = 'edubridge-academy'; title = 'Ouverture cohortes printemps'; content = 'Les inscriptions sont ouvertes pour les parcours Data et Web.'; image_url = 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1400&q=80' },
  @{ company_slug = 'urban-retail-hub'; title = 'Catalogue ete disponible'; content = 'Les nouvelles collections et offres partenaires sont en ligne.'; image_url = 'https://images.unsplash.com/photo-1481437156560-3205f6a55735?auto=format&fit=crop&w=1400&q=80' },
  @{ company_slug = 'atlas-industrie-services'; title = 'Extension interventions 24/7'; content = 'Notre cellule d intervention couvre maintenant 6 nouvelles zones industrielles.'; image_url = 'https://images.unsplash.com/photo-1565034946487-077786996e27?auto=format&fit=crop&w=1400&q=80' }
)

foreach ($newsSeed in $newsSeeds) {
  if (Ensure-CompanyNews -CompanyId $companyBySlug[$newsSeed.company_slug] -Title $newsSeed.title -Content $newsSeed.content -ImageUrl $newsSeed.image_url) {
    $summary.news_created++
  }
}

# 8) Ensure one sample application
$cvPath = "company/$($companyBySlug['atlas-tech'])/applications/demo-cv.pdf"
if (Ensure-Application -JobOfferId $jobByKey['atlas-dev'] -CompanyId $companyBySlug['atlas-tech'] -CandidateEmail 'candidate.demo@cartevisite.app' -CandidateName 'Candidate Demo' -CandidatePhone '+212611111111' -CvPath $cvPath) {
  $summary.applications_created++
}

# 9) Upsert platform settings
$platformSettings = @(
  @{ id = 1; youtube_channel_url = 'https://www.youtube.com/@Fireship'; contact_email = 'contact@cartevisite.com' }
)
Invoke-SupabaseRest -Method 'POST' -Path 'platform_settings' -Body $platformSettings -OnConflict 'id' -Prefer 'resolution=merge-duplicates,return=representation' | Out-Null

# 10) Ensure ad campaigns
$campaigns = @(
  @{
    slot = 'primary'
    media_type = 'image'
    media_url = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f'
    target_url = 'https://cartevisite.com/formation'
    is_active = $true
  },
  @{
    slot = 'secondary'
    media_type = 'video'
    media_url = 'https://samplelib.com/lib/preview/mp4/sample-5s.mp4'
    target_url = 'https://cartevisite.com/contact'
    is_active = $true
  }
)

foreach ($c in $campaigns) {
  $encodedUrl = [uri]::EscapeDataString($c.media_url)
  $existing = Invoke-SupabaseRest -Method 'GET' -Path "ad_campaigns?select=id,media_url&media_url=eq.$encodedUrl"
  if ($existing.Count -eq 0) {
    Invoke-SupabaseRest -Method 'POST' -Path 'ad_campaigns' -Body @($c) -Prefer 'return=minimal' | Out-Null
    $summary.ad_campaigns_created++
  }
}

# 11) Ensure one contact message and one website request
$seedContactEmail = [uri]::EscapeDataString('seed.contact@cartevisite.app')
$contactExisting = Invoke-SupabaseRest -Method 'GET' -Path "contact_messages?select=id,email&email=eq.$seedContactEmail"
if ($contactExisting.Count -eq 0) {
  $contactPayload = @{
    full_name = 'Seed Contact'
    email = 'seed.contact@cartevisite.app'
    phone = '+212622222222'
    message = 'Hello, this is a seeded contact message for backend testing.'
  }
  Invoke-SupabaseRest -Method 'POST' -Path 'contact_messages' -Body @($contactPayload) -Prefer 'return=minimal' | Out-Null
  $summary.contact_messages_created++
}

$seedRequestEmail = [uri]::EscapeDataString('seed.request@cartevisite.app')
$requestExisting = Invoke-SupabaseRest -Method 'GET' -Path "website_creation_requests?select=id,email&email=eq.$seedRequestEmail"
if ($requestExisting.Count -eq 0) {
  $requestPayload = @{
    company_name = 'Seed Retail Company'
    sector = 'Commerce'
    contact_name = 'Seed Request'
    email = 'seed.request@cartevisite.app'
    phone = '+212633333333'
    needs = 'Need a company website with catalog and contact form.'
    status = 'new'
  }
  Invoke-SupabaseRest -Method 'POST' -Path 'website_creation_requests' -Body @($requestPayload) -Prefer 'return=minimal' | Out-Null
  $summary.website_requests_created++
}

# 12) Output summary
$summary | ConvertTo-Json -Depth 5
