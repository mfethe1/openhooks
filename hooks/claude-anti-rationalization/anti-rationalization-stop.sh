#!/usr/bin/env bash
# Anti-Rationalization Stop Hook
# Detects when Claude stops with incomplete work and rationalizes why it's "done"
# Returns a blocking message to force continuation when rationalization patterns are detected.

set -euo pipefail

# Read the stop reason from stdin (Claude Code passes tool input as JSON on stdin)
INPUT=$(cat)

# Extract the stop reason/last message content
STOP_REASON=$(echo "$INPUT" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    # The stop hook receives the assistant's last message
    content = data.get('assistant_message', data.get('content', data.get('message', '')))
    if isinstance(content, list):
        content = ' '.join([b.get('text', '') for b in content if isinstance(b, dict)])
    print(str(content)[:3000])
except:
    print('')
" 2>/dev/null || echo "")

if [ -z "$STOP_REASON" ]; then
    exit 0
fi

# Check for rationalization patterns -- phrases that indicate premature stopping
RATIONALIZATION_PATTERNS=(
    "I'll leave the rest"
    "I'll let you"
    "you can handle"
    "you might want to"
    "I would recommend"
    "as a next step you"
    "when you're ready"
    "you could then"
    "feel free to"
    "I'll stop here"
    "that should be enough"
    "the remaining.*can be done"
    "I've done.*the rest is"
    "for now.*later you"
    "you may want to consider"
    "I'll leave it to you"
    "beyond the scope"
    "out of scope for now"
)

# Check for incomplete work indicators
INCOMPLETE_PATTERNS=(
    "TODO"
    "FIXME"
    "still need to"
    "remaining items"
    "left to do"
    "not yet implemented"
    "placeholder"
    "will need to be"
    "hasn't been"
    "haven't yet"
)

LOWER_REASON=$(echo "$STOP_REASON" | tr '[:upper:]' '[:lower:]')

RATIONALIZATION_FOUND=""
for pattern in "${RATIONALIZATION_PATTERNS[@]}"; do
    if echo "$LOWER_REASON" | grep -qi "$pattern"; then
        RATIONALIZATION_FOUND="$pattern"
        break
    fi
done

INCOMPLETE_FOUND=""
for pattern in "${INCOMPLETE_PATTERNS[@]}"; do
    if echo "$LOWER_REASON" | grep -qi "$pattern"; then
        INCOMPLETE_FOUND="$pattern"
        break
    fi
done

# If both rationalization AND incomplete work detected, block the stop
if [ -n "$RATIONALIZATION_FOUND" ] && [ -n "$INCOMPLETE_FOUND" ]; then
    echo '{"decision": "block", "reason": "Anti-rationalization: Detected premature stop with incomplete work. Pattern: \"'"$RATIONALIZATION_FOUND"'\" + incomplete indicator: \"'"$INCOMPLETE_FOUND"'\". Continue working on the remaining items instead of deferring to the user."}'
    exit 0
fi

# If just rationalization without clear incomplete work, warn but allow
if [ -n "$RATIONALIZATION_FOUND" ]; then
    echo '{"decision": "block", "reason": "Anti-rationalization: Detected deferral pattern \"'"$RATIONALIZATION_FOUND"'\". If work is genuinely complete, state what was accomplished. If not, continue working."}'
    exit 0
fi

# No issues detected, allow the stop
exit 0
