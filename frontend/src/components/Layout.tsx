import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import Icon from './Icon'

export default function Layout({ children }: { children: ReactNode }) {
  const main = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault()
        main.current?.focus()
        main.current?.scrollIntoView({ behavior: 'instant' })
      }}>Skip to content</a>
      <header className="site-header">
        <nav className="navigation container" aria-label="Main navigation">
          <Link className="brand" to="/" aria-label="RL Demo home">
            <span className="brand-icon"><Icon name="network" size={20} /></span>
            <span>RL<span>Demo</span></span>
          </Link>
          <div className="nav-links">
            <NavLink to="/" end>Overview</NavLink>
            <NavLink to="/inference/">Live inference</NavLink>
            <span className="nav-divider" aria-hidden="true" />
            <a className="external-link nav-github" href="https://github.com/victrolles/RLDemo" target="_blank" rel="noreferrer">GitHub <Icon name="external" size={13} /></a>
          </div>
        </nav>
      </header>
      <main id="main-content" ref={main} tabIndex={-1}>{children}</main>
      <footer className="site-footer">
        <div className="footer-content container">
          <p className="footer-credit"><strong>RL Demo</strong><span aria-hidden="true">/</span> A reinforcement learning playground.</p>
          <div className="footer-links">
            <a className="external-link" href="https://github.com/victrolles/RL-on-atari-games" target="_blank" rel="noreferrer">Training code <Icon name="external" size={12} /></a>
            <a className="external-link" href="https://github.com/victrolles/portfolio" target="_blank" rel="noreferrer">Portfolio <Icon name="external" size={12} /></a>
          </div>
        </div>
      </footer>
    </div>
  )
}
