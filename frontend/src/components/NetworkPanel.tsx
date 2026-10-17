import { useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import Icon from './Icon'
import type { NetworkDefinition, NetworkLayer, NetworkSnapshot } from '../types/network'

type Props = {
  model: NetworkDefinition | null
  snapshot: NetworkSnapshot | null
  step: number | undefined
  randomActions: boolean
  preparing: boolean
  replay: boolean
}

const format = (value: number) => Math.abs(value) > 0 && Math.abs(value) < 0.001 ? value.toExponential(2) : value.toFixed(4)
const maxAbs = (values: number[]) => Math.max(0.000001, ...values.map(Math.abs))

function NetworkGraph({ model, snapshot, selected, onSelect }: {
  model: NetworkDefinition; snapshot: NetworkSnapshot; selected: { layer: string; unit: number }
  onSelect: (layer: string, unit: number) => void
}) {
  const width = Math.max(340, model.layers.length * 68)
  const x = (id: string) => 30 + model.layers.findIndex((layer) => layer.id === id) * (width - 60) / (model.layers.length - 1)
  const y = (layer: NetworkLayer, unit: number) => {
    const position = layer.display_indices.indexOf(unit)
    return 38 + (position + 0.5) * 160 / layer.display_indices.length
  }
  return (
    <div className="network-diagram">
      <svg viewBox={`0 0 ${width} 244`} style={{ minWidth: width }} aria-label="Model layers, activations and sampled weight connections">
        {model.edges.map((edge) => {
          const source = model.layers.find((layer) => layer.id === edge.source)!
          const target = model.layers.find((layer) => layer.id === edge.target)!
          const activation = snapshot.activations[edge.source]?.[edge.source_index] ?? 0
          return <line key={`${edge.source}-${edge.source_index}-${edge.target_index}`} x1={x(edge.source)} y1={y(source, edge.source_index)} x2={x(edge.target)} y2={y(target, edge.target_index)} stroke={edge.weight < 0 ? '#d49d8b' : '#a795df'} strokeWidth={0.3 + edge.strength * 1.5} opacity={0.12 + edge.strength * 0.4}>
            <title>{edge.aggregate ? 'Aggregated channel weight' : 'Weight'}: {format(edge.weight)}{edge.aggregate ? '' : ` · activation × weight: ${format(activation * edge.weight)}`}</title>
          </line>
        })}
        {model.layers.map((layer) => {
          const values = snapshot.activations[layer.id] ?? []
          const scale = maxAbs(values)
          return <g key={layer.id}>
            <text x={x(layer.id)} y={19} textAnchor="middle" className="network-svg-label">{layer.label}</text>
            {layer.display_indices.map((unit) => {
              const value = values[unit] ?? 0
              const active = selected.layer === layer.id && selected.unit === unit
              return <g key={unit} tabIndex={0} role="button" aria-label={`${layer.label}, ${layer.kind === 'conv' ? 'channel' : 'neuron'} ${unit}, activation ${format(value)}`} onClick={() => onSelect(layer.id, unit)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(layer.id, unit) } }} className="network-node">
                <circle cx={x(layer.id)} cy={y(layer, unit)} r={5 + Math.abs(value) / scale * 3} fill={value < 0 ? '#d49d8b' : '#b5a0ef'} fillOpacity={0.12 + Math.abs(value) / scale * 0.85} stroke={active ? '#f0e4ff' : '#c1aee880'} strokeWidth={active ? 2 : 0.7} />
                <title>#{unit} · {format(value)}</title>
              </g>
            })}
            <text x={x(layer.id)} y={224} textAnchor="middle" className="network-svg-count">{layer.units} {layer.kind === 'conv' ? 'ch.' : 'units'}</text>
          </g>
        })}
      </svg>
    </div>
  )
}

