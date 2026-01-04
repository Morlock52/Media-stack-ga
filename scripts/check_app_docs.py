#!/usr/bin/env python3
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Set

COMPOSE_FILES = [
    "docker-compose.yml",
    "docker-compose.local.yml",
    "docker-compose.wizard.yml",
    "docker-compose.wizard.secure.yml",
    "docker-compose.wizard.override.yml",
]

DOCS_FILE = Path("docs/app.md")

SERVICE_SECTION_OVERRIDES = {
    "cloudflared": "Traefik & Cloudflare Tunnel",
}


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def parse_services_from_yaml_text(text: str) -> List[str]:
    lines = text.splitlines()
    service_indent = None
    service_key_indent = None
    services: List[str] = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        if service_indent is None:
            if re.match(r"^\s*services:\s*$", line):
                service_indent = len(line) - len(line.lstrip())
            continue

        if stripped and (len(line) - len(line.lstrip())) <= service_indent:
            break

        if not stripped or stripped.startswith("#"):
            continue

        indent = len(line) - len(line.lstrip())
        if indent <= service_indent:
            continue

        if service_key_indent is None:
            service_key_indent = indent

        if indent != service_key_indent:
            continue

        match = re.match(r"^\s*([A-Za-z0-9][A-Za-z0-9_-]*):\s*(#.*)?$", line)
        if not match:
            continue

        key = match.group(1)
        if key not in services:
            services.append(key)

    return services


def load_services(path: Path) -> List[str]:
    try:
        import yaml  # type: ignore
    except Exception:
        yaml = None

    content = path.read_text()
    if yaml is None:
        return parse_services_from_yaml_text(content)

    try:
        data = yaml.safe_load(content) or {}
    except Exception as exc:
        print(f"Failed to parse {path}: {exc}", file=sys.stderr)
        return []

    services = data.get("services", {})
    if isinstance(services, dict):
        return list(services.keys())
    return []


def load_sections(path: Path) -> List[str]:
    titles = []
    for line in path.read_text().splitlines():
        if line.startswith("### "):
            titles.append(line[4:].strip())
    return titles


def match_section(service: str, sections: List[str]) -> Optional[str]:
    override = SERVICE_SECTION_OVERRIDES.get(service)
    if override:
        for title in sections:
            if normalize(title) == normalize(override):
                return title

    normalized_service = normalize(service)
    for title in sections:
        if normalized_service and normalized_service in normalize(title):
            return title
    return None


def main() -> int:
    if not DOCS_FILE.exists():
        print(f"Missing {DOCS_FILE}.", file=sys.stderr)
        return 1

    sections = load_sections(DOCS_FILE)
    if not sections:
        print(f"No sections found in {DOCS_FILE}.", file=sys.stderr)
        return 1

    service_sources: Dict[str, Set[str]] = {}
    for file_name in COMPOSE_FILES:
        path = Path(file_name)
        if not path.exists():
            continue
        for service in load_services(path):
            service_sources.setdefault(service, set()).add(path.name)

    if not service_sources:
        print("No services found in compose files.", file=sys.stderr)
        return 1

    missing: List[str] = []
    matched_sections: Set[str] = set()
    for service, sources in sorted(service_sources.items()):
        section = match_section(service, sections)
        if section is None:
            missing.append(f"{service} ({', '.join(sorted(sources))})")
        else:
            matched_sections.add(section)

    orphan_sections = [title for title in sections if title not in matched_sections]

    if missing:
        print("Missing docs/app.md coverage for compose services:")
        for item in missing:
            print(f" - {item}")
    else:
        print("All compose services have coverage in docs/app.md.")

    if orphan_sections:
        print("\nDocs sections with no matching compose service:")
        for title in orphan_sections:
            print(f" - {title}")

    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
