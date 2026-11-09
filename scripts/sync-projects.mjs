#!/usr/bin/env node
/**
 * Automated Portfolio Sync Script for Scott Forest (@critmaths)
 * Fetches live repositories, release tags, and activity from GitHub API
 * and updates projects.json so new projects and updates appear automatically.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECTS_PATH = path.resolve(__dirname, '..', 'projects.json');
const USERNAME = 'critmaths';
const IGNORED_REPOS = new Set(['critmaths.github.io', 'critmaths']);

async function fetchJson(url) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'critmaths-portfolio-sync'
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  return res.json();
}

async function main() {
  const raw = await fs.readFile(PROJECTS_PATH, 'utf8');
  const data = JSON.parse(raw);

  const repos = await fetchJson(`https://api.github.com/users/${USERNAME}/repos?sort=pushed&per_page=100`);
  if (!Array.isArray(repos)) {
    console.log('Could not fetch repositories from GitHub API; keeping existing snapshot.');
    return;
  }

  const existingByRepo = new Map(data.flagship.map(item => [item.repo.toLowerCase(), item]));

  for (const r of repos) {
    if (r.private || r.fork || IGNORED_REPOS.has(r.name)) continue;

    const latestRelease = await fetchJson(`https://api.github.com/repos/${USERNAME}/${r.name}/releases/latest`);
    const versionTag = latestRelease?.tag_name || null;

    const key = r.name.toLowerCase();
    if (existingByRepo.has(key)) {
      const item = existingByRepo.get(key);
      item.stars = r.stargazers_count ?? item.stars;
      item.pushedAt = r.pushed_at || item.pushedAt;
      if (versionTag) item.version = versionTag;
      if (r.description && !item.summary) item.summary = r.description;
    } else {
      // Automatically onboard newly created public repositories!
      data.flagship.push({
        repo: r.name,
        title: r.name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        subtitle: r.description || 'Active Engineering Repository',
        category: (r.language === 'Rust') ? 'rust-security' : 'web-security',
        featured: false,
        badge: versionTag ? `Release ${versionTag}` : 'New Repository',
        version: versionTag || 'Active',
        language: r.language || 'Multi-Language',
        stars: r.stargazers_count || 0,
        pushedAt: r.pushed_at,
        repoUrl: r.html_url,
        liveUrl: r.homepage || r.html_url,
        downloadUrl: latestRelease?.html_url || r.html_url,
        summary: r.description || 'Newly published open-source project by Scott Forest (@critmaths).',
        highlights: [
          `Automatically synced from GitHub repository ${USERNAME}/${r.name}`,
          `Primary language: ${r.language || 'Systems / Full-Stack'}`
        ],
        stack: r.topics?.length ? r.topics.slice(0, 6) : [r.language || 'Software Engineering'],
        blueprint: `[GitHub: ${USERNAME}/${r.name}] ──► Live Automated Portfolio Sync`
      });
    }
  }

  data.generatedAt = new Date().toISOString();
  await fs.writeFile(PROJECTS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Synced ${data.flagship.length} projects at ${data.generatedAt}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
