import { useRef, useState } from 'react'
import { getGifPreview } from '../data/demos'
import type { Demo } from '../data/demos'
import GamePreview from './GamePreview'
import Icon from './Icon'

function GifPreview({ src, title, onError }: { src: string; title: string; onError: () => void }) {
  const [loaded, setLoaded] = useState(false)

  return <img className={`demo-gif${loaded ? ' is-loaded' : ''}`} src={src} alt={`${title} trained agent gameplay`} onLoad={() => setLoaded(true)} onError={onError} />
}

export default function DemoCard({ demo, index }: { demo: Demo; index: number }) {
  const gif = getGifPreview(demo.id)
  const [hovered, setHovered] = useState(false)
  const [playing, setPlaying] = useState(false)
  const pointerType = useRef('mouse')
  const [failed, setFailed] = useState(false)
  const available = Boolean(gif) && !failed
  const active = available && (hovered || playing)

  return (
    <article className={`demo-card${active ? ' is-playing' : ''}`} aria-labelledby={`${demo.id}-title`}
      onPointerEnter={(event) => { if (event.pointerType !== 'touch') setHovered(true) }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'touch') {
          setHovered(false)
        }
      }}>
      <div className="demo-media">
        <GamePreview game={demo.id} />
        <span className="preview-label mono">Environment preview</span>
        <div className="preview-caption mono">
          {available && <span className="preview-hint"><Icon name="play" size={10} /><span className="hint-hover">Hover to watch</span><span className="hint-touch">Tap to watch</span></span>}
          <span className="preview-credit">Illustration</span>
        </div>
        {active && gif && <GifPreview src={gif} title={demo.title} onError={() => setFailed(true)} />}
      </div>
      {available && <button className="demo-preview-trigger" type="button" aria-label={`${demo.title} gameplay animation`} aria-pressed={active}
        onPointerDown={(event) => { pointerType.current = event.pointerType }}
        onClick={(event) => {
          if (event.detail === 0 || pointerType.current !== 'mouse') setPlaying((value) => !value)
        }} onBlur={() => setPlaying(false)} />}
      <div className="demo-content">
        <div className="demo-title-row">
          <div className="demo-title"><span className="demo-index mono">0{index + 1}</span><h3 id={`${demo.id}-title`}>{demo.title}</h3></div>
          <span className="algorithm-tag mono">{demo.algorithm}</span>
        </div>
        <p className="demo-description">{demo.description}</p>
        <div className="demo-meta mono"><span className="demo-type">{demo.category}</span><span>{demo.environment}</span></div>
      </div>
    </article>
  )
}
