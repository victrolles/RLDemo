type IconName = 'arrow' | 'external' | 'play' | 'network' | 'layers' | 'screen' | 'down' | 'stop' | 'refresh'

export default function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === 'arrow' && <path d="M4 12h15m-6-6 6 6-6 6" />}
      {name === 'external' && <path d="M7 17 17 7M7 7h10v10" />}
      {name === 'down' && <path d="M12 4v16m-6-6 6 6 6-6" />}
      {name === 'play' && <path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none" />}
      {name === 'stop' && <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />}
      {name === 'refresh' && <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 11-2l3 3M4 16l3 3a7 7 0 0 0 11-2" /></>}
      {name === 'network' && <><path d="m7 6 10 6M7 18l10-6M7 6v12" /><circle cx="6" cy="5" r="2.5" /><circle cx="18" cy="12" r="2.5" /><circle cx="6" cy="19" r="2.5" /></>}
      {name === 'layers' && <><path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5" /></>}
      {name === 'screen' && <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>}
    </svg>
  )
}
