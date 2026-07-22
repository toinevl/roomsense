param appName string
param location string
@description('Storage account name — the key is resolved here via listKeys() so it never flows through a module output / deployment history')
param storageAccountName string
@description('Comma-separated CORS origins (SWA + localhost) — set as ALLOWED_ORIGINS for function-level CORS AND on the platform CORS config')
param corsOrigins string
@description('Application Insights connection string — the Functions runtime auto-detects this and streams host/worker logs + exceptions.')
param appInsightsConnectionString string
@description('Azure Tables connection string for the roomsense data tables (Rooms, SensorReadings, OccupancySnapshots, Reservations, Sources)')
param tablesConnectionString string

// Existing reference to the storage account created by the storage module.
// We resolve the primary key here, at the functions module's deploy scope,
// so the key is used only in this module's app-settings resource and never
// returned as a module output or recorded in the parent deployment's outputs.
resource storageExisting 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

// Consumption (Dynamic/Y1) plan — platform-managed per region. We reference the
// shared WestEuropeLinuxDynamicPlan that az functionapp create --consumption-plan-location
// auto-provisions. Using a dedicated plan name would create a separate plan, which
// works but is unnecessary for a single function app.
// IMPORTANT: do NOT use Flex Consumption (FC1) — its Kestrel front-end short-circuits
// browser CORS preflights (OPTIONS) with an empty 204 before function code runs.
// See wishlist.md #29 and #39 for the full root-cause analysis.
resource functionPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${location}LinuxDynamicPlan'
  location: location
  sku: { name: 'Y1', tier: 'Dynamic' }
  properties: { reserved: true, targetWorkerSizeId: 0 }
  kind: 'functionapp'
}

resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: functionPlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|22'
      use32BitWorkerProcess: false
      alwaysOn: false
      cors: {
        allowedOrigins: split(corsOrigins, ',')
        supportCredentials: false
      }
    }
  }
}

// Enable SCM basic auth publishing credentials — required by the func CLI
// deploy path and some deployment tooling. Can be tightened (allow=false)
// once OIDC deploy is confirmed stable on Consumption.
resource scmBasicAuth 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2023-12-01' = {
  name: 'scm'
  parent: app
  properties: {
    allow: true
  }
}

resource appSettings 'Microsoft.Web/sites/config@2023-12-01' = {
  name: 'appsettings'
  parent: app
  properties: {
    // Consumption plan uses AzureWebJobsStorage as a connection string (not
    // identity-based like Flex Consumption). This is the runtime trigger/binding
    // storage — separate from the data tables connection string below.
    AzureWebJobsStorage: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${storageExisting.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
    TABLES_CONNECTION_STRING: tablesConnectionString
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsightsConnectionString
    ApplicationInsightsAgent_EXTENSION_VERSION: '~3'
    XDT_MicrosoftApplicationInsights_Mode: 'recommended'
    ALLOWED_ORIGINS: corsOrigins
    FUNCTIONS_EXTENSION_VERSION: '~4'
    FUNCTIONS_WORKER_RUNTIME: 'node'
    WEBSITE_NODE_DEFAULT_VERSION: '~22'
  }
}

output principalId string = app.identity.principalId
output defaultHostName string = app.properties.defaultHostName
