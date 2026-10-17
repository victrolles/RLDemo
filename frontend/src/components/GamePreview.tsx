import type { Demo } from '../data/demos'

// Stylized environment illustrations, deliberately labelled as previews.
export default function GamePreview({ game }: { game: Demo['id'] }) {
  const accent = { cartpole: '#a39aff', pendulum: '#d39cdd', bipedalwalker: '#86c4c2', carracing: '#b4b2ec' }[game]
  return (
    <svg className="preview-art" viewBox="0 0 560 315" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id={`${game}-glow`}><stop stopColor={accent} stopOpacity=".12" /><stop offset="1" stopColor={accent} stopOpacity="0" /></radialGradient>
        <pattern id={`${game}-grid`} width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" stroke={accent} strokeOpacity=".065" strokeWidth=".6" /></pattern>
      </defs>
      <rect width="560" height="315" fill="#0e0e17" />
      <rect width="560" height="315" fill={`url(#${game}-grid)`} />
      <ellipse cx="280" cy="164" rx="230" ry="170" fill={`url(#${game}-glow)`} />
      {game === 'cartpole' && <>
        <path d="M70 235h420" stroke="#7e738e" strokeOpacity=".4" />
        <path d="M100 244h360" stroke="#7e738e" strokeOpacity=".15" strokeDasharray="2 8" />
        <rect x="236" y="204" width="88" height="23" rx="5" fill="#37304e" stroke={accent} strokeOpacity=".8" />
        <circle cx="252" cy="230" r="7" fill="#17131f" stroke="#9584b6" /><circle cx="308" cy="230" r="7" fill="#17131f" stroke="#9584b6" />
        <path d="m280 205-20-114" stroke={accent} strokeWidth="8" strokeLinecap="round" />
        <circle cx="280" cy="205" r="5" fill="#e6defe" />
        <path d="M280 177V80m-62 136h-35m158 0h35m-185-5-8 5 8 5m177-10 8 5-8 5" stroke={accent} strokeOpacity=".35" strokeDasharray="4 5" />
        <path d="M280 114a90 90 0 0 0-16 2" stroke={accent} strokeOpacity=".6" />
      </>}
      {game === 'pendulum' && <>
        <circle cx="280" cy="160" r="94" stroke={accent} strokeOpacity=".13" strokeDasharray="3 7" />
        <path d="M280 66a94 94 0 0 1 85 134" stroke={accent} strokeOpacity=".4" strokeWidth="2" />
        <path d="m360 189 5 12 10-8" stroke={accent} strokeOpacity=".6" strokeWidth="2" />
        <path d="M280 160V65" stroke={accent} strokeOpacity=".24" strokeDasharray="4 5" />
        <path d="m280 160 45-79" stroke={accent} strokeWidth="9" strokeLinecap="round" />
        <circle cx="325" cy="81" r="11" fill="#33233b" stroke={accent} strokeWidth="3" />
        <circle cx="280" cy="160" r="10" fill="#241d2c" stroke={accent} strokeWidth="2" />
        <circle cx="280" cy="160" r="3" fill="#f1d9ef" />
        <path d="M254 256h52m-26-77v69" stroke={accent} strokeOpacity=".15" />
      </>}
      {game === 'bipedalwalker' && <>
        <path d="m0 254 60-3 40-12 51 4 34-14 49 3 44-9 52 7 55-17 50 5 48-12 77 9v100H0Z" fill="#172527" />
        <path d="m0 254 60-3 40-12 51 4 34-14 49 3 44-9 52 7 55-17 50 5 48-12 77 9" stroke={accent} strokeOpacity=".6" />
        <path d="m255 151-15 36 31 40m13-72 27 29-8 39" stroke="#314b53" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m255 151-15 36 31 40m13-72 27 29-8 39" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m248 121 45 7-10 34-31-9Z" fill="#34535a" stroke={accent} strokeWidth="2" />
        <circle cx="240" cy="187" r="5" fill="#b3d9cf" /><circle cx="311" cy="184" r="5" fill="#b3d9cf" />
        <path d="m273 143 84-34m-84 34 97-8m-97 8 92 23m-92-23 66 49" stroke={accent} strokeOpacity=".2" strokeDasharray="3 5" />
        <path d="M90 88h45m-10-5 10 5-10 5" stroke={accent} strokeOpacity=".45" />
      </>}
      {game === 'carracing' && <>
        <path d="M133 315C116 248 125 212 199 187S385 195 392 130 327 52 346-10" stroke="#28302c" strokeWidth="104" />
        <path d="M133 315C116 248 125 212 199 187S385 195 392 130 327 52 346-10" stroke="#54505f" strokeWidth="75" />
        <path d="M133 315C116 248 125 212 199 187S385 195 392 130 327 52 346-10" stroke="#c6b9d4" strokeOpacity=".5" strokeWidth="2" strokeDasharray="10 13" />
        <path d="M130 315C108 244 125 207 199 184S386 189 389 130" stroke={accent} strokeOpacity=".35" strokeWidth="2" />
        <g transform="translate(269 184) rotate(85)">
          <rect x="-15" y="-16" width="6" height="12" rx="2" fill="#15121c" /><rect x="9" y="-16" width="6" height="12" rx="2" fill="#15121c" />
          <rect x="-15" y="8" width="6" height="12" rx="2" fill="#15121c" /><rect x="9" y="8" width="6" height="12" rx="2" fill="#15121c" />
          <rect x="-10" y="-23" width="20" height="48" rx="6" fill="#b5a7f2" /><path d="M-7-8H7v16H-7Z" fill="#49405f" /><path d="M-7-18H7M-7 17H7" stroke="#e8dfff" strokeWidth="2" />
        </g>
      </>}
    </svg>
  )
}
