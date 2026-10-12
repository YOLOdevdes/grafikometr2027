import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { actions, db } from '../db'
import { READ_ONLY } from '../mode'
import type { Designer, Todo } from '../domain/types'

type Px = [x: number, y: number, w: number, h: number]

/** Pixelowy notatnik na spirali 14×14 (kolor z currentColor). */
export function NotebookIcon({ size = 1 }: { size?: number }) {
  const body: Px[] = [[3, 1, 10, 1], [3, 13, 10, 1], [3, 1, 1, 13], [12, 1, 1, 13]]
  const lines: Px[] = [[6, 4, 5, 1], [6, 7, 5, 1], [6, 10, 4, 1]]
  const rings: Px[] = [[1, 3, 3, 1], [1, 6, 3, 1], [1, 9, 3, 1], [1, 12, 3, 1]]
  return (
    <svg viewBox="0 0 14 15" width={14 * size} height={15 * size} shapeRendering="crispEdges" aria-hidden="true">
      <rect x={4} y={2} width={8} height={11} fill="var(--nb-paper, #ddd3c1)" />
      {body.map(([x, y, w, h], i) => <rect key={`b${i}`} x={x} y={y} width={w} height={h} fill="currentColor" />)}
      {lines.map(([x, y, w, h], i) => <rect key={`l${i}`} x={x} y={y} width={w} height={h} fill="#8d8471" />)}
      <rect x={5} y={2} width={1} height={11} fill="#c4544a" />
      {rings.map(([x, y, w, h], i) => <rect key={`r${i}`} x={x} y={y} width={w} height={h} fill="currentColor" />)}
    </svg>
  )
}

/** Przycisk z notatnikiem przy osobie; liczba = zadania do zrobienia. */
export function NotebookButton({ designer, open, onOpen }: { designer: Designer; open: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      className={`nb-btn ${open ? 'has' : ''}`}
      aria-label={`Zadania: ${designer.name}${open ? `, ${open} do zrobienia` : ''}`}
      title={open ? `${open} do zrobienia` : 'Zadania'}
      onClick={e => { e.stopPropagation(); onOpen() }}
    >
      <NotebookIcon />
      {open > 0 && <span className="nb-count">{open}</span>}
    </button>
  )
}

function Check({ done, onToggle, label }: { done: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={done} aria-label={label} className="nb-check" onClick={onToggle} disabled={READ_ONLY}>
      {done && (
        <svg viewBox="0 0 8 8" width="12" height="12" shapeRendering="crispEdges" aria-hidden="true">
          {([[0, 4], [1, 5], [2, 6], [3, 5], [4, 4], [5, 3], [6, 2], [7, 1]] as const).map(([x, y]) => <rect key={x} x={x} y={y} width={1} height={1.6} fill="currentColor" />)}
        </svg>
      )}
    </button>
  )
}

function TodoLine({ todo, onBackspaceEmpty, onEnter, inputRef }: {
  todo: Todo; onBackspaceEmpty: () => void; onEnter: () => void; inputRef: (el: HTMLInputElement | null) => void
}) {
  const [text, setText] = useState(todo.text)
  useEffect(() => setText(todo.text), [todo.text])
  // pusty tekst = usunięcie zadania
  const commit = () => (text.trim() ? text !== todo.text && actions.updateTodo(todo.id, { text: text.trim() }) : actions.deleteTodo(todo.id))
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); onEnter() }
    if (e.key === 'Backspace' && text === '') { e.preventDefault(); actions.deleteTodo(todo.id); onBackspaceEmpty() }
  }
  return (
    <li className={`nb-line ${todo.done ? 'done' : ''}`}>
      <Check done={todo.done} label={`Zrobione: ${todo.text}`} onToggle={() => actions.updateTodo(todo.id, { done: !todo.done })} />
      <input ref={inputRef} value={text} readOnly={READ_ONLY} onChange={e => setText(e.target.value)} onBlur={() => !READ_ONLY && commit()} onKeyDown={e => !READ_ONLY && onKey(e)} aria-label="Treść zadania" spellCheck={false} />
    </li>
  )
}

/** Notatnik osoby: lista zadań do dodawania, odhaczania i usuwania (wyczyść tekst, żeby usunąć). */
export function TodoNotebook({ designer, onClose }: { designer: Designer; onClose: () => void }) {
  const todos = useLiveQuery(() => db.todos.where('designerId').equals(designer.id).sortBy('createdAt'), [designer.id]) ?? []
  const [draft, setDraft] = useState('')
  const newRef = useRef<HTMLInputElement>(null)
  const lineRefs = useRef(new Map<string, HTMLInputElement>())

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => { if (!READ_ONLY) newRef.current?.focus() }, [])

  const add = async () => {
    if (!draft.trim()) return
    await actions.addTodo(designer.id, draft.trim())
    setDraft('')
  }
  const focusLine = (i: number) => {
    const t = todos[i]
    const el = t ? lineRefs.current.get(t.id) : newRef.current
    requestAnimationFrame(() => el?.focus())
  }
  const left = todos.filter(t => !t.done).length

  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="nb" role="dialog" aria-modal="true" aria-label={`Zadania: ${designer.name}`}>
        <div className="nb-spiral" aria-hidden="true">{Array.from({ length: 11 }, (_, i) => <i key={i} />)}</div>
        <header className="nb-head">
          <h2>{designer.name}</h2>
          <span>{todos.length === 0 ? 'Brak zadań' : left === 0 ? 'Wszystko zrobione' : `${left} do zrobienia`}</span>
          <button type="button" className="nb-close" onClick={onClose} aria-label="Zamknij notatnik">✕</button>
        </header>
        <ul className="nb-page">
          {todos.map((t, i) => (
            <TodoLine
              key={t.id}
              todo={t}
              inputRef={el => (el ? lineRefs.current.set(t.id, el) : lineRefs.current.delete(t.id))}
              onEnter={() => focusLine(i + 1)}
              onBackspaceEmpty={() => focusLine(Math.max(0, i - 1))}
            />
          ))}
          {READ_ONLY && todos.length === 0 && <li className="nb-line nb-empty">Brak zadań.</li>}
          {!READ_ONLY && <li className="nb-line nb-new">
            <span className="nb-plus" aria-hidden="true">+</span>
            <input
              ref={newRef}
              value={draft}
              placeholder="Nowe zadanie, Enter dodaje"
              aria-label="Nowe zadanie"
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); add() }
                if (e.key === 'Backspace' && draft === '' && todos.length) { e.preventDefault(); focusLine(todos.length - 1) }
              }}
              spellCheck={false}
            />
          </li>}
          <li className="nb-line nb-blank" aria-hidden="true" />
        </ul>
        <p className="nb-hint">{READ_ONLY ? 'Podgląd — tylko do odczytu.' : 'Kliknij kratkę, żeby odhaczyć. Wyczyść tekst, żeby usunąć zadanie.'}</p>
      </div>
    </div>
  )
}
