#!/usr/bin/env bash
# PreCompact Context Saver Hook
# Runs on the Notification hook type to detect context compression warnings.
# When context is getting large, saves critical state to a checkpoint file
# so it survives compression.

set -euo pipefail

INPUT=$(cat)

# Check if this is a context-related notification
IS_CONTEXT_WARNING=$(echo "$INPUT" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    msg = str(data.get('message', data.get('content', data.get('notification', ''))))
    # Detect context compression signals
    keywords = ['compress', 'context', 'truncat', 'limit', 'window', 'token']
    if any(k in msg.lower() for k in keywords):
        print('yes')
    else:
        print('no')
except:
    print('no')
" 2>/dev/null || echo "no")

if [ "$IS_CONTEXT_WARNING" = "yes" ]; then
    # Save a checkpoint with timestamp
    CHECKPOINT_DIR="$HOME/.claude/checkpoints"
    mkdir -p "$CHECKPOINT_DIR"
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    CHECKPOINT_FILE="$CHECKPOINT_DIR/precompact-$(date +%s).md"

    cat > "$CHECKPOINT_FILE" << CHECKPOINT
# Pre-Compaction Checkpoint
**Saved:** $TIMESTAMP
**Reason:** Context approaching limit, saving state before compression

## Recovery Instructions
After context compression, read this file to recover working state.
Check the most recent files in the working directory for current progress.
CHECKPOINT

    echo "Context checkpoint saved to $CHECKPOINT_FILE"
fi

exit 0
