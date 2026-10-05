import { TESTIDS } from '../../lib/testids'
import './game-preview.css'

/** Miniature, looping CSS-only teasers shown on a game card's hover/focus. Purely decorative. */
const MatchArt = () => (
  <svg viewBox="0 0 120 36" className="game-preview-art">
    {[0, 1, 2, 3].map((slot) => (
      <rect
        key={slot}
        x={4 + slot * 29}
        y={4}
        width={24}
        height={28}
        rx={3}
        className={`pv-tile ${slot % 2 === 0 ? 'pv-pair-a' : 'pv-pair-b'}`}
      />
    ))}
  </svg>
)

const BlastArt = () => (
  <svg viewBox="0 0 120 36" className="game-preview-art">
    {[0, 1, 2].map((slot) => (
      <g key={slot} className="pv-bob" style={{ animationDelay: `${slot * -0.5}s` }}>
        <circle cx={22 + slot * 38} cy={18} r={9} className={`pv-rock${slot === 1 ? ' pv-rock-hit' : ''}`} />
      </g>
    ))}
    <circle cx={60} cy={18} r={9} className="pv-ring" />
  </svg>
)

const BlocksArt = () => (
  <svg viewBox="0 0 120 36" className="game-preview-art">
    {Array.from({ length: 12 }, (_, slot) => (
      <rect
        key={slot}
        x={24 + (slot % 6) * 12}
        y={4 + Math.floor(slot / 6) * 16}
        width={10}
        height={14}
        rx={2}
        className={`pv-cell${slot === 2 || slot === 8 || slot === 9 ? ' pv-cell-lit' : ''}`}
        style={
          slot === 2 || slot === 8 || slot === 9 ? { animationDelay: `${[2, 8, 9].indexOf(slot) * 0.6}s` } : undefined
        }
      />
    ))}
  </svg>
)

const ART: Readonly<Record<string, () => React.JSX.Element>> = {
  match: MatchArt,
  blast: BlastArt,
  blocks: BlocksArt,
}

export const GamePreview = ({ gameId }: { readonly gameId: string }) => {
  const Art = ART[gameId]
  if (Art === undefined) return null
  return (
    <span className="game-preview" aria-hidden="true" data-testid={TESTIDS.gamesPreview} data-game={gameId}>
      <Art />
    </span>
  )
}
