# DEPS Planning Gate Hook (Claude Code)

**Type:** UserPromptSubmit  
**Runtime:** Python 3.10+  
**Platform:** Windows, Linux, macOS

## What It Does

Soft gate that detects complex/multi-step task prompts and injects DEPS (Describe, Explain, Plan, Select) planning guidance before the model responds.

Prevents the "prompt → immediate file modification" anti-pattern by encouraging structured planning for complex tasks.

### Detection Signals

Triggers when a prompt contains 2+ of:
- Feature/build keywords (`build`, `implement`, `create full-stack`)
- Multi-step connectives (`and then`, `followed by`, `step 1`)
- Large scope signals (`all files`, `for each component`, `audit`)
- Deployment/infra keywords (`deploy to production`, `set up CI/CD`)

### What Gets Injected

A DEPS planning instruction via `additionalContext`:
1. **Describe** — Read relevant files, state current system state
2. **Explain** — Surface blockers, conflicts, missing deps
3. **Plan** — List atomic sub-tasks in execution order
4. **Select** — Start with simplest, verify each step

## Installation

```bash
cp hook.py ~/.claude/hooks/deps_planning_hook.py
```

Add to `.claude/settings.json`:
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": ["python3 ~/.claude/hooks/deps_planning_hook.py"]
      }
    ]
  }
}
```

## Notes

- This is advisory only — it injects context, never blocks
- Short prompts (<10 words) are always skipped
- Requires 2+ complexity signals to trigger (avoids false positives)
