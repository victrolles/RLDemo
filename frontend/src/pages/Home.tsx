import { useRef } from 'react'
import { Link } from 'react-router-dom'
import DemoCard from '../components/DemoCard'
import Icon from '../components/Icon'
import { demos } from '../data/demos'

export default function Home() {
  const showcase = useRef<HTMLElement>(null)

  return (
    <>
      <section className="hero container" aria-labelledby="home-title">
        <p className="eyebrow mono"><span className="status-dot" />Reinforcement learning, in action</p>
        <h1 id="home-title">Watch AI agents play<br /><span className="gradient-text">in real time.</span></h1>
        <p className="hero-description">From the first swing to the perfect turn. Watch trained agents put reinforcement learning into practice, with every decision computed live and streamed to your browser.</p>
        <div className="hero-actions">
          <Link className="button button-primary" to="/inference/"><Icon name="play" size={15} />Try live inference<Icon name="arrow" size={15} /></Link>
          <button className="button button-secondary" type="button" onClick={() => showcase.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })}>Explore the demos<Icon name="down" size={14} /></button>
        </div>
        <p className="hero-note mono">Your browser. A neural network. The next move.</p>
        <div className="process mono" aria-label="Live inference flow: trained model, live decisions, your browser">
          <span className="process-step"><Icon name="layers" size={14} />Trained model</span>
          <Icon name="arrow" size={13} />
          <span className="process-step"><Icon name="network" size={14} />Live decisions</span>
          <Icon name="arrow" size={13} />
          <span className="process-step"><Icon name="screen" size={14} />Your browser</span>
        </div>
      </section>
      <section className="showcase container" id="showcase" ref={showcase} aria-labelledby="showcase-title">
        <div className="section-heading">
          <div>
            <span className="section-kicker mono">The agent collection</span>
            <h2 id="showcase-title">Different worlds. Learned skills.</h2>
            <p>A collection of trained agents, from classic control to the open track.</p>
          </div>
          <span className="section-count mono"><span>01</span> — 04 / Environments</span>
        </div>
        <div className="video-grid">{demos.map((demo, index) => <DemoCard key={demo.id} demo={demo} index={index} />)}</div>
        <p className="gallery-note">Explore each agent in action, or head to live inference for the interactive experience.</p>
      </section>
    </>
  )
}
