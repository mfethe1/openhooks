# Git Checkpoint Hook (Claude Code)

**Type:** PreToolUse  
**Matcher:** Bash  
**Runtime:** Python 3.10+  
**Platform:** Windows, Linux, macOS

## What It Does

Creates a git stash checkpoint **before** any potentially destructive Bash command runs. Implements the safety-net pattern:

1. Detects destructive command patterns (`rm -rf`, `git reset --hard`, `DROP TABLE`, etc.)
2. Creates `git add -A && git stash push --message "auto-checkpoint-<timestamp>"` 
3. Pops stash to restore working tree (checkpoint preserved in stash list)
4. Logs to `workspace/decision-log.md`
5. Allows the operation to proceed

### Hard-blocked patterns

These commands are blocked entirely (no checkpoint can save them):
- `rm -rf /`, `rm -rf ~`
- `git push --force origin main/master`
- Fork bombs, `mkfs`, `chmod -R 777 /`

## Installation

```bash
cp hook.py ~/.claude/hooks/git_checkpoint_hook.py
```

Add to `.claude/settings.json`:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": ["python3 ~/.claude/hooks/git_checkpoint_hook.py"]
      }
    ]
  }
}
```

## Requirements

- Git installed and on PATH
- Operations must be inside a git repository
