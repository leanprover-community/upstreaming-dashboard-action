'use strict';

const fs = require('fs');
const path = require('path');

const PR_ICON_SVG = '<svg class="upstreaming-dashboard-open-pr-logo" title="Open" viewBox="0 0 16 16" version="1.1" width="16" height="16" aria-hidden="true"><path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"></path></svg>';

function outputPathForFile(websiteDir, fileName) {
  return path.join(websiteDir, '_includes', '_upstreaming_dashboard', fileName);
}

function writeReadyToUpstream(projectFiles, config) {
  const {
    websiteDir,
    repoUrl,
    includeDrafts,
    branchName,
    relevantLabels,
  } = config;
  let text = '';
  const relevantLabelsList = (relevantLabels || [])
    .map((label) => label.trim())
    .filter((label) => label.length > 0);
  
  // Lookup set
  const relevantLabelSet = new Set(relevantLabelsList.map((label) => label.toLowerCase()));

  const hasRelevantLabel = (pr) => {
    return (pr.labels || []).some((label) => {
      const normalizedName = label.name.trim().toLowerCase();
      return relevantLabelSet.has(normalizedName);
    });
  };

  const renderPrItem = (pr) => {
    const prUrl = `https://github.com/leanprover-community/mathlib4/pull/${pr.number}`;
    const labels = pr.labels || [];
    const labelText = labels.length > 0
      ? `${labels
          .map((label) => {
            const color = label.color ? `#${label.color}` : "#000";
            const styledName = color
              ? `<span style="font-size: 70%; color: ${color}">${label.name}</span>`
              : label.name;
            if (label.url) {
              return `<a href="${label.url}">${styledName}</a>`;
            }
            return styledName;
          })
          .join(', ')}`
      : '';
    const labelBlock = labelText
      ? `\n        <div class="upstreaming-dashboard-pr-labels">${labelText}</div>`
      : '';
    return `        <li class="upstreaming-dashboard-pr-item"><a href="${prUrl}">${PR_ICON_SVG} ${pr.title} #${pr.number}</a>${labelBlock}</li>\n`;
  };

  const renderPrGroup = (title, prs) => {
    if (prs.length === 0) {
      return '';
    }
    let groupText = '';
    if (title) {
      groupText += `      <div class="upstreaming-dashboard-pr-group">\n`;
      groupText += `        <div class="upstreaming-dashboard-pr-group-title"><strong>${title}</strong></div>\n`;
    }
    groupText += `        <ul class="upstreaming-dashboard-pr-list">\n`;
    for (const pr of prs) {
      groupText += renderPrItem(pr);
    }
    groupText += `        </ul>\n`;
    if (title) {
    groupText += `      </div>\n`;
    }
    return groupText;
  };


  text += `<div class="upstreaming-dashboard-ready-list">\n`;
  if (relevantLabelSet.size > 0) {
    const pluralText = relevantLabelSet.size === 1 ? 'the following label' : 'any of the following labels'; 
    const labelListText = relevantLabelsList.join(', ');
    text += `  <div class="upstreaming-dashboard-relevant-labels-note"><i>PRs are grouped as 'relevant' if they contain ${pluralText}: <b>${labelListText}</b></i></div><br/>\n`;
  }
  for (const file of projectFiles) {
    // Skip files that are not ready to upstream
    if (file.num_sorries > 0) {
      continue;
    }
    if (file.depends) {
      continue;
    }

    const prsToShow = file.prs.filter((pr) => !(pr.is_draft && !includeDrafts));
    const normalizedPath = file.path.split(path.sep).join('/');
    const projectName = normalizedPath.replace(/\//g, '.').replace(/\.lean$/, '');

    const url = `${repoUrl}/blob/${branchName}/${normalizedPath}`;
    text += `  <div class="upstreaming-dashboard-ready-item">\n`;
    text += `    <div class="upstreaming-dashboard-file-link"><a href="${url}"><code>${projectName}</code></a></div>\n`;
    if (prsToShow.length === 0) {
      text += `    <div class="upstreaming-dashboard-empty"><em>No open pull requests.</em></div>\n`;
      text += `  </div>\n`;
      continue;
    }

    // Only group PRs if there are relevant labels to group by
    const useGrouping = relevantLabelSet.size > 0;
    const selectedPrs = useGrouping ? prsToShow.filter(hasRelevantLabel) : prsToShow;
    const otherPrs = useGrouping ? prsToShow.filter((pr) => !hasRelevantLabel(pr)) : [];
    
    // Construct PR summary
    const prCountLabel = prsToShow.length === 1 ? '1 open pull request' : `${prsToShow.length} open pull requests`;
    const summaryLabel = useGrouping
      ? `${prCountLabel} (${selectedPrs.length} with relevant labels)`
      : prCountLabel;
    text += `    <details class="upstreaming-dashboard-pr-details">\n`;
    text += `      <summary style="cursor: pointer;">${summaryLabel}</summary>\n`;
    if (useGrouping) {
      text += renderPrGroup('Relevant', selectedPrs);
      text += renderPrGroup('Other', otherPrs);
    } else {
      text += renderPrGroup(null, prsToShow);
    }
    text += `    </details>\n`;
    text += `  </div>\n`;
  }
  text += `</div>\n`;

  const outputPath = outputPathForFile(websiteDir, 'ready_to_upstream.md');
  fs.writeFileSync(outputPath, text);
  console.log(`Wrote ${outputPath}`);
}

