output "frontend_url" {
  value = module.frontend_service.url
}

output "backend_url" {
  value = module.backend_service.url
}

output "backend_service_account_email" {
  value = module.backend_sa.email
}

output "frontend_service_account_email" {
  value = module.frontend_sa.email
}

output "provisioned_secret_ids" {
  value = { for k, m in module.secrets : k => m.secret_id }
}

output "custom_domain_dns_records" {
  description = "A/AAAA (or CNAME) records Google assigned for var.custom_domain once the mapping applies successfully. Create these in Cloudflare DNS (jobmagnate.com's nameservers; GoDaddy is only the registrar) exactly as shown, Proxy status = DNS only — run `terraform output custom_domain_dns_records` or check this apply's log."
  value       = google_cloud_run_domain_mapping.frontend.status
}

output "api_subdomain_dns_records" {
  description = "DNS record(s) Google assigned for api.<custom_domain> (a CNAME, typically to ghs.googlehosted.com, since this is a subdomain rather than the apex). Create this in Cloudflare DNS (Proxy status = DNS only) exactly as shown — run `terraform output api_subdomain_dns_records` or check this apply's log."
  value       = google_cloud_run_domain_mapping.backend.status
}

output "www_subdomain_dns_records" {
  description = "DNS record(s) Google assigned for www.<custom_domain> (a CNAME to ghs.googlehosted.com). In Cloudflare DNS, set the www CNAME to exactly this value with Proxy status = DNS only (grey cloud) - a proxied record blocks Google's certificate issuance."
  value       = google_cloud_run_domain_mapping.frontend_www.status
}

