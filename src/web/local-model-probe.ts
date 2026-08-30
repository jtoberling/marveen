import { execSync } from 'child_process'

export function getValidLocalModel(url: string, apiKey: string, preferredModel: string): string | null {
  if (!url) return preferredModel
  try {
    const endpoint = url.endsWith('/v1') ? `${url}/models` : `${url.replace(/\/+$/, '')}/v1/models`
    let cmd = `curl -s --max-time 2 "${endpoint}"`
    if (apiKey) {
      cmd = `curl -s --max-time 2 -H "Authorization: Bearer ${apiKey}" "${endpoint}"`
    }
    const out = execSync(cmd, { encoding: 'utf8' })
    const data = JSON.parse(out)
    if (data && Array.isArray(data.data) && data.data.length > 0) {
      const models = data.data.map((m: any) => m.id)
      if (models.includes(preferredModel)) {
        return preferredModel
      }
      return models[0]
    }
  } catch (err: any) {
    return preferredModel
  }
  return preferredModel
}
