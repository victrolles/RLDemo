import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Icon from '../components/Icon'
import GamePreview from '../components/GamePreview'
import { demos } from '../data/demos'
import { fetchApi } from '../lib/api'
import { useInference } from '../hooks/useInference'
import type { Environment, InferenceRequest, ModelCatalog, ModelSelection, Status } from '../types/types'

const policies: { value: ModelSelection; label: string; description: string }[] = [
  { value: 'best', label: 'Best trained model', description: 'Watch the checkpoint saved as the best model.' },
  { value: 'worst', label: 'Worst trained model', description: 'See how the checkpoint saved as the worst model behaves.' },
  { value: 'random', label: 'Random saved model', description: 'Pick a random checkpoint from this collection.' },
  { value: 'custom', label: 'Custom checkpoint', description: 'Choose a specific checkpoint from the models on the server.' },
  { value: 'random_actions', label: 'Random actions', description: 'A baseline with random actions, without a trained model.' },
]

const statusLabels: Record<Status, string> = {
  idle: 'Ready', connecting: 'Preparing', running: 'Live', stopping: 'Stopping',
  stopped: 'Stopped', finished: 'Finished', error: 'Disconnected',
}

const formatReward = (value: number | undefined) => value === undefined ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Inference() {
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [catalogError, setCatalogError] = useState('')
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [gameId, setGameId] = useState('Pendulum-v1')
  const [algorithm, setAlgorithm] = useState('sac')
  const [requestedPolicy, setRequestedPolicy] = useState<ModelSelection>('best')
  const [modelName, setModelName] = useState('')
  const [modelCatalog, setModelCatalog] = useState<ModelCatalog | null>(null)
  const [modelError, setModelError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const session = useInference()

  useEffect(() => {
    const controller = new AbortController()
    setCatalogLoading(true)
    setCatalogError('')
    fetchApi<{ environments: Environment[] }>('/environments', controller.signal)
      .then((data) => setEnvironments(data.environments))
      .catch(() => {
        if (!controller.signal.aborted) setCatalogError('Unable to reach the inference server. Start FastAPI, then retry.')
      })
      .finally(() => { if (!controller.signal.aborted) setCatalogLoading(false) })
    return () => controller.abort()
  }, [refresh])

  useEffect(() => {
    const controller = new AbortController()
    setModelCatalog(null)
    setModelError('')
    const query = new URLSearchParams({ env_name: gameId, algorithm })
    fetchApi<ModelCatalog>(`/models?${query}`, controller.signal)
      .then(setModelCatalog)
      .catch(() => {
        if (!controller.signal.aborted) setModelError('Could not load the models for this game. Please retry.')
      })
    return () => controller.abort()
  }, [gameId, algorithm, refresh])

  const game = environments.find((environment) => environment.id === gameId)
  const demo = demos.find((item) => item.environment === gameId) ?? demos[1]
  const currentCatalog = modelCatalog?.env_name === gameId && modelCatalog.algorithm === algorithm ? modelCatalog : null
  const policy = currentCatalog?.selections.includes(requestedPolicy) ? requestedPolicy : currentCatalog?.selections[0] ?? 'best'
  const customValid = Boolean(currentCatalog?.models.some((model) => model.name === modelName))
  const busy = ['connecting', 'running', 'stopping'].includes(session.status)
  const canStart = Boolean(game && currentCatalog && !catalogError && !catalogLoading && !modelError && !busy && (policy !== 'custom' || customValid))
  const request: InferenceRequest = {
    env_name: gameId, algorithm, model_selection: policy,
    ...(policy === 'custom' && modelName ? { model_name: modelName } : {}),
  }
  const episode = session.status === 'stopped' ? 'Stopped by you'
    : session.step?.terminated ? 'Terminal state reached'
    : session.step?.truncated ? 'Environment time limit'
    : session.status === 'finished' ? 'Step limit reached'
    : session.status === 'running' ? 'Episode in progress'
    : session.status === 'connecting' ? 'Loading model & environment'
    : session.status === 'error' ? 'Session interrupted'
    : 'Waiting to start'

  function submit(event: FormEvent) {
    event.preventDefault()
    if (canStart) session.start(request)
  }

  return (
    <section className="inference-page container" aria-labelledby="inference-title">
      <div className="inference-heading">
        <div>
          <span className="section-kicker mono">Inside the decision loop</span>
          <h1 id="inference-title">Your agent. <span className="gradient-text">Live.</span></h1>
          <p>Choose a world, pick a policy, and watch every decision unfold.</p>
        </div>
        <span className={`connection-badge mono${catalogError || modelError ? ' is-offline' : ''}`} role="status"><span />{catalogLoading ? 'Connecting to server' : catalogError || modelError ? 'Server unavailable' : 'Server connected'}</span>
      </div>

      <div className="inference-workspace">
        <aside className="control-panel" aria-labelledby="controls-title">
          <div className="panel-heading"><Icon name="layers" size={17} /><h2 id="controls-title">Session setup</h2><span className="mono">01</span></div>
          <form onSubmit={submit}>
            <fieldset disabled={busy || catalogLoading || Boolean(catalogError)}>
              <div className="control-field">
                <label htmlFor="game"><span className="mono">01</span>Environment</label>
                <select id="game" value={gameId} onChange={(event) => {
                  const selected = environments.find((item) => item.id === event.target.value)
                  session.reset()
                  setGameId(event.target.value)
                  setAlgorithm(selected?.algorithms[0]?.id ?? '')
                  setModelName('')
                }}>
                  {environments.length ? environments.map((item) => <option value={item.id} key={item.id}>{item.label}</option>) : <option value={gameId}>{catalogLoading ? 'Loading environments…' : 'Server unavailable'}</option>}
                </select>
                <p className="field-note mono">{gameId}</p>
              </div>

              <div className="control-field">
                <label htmlFor="algorithm"><span className="mono">02</span>Algorithm</label>
                <select id="algorithm" value={algorithm} onChange={(event) => { session.reset(); setAlgorithm(event.target.value); setModelName('') }}>
                  {game?.algorithms.map((item) => <option value={item.id} key={item.id}>{item.label === 'SAC' ? 'SAC · Soft Actor-Critic' : item.label === 'DQN' ? 'DQN · Deep Q-Network' : item.label}</option>)}
                </select>
                <p className="field-note">Available algorithms for this environment.</p>
              </div>

              <div className="control-field">
                <label htmlFor="policy"><span className="mono">03</span>Model selection</label>
                <select id="policy" value={policy} disabled={!currentCatalog} onChange={(event) => { session.reset(); setRequestedPolicy(event.target.value as ModelSelection) }}>
                  {policies.map((item) => <option value={item.value} key={item.value} disabled={!currentCatalog?.selections.includes(item.value)}>{item.label}{currentCatalog && !currentCatalog.selections.includes(item.value) ? ' · unavailable' : ''}</option>)}
                </select>
                <p className="field-note">{policies.find((item) => item.value === policy)?.description}</p>
              </div>

              {policy === 'custom' && <div className="control-field">
                <label htmlFor="checkpoint"><span className="mono">04</span>Checkpoint</label>
                <select id="checkpoint" value={customValid ? modelName : ''} onChange={(event) => { session.reset(); setModelName(event.target.value) }}>
                  <option value="" disabled>Choose a saved model</option>
                  {currentCatalog?.models.map((model) => <option key={model.name} value={model.name}>{model.name}</option>)}
                </select>
              </div>}
            </fieldset>

            <div className="model-inventory"><span className="mono">{currentCatalog ? `${currentCatalog.models.length} saved checkpoint${currentCatalog.models.length === 1 ? '' : 's'}` : modelError ? 'Models unavailable' : 'Loading checkpoints…'}</span><button className="refresh-models" type="button" disabled={busy || catalogLoading} onClick={() => setRefresh((value) => value + 1)} aria-label="Refresh environments and saved models" title="Refresh models"><Icon name="refresh" size={14} /></button></div>
            {currentCatalog?.models.length === 0 && <p className="empty-models">No trained checkpoints yet. Try random actions to explore this environment.</p>}
            <div className="session-actions">
              <button className="button button-primary start-inference" type="submit" disabled={!canStart}><Icon name="play" size={14} />{session.status === 'connecting' ? 'Preparing…' : session.status === 'running' ? 'Running' : session.status === 'stopping' ? 'Stopping…' : session.status === 'finished' || session.status === 'stopped' ? 'Run again' : 'Start inference'}</button>
              <button className="button stop-inference" type="button" disabled={!busy || session.status === 'stopping'} onClick={session.stop}><Icon name="stop" size={13} />Stop</button>
            </div>
            <p className="setup-note">One episode per session. Stop at any time.</p>
          </form>
        </aside>

        <div className="live-column">
          <section className="viewer-panel" aria-labelledby="viewer-title">
            <div className="viewer-heading"><div><Icon name="screen" size={16} /><h2 id="viewer-title">{game?.label ?? demo.title}</h2><span className="mono">{algorithm.toUpperCase()}</span></div><span className={`session-badge mono status-${session.status}`} role="status"><span />{statusLabels[session.status]}</span></div>
            <div className="live-stage" aria-busy={session.status === 'connecting'}>
              {!session.hasFrame && <div className="stage-illustration"><GamePreview game={demo.id} /></div>}
              <canvas className={`live-canvas${session.hasFrame ? ' has-frame' : ''}`} ref={session.canvasRef} role="img" aria-label={`Live ${game?.label ?? demo.title} agent gameplay`} />
              {!session.hasFrame && <div className="stage-placeholder"><span className="stage-symbol"><Icon name={session.status === 'connecting' ? 'network' : 'play'} size={19} /></span><h3>{session.status === 'connecting' ? 'Preparing the next move' : 'Ready when you are.'}</h3><p>{session.status === 'connecting' ? 'Loading the environment and waiting for the first frame.' : 'Configure your agent and start a live session.'}</p></div>}
              {session.status === 'stopping' && <div className="stage-stopping">Stopping the episode…</div>}
            </div>
            <div className="viewer-caption mono"><span><span className={`stream-dot${session.status === 'running' ? ' is-live' : ''}`} />{session.hasFrame ? session.status === 'running' ? 'Live environment render' : 'Last received frame' : 'Environment preview'}</span><span>{session.hasFrame ? 'Real-time inference' : 'No session running'}</span></div>
          </section>

          <div className="metric-grid" aria-label="Live episode metrics">
            <div className="metric-card"><span className="metric-label mono">Environment step</span><strong>{session.step?.step.toLocaleString('en-US') ?? '—'}</strong><span className="metric-caption">Decisions this episode</span></div>
            <div className="metric-card"><span className="metric-label mono">Step reward</span><strong>{formatReward(session.step?.reward)}</strong><span className="metric-caption">Reward for the latest action</span></div>
            <div className="metric-card metric-total"><span className="metric-label mono">Total reward</span><strong>{formatReward(session.step?.total_reward)}</strong><span className="metric-caption">Cumulative episode return</span></div>
          </div>
          <div className="episode-summary"><span className="mono">Episode status</span><span role="status">{episode}</span>{session.step && <span className="episode-flags mono">terminated: {String(session.step.terminated)} <span aria-hidden="true">/</span> truncated: {String(session.step.truncated)}</span>}</div>
        </div>
      </div>
      {(catalogError || modelError || session.error) && <div className="inference-error" role="alert"><span>{catalogError || modelError || session.error}</span>{!busy && <button type="button" onClick={() => { session.reset(); setRefresh((value) => value + 1) }}>Refresh connection<Icon name="refresh" size={13} /></button>}</div>}
      <p className="inference-footnote"><Icon name="network" size={14} />Every frame comes from the running environment. Every reward comes from the agent’s latest action.</p>
    </section>
  )
}
