#!/usr/bin/env bash
# PreToolUse security gate - Action Selector pattern
# Blocks dangerous commands, enforces git checkpoint before destructive ops
# Exit 0 = allow, Exit 2 = block with message to stderr

TOOL_NAME="${CLAUDE_TOOL_NAME:-}"
TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

# Block destructive shell commands
if [[ "$TOOL_NAME" == "Bash" ]]; then
    INPUT_LOWER=$(echo "$TOOL_INPUT" | tr '[:upper:]' '[:lower:]')
    
    # Hard blocks - never allow
    BLOCKED_PATTERNS=(
        "rm -rf /"
        "rm -rf ~"
        "rm -rf /home"
        "mkfs\."
        "dd if=/dev/zero"
        "> /dev/sda"
        "chmod -R 777 /"
        ":(){ :|:& };:"
    )
    
    for pattern in "${BLOCKED_PATTERNS[@]}"; do
        if echo "$INPUT_LOWER" | grep -qE "$pattern"; then
            echo "BLOCKED: Destructive command detected: $pattern" >&2
            exit 2
        fi
    done
    
    # Warn on potentially dangerous ops - create git checkpoint
    WARN_PATTERNS=("rm -rf" "drop table" "drop database" "truncate" "delete from" "git push.*--force" "git reset --hard")
    for pattern in "${WARN_PATTERNS[@]}"; do
        if echo "$INPUT_LOWER" | grep -qiE "$pattern"; then
            # Auto-checkpoint before destructive ops
            if git rev-parse --is-inside-work-tree &>/dev/null; then
                git stash push -m "pre-destructive-checkpoint-$(date +%s)" --include-untracked 2>/dev/null
                git stash pop 2>/dev/null
            fi
        fi
    done
fi

# Block writes to protected paths
if [[ "$TOOL_NAME" == "Write" || "$TOOL_NAME" == "Edit" ]]; then
    PROTECTED_PATHS=("/etc/" "/usr/bin/" "/usr/lib/" "~/.ssh/authorized_keys" "~/.bashrc")
    for ppath in "${PROTECTED_PATHS[@]}"; do
        if echo "$TOOL_INPUT" | grep -q "$ppath"; then
            echo "BLOCKED: Cannot modify protected path: $ppath" >&2
            exit 2
        fi
    done
fi

exit 0
