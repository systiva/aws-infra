bucket         = "${tenant_bucket}"
key            = "tenant-iac/terraform.tfstate"
region         = "${aws_region}"
dynamodb_table = "${tenant_lock_table}"
encrypt        = true
profile        = "${aws_profile}"