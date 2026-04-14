variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
  default     = "rg-rcv-app"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "eastus"
}

variable "storage_account_name" {
  description = "Globally unique storage account name (3-24 lowercase letters/numbers)"
  type        = string
}

variable "app_passcode" {
  description = "Passcode shared via text message to gate entry to the app"
  type        = string
  sensitive   = true
}

variable "admin_code" {
  description = "Separate code to unlock the admin page for managing survey items"
  type        = string
  sensitive   = true
}

variable "friendly_account_name" {
  description = "Friendly storage account name for a nicer URL (3-24 lowercase letters/numbers)"
  type        = string
  default     = "songsforthebarn"
}

variable "sas_start" {
  description = "SAS token start time (ISO 8601)"
  type        = string
  default     = "2025-01-01T00:00:00Z"
}

variable "sas_expiry" {
  description = "SAS token expiry time (ISO 8601)"
  type        = string
  default     = "2027-12-31T23:59:59Z"
}
