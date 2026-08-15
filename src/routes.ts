/**
 * The /api/dsh-record-replay route family: session library, timeline reads,
 * replay-pack export, and the imported-pack store. Every route carries a
 * loopback-only trust fence (mirroring dsh-ssh) — these endpoints read local
 * conversation transcripts, so LAN-exposed dsh web deployments must not
 * serve them.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { ReplayPack, SessionMeta, SessionSummary, TimelineItem } from './types.ts'
import type { SessionStore } from './session-store.ts'
import { parseTimeline, extractUserMessages } from './timeline.ts'
import type { PackStore } from './pack-store.ts'
import { buildReplayPack, parseReplayPack, packFileName, serializeReplayPack } from './replay-pack.ts'

/** API base path (the browser half fetches these same-origin). */
export const API_BASE = '/api/dsh-record-replay'

/** Cap on JSON request bodies (packs can be large, but not unbounded). */
const MAX_JSON_BODY_BYTES = 32 * 1024 * 1024

/** Loopback literal check plus browser same-origin markers. */
function isLoopbackRequest(request: IncomingMessage): boolean {
  const address = request.socket.remoteAddress
  if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') return false
  const host = request.headers.host
  if (typeof host !== 'string') return false
  let hostUrl: URL
  try { hostUrl = new URL(`http://${host}`) } catch { return false }
  if (hostUrl.hostname !== '127.0.0.1' && hostUrl.hostname !== 'localhost' && hostUrl.hostname !== '[::1]') return false
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (origin === undefined) return true
  try { return new URL(origin).host === hostUrl.host } catch { return false }
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'referrer-policy': 'no-referrer' })
  res.end(payload)
}

/** Read a JSON request body (undefined when too large or unparseable). */
async function readJsonBody(req: IncomingMessage): Promise<unknown | undefined> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > MAX_JSON_BODY_BYTES) return undefined
    chunks.push(buffer)
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return parsed
  } catch { return undefined }
}

/** URL query helper (first value, decoded). */
function queryParam(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name)
  return value === null ? undefined : value
}

/** Route family dependencies. */
export interface RecordReplayRoutesDeps {
  sessions: SessionStore
  packs: PackStore
}

/** Build every /api/dsh-record-replay route (exact paths, one handler per path). */
export function makeRoutes(deps: RecordReplayRoutesDeps): WebRoute[] {
  const { sessions, packs } = deps

  /** Guard helper: fence + method check. */
  const guard = (req: IncomingMessage, res: ServerResponse, method: string): boolean => {
    if (!isLoopbackRequest(req)) {
      writeJson(res, 403, { error: 'forbidden: loopback-only' })
      return false
    }
    if (req.method !== method) {
      writeJson(res, 405, { error: `method not allowed: ${req.method}` })
      return false
    }
    return true
  }

  /** Read a session id from the query. */
  const sessionIdOf = (url: URL): string | undefined => {
    const id = queryParam(url, 'id') ?? queryParam(url, 'sessionId')
    return id !== undefined && id !== '' ? id : undefined
  }

  return [
    // ----------------------------------------------------- library
    {
      kind: 'exact',
      path: `${API_BASE}/sessions`,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return
        try {
          writeJson(res, 200, { sessions: await sessions.list() })
        } catch (error) {
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: `${API_BASE}/session`,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return
        const url = new URL(req.url ?? '/', 'http://localhost')
        const id = sessionIdOf(url)
        if (id === undefined) { writeJson(res, 400, { error: 'id query parameter is required' }); return }
        try {
          const log = await sessions.read(id)
          if (log === undefined) { writeJson(res, 404, { error: 'session not found' }); return }
          const { meta, items } = parseTimeline(log.events)
          writeJson(res, 200, { summary: log.summary, meta, items })
        } catch (error) {
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    // ------------------------------------------------------- export
    {
      kind: 'exact',
      path: `${API_BASE}/export`,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return
        const url = new URL(req.url ?? '/', 'http://localhost')
        const id = sessionIdOf(url)
        const notes = queryParam(url, 'notes')
        if (id === undefined) { writeJson(res, 400, { error: 'sessionId query parameter is required' }); return }
        try {
          const log = await sessions.read(id)
          if (log === undefined) { writeJson(res, 404, { error: 'session not found' }); return }
          const { meta, items } = parseTimeline(log.events)
          const pack = buildReplayPack(meta, items, notes)
          const body = serializeReplayPack(pack)
          res.writeHead(200, {
            'content-type': 'application/json; charset=utf-8',
            'content-length': String(Buffer.byteLength(body, 'utf8')),
            'content-disposition': `attachment; filename="${packFileName(pack).replace(/"/g, '')}"`,
            'referrer-policy': 'no-referrer',
          })
          res.end(body)
        } catch (error) {
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    // -------------------------------------------------------- packs
    {
      kind: 'exact',
      path: `${API_BASE}/packs`,
      handler: async (req, res) => {
        const method = req.method ?? 'GET'
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: 'forbidden: loopback-only' })
          return
        }
        if (method === 'GET') {
          try {
            writeJson(res, 200, { packs: await packs.list() })
          } catch (error) {
            writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
          }
          return
        }
        if (method === 'POST') {
          const body = await readJsonBody(req)
          if (body === undefined) { writeJson(res, 400, { error: 'invalid JSON body' }); return }
          try {
            const pack = parseReplayPack(JSON.stringify(body))
            writeJson(res, 201, { pack: await packs.save(pack) })
          } catch (error) {
            writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
          }
          return
        }
        writeJson(res, 405, { error: `method not allowed: ${method}` })
      },
    },
    {
      kind: 'exact',
      path: `${API_BASE}/pack`,
      handler: async (req, res) => {
        const method = req.method ?? 'GET'
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: 'forbidden: loopback-only' })
          return
        }
        const url = new URL(req.url ?? '/', 'http://localhost')
        const id = queryParam(url, 'id')
        if (id === undefined || id === '') { writeJson(res, 400, { error: 'id query parameter is required' }); return }
        if (method === 'GET') {
          try {
            const pack = await packs.read(id)
            if (pack === undefined) { writeJson(res, 404, { error: 'pack not found' }); return }
            writeJson(res, 200, { pack })
          } catch (error) {
            writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
          }
          return
        }
        if (method === 'DELETE') {
          try {
            writeJson(res, 200, { ok: await packs.remove(id) })
          } catch (error) {
            writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
          }
          return
        }
        writeJson(res, 405, { error: `method not allowed: ${method}` })
      },
    },
  ]
}

// Type-only re-exports so the browser half can share these shapes.
export type { ReplayPack, SessionMeta, SessionSummary, TimelineItem }
