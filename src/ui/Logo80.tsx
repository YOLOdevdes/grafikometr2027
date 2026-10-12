/** Logo w stylu lat 80.: chromowane, pochylone litery + neonowy podpis „2027”. */
export function Logo80({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const word = 'GRAFIKOMETR'
  return (
    <div className={`logo80 ${size}`} role="img" aria-label="Grafikometr2027">
      <span className="logo80-word" aria-hidden="true">
        <span className="logo80-glow">{word}</span>
        <span className="logo80-fill">{word}</span>
        <span className="logo80-shine">{word}</span>
      </span>
      <span className="logo80-script" aria-hidden="true">2027</span>
    </div>
  )
}
