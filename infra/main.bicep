targetScope = 'resourceGroup'

@description('Suffix used to compose resource names within rgRoomSense')
param nameSuffix string = ''
@description('Azure region')
param location string = 'westeurope'
@description('Comma-separated CORS origins (SWA + localhost)')
param corsOrigins string = 'https://mango-coast-0abcdef1.westeurope.2.azurestaticapps.net,http://localhost:5173'
@description('Deploy the Static Web App? SWA create requires a GitHub repo link + repositoryToken (PAT) — set false to stand up the API infra only and create/link the SWA separately.')
param deploySwa bool = true
@description('GitHub repo URL for the SWA link (required when deploySwa=true)')
param swaRepositoryUrl string = ''
@description('GitHub PAT with repo scope, for the SWA repo link (required when deploySwa=true). Pass via a secure parameter; not stored in outputs.')
@secure()
param swaRepositoryToken string = ''

// Confirm the resource group name before deploying. The deployment target is
// rgRoomSense — create it first (az group create -n rgRoomSense -l westeurope), then
// deploy with --resource-group rgRoomSense. The template does not create the RG.
var base = 'roomsense${nameSuffix}'

module storage 'modules/storage.bicep' = {
  name: '${base}-storage'
  params: {
    storageName: '${replace(base, '-', '')}storage'
    location: location
  }
}

module appInsights 'modules/app-insights.bicep' = {
  name: '${base}-appi'
  params: {
    aiName: '${base}-appi'
    location: location
  }
}

// Existing reference to the storage account — used to compute connection string at deploy scope
// (not via module output) to avoid leaking keys to RG Readers via deployment history.
resource storageExisting 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: '${replace(base, '-', '')}storage'
}

// Compute Tables connection string at deploy scope to avoid leaking keys via module outputs
var storageAccountName = '${replace(base, '-', '')}storage'
var tablesConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${storageExisting.listKeys().keys[0].value};EndpointSuffix=core.windows.net'

module functions 'modules/functions.bicep' = {
  name: '${base}-api'
  params: {
    appName: '${base}-api'
    location: location
    storageAccountName: storageAccountName
    corsOrigins: corsOrigins
    appInsightsConnectionString: appInsights.outputs.connectionString
    tablesConnectionString: tablesConnectionString
  }
}

// NOTE: Flex Consumption required "Storage Blob Data Contributor" role assignment for
// identity-based storage access. Consumption (Y1/Dynamic) plan uses connection strings
// (AzureWebJobsStorage with AccountKey), so this role assignment is no longer needed.
// The managed identity is still created on the function app for potential future use
// (e.g., Key Vault references), but storage access is via connection string.

module swa 'modules/swa.bicep' = if (deploySwa) {
  name: '${base}-swa'
  params: {
    swaName: '${base}-swa'
    location: location
    repositoryUrl: swaRepositoryUrl
    repositoryToken: swaRepositoryToken
  }
}

output swaHostname string = deploySwa ? swa.outputs.defaultHostname : ''
output apiHostname string = functions.outputs.defaultHostName
output storageAccountName string = storage.outputs.storageAccountName
