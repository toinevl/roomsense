param swaName string
param location string
@description('GitHub repo URL the SWA is linked to (required on create by Microsoft.Web/staticSites)')
param repositoryUrl string
@secure()
@description('GitHub PAT (repo scope) authorizing the SWA repo link')
param repositoryToken string

resource swa 'Microsoft.Web/staticSites@2023-12-01' = {
  name: swaName
  location: location
  sku: { name: 'Free', tier: 'Free' }
  properties: {
    repositoryUrl: repositoryUrl
    branch: 'main'
    repositoryToken: repositoryToken
    buildProperties: {
      appLocation: '/'
      outputLocation: 'dist'
      appArtifactLocation: 'dist'
    }
  }
}

output defaultHostname string = swa.properties.defaultHostname
