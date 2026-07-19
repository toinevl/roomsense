#!/usr/bin/env bash
# One-time setup: GitHub OIDC deploy identity for roomsense.
#
# Supersedes create_sp.sh, which was never successfully run — it hardcoded
# subscription e42b6bd5-... which does not exist in this tenant. rgRoomSense
# actually lives in the Visual Studio Enterprise subscription below (verified
# 2026-07-19 via `az account show` + `az group exists`). No SP had any role
# assignment on rgRoomSense, which is why the OIDC deploy path never worked
# and the publish-profile detour happened (dead end: Flex Consumption has no
# Kudu/SCM, so publish-profile deploys get "Empty reply from server").
#
# Run from the repo root. Requires: az login (tenant admin enough to create
# an app registration), gh auth.
set -euo pipefail

SUB="2dbeb3f1-e45d-4207-a7e9-185330aad74b" # Visual Studio Enterprise — holds rgRoomSense

APP_ID=$(az ad app list --filter "displayName eq 'roomsense-github-deploy'" --query "[0].appId" -o tsv)
if [ -z "$APP_ID" ]; then
  APP_ID=$(az ad app create --display-name roomsense-github-deploy --query appId -o tsv)
  az ad sp create --id "$APP_ID" >/dev/null
  echo "Created app roomsense-github-deploy ($APP_ID)"
else
  echo "App roomsense-github-deploy exists ($APP_ID)"
fi

# Covers both push and workflow_dispatch on main (same ref-based subject).
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "roomsense-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:toinevl/roomsense:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}' --query name -o tsv || echo "(federated credential may already exist — fine)"

az role assignment create --assignee "$APP_ID" --role Contributor \
  --scope "/subscriptions/$SUB/resourceGroups/rgRoomSense" --query roleDefinitionName -o tsv \
  || echo "(role assignment may already exist — fine)"

gh secret set AZURE_CLIENT_ID --body "$APP_ID"
gh secret set AZURE_TENANT_ID --body "$(az account show --query tenantId -o tsv)"
gh secret set AZURE_SUBSCRIPTION_ID --body "$SUB"
gh variable set DEPLOY_MODE --body oidc

echo "Done. Now: gh workflow run deploy-api.yml && gh run watch --exit-status"
