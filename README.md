# AI API Key Scanner – Prevent OpenAI, Anthropic & Google AI Key Leaks in GitHub PRs

A GitHub Action that **prevents leaked AI API keys before merge**.

AI API Key Scanner scans **pull request diffs** for exposed **OpenAI, Anthropic, and Google AI API keys**, adds inline GitHub annotations, comments on the PR with a clear summary, and **fails the workflow to block merging** when a key is detected.

This is a focused, low-noise guardrail designed specifically for teams using AI APIs.

---

## Why This Exists

AI API keys are frequently copied into scripts, tests, and examples during development.  
One accidental commit can lead to:

- unexpected API charges  
- emergency key rotation  
- security incidents  
- broken trust with customers or auditors  

This action acts as a **preventive control** — it stops AI API keys from ever reaching `main`.

---

## Features

- 🔍 Scans **PR diffs only** (added lines, not entire repos)
- 🔐 Detects **OpenAI, Anthropic, and Google AI** API keys
- 📝 Adds **inline GitHub annotations** with file + line number
- 💬 Posts a **clear PR comment summary**
- ❌ **Fails the workflow** to block merging when keys are found
- ⚙️ Configurable ignore paths and allowlist regex patterns
- 🚀 Built with **TypeScript** and **Node.js 20**
- 🧠 Designed to be **low-noise and deterministic**

---

## Supported Key Types

- **OpenAI**  
  `sk-...` or `sk-proj-...`

- **Anthropic**  
  `sk-ant-...`

- **Google AI / Gemini / Vertex**  
  `AIza...`

> The scanner is intentionally opinionated and focused on AI providers.

---

## Usage

### Basic Setup

Add the following workflow to your repository:

```yaml
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
