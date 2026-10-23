#!/usr/bin/env bash
# One-time setup for the DevTest Labs cost demo (wishlist #68).
# Run after `az login` into the TU/e sandbox subscription. Idempotent.
#
# Reuses the existing sandbox deploy identity ("RoomSense Deploy" app registration):
# no new app registration, Contributor only on the NEW demo resource group.
#
#   ./setup.sh <sandbox-AZURE_CLIENT_ID> [resource-group] [location]
set -euo pipefail

CLIENT_ID="${1:?usage: setup.sh <AZURE_CLIENT_ID of the sandbox environment> [rg] [location]}"
RG="${2:-rg-dtl-costdemo-weu}"
LOCATION="${3:-westeurope}"

SUB="$(az account show --query id -o tsv)"
echo "== subscription: $(az account show --query name -o tsv) ($SUB)"
read -r -p "Is this the sandbox subscription the 'sandbox' GitHub environment deploys to? [y/N] " ok
[[ "$ok" == "y" ]] || { echo "aborted"; exit 1; }

for ns in Microsoft.DevTestLab Microsoft.Network Microsoft.Compute Microsoft.Storage Microsoft.Consumption; do
  az provider register --namespace "$ns" >/dev/null
done

az group create --name "$RG" --location "$LOCATION" \
  --tags purpose=devtest-labs-cost-demo managedBy=github-actions >/dev/null
RG_ID="$(az group show --name "$RG" --query id -o tsv)"

SP_ID="$(az ad sp list --filter "appId eq '$CLIENT_ID'" --query "[0].id" -o tsv)"
[[ -n "$SP_ID" ]] || { echo "no service principal for appId $CLIENT_ID in this tenant"; exit 1; }

if [[ "$(az role assignment list --assignee "$SP_ID" --scope "$RG_ID" --role Contributor --query 'length(@)' -o tsv)" == "0" ]]; then
  az role assignment create --assignee-object-id "$SP_ID" --assignee-principal-type ServicePrincipal \
    --role Contributor --scope "$RG_ID" >/dev/null
fi

echo "== done. Resource group: $RG"
echo "Now set the sandbox environment variables (see README.md), then run the deploy-devtest-lab workflow."
