import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

interface Config {
  ignorePaths?: string[];
  allowlistRegex?: string[];
}

interface KeyMatch {
  file: string;
  line: number;
  keyType: string;
  match: string;
}

// API key patterns
const KEY_PATTERNS = {
  openai: {
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
    name: 'OpenAI API Key'
  },
  anthropic: {
    pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,
    name: 'Anthropic API Key'
  },
  google: {
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    name: 'Google AI API Key'
  }
};

async function loadConfig(configPath: string): Promise<Config> {
  try {
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(configContent) as Config;
      return config || {};
    }
  } catch (error) {
    core.warning(`Failed to load config file: ${error}`);
  }
  return {};
}

function shouldIgnorePath(filePath: string, config: Config): boolean {
  if (!config.ignorePaths || config.ignorePaths.length === 0) {
    return false;
  }

  for (const ignorePath of config.ignorePaths) {
    if (filePath.includes(ignorePath)) {
      return true;
    }
  }

  return false;
}

function matchesAllowlist(match: string, config: Config): boolean {
  if (!config.allowlistRegex || config.allowlistRegex.length === 0) {
    return false;
  }

  for (const regexStr of config.allowlistRegex) {
    try {
      const regex = new RegExp(regexStr);
      if (regex.test(match)) {
        return true;
      }
    } catch (error) {
      core.warning(`Invalid allowlist regex: ${regexStr} - ${error}`);
    }
  }

  return false;
}

function scanForKeys(
  content: string,
  filePath: string,
  lineMap: Map<number, number>,
  config: Config
): KeyMatch[] {
  const matches: KeyMatch[] = [];
  const lines = content.split('\n');

  for (let contentLineIndex = 0; contentLineIndex < lines.length; contentLineIndex++) {
    const line = lines[contentLineIndex];
    const actualLineNumber = lineMap.get(contentLineIndex) || contentLineIndex + 1;
    
    for (const [key, { pattern, name }] of Object.entries(KEY_PATTERNS)) {
      // Reset regex lastIndex for each line (global regexes maintain state)
      pattern.lastIndex = 0;
      const lineMatches = line.matchAll(pattern);

      for (const match of lineMatches) {
        const matchText = match[0];
        
        // Check allowlist
        if (matchesAllowlist(matchText, config)) {
          core.debug(`Key in ${filePath}:${actualLineNumber} matches allowlist, skipping`);
          continue;
        }

        matches.push({
          file: filePath,
          line: actualLineNumber,
          keyType: name,
          match: matchText.substring(0, 20) + '...' // Only show partial key
        });
      }
    }
  }

  return matches;
}

async function getPRFiles(octokit: any, owner: string, repo: string, prNumber: number): Promise<any[]> {
  const allFiles: any[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
      per_page: perPage,
      page
    });

    allFiles.push(...files);

    if (files.length < perPage) {
      break;
    }
    page++;
  }

  return allFiles;
}

async function getPRDiff(octokit: any, owner: string, repo: string, prNumber: number): Promise<string> {
  const files = await getPRFiles(octokit, owner, repo, prNumber);

  let fullDiff = '';
  for (const file of files) {
    if (!file.patch) {
      core.warning(`File ${file.filename} has no patch (likely too large), skipping`);
      continue;
    }
    fullDiff += `--- a/${file.filename}\n+++ b/${file.filename}\n`;
    fullDiff += file.patch;
    fullDiff += '\n';
  }

  return fullDiff;
}

interface FileContent {
  content: string;
  lineMap: Map<number, number>; // Maps content line index to actual file line number
}

