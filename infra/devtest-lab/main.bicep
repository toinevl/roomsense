// Azure DevTest Labs - cost control demo (West Europe, standalone network).
// Deployed at resource-group scope; the resource group is created by scripts/bootstrap.ps1.

targetScope = 'resourceGroup'

@description('Region for all resources.')
param location string = resourceGroup().location

@description('Name of the DevTest Lab.')
param labName string = 'dtl-costdemo-weu'

@description('Recipient for shutdown, lab-cost and budget notifications.')
param notificationEmail string

@description('Owner tag value (person or team responsible for the demo).')
param owner string

@description('Source allowed to reach the lab VMs on SSH. "Internet" is the only entry point; use a CIDR to narrow it.')
param allowedSourceAddressPrefix string = 'Internet'

@description('Monthly lab target cost, in the billing currency of the subscription.')
@minValue(1)
param monthlyTargetCost int = 50

@description('Maximum number of VMs in the whole lab.')
param maxVmsPerLab int = 3

@description('Maximum number of VMs per lab user.')
param maxVmsPerUser int = 1

@description('VM sizes users may pick. Everything else is blocked by lab policy.')
param allowedVmSizes array = [
  'Standard_B1s'
  'Standard_B2s'
]

@description('Daily auto-shutdown time, HHmm (24h), in the time zone below.')
param shutdownTime string = '1900'

@description('Windows time zone ID used for the shutdown schedule.')
param shutdownTimeZone string = 'W. Europe Standard Time'

@description('Create the sample VM. Needs sshPublicKey.')
param deployDemoVm bool = true

@description('SSH public key for the sample VM (public half only).')
param sshPublicKey string = ''

@description('Days until the sample VM expires and is deleted by the lab.')
@minValue(1)
param demoVmExpiryDays int = 7

@description('Do not set: evaluated at deployment time.')
param now string = utcNow()

@description('Do not set: first day of the current month, used as budget/cost cycle start.')
param monthStart string = utcNow('yyyy-MM-01')

var tags = {
  purpose: 'devtest-labs-cost-demo'
  owner: owner
  managedBy: 'github-actions'
}

var vnetName = 'vnet-${labName}'
var nsgName = 'nsg-${labName}'
var subnetName = 'snet-lab'
var cycleStart = '${monthStart}T00:00:00Z'
var cycleEnd = dateTimeAdd(cycleStart, 'P1M')

// ---------------------------------------------------------------- network
// Standalone: no peering, no gateways, no service endpoints. Internet is the only way in.

resource nsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: nsgName
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'Allow-SSH-From-Source'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: allowedSourceAddressPrefix
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '22'
        }
      }
      {
        name: 'Deny-All-Inbound'
        properties: {
          priority: 4096
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.20.0.0/16'
      ]
    }
    subnets: [
      {
        name: subnetName
        properties: {
          addressPrefix: '10.20.1.0/24'
          networkSecurityGroup: {
            id: nsg.id
          }
        }
      }
    ]
  }
}

// ---------------------------------------------------------------- lab

resource lab 'Microsoft.DevTestLab/labs@2018-09-15' = {
  name: labName
  location: location
  tags: tags
  properties: {
    labStorageType: 'Standard' // HDD-backed, cheapest
    premiumDataDisks: 'Disabled'
  }
}

resource labVnet 'Microsoft.DevTestLab/labs/virtualnetworks@2018-09-15' = {
  parent: lab
  name: vnetName
  properties: {
    description: 'Standalone demo network'
    externalProviderResourceId: vnet.id
    subnetOverrides: [
      {
        labSubnetName: subnetName
        resourceId: '${vnet.id}/subnets/${subnetName}'
        useInVmCreationPermission: 'Allow'
        usePublicIpAddressPermission: 'Allow'
        // One shared public IP for all VMs in the subnet instead of one per VM.
        sharedPublicIpAddressConfiguration: {
          allowedPorts: [
            {
              transportProtocol: 'Tcp'
              backendPort: 22
            }
          ]
        }
      }
    ]
  }
}

// ---------------------------------------------------------------- cost control: policies

resource policySet 'Microsoft.DevTestLab/labs/policySets@2018-09-15' existing = {
  parent: lab
  name: 'default'
}

var policies = [
  {
    name: 'LabVmCount'
    description: 'Cap total VMs in the lab'
    evaluatorType: 'MaxValuePolicy'
    threshold: string(maxVmsPerLab)
  }
  {
    name: 'UserOwnedLabVmCount'
    description: 'Cap VMs per user'
    evaluatorType: 'MaxValuePolicy'
    threshold: string(maxVmsPerUser)
  }
  {
    name: 'LabPremiumVmCount'
    description: 'No premium (SSD) VMs in the lab'
    evaluatorType: 'MaxValuePolicy'
    threshold: '0'
  }
  {
    name: 'UserOwnedLabPremiumVmCount'
    description: 'No premium (SSD) VMs per user'
    evaluatorType: 'MaxValuePolicy'
    threshold: '0'
  }
  {
    name: 'LabVmSize'
    description: 'Only small, cheap VM sizes'
    evaluatorType: 'AllowedValuesPolicy'
    threshold: string(allowedVmSizes)
  }
]

