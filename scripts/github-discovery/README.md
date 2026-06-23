# GitHub Discovery

Automated tool to discover GitHub repos that are gaining traction before going mainstream.

## Setup

```bash
# Optional: set GitHub token for higher API rate limits
export GITHUB_TOKEN="your_token_here"

# Run
python3 scripts/github-discovery/main.py
```

## How it works

1. **Data Sources**: GitHub Trending, GitHub Search API, Hacker News Show HN
2. **Scoring**: 3 dimensions (acceleration, quality, anti-spam) totaling 100 points
3. **Output**: Markdown report to stdout and `output/` directory
4. **Tracking**: SQLite database prevents duplicate recommendations

## Files

- `main.py` - Entry point
- `sources.py` - Data collection from 3 sources
- `scorer.py` - Scoring logic
- `anti_spam.py` - Anti-spam detection
- `db.py` - SQLite database operations
- `config.py` - Configuration
