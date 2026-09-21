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
  description = "A/AAAA (or CNAME) records Google assigned for var.custom_domain once the mapping applies successfully. Create these at your registrar (GoDaddy) exactly as shown — run `terraform output custom_domain_dns_records` or check this apply's log."
  value       = google_cloud_run_domain_mapping.frontend.status
}

output "api_subdomain_dns_records" {
  description = "DNS record(s) Google assigned for api.<custom_domain> (a CNAME, typically to ghs.googlehosted.com, since this is a subdomain rather than the apex). Create this at your registrar (GoDaddy) exactly as shown — run `terraform output api_subdomain_dns_records` or check this apply's log."
  value       = google_cloud_run_domain_mapping.backend.status
}
