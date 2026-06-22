#!/usr/bin/env python3
"""Heuristic project risk scanner for the XMETA Pay Codex skill.

This script is intentionally report-only. It finds suspicious patterns and
prints a Markdown feedback report without modifying project files.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


EXCLUDED_DIRS = {
    ".git",
    ".next",
    "node_modules",
    "playwright-report",
    "test-results",
    ".turbo",
    "coverage",
    "dist",
    "build",
}

TEXT_EXTENSIONS = {
    ".cjs",
    ".css",
    ".env",
    ".html",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".mjs",
    ".sql",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
}

SEVERITY_ORDER = ["Critical", "High", "Medium", "Low", "Info"]


@dataclass(frozen=True)
class Finding:
    severity: str
    phase: str
    file: str
    line: int | None
    risk: str
    evidence: str
    impact: str
    suggestion: str


def run_command(repo: Path, args: list[str], timeout: int = 30) -> subprocess.CompletedProcess[str] | None:
    executable = shutil.which(args[0])
    if executable is None:
        return None
    try:
        return subprocess.run(
            [executable, *args[1:]],
            cwd=repo,
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None


def git_lines(repo: Path, args: list[str]) -> list[str]:
    result = run_command(repo, ["git", *args])
    if result is None or result.returncode not in (0, 1):
        return []
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def normalize_path(path: str) -> str:
    return path.replace("\\", "/")


def git_priority_files(repo: Path) -> list[str]:
    groups: list[list[str]] = [
        git_lines(repo, ["diff", "--name-only", "--cached", "--diff-filter=A"]),
        git_lines(repo, ["ls-files", "--others", "--exclude-standard"]),
        git_lines(repo, ["diff", "--name-only", "--cached", "--diff-filter=RC"]),
        git_lines(repo, ["diff", "--name-only", "--diff-filter=RC"]),
        git_lines(repo, ["diff", "--name-only", "--cached", "--diff-filter=M"]),
        git_lines(repo, ["diff", "--name-only", "--diff-filter=M"]),
    ]

    seen: set[str] = set()
    priority: list[str] = []
    for group in groups:
        for item in group:
            path = normalize_path(item)
            if path not in seen and should_scan_path(repo / path):
                seen.add(path)
                priority.append(path)
    return priority


def should_scan_path(path: Path) -> bool:
    parts = set(path.parts)
    if parts & EXCLUDED_DIRS:
        return False
    if path.is_dir():
        return False
    if path.suffix.lower() in TEXT_EXTENSIONS:
        return True
    if path.name in {"AGENTS.md", "package.json", "package-lock.json", "next.config.ts", "middleware.ts"}:
        return True
    return False


def all_project_files(repo: Path, priority: set[str]) -> list[str]:
    files: list[str] = []
    for root, dirs, names in os.walk(repo):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        root_path = Path(root)
        for name in names:
            full_path = root_path / name
            rel = normalize_path(str(full_path.relative_to(repo)))
            if rel in priority:
                continue
            if should_scan_path(full_path):
                files.append(rel)
    return sorted(files)


def read_text(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        try:
            return path.read_text(encoding="utf-8-sig")
        except UnicodeDecodeError:
            return None
    except OSError:
        return None


SECRET_QUOTED_ASSIGNMENT = re.compile(
    r"(?i)\b(api[_-]?key|secret|token|password|passwd|pwd|private[_-]?key|database[_-]?url|db[_-]?url)\b"
    r"\s*[:=]\s*(['\"])([^'\"]{8,})\2"
)
ENV_SECRET_ASSIGNMENT = re.compile(
    r"(?i)^\s*([A-Z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE[_-]?KEY|DATABASE[_-]?URL|DB[_-]?URL)[A-Z0-9_]*)"
    r"\s*=\s*([^#\s]{8,})"
)
PRIVATE_KEY = re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")
SQL_CALL = re.compile(r"\b(query|execute)\s*\(")
SQL_KEYWORD = re.compile(r"(?i)\b(select|insert|update|delete|replace)\b.+\b(from|into|set|where|values)\b")
REQUEST_INPUT = re.compile(r"\b(req|request|searchParams|params|formData|body)\b")
ENV_ACCESS = re.compile(r"process\.env\.([A-Z0-9_]+)")


def redact_secret(line: str) -> str:
    redacted = SECRET_QUOTED_ASSIGNMENT.sub(lambda m: f"{m.group(1)}=<redacted>", line)
    redacted = ENV_SECRET_ASSIGNMENT.sub(lambda m: f"{m.group(1)}=<redacted>", redacted)
    if PRIVATE_KEY.search(redacted):
        return "<private key material redacted>"
    return redacted.strip()[:220]


def clean(line: str) -> str:
    return line.strip()[:220]


def finding(
    severity: str,
    phase: str,
    file: str,
    line: int | None,
    risk: str,
    evidence: str,
    impact: str,
    suggestion: str,
) -> Finding:
    return Finding(severity, phase, file, line, risk, evidence, impact, suggestion)


def scan_file(repo: Path, rel: str, phase: str) -> list[Finding]:
    text = read_text(repo / rel)
    if text is None:
        return []

    findings: list[Finding] = []
    lines = text.splitlines()
    suffix = Path(rel).suffix.lower()
    is_document = suffix in {".md", ".txt"}
    is_test = "/test/" in f"/{rel}" or rel.startswith("test/") or ".test." in rel or ".spec." in rel

    for index, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("//") or stripped.startswith("#"):
            continue

        if PRIVATE_KEY.search(line):
            findings.append(
                finding(
                    "Critical",
                    phase,
                    rel,
                    index,
                    "Private key material appears in the repository",
                    redact_secret(line),
                    "Committed private keys can allow account takeover or unauthorized access.",
                    "Remove the key, rotate it immediately, and load secrets from a protected secret store or local-only environment.",
                )
            )

        secret_match = SECRET_QUOTED_ASSIGNMENT.search(line) or (
            ENV_SECRET_ASSIGNMENT.search(line) if suffix == ".env" or Path(rel).name.startswith(".env") else None
        )
        if secret_match:
            secret_value = secret_match.group(3) if secret_match.re is SECRET_QUOTED_ASSIGNMENT else secret_match.group(2)
            if " " in secret_value and not re.match(r"(?i)^[a-z][a-z0-9+.-]*://", secret_value):
                continue

        if secret_match and not re.search(r"(?i)(example|placeholder|changeme|your_|dummy|test)", line):
            severity = "Low" if is_test else ("High" if suffix != ".env" else "Medium")
            findings.append(
                finding(
                    severity,
                    phase,
                    rel,
                    index,
                    "Possible hardcoded secret or credential",
                    redact_secret(line),
                    "Secrets in source or local files can leak through commits, logs, screenshots, or accidental sharing.",
                    "Move the value to an ignored local env file or managed secret store, and rotate it if it has been shared.",
                )
            )

        if is_document:
            continue

        if SQL_CALL.search(line) and ("`" in line or "+" in line or "${" in line):
            window = " ".join(lines[max(0, index - 3) : min(len(lines), index + 2)])
            severity = "High" if REQUEST_INPUT.search(window) else "Medium"
            findings.append(
                finding(
                    severity,
                    phase,
                    rel,
                    index,
                    "Possible SQL injection through dynamic query construction",
                    clean(line),
                    "Interpolated SQL can allow attackers to alter queries when user-controlled input reaches the statement.",
                    "Use mysql2 parameter placeholders and pass values separately from the SQL string.",
                )
            )

        if SQL_KEYWORD.search(line) and ("${" in line or re.search(r"['\"`]\s*\+", line) or re.search(r"\+\s*['\"`]", line)):
            findings.append(
                finding(
                    "Medium",
                    phase,
                    rel,
                    index,
                    "Raw SQL string appears dynamically assembled",
                    clean(line),
                    "Dynamic SQL fragments are easy to misuse and need parameterization review.",
                    "Verify all user-controlled values are bound parameters and keep any dynamic identifiers allowlisted.",
                )
            )

        if "dangerouslySetInnerHTML" in line:
            findings.append(
                finding(
                    "High",
                    phase,
                    rel,
                    index,
                    "Possible cross-site scripting sink",
                    clean(line),
                    "Rendering HTML directly can execute attacker-controlled script if content is not sanitized.",
                    "Avoid raw HTML when possible, or sanitize trusted markup with a reviewed sanitizer before rendering.",
                )
            )

        if re.search(r"\bredirect\s*\(", line) and REQUEST_INPUT.search(line):
            findings.append(
                finding(
                    "Medium",
                    phase,
                    rel,
                    index,
                    "Possible open redirect",
                    clean(line),
                    "Redirecting to request-controlled destinations can support phishing or auth bypass flows.",
                    "Redirect only to relative paths or allowlisted origins.",
                )
            )

        if ".set(" in line and "cookie" in line.lower():
            window = " ".join(lines[index - 1 : min(len(lines), index + 5)])
            if "httpOnly" not in window or "secure" not in window or "sameSite" not in window:
                findings.append(
                    finding(
                        "Medium",
                        phase,
                        rel,
                        index,
                        "Cookie options may be missing security flags",
                        clean(line),
                        "Session or auth cookies without httpOnly, secure, and sameSite are easier to steal or abuse.",
                        "Set httpOnly, secure in production, and an explicit sameSite policy for sensitive cookies.",
                    )
                )

        env_match = ENV_ACCESS.search(line)
        if env_match:
            name = env_match.group(1)
            if "NEXT_PUBLIC_" not in name and re.search(r"\b(client|browser|window|document|localStorage)\b", text):
                findings.append(
                    finding(
                        "Low",
                        phase,
                        rel,
                        index,
                        "Review server-only environment variable usage",
                        clean(line),
                        "Server-only environment values should not be exposed to client bundles or browser code.",
                        "Keep non-NEXT_PUBLIC environment access in server-only modules and verify this file is not a client component.",
                    )
                )

    return dedupe_findings(findings)


def dedupe_findings(findings: Iterable[Finding]) -> list[Finding]:
    seen: set[tuple[str, str, int | None, str]] = set()
    unique: list[Finding] = []
    for item in findings:
        key = (item.file, item.risk, item.line, item.phase)
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique


def npm_audit(repo: Path) -> list[Finding]:
    if not (repo / "package.json").exists():
        return []

    result = run_command(repo, ["npm", "audit", "--audit-level=moderate", "--json"], timeout=60)
    if result is None:
        return [
            finding(
                "Info",
                "Whole project",
                "package.json",
                None,
                "npm audit was not available",
                "Could not run npm audit in this environment.",
                "Dependency advisories were not checked by the script.",
                "Run npm audit --audit-level=moderate manually when npm is available.",
            )
        ]

    output = result.stdout.strip() or result.stderr.strip()
    if not output:
        return []

    try:
        data = json.loads(output)
    except json.JSONDecodeError:
        return [
            finding(
                "Info",
                "Whole project",
                "package.json",
                None,
                "npm audit returned non-JSON output",
                output[:220],
                "The script could not summarize dependency advisories.",
                "Run npm audit --audit-level=moderate manually and inspect the output.",
            )
        ]

    vulnerabilities = data.get("vulnerabilities", {})
    if not vulnerabilities:
        return []

    severity_rank = {"critical": "Critical", "high": "High", "moderate": "Medium", "low": "Low"}
    findings: list[Finding] = []
    for package_name, details in vulnerabilities.items():
        via = details.get("via", [])
        advisory_titles = []
        for advisory in via:
            if isinstance(advisory, dict) and advisory.get("title"):
                advisory_titles.append(advisory["title"])
        title = "; ".join(advisory_titles[:2]) or "npm audit advisory"
        severity = severity_rank.get(str(details.get("severity", "low")).lower(), "Low")
        findings.append(
            finding(
                severity,
                "Whole project",
                "package-lock.json",
                None,
                f"Dependency advisory for {package_name}",
                title[:220],
                "Known vulnerable dependencies can expose the application through affected package behavior.",
                "Review npm audit details and upgrade, patch, or replace the affected dependency where safe.",
            )
        )
    return findings


def render_markdown(findings: list[Finding], priority_files: list[str], scanned_count: int) -> str:
    lines: list[str] = [
        "# Project Risk Scan Report",
        "",
        f"- Priority git files scanned first: {len(priority_files)}",
        f"- Total text files scanned: {scanned_count}",
        f"- Findings: {len(findings)}",
        "",
    ]

    if priority_files:
        lines.extend(["## Priority Files", ""])
        for item in priority_files:
            lines.append(f"- `{item}`")
        lines.append("")

    if not findings:
        lines.extend(
            [
                "## Findings",
                "",
                "No heuristic findings were detected. This does not replace manual review, dependency monitoring, or penetration testing.",
            ]
        )
        return "\n".join(lines)

    for severity in SEVERITY_ORDER:
        group = [item for item in findings if item.severity == severity]
        if not group:
            continue
        lines.extend([f"## {severity}", ""])
        group.sort(key=lambda f: (0 if f.phase == "Priority git files" else 1, f.file, f.line or 0, f.risk))
        for item in group:
            location = f"`{item.file}`"
            if item.line is not None:
                location += f":{item.line}"
            lines.extend(
                [
                    f"- **{item.risk}** ({item.phase})",
                    f"  - Location: {location}",
                    f"  - Evidence: `{item.evidence}`",
                    f"  - Impact: {item.impact}",
                    f"  - Suggested fix: {item.suggestion}",
                ]
            )
        lines.append("")
    return "\n".join(lines).rstrip()


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan XMETA Pay for heuristic project security risks.")
    parser.add_argument("--repo", default=".", help="Repository root to scan.")
    parser.add_argument("--format", choices=["markdown"], default="markdown", help="Output format.")
    parser.add_argument("--skip-audit", action="store_true", help="Skip npm audit dependency checks.")
    args = parser.parse_args()

    repo = Path(args.repo).resolve()
    if not repo.exists():
        raise SystemExit(f"Repository path does not exist: {repo}")

    priority = git_priority_files(repo)
    priority_set = set(priority)
    whole_project = all_project_files(repo, priority_set)
    findings: list[Finding] = []

    for rel in priority:
        findings.extend(scan_file(repo, rel, "Priority git files"))

    for rel in whole_project:
        findings.extend(scan_file(repo, rel, "Whole project"))

    if not args.skip_audit:
        findings.extend(npm_audit(repo))

    findings = dedupe_findings(findings)
    print(render_markdown(findings, priority, len(priority) + len(whole_project)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
