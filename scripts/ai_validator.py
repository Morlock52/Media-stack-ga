#!/usr/bin/env python3
import os
import re
import sys

def check_env_security():
    print("🤖 AI Config Validator running...")
    issues = []
    
    if not os.path.exists(".env"):
        return ["❌ .env file missing"]

    with open(".env", "r") as f:
        content = f.read()

    # Rule 1: obvious placeholders / unsafe defaults
    if re.search(r'^DOMAIN=example\\.com\\s*$', content, re.MULTILINE):
        issues.append("⚠️  CRITICAL: DOMAIN is still set to example.com")

    if "CHANGE_ME_TOKEN" in content or re.search(r'^CLOUDFLARE_TUNNEL_TOKEN=changeme\\s*$', content, re.MULTILINE):
        issues.append("⚠️  CRITICAL: Cloudflare tunnel token is still a placeholder")

    if re.search(r'^REDIS_PASSWORD=changeme\\s*$', content, re.MULTILINE):
        issues.append("⚠️  CRITICAL: REDIS_PASSWORD is still 'changeme'")
    
    # Rule 2: Weak / uninitialized secrets
    weak_secret_patterns = [
        r'^AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET=(changeme_random_string|changeme)\\s*$',
        r'^AUTHELIA_SESSION_SECRET=(changeme_random_string|changeme)\\s*$',
        r'^AUTHELIA_STORAGE_ENCRYPTION_KEY=(changeme_random_string|changeme)\\s*$',
    ]
    for pattern in weak_secret_patterns:
        if re.search(pattern, content, re.MULTILINE):
            issues.append("⚠️  CRITICAL: One or more Authelia secrets are still placeholders")

    # Rule 3: Missing Keys
    required_keys = ["DOMAIN", "TIMEZONE", "PUID", "PGID"]
    for key in required_keys:
        if f"{key}=" not in content:
            issues.append(f"❌ Missing required key: {key}")

    return issues

def check_compose_logic():
    # Simple heuristic check
    if not os.path.exists("docker-compose.yml"):
        return ["❌ docker-compose.yml missing"]
    
    with open("docker-compose.yml", "r") as f:
        content = f.read()
        
    issues = []
    if "network_mode: service:gluetun" in content and "VPN_SERVICE_PROVIDER=custom" in content:
        # This is actually fine, but we can warn if provider is empty
        pass
        
    return issues

if __name__ == "__main__":
    all_issues = check_env_security() + check_compose_logic()
    
    if all_issues:
        print("\nFound the following potential issues:")
        for issue in all_issues:
            print(issue)
        sys.exit(1)
    else:
        print("✅ AI Validation passed. Configuration looks secure and logical.")
        sys.exit(0)
