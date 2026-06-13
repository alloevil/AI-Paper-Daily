# Auto-switch to zsh for interactive shells
export PATH="/root/.openclaw/workspace/.local/bin:$PATH"
if [ -x /root/.openclaw/workspace/.local/bin/zsh ] && [ -t 1 ]; then
  exec /root/.openclaw/workspace/.local/bin/zsh
fi
