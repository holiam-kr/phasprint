'use strict';
/**
 * Where a plan lives is its approval state.
 *
 *   docs/plans/draft/      awaiting the user's approval -- the hooks say nothing about it
 *   docs/plans/approved/   approved -- the hooks may push toward completion
 *   docs/plans/archives/   done
 *
 * Nothing parses the file, so there is no status line to drift out of sync, and the user can
 * see the state by looking at where the file sits. `/go` performs the draft -> approved move,
 * which makes invoking it the approval itself.
 *
 * A loose task_*.md left directly in docs/plans/ is treated as a draft. That is the safe
 * reading for repositories written against an earlier version: an unapproved plan mistaken
 * for a draft costs one missed nudge, while a draft mistaken for approved costs unwanted work.
 */

const fs = require('fs');
const path = require('path');

function expectedMissing(err) {
  return !!err && (err.code === 'ENOENT' || err.code === 'ENOTDIR');
}

function listPlansIn(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && /^task_.*\.md$/.test(e.name))
      .map((e) => e.name)
      .sort();
  } catch (err) {
    if (expectedMissing(err)) return []; // the directory simply does not exist yet
    throw err; // EACCES and friends are real problems -- let the caller report them
  }
}

/** Plans the hooks are allowed to act on. Approved only. */
function activePlans(cwd) {
  return listPlansIn(path.join(cwd, 'docs', 'plans', 'approved'));
}

module.exports = { activePlans, expectedMissing };
