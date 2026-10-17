export type Demo = {
  id: 'cartpole' | 'pendulum' | 'bipedalwalker' | 'carracing'
  title: string
  algorithm: string
  description: string
  category: string
  environment: string
}

// Environments already declared in types/types.ts.
export const demos: Demo[] = [
  { id: 'cartpole', title: 'CartPole', algorithm: 'DQN', description: 'A balancing act. Move the cart, keep the pole upright, and turn small corrections into a steady policy.', category: 'Classic control', environment: 'CartPole-v1' },
  { id: 'pendulum', title: 'Pendulum', algorithm: 'SAC', description: 'Finding balance from a swing. Learn when to apply torque to bring a pendulum upright and hold it there.', category: 'Classic control', environment: 'Pendulum-v1' },
  { id: 'bipedalwalker', title: 'BipedalWalker', algorithm: 'SAC', description: 'One step at a time. Coordinate two legs to move across uneven terrain without losing balance.', category: 'Locomotion', environment: 'BipedalWalker-v3' },
  { id: 'carracing', title: 'CarRacing', algorithm: 'SAC', description: 'Learning the racing line. Steer, accelerate, and brake through the corners of a procedural track.', category: 'Racing', environment: 'CarRacing-v3' },
]

// Only GIF URLs are bundled here; the images load when a card is activated.
const previews = import.meta.glob<string>('../assets/videos/*.gif', {
  eager: true,
  query: '?url',
  import: 'default',
})

export function getGifPreview(id: Demo['id']) {
  return previews[`../assets/videos/gameplay_${id}.gif`] ?? previews[`../assets/videos/${id}.gif`]
}
