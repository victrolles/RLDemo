import { useEffect } from 'react'
import Icon from './Icon'

type Props = {
  count: number
  index: number
  enabled: boolean
  step: number | undefined
  onSeek: (index: number) => void
  onMove: (offset: number) => void
}

export default function ReplayControls({ count, index, enabled, step, onSeek, onMove }: Props) {
  useEffect(() => {
    if (!enabled) return
    function keydown(event: KeyboardEvent) {
      const target = event.target
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, select, textarea, [role="slider"]'))) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      onMove(event.key === 'ArrowLeft' ? -1 : 1)
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [enabled, onMove])

  if (!count) return null

  return (
    <div className={`replay-controls${enabled ? ' is-ready' : ''}`} aria-label="Episode replay">
      <div className="replay-heading"><span>{enabled ? 'Episode replay' : 'Recording episode'}</span><span className="mono">{Math.max(0, index + 1)} / {count} frames</span></div>
      <div className="replay-navigation">
        <button type="button" disabled={!enabled || index <= 0} onClick={() => onMove(-1)} aria-label="Previous frame" title="Previous frame (←)"><Icon name="left" size={17} /></button>
        <input type="range" min={0} max={Math.max(0, count - 1)} value={Math.max(0, index)} disabled={!enabled || count < 2} onChange={(event) => onSeek(Number(event.target.value))} aria-label="Recorded episode timeline" aria-valuetext={step === undefined ? 'Waiting for a frame' : `Step ${step}, frame ${index + 1} of ${count}`} />
        <button type="button" disabled={!enabled || index >= count - 1} onClick={() => onMove(1)} aria-label="Next frame" title="Next frame (→)"><Icon name="right" size={17} /></button>
        <button className="replay-last" type="button" disabled={!enabled || index >= count - 1} onClick={() => onSeek(count - 1)}>Last frame</button>
      </div>
      <p>{enabled ? <>Use <kbd>←</kbd> <kbd>→</kbd> or drag the timeline to inspect each decision.</> : 'Every step is saved. Replay becomes available when the episode ends.'}</p>
    </div>
  )
}
