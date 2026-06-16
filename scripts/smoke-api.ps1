param(
  [string]$ApiUrl = "http://127.0.0.1:8000",
  [string]$FrontendOrigin = "http://127.0.0.1:3000",
  [switch]$IncludeSubmit
)

$ErrorActionPreference = "Stop"

function Invoke-SmokeRequest {
  param(
    [string]$Name,
    [string]$Uri,
    [string]$Method = "GET",
    [hashtable]$Headers = @{},
    [string]$Body = $null,
    [int[]]$ExpectedStatus = @(200)
  )

  try {
    $response = Invoke-WebRequest `
      -Uri $Uri `
      -Method $Method `
      -Headers $Headers `
      -Body $Body `
      -ContentType "application/json" `
      -UseBasicParsing

    if ($ExpectedStatus -notcontains [int]$response.StatusCode) {
      throw "Expected status $($ExpectedStatus -join ', '), got $($response.StatusCode)."
    }

    Write-Host "[OK] $Name ($($response.StatusCode))"
    return $response
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -and $ExpectedStatus -contains [int]$statusCode) {
      Write-Host "[OK] $Name ($statusCode)"
      return $_.Exception.Response
    }

    Write-Error "[FAIL] $Name - $($_.Exception.Message)"
  }
}

$baseUrl = $ApiUrl.TrimEnd("/")

Invoke-SmokeRequest `
  -Name "Health" `
  -Uri "$baseUrl/api/health" | Out-Null

$demo = Invoke-SmokeRequest `
  -Name "Demo workflow" `
  -Uri "$baseUrl/api/workflows/demo"

$workflow = $demo.Content | ConvertFrom-Json
$payload = @{
  definition = $workflow.definition
  layout = $workflow.layout
} | ConvertTo-Json -Depth 50

$validation = Invoke-SmokeRequest `
  -Name "Workflow validation" `
  -Uri "$baseUrl/api/workflows/$($workflow.id)/validate" `
  -Method "POST" `
  -Body $payload

$validationResult = $validation.Content | ConvertFrom-Json
if ($validationResult.valid -ne $true) {
  throw "Demo workflow validation returned invalid."
}

$cors = Invoke-SmokeRequest `
  -Name "CORS preflight" `
  -Uri "$baseUrl/api/workflows/validate" `
  -Method "OPTIONS" `
  -Headers @{
    Origin = $FrontendOrigin
    "Access-Control-Request-Method" = "POST"
  } `
  -ExpectedStatus @(200, 204)

$allowedOrigin = $cors.Headers["Access-Control-Allow-Origin"]
if ($allowedOrigin -and $allowedOrigin -ne "*" -and $allowedOrigin -ne $FrontendOrigin) {
  throw "CORS preflight allowed origin '$allowedOrigin' instead of '$FrontendOrigin'."
}

if ($IncludeSubmit) {
  $submission = Invoke-SmokeRequest `
    -Name "Mock submission" `
    -Uri "$baseUrl/api/workflows/$($workflow.id)/submit" `
    -Method "POST" `
    -Body $payload

  $submissionResult = $submission.Content | ConvertFrom-Json
  if ($submissionResult.status -ne "mocked_success") {
    throw "Mock submission returned status '$($submissionResult.status)'."
  }
}

Write-Host "Smoke API checks completed."
