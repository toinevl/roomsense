param appName string
param location string
@description('Storage account name — the key is resolved here via listKeys() so it never flows through a module output / deployment history')
param storageAccountName string
param corsOrigins string
@description('Application Insights connection string — the Functions runtime auto-detects this and streams host/worker logs + exceptions. Required for Flex Consumption log visibility.')
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

resource functionPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${appName}-plan'
  location: location
  sku: { name: 'FC1', tier: 'FlexConsumption' }
  properties: { reserved: true }
  kind: 'linux'
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
    // Flex Consumption REQUIRES functionAppConfig on create (the legacy
    // siteConfig-only shape is rejected). deploymentStorage is the resourceId
    // of the storage account the runtime uses (accessed via the system-assigned
    // managed identity, NOT a connection string), replacing AzureWebJobsStorage.
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storageExisting.properties.primaryEndpoints.blob}deployments'
          authentication: {
            type: 'SystemAssignedIdentity'
          }
        }
      }
      scaleAndConcurrency: {
        instanceMemoryMB: 2048
        maximumInstanceCount: 100
      }
      runtime: {
        name: 'node'
        version: '20'
      }
    }
    siteConfig: {
      cors: {
        allowedOrigins: split(corsOrigins, ',')
        supportCredentials: true
      }
      scmIpSecurityRestrictions: []
      scmIpSecurityRestrictionsUseMain: false
    }
    httpsOnly: true
  }
}

// Enable SCM basic auth publishing credentials — required by some deployment
// tooling (Azure deployment lessons). This is a separate sub-resource, not a
// SiteConfig property. Can be tightened (allow=false) once OIDC deploy is
// live.
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
    // Flex Consumption uses identity-based runtime storage: functionAppConfig
    // .deployment.storage (blobContainer, SystemAssignedIdentity) hosts the
    // package, and AzureWebJobsStorage__accountName points the triggers/metrics
    // at the same account via the managed identity (no connection string).
    AzureWebJobsStorage__accountName: storageAccountName
    TABLES_CONNECTION_STRING: tablesConnectionString
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsightsConnectionString
    ApplicationInsightsAgent_EXTENSION_VERSION: '~3'
    XDT_MicrosoftApplicationInsights_Mode: 'recommended'
  }
}

output principalId string = app.identity.principalId
output defaultHostName string = app.properties.defaultHostName