export default function NetworkPanel({ model, snapshot, step, randomActions, preparing, replay }: Props) {
  const [selection, setSelection] = useState({ layer: 'hidden1', unit: 0 })
  const [outputIndex, setOutputIndex] = useState(0)
  const selectedLayer = model?.layers.find((layer) => layer.id === selection.layer) ?? model?.layers[1]
  const unit = selectedLayer ? Math.min(selection.unit, selectedLayer.units - 1) : 0
  const values = selectedLayer && snapshot ? snapshot.activations[selectedLayer.id] ?? [] : []
  const scale = maxAbs(values)
  const output = snapshot?.output
  const selectedOutput = Math.min(outputIndex, (output?.raw.length ?? 1) - 1)
  const sourceValues = model && snapshot ? snapshot.activations[model.output_source] ?? [] : []
  const allContributions = model ? (model.output_weights[selectedOutput] ?? []).map((weight, index) => ({ index, weight, activation: sourceValues[index] ?? 0, value: weight * (sourceValues[index] ?? 0) })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)) : []
  const contributions = allContributions.slice(0, 4)
  const weightedSum = allContributions.reduce((sum, item) => sum + item.value, 0)
  const remainder = weightedSum - contributions.reduce((sum, item) => sum + item.value, 0)
  const actualOutput = output && (Array.isArray(output.action) ? output.action[selectedOutput] : output.raw[selectedOutput])

  function select(layer: string, index: number) { setSelection({ layer, unit: index }) }
  function neuronKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!selectedLayer) return
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -16, ArrowDown: 16 }
    if (!(event.key in offsets)) return
    event.preventDefault()
    const next = Math.max(0, Math.min(index + offsets[event.key], selectedLayer.units - 1))
    select(selectedLayer.id, next)
    const button = event.currentTarget.parentElement?.children[next] as HTMLElement | undefined
    button?.focus({ preventScroll: true })
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  return (
    <aside className="network-panel" aria-labelledby="network-title">
      <div className="panel-heading"><Icon name="network" size={17} /><h2 id="network-title">Inside the network</h2><span className="mono">{step === undefined ? '03' : `STEP ${step}`}</span></div>
      {!model || !snapshot || !selectedLayer ? (
        <div className="network-empty"><span className="network-empty-icon"><Icon name="network" size={30} /></span><h3>{randomActions ? 'A baseline, without a network.' : preparing ? 'Waiting for the forward pass.' : 'See the decision take shape.'}</h3><p>{randomActions ? 'Random actions are sampled directly. No neurons or model weights are evaluated.' : preparing ? 'The first step will reveal the model’s actual inputs, activations, and action output.' : 'Start a trained agent to explore its inputs, hidden layers, and how the output becomes an action.'}</p><span className="mono">INPUT → ACTIVATIONS → ACTION</span></div>
      ) : (
        <>
          <div className="network-model-line"><span>{model.architecture}</span><span className="mono">{model.parameter_count.toLocaleString('en-US')} parameters</span><span className="network-sync">{replay ? 'Replay' : 'Step synced'}</span></div>
          <NetworkGraph model={model} snapshot={snapshot} selected={{ layer: selectedLayer.id, unit }} onSelect={select} />
          <div className="network-legend"><span><i className="legend-node" />Brightness: |activation|</span><span><i className="legend-edge" />Width: |weight|</span></div>
          <p className="network-explanation">Six representative units per layer at most. Inspect every unit in the shown layers below. Activations are relative within each layer; weights stay fixed.{model.layers.length > 5 && ' Scroll horizontally to follow all layers.'}</p>

          <section className="network-section" aria-labelledby="network-input-title">
            <div className="network-section-heading"><h3 id="network-input-title">01 / Model input</h3><span className="mono">{snapshot.input.shape.join(' × ')}</span></div>
            {snapshot.input.kind === 'image' ? <>
              <img className="network-input-image" src={snapshot.input.image} alt="Preprocessed grayscale input frames, oldest to newest" />
              <p className="network-note">{snapshot.input.shape[0]} stacked frames, oldest → newest. Pixels are divided by 255 inside the encoder.</p>
            </> : <div className="network-input-values">{snapshot.input.values.map((value, index) => <div key={index}><span>{snapshot.input.kind === 'vector' && snapshot.input.labels[index]}</span><strong>{format(value)}</strong></div>)}</div>}
            <p className="network-note">Observation before the action that produced frame {step}.</p>
          </section>

          <section className="network-section" aria-labelledby="network-neurons-title">
            <div className="network-section-heading"><h3 id="network-neurons-title">02 / Inspect activations</h3><span className="mono">{selectedLayer.units} {selectedLayer.kind === 'conv' ? 'channels' : 'units'}</span></div>
            <select className="network-layer-select" aria-label="Inspect network layer" value={selectedLayer.id} onChange={(event) => select(event.target.value, 0)}>{model.layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.label} · {layer.units} {layer.kind === 'conv' ? 'channels' : 'units'}</option>)}</select>
            <div className="neuron-grid" aria-label={`${selectedLayer.label} activations`}>{values.map((value, index) => <button type="button" key={index} tabIndex={index === unit ? 0 : -1} aria-label={`${selectedLayer.kind === 'conv' ? 'Channel' : 'Neuron'} ${index}: ${format(value)}`} aria-pressed={index === unit} title={`#${index} · activation ${format(value)}`} style={{ '--activity': 0.1 + Math.abs(value) / scale * 0.85, '--neuron-color': value < 0 ? '212, 157, 139' : '181, 160, 239' } as CSSProperties} onClick={() => select(selectedLayer.id, index)} onKeyDown={(event) => neuronKey(event, index)} />)}</div>
            <div className="neuron-details"><span className="mono">{selectedLayer.kind === 'conv' ? 'Channel' : 'Neuron'} #{unit}</span><span>Activation <strong>{format(values[unit] ?? 0)}</strong></span><span title="Mean absolute outgoing weight; not a causal importance score">Outgoing |w| <strong>{selectedLayer.kind === 'output' ? '—' : format(selectedLayer.outgoing_strength[unit] ?? 0)}</strong></span></div>
            <p className="network-note">{selectedLayer.kind === 'conv' ? 'Each tile is a channel’s mean activation across its spatial feature map.' : 'Select a tile or use arrow keys within the grid to inspect a unit.'}</p>
          </section>

          <section className="network-section network-output" aria-labelledby="network-output-title">
            <div className="network-section-heading"><h3 id="network-output-title">03 / From signal to action</h3><span className="mono">{output?.rule === 'tanh' ? 'SAC' : 'DQN'}</span></div>
            <div className="network-output-tabs">{output?.raw.map((_, index) => <button key={index} type="button" aria-pressed={selectedOutput === index} onClick={() => setOutputIndex(index)}>{output.rule === 'argmax' ? `Q${index}` : `a${index}`}</button>)}</div>
            <div className="network-formula"><span className="mono">{output?.rule === 'tanh' ? 'tanh(Σ activation × weight + bias)' : 'Q = Σ activation × weight + bias'}</span><strong>{format(actualOutput ?? 0)}</strong></div>
            <div className="network-output-detail"><span>Σ a·w <strong>{format(weightedSum)}</strong></span><span>Bias <strong>{format(model.output_bias[selectedOutput] ?? 0)}</strong></span><span>Raw {output?.rule === 'tanh' ? 'mean' : 'Q'} <strong>{format(output?.raw[selectedOutput] ?? 0)}</strong></span></div>
            <p className="network-note">{output?.rule === 'tanh' ? 'Deterministic policy: tanh(mean) produces the action before rescaling. The unused log-standard-deviation branch is omitted.' : `The action with the highest Q value is selected: ${output?.action}.`}</p>
            <span className="contribution-title mono">Largest contributions to this output</span>
            <div className="network-contributions">{contributions.map((item) => <button type="button" key={item.index} onClick={() => select(model.output_source, item.index)} title={`activation ${format(item.activation)} × weight ${format(item.weight)}`}><span>#{item.index}</span><span className="contribution-track"><i style={{ width: `${Math.abs(item.value) / Math.max(0.000001, ...contributions.map((entry) => Math.abs(entry.value))) * 100}%`, background: item.value < 0 ? '#d49d8b' : '#b5a0ef' }} /></span><strong>{item.value >= 0 ? '+' : ''}{format(item.value)}</strong></button>)}</div>
            {allContributions.length > contributions.length && <p className="contribution-remainder"><span>Other {allContributions.length - contributions.length} units combined</span><strong>{remainder >= 0 ? '+' : ''}{format(remainder)}</strong></p>}
          </section>
          <p className="network-caveat">Weights and activations describe the forward pass, not causal importance. CNN links aggregate kernel weights; the output contributions use the actual dense weights.</p>
        </>
      )}
    </aside>
  )
}