function parseDiff(diff: string): Map<string, FileContent> {
  const files = new Map<string, FileContent>();
  const lines = diff.split('\n');
  let currentFile = '';
  let currentContent = '';
  let currentLineMap = new Map<number, number>();
  let contentLineIndex = 0;
  let newLine = 0; // Current line number in the new file version

  for (const line of lines) {
    if (line.startsWith('--- a/')) {
      if (currentFile && currentContent) {
        files.set(currentFile, { content: currentContent, lineMap: currentLineMap });
      }
      currentFile = line.substring(6); // Remove '--- a/'
      currentContent = '';
      currentLineMap = new Map();
      contentLineIndex = 0;
      newLine = 0;
    } else if (line.startsWith('+++ b/')) {
      // Skip, we already have the file from --- a/
    } else if (line.startsWith('@@')) {
      // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      const hunkMatch = line.match(/@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
      if (hunkMatch) {
        newLine = parseInt(hunkMatch[1], 10); // newStart is the starting line number in the new file
      }
    } else if (currentFile) {
      // Guard against diff headers appearing inside hunks
      if (line.startsWith('+++ b/') || line.startsWith('--- a/')) {
        continue;
      }

      const firstChar = line.charAt(0);
      
      if (firstChar === '+') {
        // Added line (not +++ header)
        currentContent += line.substring(1) + '\n';
        currentLineMap.set(contentLineIndex, newLine);
        contentLineIndex++;
        newLine++;
      } else if (firstChar === ' ') {
        // Context line
        newLine++;
      } else if (firstChar === '-') {
        // Removed line (not --- header) - DO NOT increment newLine
        // (only removed lines don't exist in the new file)
      }
    }
  }

  if (currentFile && currentContent) {
    files.set(currentFile, { content: currentContent, lineMap: currentLineMap });
  }

  return files;
}

async function createPRComment(
  octokit: any,
  owner: string,
  repo: string,
  prNumber: number,
  matches: KeyMatch[]
): Promise<void> {
  let comment = '## 🔒 AI API Key Scanner Results\n\n';
  
  if (matches.length === 0) {
    comment += '✅ No AI API keys detected in this PR.\n';
  } else {
    comment += `⚠️ **${matches.length} AI API key(s) detected in this PR:**\n\n`;
    
    // Group by file
    const matchesByFile = new Map<string, KeyMatch[]>();
    for (const match of matches) {
      if (!matchesByFile.has(match.file)) {
        matchesByFile.set(match.file, []);
      }
      matchesByFile.get(match.file)!.push(match);
    }

    for (const [file, fileMatches] of matchesByFile) {
      comment += `### \`${file}\`\n\n`;
      for (const match of fileMatches) {
        comment += `- Line ${match.line}: ${match.keyType} detected (${match.match})\n`;
      }
      comment += '\n';
    }

    comment += '**Please remove these keys and rotate them immediately if they were committed.**\n';
  }

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body: comment
  });
}

async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: true });
    const configPath = core.getInput('config-path') || '.github/ai-key-scanner.yml';
    
    const octokit = github.getOctokit(token);
    const context = github.context;

    if (context.eventName !== 'pull_request') {
      core.info('This action only works on pull_request events');
      return;
    }

    const prNumber = context.payload.pull_request?.number;
    if (!prNumber) {
      core.setFailed('Could not determine PR number');
      return;
    }

    const owner = context.repo.owner;
    const repo = context.repo.repo;

    core.info('Loading configuration...');
    const config = await loadConfig(configPath);

    core.info('Fetching PR diff...');
    const diff = await getPRDiff(octokit, owner, repo, prNumber);
    const files = parseDiff(diff);

    core.info(`Scanning ${files.size} file(s) for AI API keys...`);
    const allMatches: KeyMatch[] = [];

    for (const [filePath, fileData] of files) {
      if (shouldIgnorePath(filePath, config)) {
        core.debug(`Ignoring ${filePath} (matches ignorePaths)`);
        continue;
      }

      const matches = scanForKeys(fileData.content, filePath, fileData.lineMap, config);
      allMatches.push(...matches);

      // Add annotations for each match
      for (const match of matches) {
        core.error(`Found ${match.keyType} in ${match.file} at line ${match.line}`, {
          file: match.file,
          startLine: match.line,
          endLine: match.line,
          title: `${match.keyType} detected`
        });
      }
    }

    // Create PR comment
    core.info('Creating PR comment...');
    await createPRComment(octokit, owner, repo, prNumber, allMatches);

    if (allMatches.length > 0) {
      core.setFailed(`Found ${allMatches.length} AI API key(s) in the PR. Please remove them and rotate the keys.`);
    } else {
      core.info('No AI API keys detected. ✅');
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('Unknown error occurred');
    }
  }
}

run();

