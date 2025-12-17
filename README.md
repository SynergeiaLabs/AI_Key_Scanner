# AI API Key Scanner

A GitHub Action that scans pull request diffs for exposed AI API keys from OpenAI, Anthropic, and Google AI. When keys are detected, it adds GitHub annotations, comments on the PR with a summary, and fails the workflow to prevent merging.

## Features

- 🔍 Scans PR diffs for AI API keys (OpenAI, Anthropic, Google AI)
- 📝 Adds GitHub annotations for each detected key
- 💬 Comments on PRs with a summary of findings
- ❌ Fails the workflow when keys are detected
- ⚙️ Configurable ignore paths and allowlist regex patterns
- 🚀 Built with TypeScript and Node.js 20

## Supported Key Types

- **OpenAI**: `sk-` followed by alphanumeric characters (32+ chars)
- **Anthropic**: `sk-ant-` followed by alphanumeric/dash/underscore (95+ chars)
- **Google AI**: `AIza` followed by alphanumeric/dash/underscore (35 chars)

## Usage

### Basic Usage

Add this to your `.github/workflows/ai-key-scanner.yml`:

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

      - name: Run AI Key Scanner
        uses: ./
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          config-path: .github/ai-key-scanner.yml
```

### Configuration

Create a `.github/ai-key-scanner.yml` file in your repository to customize the scanner:

```yaml
# Paths to ignore when scanning (relative to repo root)
# Uses simple substring matching (not glob patterns)
ignorePaths:
  - node_modules/
  - dist/
  - build/

# Regular expression to allowlist certain key patterns
# Keys matching this regex will be ignored
allowlistRegex: "^test-.*"
```

#### Configuration Options

- `ignorePaths` (optional): Array of file path substrings to exclude from scanning. Uses simple substring matching (not glob patterns). If any part of the file path contains the substring, it will be ignored.
- `allowlistRegex` (optional): Regular expression pattern. Any detected keys matching this pattern will be ignored

### Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for API access | Yes | - |
| `config-path` | Path to configuration file | No | `.github/ai-key-scanner.yml` |

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

1. Install dependencies:
```bash
npm install
```

2. Build the action:
```bash
npm run build
```

This will:
- Compile TypeScript to JavaScript
- Bundle the code with `ncc` to `dist/index.js`
- Generate source maps and license files

### Project Structure

```
.
├── src/
│   └── index.ts          # Main action code
├── dist/                 # Compiled output (generated)
├── action.yml            # Action metadata
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

## How It Works

1. The action triggers on pull request events
2. Fetches the PR diff using GitHub API
3. Parses the diff to extract added lines
4. Scans each line for AI API key patterns
5. Applies ignore paths and allowlist filters
6. Creates GitHub annotations for each match
7. Posts a summary comment on the PR
8. Fails the workflow if any keys are found

## Security Notes

- **Never commit real API keys** to your repository, even in test files
- If keys are detected, rotate them immediately
- The scanner only checks PR diffs (added lines), not the entire codebase
- Consider setting up branch protection rules to prevent bypassing the check

## License

MIT

