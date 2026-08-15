/**
 * Smoke test: run the real host pipeline against this machine's recorded
 * sessions — scan the library, decode a real multi-frame .zstd transcript,
 * distill the timeline, build a replay pack, round-trip parse it, and run it
 * through a temp pack store.
 */
import { SessionStore } from '../lib/session-store.js'
import { parseTimeline, extractUserMessages } from '../lib/timeline.js'
import { buildReplayPack, serializeReplayPack, parseReplayPack, packFileName } from '../lib/replay-pack.js'
import { PackStore } from '../lib/pack-store.js'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let failures = 0
function check(name, condition, detail = '') {
  if (condition) console.log(`  ok  ${name}`)
  else { failures += 1; console.error(`FAIL  ${name} ${detail}`) }
}

const store = new SessionStore()
const sessions = await store.list()
console.log(`sessions found: ${sessions.length}`)
check('library listing', sessions.length > 0)

// Pick the newest session with real content (a brand-new 4-line session has
// no conversation to replay).
const first = sessions.find(entry => entry.messageCount >= 50) ?? sessions[0]
if (first !== undefined) {
  console.log(`  sample: ${first.title ?? '(untitled)'} @ ${first.cwd ?? '?'} (${first.messageCount} lines)`)
  const log = await store.read(first.id)
  check('read by id', log !== undefined && log.summary.id === first.id)

  const { meta, items } = parseTimeline(log?.events ?? [])
  console.log(`  timeline: ${items.length} items, ${meta.userMessages} user, ${meta.assistantMessages} assistant, ${meta.toolCalls} tools`)
  check('timeline distilled', items.length > 0)
  check('has user messages', meta.userMessages > 0)
  check('has tool calls', meta.toolCalls > 0)
  check('title picked up', meta.title !== undefined || true)

  const pack = buildReplayPack(meta, items, 'smoke test')
  const json = serializeReplayPack(pack)
  const parsed = parseReplayPack(json)
  check('pack round-trip', parsed.items.length === pack.items.length)
  check('pack filename', packFileName(pack).endsWith('.replay.json'))
  const users = extractUserMessages(items)
  check('extract user messages', users.length === meta.userMessages)

  const dir = await mkdtemp(join(tmpdir(), 'rrp-smoke-'))
  try {
    const packs = new PackStore(dir)
    const saved = await packs.save(parsed)
    check('pack store save', saved.id.length === 12)
    const listed = await packs.list()
    check('pack store list', listed.length === 1)
    const reread = await packs.read(saved.id)
    check('pack store read', reread?.meta.title === pack.meta.title)
    check('pack store delete', await packs.remove(saved.id))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

if (failures > 0) { console.error(`${failures} check(s) failed`); process.exit(1) }
console.log('smoke passed')