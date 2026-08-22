'use strict';
/**
 * The core rules compressed to one line.
 *
 * Two hooks need this same sentence and they must not drift: `gate.cjs` injects it every turn
 * so the rules survive a long conversation, and `core.cjs` falls back to it when
 * `rules/core.md` cannot be read. One literal, two callers.
 */

const ESSENTIALS =
  'phasprint: claims of done or passing rest on command output from this session only - ' +
  'stay inside the requested scope - stop and ask when blocked twice or when a destructive ' +
  'action is needed.';

module.exports = { ESSENTIALS };
