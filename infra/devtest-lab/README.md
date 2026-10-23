# DevTest Labs cost-control demo

Wishlist #68. Azure DevTest Labs in West Europe, deployed with Bicep from GitHub Actions to the TU/e `sandbox` environment. Independent of the RoomSense app: own resource group, own teardown. Focus: **keeping lab spend small and predictable**.

## What it shows

| Control | Where | Effect |
|---|---|---|
| Daily auto-shutdown (19:00 W. Europe) + 30 min email warning | `LabVmsShutdown` schedule | No overnight compute cost |
| Max 3 VMs per lab, 1 per user | `LabVmCount`, `UserOwnedLabVmCount` policies | Bounds the worst case |
| Allowed sizes `Standard_B1s`, `Standard_B2s` only | `LabVmSize` policy | No expensive SKUs |
| No premium (SSD) VMs, HDD lab storage | `LabPremiumVmCount` policies, `labStorageType: Standard` | Cheapest disks |
| Lab target cost, alerts at 50/75/100/125 % | `costs/targetCost` + `costThreshold` channel | Chart lines and email |
| Azure budget on the resource group (80 %/100 % actual, 100 % forecast) | `Microsoft.Consumption/budgets` | Backstop outside the lab |
| One shared public IP for all VMs | `sharedPublicIpAddressConfiguration` | No per-VM public IP charge |
| Sample VM expires after 7 days | `expirationDate` | Forgotten VMs delete themselves |
| One-click teardown | `teardown-devtest-lab` workflow | Nothing left behind |

## Network

Standalone VNet `10.20.0.0/16`: no peering, VPN, ExpressRoute or service endpoints. The only way in is the Internet, through the lab's shared public IP on TCP 22. The NSG allows SSH from `DTL_ALLOWED_SOURCE` (default `Internet`) and denies all other inbound traffic. Set `DTL_ALLOWED_SOURCE` to your own CIDR to narrow it.

## Identity

Reuses the existing `sandbox` environment identity (the `roomsense-github-deploy-sandbox` app registration, secrets `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID`). `setup.sh` grants it Contributor on the **new demo resource group only**. This repository is public, so keep every environment-specific value in environment variables or secrets, never in the files.

## Setup (once)

```bash
az login --tenant <tue-tenant-id>
./infra/devtest-lab/setup.sh <sandbox AZURE_CLIENT_ID>

gh variable set DTL_RESOURCE_GROUP   --env sandbox --body rg-dtl-costdemo-weu
gh variable set DTL_NOTIFICATION_EMAIL --env sandbox --body <you@tue.nl>
gh variable set DTL_OWNER            --env sandbox --body <you>
gh variable set DTL_ALLOWED_SOURCE   --env sandbox --body Internet     # or your CIDR
gh variable set DTL_SSH_PUBLIC_KEY   --env sandbox --body "$(cat ~/.ssh/id_ed25519.pub)"   # optional: creates the sample VM
```

## Deploy

`gh workflow run deploy-devtest-lab.yml -f what_if_only=true`, review the output, then rerun with `what_if_only=false`. Verify with `gh run list --workflow=deploy-devtest-lab.yml --limit 1` and `gh run watch <id> --exit-status`.

## Tear down

`gh workflow run teardown-devtest-lab.yml -f confirm=DELETE`. Removes the lab (and its VMs), VNet, NSG and budget; keeps the resource group so it can be redeployed.

## Demo script

1. Lab > Configuration and policies: VM sizes, VM limits, auto-shutdown, target cost.
2. Try to create a large or premium VM: blocked.
3. Try a second VM as the same user: blocked.
4. Show the sample VM's expiry date and its shared-IP SSH command.
5. Show the cost chart with threshold lines and the budget in Cost Management.

## Known caveats

- Written against the published 2018-09-15 API; the first real deployment is the validation. Azure Policy in the tenant may block public IPs, require tags, or forbid Internet-facing NSG rules.
- Re-running the deployment re-submits the sample VM (its expiry is recomputed). If that errors, set `deployDemoVm` to `false` after the first run.
