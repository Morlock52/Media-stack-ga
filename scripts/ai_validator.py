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

    # Rule 1: Default Passwords
    if "Morlock52$" in content:
        issues.append("⚠️  CRITICAL: Default password 'Morlock52$' detected!")
    
    # Rule 2: Weak Secrets
    secret_patterns = [r'AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET=(\w{0,10})$', r'POSTGRES_PASSWORD=(\w{0,5})$']
    for line in content.splitlines():
        for pattern in secret_patterns:
            if re.search(pattern, line):
                issues.append(f"⚠️  Weak secret detected: {line}")

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
