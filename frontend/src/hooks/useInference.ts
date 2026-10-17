import { useCallback, useEffect, useRef, useState } from 'react'
import { inferenceUrl } from '../lib/api'
import type { InferenceRequest, InferenceResponse, Status } from '../types/types'

type RecordedFrame = { image: Blob; metadata: InferenceResponse }

export function useInference() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const clearTimers = useRef<() => void>(() => {})
  const stopRequested = useRef(false)
  const stopTimer = useRef<number | undefined>(undefined)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [step, setStep] = useState<InferenceResponse | null>(null)
  const [hasFrame, setHasFrame] = useState(false)
  const history = useRef<RecordedFrame[]>([])
  const renderTicket = useRef(0)
  const replayReady = useRef(false)
  const targetIndex = useRef(-1)
  const [historyLength, setHistoryLength] = useState(0)
  const [historyIndex, setHistoryIndex] = useState(-1)

  const present = useCallback(async (frame: RecordedFrame, index: number) => {
    const ticket = ++renderTicket.current
    let bitmap: ImageBitmap
    try {
      bitmap = await createImageBitmap(frame.image)
    } catch (error) {
      if (ticket !== renderTicket.current || history.current[index] !== frame) return false
      throw error
    }
    try {
      // A rapid seek or new session can supersede an asynchronous decode.
      if (ticket !== renderTicket.current || history.current[index] !== frame) return false
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (!canvas || !context) return false
      if (canvas.width !== bitmap.width) canvas.width = bitmap.width
      if (canvas.height !== bitmap.height) canvas.height = bitmap.height
      context.drawImage(bitmap, 0, 0)
      setHasFrame(true)
      setStep(frame.metadata)
      setHistoryIndex(index)
      return true
    } finally {
      bitmap.close()
    }
  }, [])

  const seek = useCallback((index: number) => {
    if (!replayReady.current || history.current.length === 0) return
    const next = Math.max(0, Math.min(index, history.current.length - 1))
    targetIndex.current = next
    void present(history.current[next], next).catch(() => {
      setError('Could not display this recorded frame. Try another step.')
    })
  }, [present])

  const moveReplay = useCallback((offset: number) => {
    seek(targetIndex.current + offset)
  }, [seek])

  function clearHistory() {
    ++renderTicket.current
    history.current = []
    replayReady.current = false
    targetIndex.current = -1
    setHistoryLength(0)
    setHistoryIndex(-1)
    setStep(null)
    setHasFrame(false)
  }

  useEffect(() => () => {
    clearTimers.current()
    window.clearTimeout(stopTimer.current)
    const socket = socketRef.current
    socketRef.current = null
    ++renderTicket.current
    history.current = []
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'stop' }))
    socket?.close()
  }, [])

  function start(request: InferenceRequest) {
    if (socketRef.current && socketRef.current.readyState < WebSocket.CLOSING) return
    clearTimers.current()
    window.clearTimeout(stopTimer.current)
    stopRequested.current = false
    setError('')
    clearHistory()
    setStatus('connecting')

    let socket: WebSocket
    try {
      socket = new WebSocket(inferenceUrl())
    } catch {
      setError('Could not connect to the inference server. Check the server address.')
      setStatus('error')
      return
    }
    socket.binaryType = 'blob'
    socketRef.current = socket
    let metadata: InferenceResponse | null = null
    let terminal: 'finished' | 'stopped' | 'error' | null = null
    let heartbeat: number | undefined
    let timeout: number | undefined
    clearTimers.current = () => {
      window.clearInterval(heartbeat)
      window.clearTimeout(timeout)
      window.clearTimeout(stopTimer.current)
    }

    function fail(message: string) {
      if (socketRef.current !== socket) return
      terminal = 'error'
      replayReady.current = true
      clearTimers.current()
      setError(message)
      setStatus('error')
      socket.close()
    }

    timeout = window.setTimeout(() => fail('The server took too long to connect. Please try again.'), 10000)
    socket.onopen = () => {
      if (socketRef.current !== socket) return
      window.clearTimeout(timeout)
      socket.send(JSON.stringify(request))
      heartbeat = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'heartbeat' }))
      }, 5000)
      timeout = window.setTimeout(() => fail('The model did not produce a frame. Try another checkpoint.'), 60000)
    }

    socket.onmessage = async (event: MessageEvent) => {
      if (socketRef.current !== socket || terminal === 'error') return
      if (typeof event.data === 'string') {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'step') {
            metadata = message as InferenceResponse
          } else if (message.type === 'finished' || message.type === 'stopped') {
            terminal = message.type
            replayReady.current = true
            clearTimers.current()
            setStatus(message.type)
          } else if (message.type === 'error') {
            fail(message.message || 'The inference session failed. Please try another model.')
          }
        } catch {
          fail('The server sent an unreadable response. Please restart the session.')
        }
        return
      }

      if (!(event.data instanceof Blob) || !metadata) return
      const frameStep = metadata
      metadata = null
      const frame = { image: event.data, metadata: frameStep }
      const index = history.current.push(frame) - 1
      targetIndex.current = index
      setHistoryLength(history.current.length)
      try {
        const displayed = await present(frame, index)
        if (displayed && socketRef.current === socket) {
          window.clearTimeout(timeout)
          if (!terminal && !stopRequested.current) setStatus('running')
        }
      } catch {
        fail('Could not display the live frame. Please restart the session.')
      }
    }

    socket.onerror = () => {
      if (!stopRequested.current) fail('The connection to the inference server failed. Check that it is running, then try again.')
    }
    socket.onclose = (event) => {
      if (socketRef.current !== socket) return
      clearTimers.current()
      replayReady.current = true
      if (terminal) return
      if (stopRequested.current) {
        setStatus('stopped')
      } else {
        setStatus('error')
        setError(event.code === 1013
          ? 'The inference server is busy. Try again shortly.'
          : event.code === 1008
            ? 'This model selection is unavailable. Refresh the model list and try again.'
            : 'The connection ended before the episode finished. Please try again.')
      }
    }
  }

  function stop() {
    const socket = socketRef.current
    if (!socket || socket.readyState >= WebSocket.CLOSING) return
    stopRequested.current = true
    setStatus('stopping')
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'stop' }))
      stopTimer.current = window.setTimeout(() => socket.close(), 5000)
    } else {
      socket.close()
    }
  }

  function reset() {
    if (socketRef.current && socketRef.current.readyState < WebSocket.CLOSING) return
    clearTimers.current()
    socketRef.current = null
    setStatus('idle')
    setError('')
    clearHistory()
  }

  const canReplay = historyLength > 0 && ['finished', 'stopped', 'error'].includes(status)
  const isReplaying = canReplay && historyIndex >= 0 && historyIndex < historyLength - 1

  return { canvasRef, status, error, step, hasFrame, start, stop, reset,
    historyLength, historyIndex, canReplay, isReplaying, seek, moveReplay }
}
