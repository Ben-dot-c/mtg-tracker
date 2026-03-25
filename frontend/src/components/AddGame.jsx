import { useEffect, useState } from 'react'
import { getDecks, logGame } from '../api'

const emptyRow = () => ({ deck_id: '', won: false })

export default function AddGame({ onSaved, adminKey }) {
  const [decks, setDecks] = useState([])
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState([emptyRow(), emptyRow()])
  const [draw, setDraw] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getDecks().then(setDecks)
  }, [])

  function updateRow(index, field, value) {
    setRows(rows.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  function setWinner(index) {
    setRows(rows.map((r, i) => ({ ...r, won: i === index })))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const results = rows.map(r => ({
      deck_id: parseInt(r.deck_id),
      won: r.won,
    }))

    if (results.some(r => !r.deck_id)) {
      return setError('Every row needs a deck selected.')
    }
    if (!draw && results.filter(r => r.won).length !== 1) {
      return setError('Select exactly one winner, or mark as draw.')
    }

    try {
      await logGame({ date, notes, draw, results }, adminKey)
      setRows([emptyRow(), emptyRow()])
      setNotes('')
      onSaved()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <h3>Log a Game</h3>

      <form onSubmit={handleSubmit}>
        <label>
          Date
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </label>
        <label>
          Notes (optional)
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. kitchen table game" />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
          <input type="checkbox" checked={draw} onChange={e => setDraw(e.target.checked)} />
          Draw (no winner)
        </label>

        <div className="table-wrap" style={{ marginTop: '1rem' }}>
        <table>
          <thead>
            <tr>
              <th>Deck (Player)</th>
              {!draw && <th>Winner?</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td>
                  <select value={row.deck_id} onChange={e => updateRow(i, 'deck_id', e.target.value)}>
                    <option value="">— select deck —</option>
                    {[...decks].sort((a, b) => b.games - a.games).map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.player.name})</option>
                    ))}
                  </select>
                </td>
                {!draw && (
                  <td>
                    <input type="radio" name="winner" checked={row.won} onChange={() => setWinner(i)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button type="button" className="btn" onClick={() => setRows([...rows, emptyRow()])}>+ Add Row</button>
          {rows.length > 2 && (
            <button type="button" className="btn" style={{ background: '#6b21a8' }} onClick={() => setRows(rows.slice(0, -1))}>- Remove Row</button>
          )}
        </div>

        {error && <p style={{ color: '#f87171' }}>{error}</p>}
        <button type="submit" style={{ marginTop: '0.75rem' }}>Save Game</button>
      </form>
    </div>
  )
}
