'use strict';

const QUEUEBOARD = "queueboard-backend-7f9cf5a8499a";
const QUEUEBOARD_ENDPOINT =
  `https://${QUEUEBOARD}.herokuapp.com/` +
  'api/v1/queueboard/snapshot' +
  '?repo=leanprover-community/mathlib4&rule_set_id=1';

async function fetchPrs() {
  console.log(`Fetching PR data...`);
  const response = await fetch(QUEUEBOARD_ENDPOINT);
  if (!response.ok) {
    throw new Error(`Request failed: (${response.status})`);
  }
  const payload = await response.json();
  const prList = [];
  for (const [numberStr, pr] of Object.entries(payload.prs)) {
      if (pr.state !== 'open') {
        continue;
      }
      const labels = (pr.labels || []).filter((label) => label.name);
      prList.push({
        number: Number(numberStr),
        title: pr.title,
        is_draft: pr.is_draft,
        files: pr.modified_files,
        labels,
      });
  }
  
  return prList;
}

module.exports = { fetchPrs };
