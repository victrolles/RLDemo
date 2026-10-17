const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export async function fetchApi<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
  })
  if (!response.ok) throw new Error('The inference server could not complete this request.')
  return response.json() as Promise<T>
}

export function inferenceUrl() {
  const url = new URL(`${base}/inference`, window.location.href)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}
