variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
}

variable "account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "zone_id" {
  description = "Cloudflare Zone ID"
  type        = string
}

variable "allowed_email" {
  description = "Email address allowed to access the API"
  type        = string
}

variable "app_domain" {
  description = "Application domain (e.g., music.example.com)"
  type        = string
}
