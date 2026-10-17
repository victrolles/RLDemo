import { useEffect, useRef, useState } from 'react'
import { inferenceUrl } from '../lib/api'
import type { InferenceRequest, InferenceResponse, Status } from '../types/types'

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

  useEffect(() => () => {
    clearTimers.current()
    window.clearTimeout(stopTimer.current)
    const socket = socketRef.current
    socketRef.current = null
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'stop' }))
    socket?.close()
  }, [])

  function start(request: InferenceRequest) {
    if (socketRef.current && socketRef.current.readyState < WebSocket.CLOSING) return
    clearTimers.current()
    window.clearTimeout(stopTimer.current)
    stopRequested.current = false
    setError('')
    setStep(null)
    setHasFrame(false)
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
    let received = 0
    let drawn = 0
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
      const sequence = ++received
      try {
        const bitmap = await createImageBitmap(event.data)
        try {
          // Decoding is asynchronous: discard old sessions and out-of-order frames.
          if (socketRef.current !== socket || sequence <= drawn) return
          const canvas = canvasRef.current
          const context = canvas?.getContext('2d')
          if (!canvas || !context) return
          if (canvas.width !== bitmap.width) canvas.width = bitmap.width
          if (canvas.height !== bitmap.height) canvas.height = bitmap.height
          context.drawImage(bitmap, 0, 0)
          drawn = sequence
          window.clearTimeout(timeout)
          setHasFrame(true)
          setStep(frameStep)
          if (!terminal && !stopRequested.current) setStatus('running')
        } finally {
          bitmap.close()
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
    setStep(null)
    setHasFrame(false)
  }

  return { canvasRef, status, error, step, hasFrame, start, stop, reset }
}
