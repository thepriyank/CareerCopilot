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
