import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveAgentApiUrl, resolveAgentApiKey } from '../web/agent-config.js'

// We need to mock the config module so we can control LOCAL_API_BASE_URL and LOCAL_API_KEY
vi.mock('../config.js', () => ({
  PROJECT_ROOT: '/mock/root',
  MAIN_AGENT_ID: 'marveen',
  LOCAL_API_BASE_URL: 'http://default-local:8000/v1',
  LOCAL_API_KEY: 'default-key',
}))

describe('resolveAgentApiUrl', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns the URL from valid JSON', () => {
    expect(resolveAgentApiUrl('{"apiUrl":"http://custom-local:1234/v1"}'))
      .toBe('http://custom-local:1234/v1')
  })

  it('trims whitespace from the URL', () => {
    expect(resolveAgentApiUrl('{"apiUrl":"   http://custom-local:1234/v1   "}'))
      .toBe('http://custom-local:1234/v1')
  })

  it('falls back to LOCAL_API_BASE_URL if apiUrl is missing', () => {
    expect(resolveAgentApiUrl('{}')).toBe('http://default-local:8000/v1')
  })

  it('falls back to LOCAL_API_BASE_URL if JSON is unparseable', () => {
    expect(resolveAgentApiUrl('not json')).toBe('http://default-local:8000/v1')
  })

  it('falls back to LOCAL_API_BASE_URL if apiUrl is empty string', () => {
    expect(resolveAgentApiUrl('{"apiUrl":""}')).toBe('http://default-local:8000/v1')
    expect(resolveAgentApiUrl('{"apiUrl":"   "}')).toBe('http://default-local:8000/v1')
  })
})

describe('resolveAgentApiKey', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns the key from valid JSON', () => {
    expect(resolveAgentApiKey('{"apiKey":"custom-secret-key"}'))
      .toBe('custom-secret-key')
  })

  it('trims whitespace from the key', () => {
    expect(resolveAgentApiKey('{"apiKey":"   custom-secret-key   "}'))
      .toBe('custom-secret-key')
  })

  it('falls back to LOCAL_API_KEY if apiKey is missing', () => {
    expect(resolveAgentApiKey('{}')).toBe('default-key')
  })

  it('falls back to LOCAL_API_KEY if JSON is unparseable', () => {
    expect(resolveAgentApiKey('not json')).toBe('default-key')
  })

  it('falls back to LOCAL_API_KEY if apiKey is empty string', () => {
    expect(resolveAgentApiKey('{"apiKey":""}')).toBe('default-key')
    expect(resolveAgentApiKey('{"apiKey":"   "}')).toBe('default-key')
  })
})
