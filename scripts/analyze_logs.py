#!/usr/bin/env python3
import subprocess
import sys

def get_compose_cmd():
    try:
        probe = subprocess.run(["docker", "compose", "version"], capture_output=True, text=True)
        if probe.returncode == 0:
            return ["docker", "compose"]
    except Exception:
        pass
    return ["docker-compose"]

def analyze_logs(container_name="all"):
    print(f"🧠 Analyzing logs for: {container_name}...")
    
    cmd = get_compose_cmd() + ["logs", "--tail=100"]
    if container_name != "all":
        cmd.append(container_name)
        
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        logs = result.stdout
    except Exception as e:
        print(f"Error reading logs: {e}")
        return

    error_patterns = ["Error", "Exception", "Fatal", "Panic", "Unauthorized"]
    
    findings = []
    for line in logs.splitlines():
        for pattern in error_patterns:
            if pattern in line:
                findings.append(line)

    if findings:
        print(f"\n⚠️  Found {len(findings)} potential issues:")
        # Simple deduplication and summary
        unique_findings = list(set(findings))[:10] # Show top 10 unique
        for f in unique_findings:
            print(f" - {f.strip()}")
            
        compose_cmd = "docker compose" if cmd[:2] == ["docker", "compose"] else "docker-compose"
        print(f"\n💡 Recommendation: Check the lines above. Use '{compose_cmd} logs <service>' for more details.")
    else:
        print("✅ No obvious errors found in recent logs.")

if __name__ == "__main__":
    container = sys.argv[1] if len(sys.argv) > 1 else "all"
    analyze_logs(container)
