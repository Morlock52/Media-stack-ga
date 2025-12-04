#!/usr/bin/env python3
import subprocess
import sys

def analyze_logs(container_name="all"):
    print(f"🧠 Analyzing logs for: {container_name}...")
    
    cmd = ["docker-compose", "logs", "--tail=100"]
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
            
        print("\n💡 Recommendation: Check the lines above. Use 'docker-compose logs <service>' for more details.")
    else:
        print("✅ No obvious errors found in recent logs.")

if __name__ == "__main__":
    container = sys.argv[1] if len(sys.argv) > 1 else "all"
    analyze_logs(container)
