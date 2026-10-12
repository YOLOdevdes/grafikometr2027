/** Przełącznik wł./wył. (role="switch"), cała linia jest klikalna. */
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="nav-set toggle-row" onClick={onChange}>
      <span>{label}</span>
      <span className={`toggle ${checked ? 'on' : ''}`} aria-hidden="true">
        <i />
      </span>
    </button>
  )
}
