/**
 * Browser-side API client for the /api/dsh-record-replay route family.
 * Plain fetch, same origin. Types are shared from src/types.ts (pure types
 * only - safe for the client bundle).
 */
import type { PackSummary, ReplayPack, SessionMeta, SessionSummary, TimelineItem } from '../types.ts'
import { API_BASE } from '../routes.ts'

/** Error carrying the route JSON error message. */
export class ReplayApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReplayApiError'
  }
}

async function readJson<T>(response: Response): Promise<T> {
  let body: unknown
  try { body = await response.json() } catch { throw new ReplayApiError("HTTP " + response.status + ": invalid JSON response") }
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : "HTTP " + response.status
    throw new ReplayApiError(message)
  }
  return body as T
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text === '' ? '' : '?' + text
}

/** Timeline payload for one session (GET /session). */
export interface SessionTimeline {
  summary: SessionSummary
  meta: SessionMeta
  items: TimelineItem[]
}

/** The browser half data entry point. */
export class ReplayApi {
  async listSessions(): Promise<SessionSummary[]> {
    const response = await fetch(API_BASE + '/sessions')
    const body = await readJson<{ sessions: SessionSummary[] }>(response)
    return body.sessions
  }

  async getSession(id: string): Promise<SessionTimeline> {
    const response = await fetch(API_BASE + '/session' + query({ id }))
    const body = await readJson<SessionTimeline>(response)
    return body
  }

  /** Trigger a replay-pack download for one session (browser download). */
  exportPack(sessionId: string, notes?: string): void {
    const url = API_BASE + '/export' + query({ sessionId, notes })
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = ''
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  async listPacks(): Promise<PackSummary[]> {
    const response = await fetch(API_BASE + '/packs')
    const body = await readJson<{ packs: PackSummary[] }>(response)
    return body.packs
  }

  async importPack(pack: ReplayPack): Promise<PackSummary> {
    const response = await fetch(API_BASE + '/packs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(pack),
    })
    const body = await readJson<{ pack: PackSummary }>(response)
    return body.pack
  }

  async getPack(id: string): Promise<ReplayPack> {
    const response = await fetch(API_BASE + '/pack' + query({ id }))
    const body = await readJson<{ pack: ReplayPack }>(response)
    return body.pack
  }

  async deletePack(id: string): Promise<void> {
    const response = await fetch(API_BASE + '/pack' + query({ id }), { method: 'DELETE' })
    await readJson<{ ok: boolean }>(response)
  }
}
