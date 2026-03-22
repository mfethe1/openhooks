#!/usr/bin/env bash
# PostToolUse verification hook
# Runs linting/type-checking after file modifications
# Outputs feedback to stdout for context injection

TOOL_NAME="${CLAUDE_TOOL_NAME:-}"
TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"
EXIT_CODE="${CLAUDE_TOOL_EXIT_CODE:-0}"

# Only run verification on successful file operations
if [[ "$EXIT_CODE" != "0" ]]; then
    exit 0
fi

# After file writes, run relevant checks
if [[ "$TOOL_NAME" == "Write" || "$TOOL_NAME" == "Edit" ]]; then
    FILE_PATH=$(echo "$TOOL_INPUT" | grep -oP '"file_path"\s*:\s*"([^"]*)"' | head -1 | sed 's/.*"file_path"\s*:\s*"\(.*\)"/\1/')
    
    if [[ -z "$FILE_PATH" ]]; then
        exit 0
    fi
    
    EXT="${FILE_PATH##*.}"
    
    case "$EXT" in
        ts|tsx)
            if command -v npx &>/dev/null; then
                # Quick type check on the specific file
                npx tsc --noEmit "$FILE_PATH" 2>&1 | tail -5 && echo "[HOOK] TypeScript check passed" || echo "[HOOK] TypeScript errors detected - fix before proceeding"
            fi
            ;;
        py)
            if command -v python3 &>/dev/null; then
                python3 -c "import py_compile; py_compile.compile('$FILE_PATH', doraise=True)" 2>&1 && echo "[HOOK] Python syntax OK" || echo "[HOOK] Python syntax error detected"
            fi
            ;;
        json)
            python3 -c "import json; json.load(open('$FILE_PATH'))" 2>&1 && echo "[HOOK] JSON valid" || echo "[HOOK] Invalid JSON detected"
            ;;
        sh|bash)
            if command -v shellcheck &>/dev/null; then
                shellcheck "$FILE_PATH" 2>&1 | tail -5
            else
                bash -n "$FILE_PATH" 2>&1 && echo "[HOOK] Shell syntax OK" || echo "[HOOK] Shell syntax error"
            fi
            ;;
    esac
fi

exit 0
