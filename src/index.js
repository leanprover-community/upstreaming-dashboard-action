#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { fetchPrs } = require('./fetchPrs');
const { collectProjectFilesData } = require('./collectProjectFilesData');
const { writeOutputFiles } = require('./render');

async function main() {
  // Process inputs. 
  // Our action is simple enough to do this manually through the environment
  // to avoid adding a dependency on the GitHub Actions toolkit.
  const inputwebsiteDir = process.env['INPUT_WEBSITE-DIRECTORY'];
  const inputIncludeDrafts = process.env['INPUT_INCLUDE-DRAFTS'];
  const inputBranchName = process.env['INPUT_BRANCH-NAME'];
  const inputRepoUrl = process.env['INPUT_REPO-URL'];
  const inputSearchRoot = process.env['INPUT_SEARCH-ROOT'];
  const inputProjectName = process.env['INPUT_PROJECT-NAME'];
  const inputRelevantLabels = process.env['INPUT_RELEVANT-LABELS'];

  // Process inputs into our parameters
  const websiteDir = (inputwebsiteDir || '').trim() || '.';
  const includeDrafts =
    ((inputIncludeDrafts || 'false').trim().toLowerCase() === 'true');
  const branchName = (inputBranchName || 'main').trim() || 'main';
  const repoUrlInput =
    (inputRepoUrl || '').trim();
  const projectName = inputProjectName.trim();
  const relevantLabels = (inputRelevantLabels || '')
    .split(/[\n,]/)
    .map((label) => label.trim())
    .filter((label) => label.length > 0);

  const repoUrl =
    (repoUrlInput ||
      `${process.env['GITHUB_SERVER_URL']}/${process.env['GITHUB_REPOSITORY']}`)
      .replace(/\/+$/, ''); // Remove trailing slashes

  console.log('Inputs:');
  console.log(`  OUTPUT-DIR: ${inputwebsiteDir ?? ''}`);
  console.log(`  INCLUDE-DRAFTS: ${inputIncludeDrafts ?? ''}`);
  console.log(`  BRANCH-NAME: ${inputBranchName ?? ''}`);
  console.log(`  REPO-URL: ${inputRepoUrl ?? ''}`);
  console.log(`  SEARCH-ROOT: ${inputSearchRoot ?? ''}`);
  console.log(`  PROJECT-NAME: ${inputProjectName ?? ''}`);
  console.log(`  RELEVANT-LABELS: ${inputRelevantLabels ?? ''}`);
  console.log('Using parameters:');
  console.log(`  Project name: ${projectName}`);
  console.log(`  Output directory: ${websiteDir}`);
  console.log(`  Including draft PRs: ${includeDrafts}`);
  console.log(`  Branch name: ${branchName}`);
  console.log(`  Relevant labels: ${relevantLabels.length > 0 ? relevantLabels.join(', ') : '(none)'}`);
  
  // Act
  // 1. Gather PR data
  console.log(`Gathering PR data from the queueboard...`);
  const prList = await fetchPrs();

  // 2. Build project file data
  console.log(`Building project file data for project: ${projectName}...`);
  const projectFiles = collectProjectFilesData(prList, projectName);

  // 3. Write output files
  fs.mkdirSync(websiteDir, { recursive: true });
  console.log('Writing output files...');
  writeOutputFiles(projectFiles, {
    websiteDir,
    repoUrl,
    includeDrafts,
    branchName,
    relevantLabels,
  });
  
  console.log('Done.');
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
