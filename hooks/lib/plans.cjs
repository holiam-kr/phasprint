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
const os = require('os');
const path = require('path');

function expectedMissing(err) {
  return !!err && (err.code === 'ENOENT' || err.code === 'ENOTDIR');
}

const MAX_HOPS = 8;

function exists(target) {
  try {
    return fs.existsSync(target);
  } catch (_) {
    return false;
  }
}

/**
 * Finds docs/plans/ by walking up from cwd, because a session opened in a subpackage of a
 * monorepo would otherwise see no plans at all and the hooks would go silent for the wrong
 * reason.
 *
 * The walk stops at the repository root: a directory holding .git is the last one examined.
 * Without that boundary a session in some unrelated folder could bind itself to a parent
 * directory's plans and start pushing to finish work nobody asked about. The home directory
 * and the filesystem root are hard stops for the same reason.
 */
function findPlansDir(cwd) {
  let dir;
  try {
    dir = path.resolve(cwd);
  } catch (_) {
    return null;
  }
  const home = path.resolve(os.homedir());

  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const candidate = path.join(dir, 'docs', 'plans');
    if (exists(candidate)) return candidate;
    if (exists(path.join(dir, '.git'))) break; // repository root -- never look outside it
    const parent = path.dirname(dir);
    if (parent === dir || dir === home) break;
    dir = parent;
  }
  return null;
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
  const plansDir = findPlansDir(cwd);
  if (!plansDir) return [];
  return listPlansIn(path.join(plansDir, 'approved'));
}

module.exports = { activePlans, findPlansDir, expectedMissing };
