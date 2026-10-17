export type NetworkLayer = {
  id: string
  label: string
  kind: 'input' | 'conv' | 'dense' | 'output'
  units: number
  display_indices: number[]
  outgoing_strength: number[]
}

export type NetworkEdge = {
  source: string
  target: string
  source_index: number
  target_index: number
  weight: number
  strength: number
  aggregate: boolean
}

export type NetworkDefinition = {
  algorithm: string
  architecture: string
  parameter_count: number
  layers: NetworkLayer[]
  edges: NetworkEdge[]
  output_source: string
  output_weights: number[][]
  output_bias: number[]
}

export type NetworkSnapshot = {
  input: { kind: 'vector'; shape: number[]; values: number[]; labels: string[] }
    | { kind: 'image'; shape: number[]; image: string }
  activations: Record<string, number[]>
  output: { rule: 'tanh' | 'argmax'; raw: number[]; action: number | number[] }
}
