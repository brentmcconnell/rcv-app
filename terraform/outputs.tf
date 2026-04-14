output "website_url" {
  value       = azurerm_storage_account.sa.primary_web_endpoint
  description = "URL of the static website (primary)"
}

output "friendly_url" {
  value       = azurerm_storage_account.friendly.primary_web_endpoint
  description = "URL of the static website (friendly name)"
}

output "storage_account_name" {
  value       = azurerm_storage_account.sa.name
  description = "Storage account name"
}
