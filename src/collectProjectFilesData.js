'use strict';

const fs = require('fs');
const path = require('path');

// Enumerate the *.lean files in the Mathlib directory
// with the extra metadata that we care about
function collectProjectFilesData(prList, projectName) {
  // The project name with . replaced by path separators
  // This will be treated relative to the current working directory, which
  //  is assumed to be the repository root 
  const projectRoot = path.join(...projectName.split('.'));
  
  // We will look for files under the Mathlib subdirectory, 
  // which is where 'upstream' candidates are located
  const searchRootNamespace = `${projectName}.Mathlib`;
  const searchRoot = path.join(...searchRootNamespace.split('.'));

  const fileTouchedPr = {};

  // Build a reverse mapping from file paths to PRs that touch them
  for (const pr of prList) {
    const files = pr.files || [];
    const prData = {
      number: pr.number,
      title: pr.title,
      num_files: files.length,
      is_draft: pr.is_draft,
      labels: pr.labels || [],
    };

    for (const file of files) {
      if (!fileTouchedPr[file]) {
        fileTouchedPr[file] = [prData];
      } else {
        fileTouchedPr[file].push(prData);
      }
    }
  }

  const projectFiles = [];

  // Naive fast substring counter to look for sorries
  const countOccurrences = (text, needle) => {
    let count = 0;
    let idx = text.indexOf(needle);
    while (idx !== -1) {
      count += 1;
      idx = text.indexOf(needle, idx + needle.length);
    }
    return count;
  };

  // Recursively walk the project directory for *.lean files
  // and find the data that we want, namely:
  // - which PRs touch the file
  // - number of sorries
  // - whether it has inter-project dependencies
  const walkDir = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.lean')) {
        continue;
      }
      const code = fs.readFileSync(fullPath, 'utf8');
      
      // Path relative to the project root, namely, a path of the form
      // 'Mathlib/...', which will match the path in the data for a pull request to mathlib4
      const file = path.relative(projectRoot, fullPath).split(path.sep).join('/');

      projectFiles.push({
        path: fullPath,
        prs: fileTouchedPr[file] ? fileTouchedPr[file] : [],

        // Note this is very naive and could be improved with
        // better parsing, but it should be enough for our simple purposes
        num_sorries: countOccurrences(code, ' sorry'),
        depends: code.includes(`import ${projectName}`),
      });
    }
  };

  if (fs.existsSync(searchRoot)) {
    walkDir(searchRoot);
  }

  // Sort files by path for consistent output
  projectFiles.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return projectFiles;
}

module.exports = { collectProjectFilesData };
