variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "name" {
  type = string
}

variable "schedule" {
  description = "Standard 5-field cron expression, evaluated in time_zone."
  type        = string
}

variable "time_zone" {
  type    = string
  default = "Etc/UTC"
}

variable "cloud_run_job_name" {
  description = "Name of the google_cloud_run_v2_job this schedule triggers (module.<job>.name)."
  type        = string
}

variable "invoker_service_account_email" {
  description = "Dedicated SA Cloud Scheduler uses to call the Cloud Run Jobs API — separate from the job's own runtime SA (that one only needs DB/secret access, not permission to *start* executions). Granted roles/run.invoker on just this one job by this module."
  type        = string
}
