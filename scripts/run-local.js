#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function parseCliArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const rawArg = argv[index];

    if (rawArg === '--help' || rawArg === '-h') {
      args.help = 'true';
      continue;
    }

    if (!rawArg.startsWith('--')) {
      throw new Error(`Unexpected positional argument: ${rawArg}`);
    }

    const equalsIndex = rawArg.indexOf('=');
    if (equalsIndex !== -1) {
      args[rawArg.slice(2, equalsIndex)] = rawArg.slice(equalsIndex + 1);
      continue;
    }

    const key = rawArg.slice(2);
    const nextArg = argv[index + 1];
    if (nextArg && !nextArg.startsWith('--')) {
      args[key] = nextArg;
      index += 1;
      continue;
    }

    args[key] = 'true';
  }

  return args;
}

function printUsage() {
  console.log(`Usage:
  node scripts/run-local.js --project-name MyProject [options]

Options:
  --input-directory PATH
  --output-directory PATH
  --include-drafts true|false
  --branch-name NAME
  --repo-url URL
  --relevant-labels "label-a,label-b"
  --help
`);
}

function requireCliArg(name, cliArgs) {
  const value = cliArgs[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required input: ${name}. Use --${name}.`);
  }
  return value.trim();
}

function inferRepoUrl(inputDirectory) {
  const remote = spawnSync(
    'git',
    ['remote', 'get-url', 'origin'],
    { cwd: inputDirectory, encoding: 'utf8' },
  );
  if (remote.status !== 0) {
    return undefined;
  }

  const rawUrl = remote.stdout.trim();
  if (!rawUrl) {
    return undefined;
  }

  if (rawUrl.startsWith('git@github.com:')) {
    return `https://github.com/${rawUrl
      .slice('git@github.com:'.length)
      .replace(/\.git$/, '')}`;
  }
  if (rawUrl.startsWith('ssh://git@github.com/')) {
    return `https://github.com/${rawUrl
      .slice('ssh://git@github.com/'.length)
      .replace(/\.git$/, '')}`;
  }
  return rawUrl.replace(/\.git$/, '');
}

const cliArgs = parseCliArgs(process.argv.slice(2));
if (cliArgs.help === 'true') {
  printUsage();
  process.exit(0);
}

if (cliArgs['website-directory'] !== undefined) {
  throw new Error('Local runs use --output-directory, not website-directory.');
}

const inputDirectory = path.resolve(cliArgs['input-directory'] || '.');
const outputDirectory = requireCliArg('output-directory', cliArgs);
const projectName = requireCliArg('project-name', cliArgs);

const inputNames = [
  'include-drafts',
  'branch-name',
  'repo-url',
  'relevant-labels',
];

const tempWebsiteDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'upstreaming-dashboard-local-'),
);
const childEnv = {
  ...process.env,
  'INPUT_WEBSITE-DIRECTORY': tempWebsiteDirectory,
  'INPUT_PROJECT-NAME': projectName,
};

for (const inputName of inputNames) {
  const value = cliArgs[inputName];
  if (value !== undefined) {
    childEnv[`INPUT_${inputName.toUpperCase()}`] = value;
  }
}
if (childEnv['INPUT_REPO-URL'] === undefined) {
  const inferredRepoUrl = inferRepoUrl(inputDirectory);
  if (inferredRepoUrl !== undefined) {
    childEnv['INPUT_REPO-URL'] = inferredRepoUrl;
  }
}

const child = spawnSync(
  process.execPath,
  [path.join(__dirname, '..', 'src', 'index.js')],
  {
    cwd: inputDirectory,
    env: childEnv,
    stdio: 'inherit',
  },
);

if (child.error) {
  fs.rmSync(tempWebsiteDirectory, { recursive: true, force: true });
  throw child.error;
}

if (child.status !== 0) {
  fs.rmSync(tempWebsiteDirectory, { recursive: true, force: true });
  process.exit(child.status === null ? 1 : child.status);
}

try {
  const generatedDirectory = path.join(
    tempWebsiteDirectory,
    '_includes',
    '_upstreaming_dashboard',
  );
  const resolvedOutputDirectory = path.resolve(inputDirectory, outputDirectory);

  fs.mkdirSync(resolvedOutputDirectory, { recursive: true });
  for (const fileName of fs.readdirSync(generatedDirectory)) {
    fs.copyFileSync(
      path.join(generatedDirectory, fileName),
      path.join(resolvedOutputDirectory, fileName),
    );
  }
  console.log(`Copied generated files to ${resolvedOutputDirectory}`);
} finally {
  fs.rmSync(tempWebsiteDirectory, { recursive: true, force: true });
}