resource labPolicies 'Microsoft.DevTestLab/labs/policySets/policies@2018-09-15' = [
  for p in policies: {
    parent: policySet
    name: p.name
    properties: {
      description: p.description
      evaluatorType: p.evaluatorType
      factName: p.name
      factData: ''
      status: 'Enabled'
      threshold: p.threshold
    }
  }
]

// ---------------------------------------------------------------- cost control: auto-shutdown

resource shutdown 'Microsoft.DevTestLab/labs/schedules@2018-09-15' = {
  parent: lab
  name: 'LabVmsShutdown'
  tags: tags
  properties: {
    status: 'Enabled'
    taskType: 'LabVmsShutdownTask'
    timeZoneId: shutdownTimeZone
    dailyRecurrence: {
      time: shutdownTime
    }
    notificationSettings: {
      status: 'Enabled'
      timeInMinutes: 30
      emailRecipient: notificationEmail
      notificationLocale: 'en'
    }
  }
}

// ---------------------------------------------------------------- cost control: target cost + alerts

resource costChannel 'Microsoft.DevTestLab/labs/notificationchannels@2018-09-15' = {
  parent: lab
  name: 'costThreshold'
  tags: tags
  properties: {
    description: 'Lab cost threshold alerts'
    emailRecipient: notificationEmail
    notificationLocale: 'en'
    events: [
      {
        eventName: 'Cost'
      }
    ]
  }
}

resource targetCost 'Microsoft.DevTestLab/labs/costs@2018-09-15' = {
  parent: lab
  name: 'targetCost'
  tags: tags
  properties: {
    targetCost: {
      status: 'Enabled'
      target: monthlyTargetCost
      cycleType: 'CalendarMonth'
      cycleStartDateTime: cycleStart
      cycleEndDateTime: cycleEnd
      costThresholds: [
        for pct in [50, 75, 100, 125]: {
          thresholdId: guid(lab.id, 'threshold', string(pct))
          displayOnChart: 'Enabled'
          sendNotificationWhenExceeded: 'Enabled'
          percentageThreshold: {
            thresholdValue: pct
          }
        }
      ]
    }
  }
  dependsOn: [
    costChannel
  ]
}

// ---------------------------------------------------------------- cost control: Azure budget on the RG
// Backstop outside the lab: also covers the network and any lab-managed resources.

resource budget 'Microsoft.Consumption/budgets@2023-05-01' = {
  name: 'budget-${labName}'
  properties: {
    category: 'Cost'
    amount: monthlyTargetCost
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: cycleStart
    }
    notifications: {
      actual80: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        thresholdType: 'Actual'
        contactEmails: [
          notificationEmail
        ]
      }
      actual100: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Actual'
        contactEmails: [
          notificationEmail
        ]
      }
      forecast100: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: [
          notificationEmail
        ]
      }
    }
  }
}

// ---------------------------------------------------------------- sample VM (expires automatically)

resource demoVm 'Microsoft.DevTestLab/labs/virtualmachines@2018-09-15' = if (deployDemoVm && !empty(sshPublicKey)) {
  parent: lab
  name: 'vm-demo-01'
  location: location
  tags: tags
  properties: {
    size: 'Standard_B1s'
    userName: 'labadmin'
    isAuthenticationWithSshKey: true
    sshKey: sshPublicKey
    storageType: 'Standard'
    allowClaim: false
    disallowPublicIpAddress: true // use the subnet's shared public IP
    labVirtualNetworkId: labVnet.id
    labSubnetName: subnetName
    expirationDate: dateTimeAdd(now, 'P${demoVmExpiryDays}D')
    notes: 'Cost demo VM. Expires automatically.'
    galleryImageReference: {
      publisher: 'Canonical'
      offer: '0001-com-ubuntu-server-jammy'
      sku: '22_04-lts-gen2'
      osType: 'Linux'
      version: 'latest'
    }
    networkInterface: {
      sharedPublicIpAddressConfiguration: {
        inboundNatRules: [
          {
            transportProtocol: 'Tcp'
            backendPort: 22
          }
        ]
      }
    }
  }
  dependsOn: [
    labPolicies
    shutdown
  ]
}

output labName string = lab.name
output labId string = lab.id
output vnetId string = vnet.id
