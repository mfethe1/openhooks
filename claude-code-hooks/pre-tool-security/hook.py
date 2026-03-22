#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Optimized PreToolUse Hook v1.0
==============================
Consolidates pre_tool_guard.py and pre_tool_hook.py into a single efficient hook.

Key Optimizations:
- Single config load (cached)
- Single Python process instead of two
- Lazy evaluation (skip checks based on tool type)
- Fast-path for low-cost tools
- Reduced I/O operations

Exit Codes:
- 0 + {} = allow
- 0 + {"hookSpecificOutput": {"permissionDecision": "deny"}} = block
- 2 + stderr = block (simpler)
- 42 = hibernation trigger

Hook Type: PreToolUse
"""
import sys
import json
import re
import os
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, Tuple

# =============================================================================
# Fast-path Configuration (no imports needed)
# =============================================================================
# Tools that can skip expensive checks
FAST_PATH_TOOLS = frozenset({
    "TodoRead", "TodoWrite", "AskUserQuestion",
    "TaskList", "TaskGet", "TaskCreate", "TaskUpdate",
    "Glob", "Read",  # Read-only, low risk
})

# Tools that need full checking
HIGH_RISK_TOOLS = frozenset({
    "Bash", "Edit", "Write", "MultiEdit", "Task",
    "mcp__playwright__", "mcp__windows-control__",
})

# Protected paths - no regex needed, use simple string matching
PROTECTED_PATHS = (
    ".ssh", ".gnupg", ".aws/credentials", ".env",
    "id_rsa", "id_ed25519", ".npmrc", ".pypirc",
)

# Dangerous commands - simple patterns
DANGEROUS_COMMANDS = (
    "rm -rf /", "rm -rf ~", "rm -rf /*",
    ":(){ :|:& };:", "mkfs.", "dd if=",
    "> /dev/sd", "chmod -R 777 /",
)

# =============================================================================
# Windows Encoding (minimal setup)
# =============================================================================
if sys.platform == 'win32':
    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, OSError, ValueError):
        pass

# =============================================================================
# Output Functions (inline, no imports)
# =============================================================================
def output_allow(msg: Optional[str] = None) -> None:
    """Allow tool execution."""
    result = {"systemMessage": msg} if msg else {}
    print(json.dumps(result), flush=True)
    sys.exit(0)

def output_deny(reason: str) -> None:
    """Block tool execution."""
    print(reason, file=sys.stderr, flush=True)
    sys.exit(2)

# =============================================================================
# Fast Checks (no external imports)
# =============================================================================
def is_protected_path(path: str) -> bool:
    """Check if path contains protected patterns."""
    if not path:
        return False
    path_lower = path.lower().replace('\\', '/')
    return any(p in path_lower for p in PROTECTED_PATHS)

def is_dangerous_command(cmd: str) -> bool:
    """Check if command is dangerous."""
    if not cmd:
        return False
    cmd_lower = cmd.lower()
    return any(d in cmd_lower for d in DANGEROUS_COMMANDS)

def quick_risk_assessment(tool_name: str, tool_input: Dict) -> Tuple[bool, Optional[str]]:
    """
    Quick risk assessment without LLM.
    Returns (is_blocked, reason) tuple.
    """
    # Check Bash commands
    if tool_name == "Bash":
        cmd = tool_input.get("command", "")
        if is_dangerous_command(cmd):
            return True, f"Blocked dangerous command pattern in: {cmd[:100]}"

    # Check file operations for protected paths
    if tool_name in ("Edit", "Write", "Read", "MultiEdit"):
        path = tool_input.get("file_path", "") or tool_input.get("path", "")
        if is_protected_path(path):
            return True, f"Blocked access to protected path: {path}"

    return False, None

# =============================================================================
# Rate Limit Checking (lazy import)
# =============================================================================
_rate_limit_module = None

def get_rate_limit_module():
    """Lazy load rate_limit_guard module."""
    global _rate_limit_module
    if _rate_limit_module is None:
        try:
            HOOKS_DIR = Path.home() / ".claude" / "hooks"
            sys.path.insert(0, str(HOOKS_DIR))
            import rate_limit_guard
            _rate_limit_module = rate_limit_guard
        except ImportError:
            _rate_limit_module = False  # Mark as unavailable
    return _rate_limit_module if _rate_limit_module else None

def check_rate_limits(session_usage: Dict) -> Tuple[bool, int, str]:
    """Check rate limits if module available."""
    module = get_rate_limit_module()
    if not module:
        return False, 0, ""
    try:
        return module.check_usage_limits(session_usage)
    except Exception:
        return False, 0, ""

# =============================================================================
# Main Entry Point
# =============================================================================
def main() -> None:
    """
    Optimized PreToolUse hook.

    Processing order:
    1. Fast-path check (skip expensive checks for low-risk tools)
    2. Quick risk assessment (no LLM, pure pattern matching)
    3. Rate limit check (only if module available)
    4. Allow operation
    """
    try:
        # Read input
        raw = sys.stdin.read()
        if not raw.strip():
            output_allow()
            return

        data = json.loads(raw)
        if not isinstance(data, dict):
            output_allow()
            return

        tool_name = str(data.get("tool_name", "unknown"))
        tool_input = data.get("tool_input", {})
        if not isinstance(tool_input, dict):
            tool_input = {}

        # 1. Fast-path for low-risk tools
        if tool_name in FAST_PATH_TOOLS:
            output_allow()
            return

        # Check for MCP tools (prefix match)
        is_mcp = tool_name.startswith("mcp__")
        is_high_risk = any(tool_name.startswith(h) for h in HIGH_RISK_TOOLS) if is_mcp else tool_name in HIGH_RISK_TOOLS

        # 2. Quick risk assessment (no LLM)
        if is_high_risk:
            is_blocked, reason = quick_risk_assessment(tool_name, tool_input)
            if is_blocked:
                output_deny(reason)
                return

        # 3. Rate limit check (lazy, only for expensive tools)
        if tool_name in ("Task", "WebFetch", "WebSearch") or is_mcp:
            session_usage = {
                "context_window": data.get("context_window", {}),
                "session_tokens": data.get("session_tokens", 0)
            }
            should_hibernate, wait_time, reason = check_rate_limits(session_usage)
            if should_hibernate:
                # Trigger hibernation
                module = get_rate_limit_module()
                if module:
                    try:
                        module.trigger_hibernation(wait_time, reason)
                    except Exception:
                        pass

        # 4. Allow operation
        output_allow()

    except json.JSONDecodeError:
        output_allow()
    except Exception:
        output_allow()

if __name__ == "__main__":
    main()
