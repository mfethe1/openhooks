#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DEPS Planning Gate Hook — UserPromptSubmit
==========================================
Implements the DEPS (Describe, Explain, Plan, Select) framework from the
harness blueprints. For prompts that look like multi-step tasks (3+ steps),
this hook injects DEPS planning guidance into the context BEFORE the model
responds, nudging it to plan before executing.

This is a SOFT gate (advisory) — it injects context, doesn't block.
The goal: prevent "prompt → immediate file modification" anti-pattern.

Key behaviors:
- Detects complex/multi-step task signals in the prompt
- Injects DEPS planning instruction via additionalContext
- Logs detection for async review

Hook Type: UserPromptSubmit
"""
import sys
import json
import re
from datetime import datetime
from pathlib import Path

# Windows encoding
if sys.platform == 'win32':
    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8', errors='replace')
        if hasattr(sys.stdin, 'reconfigure'):
            sys.stdin.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, OSError):
        pass

# ============================================================================
# Complexity signals — prompts that likely need planning before execution
# ============================================================================
COMPLEX_TASK_SIGNALS = [
    # Feature/build signals
    r'\bbuild\b.{5,50}(feature|system|module|integration)',
    r'\bimplement\b.{5,50}(auth|payment|api|database|flow)',
    r'\bcreate\b.{5,50}(full.?stack|end.to.end|complete)',
    r'\brefactor\b.{5,50}(entire|whole|all|across)',
    r'\bmigrate\b.{5,50}(database|schema|codebase)',
    # Multi-step connectives
    r'\b(and then|after that|followed by|next|then)\b.{3,50}\b(also|and)\b',
    r'\bstep[s]?\s*\d',
    r'\b\d+\s*\.\s*\w.{10,}',  # numbered list
    # Large scope signals
    r'\ball\s+(files|routes|components|endpoints|tables)',
    r'\bfor\s+each\s+(file|component|route|table)',
    r'\bsweep\b|\boverview\b|\baudit\b',
    # Deployment/infra
    r'\bdeploy.{3,30}(railway|production|staging)',
    r'\bset\s+up\b.{5,50}(pipeline|workflow|ci|cd)',
]

DEPS_INJECTION = """
⚡ DEPS PLANNING GATE ACTIVATED ⚡

This looks like a multi-step task. Before writing any code or modifying files:

1. **Describe** — Briefly state what currently exists (read relevant files first)
2. **Explain** — Note any blockers, conflicts, or missing dependencies  
3. **Plan** — List the atomic sub-tasks in execution order
4. **Select** — Start with the smallest/simplest sub-task first

Write the plan in `workspace/task-breakout.md` if it has 5+ steps.
Execute step-by-step, verify each step before the next.

> Blueprint principle: "Never jump from prompt → file modification for complex tasks."
"""

WORKSPACE = Path.home() / ".openclaw" / "workspace"


def detect_complexity(prompt: str) -> bool:
    """Returns True if the prompt looks like a multi-step complex task."""
    prompt_lower = prompt.lower()
    
    # Quick checks
    if len(prompt.split()) < 10:
        return False  # Too short to be complex
    
    matches = 0
    for pattern in COMPLEX_TASK_SIGNALS:
        if re.search(pattern, prompt_lower):
            matches += 1
            if matches >= 2:
                return True
    
    return False


def main():
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            print("{}", flush=True)
            return
        data = json.loads(raw)
    except Exception:
        print("{}", flush=True)
        return

    prompt = data.get("prompt", "")
    
    if not prompt or not detect_complexity(prompt):
        print("{}", flush=True)
        return

    # Inject DEPS planning guidance
    output = {
        "additionalContext": DEPS_INJECTION
    }
    
    print(json.dumps(output), flush=True)


if __name__ == "__main__":
    main()
