@description('Name of the storage account (lowercase, alnum)')
param storageName string
param location string

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    publicNetworkAccess: 'Enabled'
  }
}

// Blob container required by Functions Flex Consumption
// (functionAppConfig.deployment.storage). The runtime reads the function package
// from here via the app's system-assigned managed identity.
resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  name: '${storage.name}/default/deployments'
  properties: { publicAccess: 'None' }
}

// Table service with five tables created via seed script (Rooms, SensorReadings,
// OccupancySnapshots, Reservations, Sources). Tables are created at seed time
// via packages/seed/src/upload.ts calling @azure/data-tables batch upserts.
resource tableServices 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  name: 'default'
  parent: storage
  properties: {}
}

output storageAccountName string = storage.name
output storageAccountId string = storage.id
// NOTE: connection string is intentionally NOT exposed as an output to avoid leaking keys
// to RG Readers via deployment history. Callers resolve the key at deploy scope via an
// `existing` reference + listKeys() (see main.bicep for the pattern).
