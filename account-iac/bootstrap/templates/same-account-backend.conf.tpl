bucket         = "${admin_bucket}"
key            = "account-iac/terraform.tfstate"
region         = "${aws_region}"
dynamodb_table = "${admin_lock_table}"
encrypt        = true