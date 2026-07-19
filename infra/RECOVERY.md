# GitHub Actions → Azure OIDC federation recovery

This document describes the **one-time manual setup** that establishes the OIDC
trust between this GitHub repo and Azure, so the deploy workflows
(`deploy-frontend.yml`, `deploy-api.yml`) can use `azure/login@v2` with
**`client-id`/`tenant-id`/`subscription-id` and no client secret**.

## GitHub OIDC app registration — verified live name

The Azure AD **application registration** that backs OIDC login is **NOT** created
by Bicep (it is tenant-rooted and would require tenant-level permissions).
Instead, it must be created once via Azure CLI and referenced by its verified
live **application (client) ID** in GitHub Actions secrets.

**TODO:** Verify the actual app registration name in the live tenant via:
```bash
az ad app list --filter "displayName eq 'APPNAME-github-deploy'" -o tsv --query "[].{displayName, appId, id}"
```

Replace `APPNAME` with the verified app registration display name. Document the
display name below once confirmed:

**Verified app registration display name:** `roomsense-github-deploy` (TODO: confirm at provision time)

## The four GitHub secrets the workflows need

| Secret | Value | Used by |
|---|---|---|
| `AZURE_CLIENT_ID` | App registration's **application (client) ID** | both deploy workflows |
| `AZURE_TENANT_ID` | The AAD **tenant ID** | both deploy workflows |
| `AZURE_SUBSCRIPTION_ID` | The **subscription ID** holding `rgRoomSense` | both deploy workflows |
| `ROOMSENSE_SWA_DEPLOY_TOKEN` | The SWA **deployment token** (managed by Azure Static Web Apps, not AAD) | `deploy-frontend.yml` only |

The first three back the OIDC login. The SWA token is a separate, SWA-issued
deployment token (Free-tier SWA does not support AAD OIDC for deploys — it uses
its own token, copied out of the portal). The `azure/login` step in
`deploy-frontend.yml` is still required so later steps in that job can call `az`
if needed, but the actual SWA upload uses the token.

## One-time setup (Azure CLI)

```bash
# 0. Variables — fill in for your environment.
SUBSCRIPTION_ID="<your-subscription-id>"
RG="rgRoomSense"
REPO="toine-dev/roomsense"          # owner/repo of THIS GitHub repo
LOCATION="westeurope"

az account set --subscription "$SUBSCRIPTION_ID"

# 1. Create the app registration (the deploy identity).
APP_JSON=$(az ad app create --display-name roomsense-github-deploy --is-fallback-public false)
APP_ID=$(echo "$APP_JSON" | jq -r .appId)
APP_OBJECT_ID=$(echo "$APP_JSON" | jq -r .id)
echo "AZURE_CLIENT_ID = $APP_ID"

# 2. Create a service principal for the app (required before role assignment).
az ad sp create --id "$APP_ID"

# 3. Grant the app contributor rights over the resource group that holds the
#    resources it must deploy to (rgRoomSense). This is the *least* privilege that
#    still lets azure/functions-action and the SWA deploy action work.
az role assignment create \
  --role "Contributor" \
  --assignee "$APP_ID" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RG"

# 4. Add the federated identity credential: trust THIS repo's main-branch runs.
#    subject matches the job in deploy-*.yml (repo + ref).
az ad app federated-credential create --id "$APP_OBJECT_ID" --parameters "{
  \"name\": \"roomsense-github-actions\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:$REPO:ref:refs/heads/main\",
  \"description\": \"RoomSense deploys from main\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}"

# 5. Add a second FIC for workflow_dispatch runs (environment-scoped, optional
#    but recommended so manual dispatches also work without a push to main).
az ad app federated-credential create --id "$APP_OBJECT_ID" --parameters "{
  \"name\": \"roomsense-github-actions-dispatch\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:$REPO:environment:prod\",
  \"description\": \"RoomSense manual dispatch deploys\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}"

# 6. Read the SWA deployment token (separate from the AAD app above).
SWA_TOKEN=$(az staticwebapp secrets list --name roomsense-swa --resource-group "$RG" -o tsv --query "properties.apiKey")
echo "ROOMSENSE_SWA_DEPLOY_TOKEN = $SWA_TOKEN"
```

Then add the four values as GitHub Actions secrets (`Settings → Secrets and variables → Actions`).

## Why the workflows are still safe on a fork or misconfigured repo

Both deploy workflows begin with a **guard step** that fails fast with a clear
message if any of `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID`
is unset.

On a fork the secrets are not copied, so the guard emits a clear error and the job
exits before any `azure/login` or deploy step runs — no silent OIDC failure, no
misleading "deployed" status.

## Verifying the trust

After adding the secrets, trigger `deploy-api` via `workflow_dispatch`. If the
FIC is misconfigured, `azure/login` fails with an error like
`AADSTS70021: No matching federated identity record found` — that is the signal
to recheck the `subject` in step 4/5 against `repo:owner/repo:ref:refs/heads/main`.
