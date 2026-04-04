// Fonctions de célébration — canvas-confetti (déjà installé)

export async function confettiPop() {
  const { default: confetti } = await import('canvas-confetti')
  confetti({
    particleCount: 90,
    spread:        70,
    origin:        { y: 0.65 },
    colors:        ['#E8622A', '#FF6B35', '#FFD700', '#FFFFFF', '#1D3550'],
  })
}

export async function fireworks() {
  const { default: confetti } = await import('canvas-confetti')
  const end    = Date.now() + 2200
  const colors = ['#E8622A', '#FF6B35', '#FFD700', '#FFFFFF']

  ;(function frame() {
    confetti({ particleCount: 4, angle:  60, spread: 55, origin: { x: 0 }, colors })
    confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
}

export async function beerRain() {
  const { default: confetti } = await import('canvas-confetti')
  confetti({
    particleCount: 70,
    spread:        120,
    origin:        { y: 0 },
    gravity:       0.7,
    ticks:         250,
    colors:        ['#F5A623', '#E8622A', '#FFD700', '#FFF3CD'],
    scalar:        1.3,
  })
}
