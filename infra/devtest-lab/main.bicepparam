using 'main.bicep'

// Values come from environment variables so nothing environment-specific is committed.
// GitHub Actions sets them from repository variables; locally, export them first.

param notificationEmail = readEnvironmentVariable('NOTIFICATION_EMAIL', 'demo@example.invalid')
param owner = readEnvironmentVariable('OWNER_TAG', 'unset')
param allowedSourceAddressPrefix = readEnvironmentVariable('ALLOWED_SOURCE', 'Internet')
param sshPublicKey = readEnvironmentVariable('SSH_PUBLIC_KEY', '')
