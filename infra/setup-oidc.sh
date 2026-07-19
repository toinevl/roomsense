#!/usr/bin/env bash
set -euo pipefail

RG="rgRoomSense"
SUB="e42b6bd5-a9a0-4c07-8a1b-6b4f12b1d11a"
TENANT="$(az account show --query tenantId -o tsv)"
APP_NAME="RoomSense Deploy"
REPO="toinevl/roomsense"

echo "== tenant: $TENANT"

# 1) Graph token
GRAPH_TOKEN="$(az account get-access-token --resource https://graph.microsoft.com/ --query token -o tsv)"

# 2) Create app registration
APP_JSON="$(curl -sS -X POST \
  -H "Authorization: Bearer $GRAPH_TOKEN" \
  -H "Content-Type: application/json" \
  https://graph.microsoft.com/v1.0/applications \
  -d '{"displayName":"'"$APP_NAME"'","signInAudience":"AzureADMyOrg"}' )"

APP_ID="$(echo "$APP_JSON" | jq -r '.appId')"
OBJ_ID="$(echo "$APP_ID" | sed 's/.//')"
echo "appId: $APP_ID"

# 3) Create service principal from app
SP_JSON="$(curl -sS -X POST \
  -H "Authorization: Bearer $GRAPH_TOKEN" \
  -H "Content-Type: application/json" \
  https://graph.microsoft.com/v1.0/servicePrincipals \
  -d '{"appId":"'"$APP_ID"'"}' )"

SP_ID="$(echo "$SP_JSON" | jq -r '.id')"
echo "servicePrincipal id: $SP_ID"

# 4) Wait for propagation
sleep 5

# 5) Assign Contributor on rg via ARM
ARM_TOKEN="$(az account get-access-token --resource https://management.azure.com/ --query token -o tsv)"
ROLE_DEF_ID="$(az role definition list --name Contributor --query '[0].id' -o tsv)"

GUARD="$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || date +%s)"
ASSIGN_URL="https://management.azure.com/subscriptions/${SUB}/resourceGroups/${RG}/providers/Microsoft.Authorization/roleAssignments/${GUARD}?api-version=2022-04-01"

BODY="$(jq -n \
  --arg roleDef "$ROLE_DEF_ID" \
  --arg principal "$SP_ID" \
  '{properties:{roleDefinitionId:$roleDef,principalId:$principal,principalType:"ServicePrincipal"}}' )"

echo "$BODY" | curl -sS -X PUT \
  -H "Authorization: Bearer $ARM_TOKEN" \
  -H "Content-Type: application/json" \
  "$ASSIGN_URL" -d @- >/tmp/roomsense-roleassign.json

echo "role assignment: $(jq -r '.properties.principalId' /tmp/roomsense-roleassign.json)"

# 6) Export secrets to GH
gh secret set AZURE_CLIENT_ID    -R "$REPO" --body "$APP_ID"
gh secret set AZURE_TENANT_ID    -R "$REPO" --body "$TENANT"
gh secret set AZURE_SUBSCRIPTION_ID -R "$REPO" --body "$SUB"

echo "DONE. Next: rerun deploy workflow."
