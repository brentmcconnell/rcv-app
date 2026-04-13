output "website_url" {
  value       = azurerm_storage_account.sa.primary_web_endpoint
  description = "URL of the static website"
}

output "storage_account_name" {
  value       = azurerm_storage_account.sa.name
  description = "Storage account name"
}
