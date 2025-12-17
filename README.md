AI API Key Scanner – Prevent OpenAI, Anthropic & Google AI Key Leaks in GitHub PRs

A GitHub Action that prevents leaked AI API keys before merge.

AI API Key Scanner scans pull request diffs for exposed OpenAI, Anthropic, and Google AI API keys, adds inline GitHub annotations, comments on the PR with a clear summary, and fails the workflow to block merging when a key is detected.

The scan runs before code is merged, stopping leaks at the earliest possible point in the development workflow.

This is a focused, low-noise guardrail designed specifically for teams using AI APIs.

Why This Exists

AI API keys are frequently copied into scripts, tests, and examples during development.
One accidental commit can lead to:

unexpected API charges

emergency key rotation

security incidents

broken trust with customers or auditors

This action acts as a preventive control — it stops AI API keys from ever reaching main, not after the damage is done.

Features

🔍 Scans PR diffs only (added lines, not entire repositories)

🔐 Detects OpenAI, Anthropic, and Google AI API keys

📝 Adds inline GitHub annotations with file and line number

💬 Posts a clear PR comment summary

❌ Fails the workflow to block merging when keys are found

⚙️ Configurable ignore paths and allowlist regex patterns

🚀 Built with TypeScript and Node.js 20

🧠 Designed to be low-noise and deterministic

Supported Key Types

OpenAI
sk-... or sk-proj-...

Anthropic
sk-ant-...

Google AI / Gemini / Vertex
AIza...

The scanner is intentionally opinionated and focused on AI providers.

Usage
Basic Setup

Add the following workflow to your repository:

name: AI Key Scanner

on:
  pull_request:
    branches: [ main, master ]

jobs:
  scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      issues: write
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run AI API Key Scanner
        uses: SynergeiaLabs/AI_Key_Scanner@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}


That’s it.
Every pull request will now be scanned before merge.

Configuration (Optional)

Create a .github/ai-key-scanner.yml file to customize behavior:

# Paths to ignore when scanning
# Uses simple substring matching (not glob patterns)
ignorePaths:
  - node_modules/
  - dist/
  - build/

# Regular expressions to allowlist certain key patterns
# Keys matching ANY of these regexes will be ignored
allowlistRegex:
  - "^test-.*"
  - "^example-.*"

Configuration Options
Option	Description
ignorePaths	Array of path substrings to exclude from scanning (simple substring match, not glob patterns)
allowlistRegex	Array of regex patterns; matching keys are ignored
How It Works

Action triggers on pull_request

Fetches PR file diffs via GitHub API

Parses diffs and extracts added lines only

Scans each line for AI API key patterns

Applies ignore and allowlist rules

Adds inline annotations for each finding

Posts a PR summary comment

Fails the workflow to block merge if keys are found

Large diffs without patch data are skipped with a warning to avoid false confidence.

Security Notes

Never commit real API keys, even in tests or examples

Treat detected keys as compromised and rotate immediately

This action scans PR diffs only, not the full codebase

Pair with branch protection rules for best results

Pricing

Free for public repositories

Paid for private repositories (via GitHub Marketplace)

GitHub handles billing and access automatically.

Why Not Use a Generic Secret Scanner?

Generic secret scanners are powerful, but often:

noisy

over-configured

focused on all credentials, not AI usage

This action is intentionally narrow:

One job: stop AI API keys from reaching main.

License

MIT

Keywords

GitHub Action, GitHub Marketplace, OpenAI API key scanner, Anthropic API key, Google AI API key,
AI security, secret scanning, pull request security, prevent API key leaks