terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# R2バケット（非公開）
resource "cloudflare_r2_bucket" "music" {
  account_id = var.account_id
  name       = "edgedeck-music"
}

# D1データベース
resource "cloudflare_d1_database" "main" {
  account_id = var.account_id
  name       = "edgedeck-db"
  read_replication = {
    mode = "disabled"
  }
}

# Cloudflare Access アプリケーション（サイト全体を保護）
resource "cloudflare_zero_trust_access_application" "app" {
  zone_id          = var.zone_id
  name             = "edgedeck"
  domain           = var.app_domain
  session_duration = "24h"
  type             = "self_hosted"

  policies = [
    {
      name     = "Allow owner"
      decision = "allow"
      include  = [{
        email = {
          email = var.allowed_email
        }
      }]
    },
    {
      name     = "Allow service token"
      decision = "non_identity"
      include  = [{
        any_valid_service_token = {}
      }]
    },
  ]
}
