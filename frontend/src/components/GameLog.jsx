import { useEffect, useState } from 'react'
import { getGames } from '../api'

export default function GameLog() {
  const [games, setGames] = useState([])

  useEffect(() => {
    getGames().then(setGames).catch(console.error)
  }, [])

  return (
    <div>
      <h2>Game Log</h2>
      {games.length === 0 && <p style={{ color: '#aaa' }}>No games logged yet.</p>}
      {games.map((game) => (
        <div key={game.id} style={{ marginBottom: '1rem', background: '#16213e', borderRadius: 8, padding: '1rem' }}>
          <div style={{ marginBottom: '0.5rem', color: '#aaa', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {game.date}{game.notes ? ` — ${game.notes}` : ''}
            {game.draw && <span style={{ background: '#64748b', color: '#fff', borderRadius: 4, padding: '0 6px', fontSize: '0.75rem', fontWeight: 'bold' }}>DRAW</span>}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Deck</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {game.results.map((r, i) => (
                  <tr key={i}>
                    <td>{r.deck.player.name}</td>
                    <td>{r.deck.name}</td>
                    <td>{r.won ? <span className="badge-win">WIN</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