function writeEasyToUnlock(projectFiles, config) {
  const {
    websiteDir,
    repoUrl,
    branchName,
  } = config;
  // TODO: Should we find 'easy to unlock' files only in the 'Mathlib/*' directory or also 
  // match other files in the project? 
  let text = '';
  text += `<div class="upstreaming-dashboard-easy-list">\n`;
  for (const file of projectFiles) {
    if (file.num_sorries === 0) {
      continue;
    }
    if (file.depends) {
      continue;
    }
    const normalizedPath = file.path.split(path.sep).join('/');
    const projectName = normalizedPath.replace(/\//g, '.').replace(/\.lean$/, '');
    const numSorries = file.num_sorries;
    const url = `${repoUrl}/blob/${branchName}/${normalizedPath}`;
    const sorryLabel = numSorries === 1 ? '1 sorry' : `${numSorries} sorries`;
    text += `  <div class="upstreaming-dashboard-easy-item" style="display:flex;gap:1em">\n`;
    text += `    <div class="upstreaming-dashboard-file-link"><a href="${url}"><code>${projectName}</code></a></div>\n`;
    text += `    <div class="upstreaming-dashboard-file-metric">${sorryLabel}</div>\n`;
    text += `  </div>\n`;
  }
  text += `</div>\n`;

  const outputPath = outputPathForFile(websiteDir, 'easy_to_unlock.md');
  fs.writeFileSync(outputPath, text);
  console.log(`Wrote ${outputPath}`);
}

function prepareWebsiteDirectory(websiteDir) {
  // Copy the assets folder to the output directory
  // This is the 'ready-to-include' full version of the dashboard that this action produces
  const assetPath = path.join(__dirname, 'assets');
  const destPath = path.join(websiteDir, '_includes/_upstreaming_dashboard');
  fs.mkdirSync(destPath, { recursive: true });
  const assetFiles = fs.readdirSync(assetPath);
  for (const file of assetFiles) {
    const srcFile = path.join(assetPath, file);
    const destFile = path.join(destPath, file);
    fs.copyFileSync(srcFile, destFile);
  }
  console.log(`Output dashboard to ${destPath}`);
}

function writeOutputFiles(projectFiles, config) {
  prepareWebsiteDirectory(config.websiteDir);
  writeReadyToUpstream(projectFiles, config);
  writeEasyToUnlock(projectFiles, config);
}

module.exports = { writeOutputFiles };
