import { useEffect, useState } from 'react'
import { getDecks, getDeckStats } from '../api'
import {
  LineChart, Line,
  XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

function StatBox({ label, value, color }) {
  return (
    <div style={{
      background: '#16213e',
      borderRadius: 8,
      padding: '1rem 1.5rem',
      minWidth: 110,
      textAlign: 'center',
      flex: '1 1 110px',
    }}>
      <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: color ?? '#e0e0e0' }}>
        {value}
      </div>
    </div>
  )
}

function MatchupCard({ title, items, countColor, emptyMsg }) {
  return (
    <div style={{ flex: 1, minWidth: 220, background: '#16213e', borderRadius: 8, padding: '1rem 1.25rem' }}>
      <h4 style={{ color: countColor, marginBottom: '0.75rem', fontSize: '0.95rem' }}>{title}</h4>
      {items.length === 0
        ? <p style={{ color: '#475569', fontSize: '0.85rem' }}>{emptyMsg}</p>
        : items.map((m, i) => (
          <div key={m.deck_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
            <span style={{ fontSize: '0.88rem' }}>
              <span style={{ color: '#94a3b8', marginRight: '0.3rem' }}>{i + 1}.</span>
              {m.deck_name}
              <span style={{ color: '#64748b', fontSize: '0.78rem' }}> ({m.player})</span>
            </span>
            <span style={{ color: countColor, fontWeight: 'bold', marginLeft: '0.75rem' }}>{m.count}×</span>
          </div>
        ))
      }
    </div>
  )
}

export default function DeckStats() {
  const [decks, setDecks] = useState([])
  const [selectedDeckId, setSelectedDeckId] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [showSmall, setShowSmall] = useState(false)
  const [collapsed, setCollapsed] = useState(null)

  useEffect(() => {
    getDecks().then(setDecks).catch(console.error)
  }, [])

  useEffect(() => {
    if (!selectedDeckId) return
    setLoading(true)
    setError(null)
    getDeckStats(selectedDeckId)
      .then(data => { setStats(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [selectedDeckId])

  // Group decks by player
  const byPlayer = decks.reduce((acc, deck) => {
    const p = deck.player.name
    if (!acc[p]) acc[p] = []
    acc[p].push(deck)
    return acc
  }, {})
  const players = Object.keys(byPlayer).sort()

  // null = not yet initialised (all closed); Set contains the *open* players
  const openPlayers = collapsed ?? new Set()

  function toggleCollapse(player) {
    setCollapsed(prev => {
      const next = new Set(prev ?? [])
      next.has(player) ? next.delete(player) : next.add(player)
      return next
    })
  }

  const searchLower = search.toLowerCase()
  const filteredPlayers = players.filter(p =>
    p.toLowerCase().includes(searchLower) ||
    byPlayer[p].some(d => d.name.toLowerCase().includes(searchLower))
  )

  return (
    <div>
      <h2>Deck Stats</h2>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Sidebar */}
        <div style={{
          width: 230,
          flexShrink: 0,
          background: '#16213e',
          borderRadius: 8,
          padding: '0.75rem',
          maxHeight: 600,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ marginBottom: '0.4rem', width: '100%', boxSizing: 'border-box', fontSize: '0.82rem' }}
          />
          <button
            className="btn"
            onClick={() => setShowSmall(s => !s)}
            style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', marginBottom: '0.6rem', width: '100%', opacity: showSmall ? 1 : 0.6 }}
          >
            {showSmall ? 'Hide small decks' : 'Show small decks'}
          </button>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredPlayers.map(player => {
              const visibleDecks = byPlayer[player]
                .filter(d => (showSmall || d.games > 5) && (
                  d.name.toLowerCase().includes(searchLower) || player.toLowerCase().includes(searchLower)
                ))
              if (visibleDecks.length === 0) return null
              const isOpen = openPlayers.has(player)
              return (
                <div key={player} style={{ marginBottom: '0.75rem' }}>
                  <div
                    onClick={() => toggleCollapse(player)}
                    style={{ color: '#a855f7', fontSize: '0.82rem', fontWeight: 'bold', marginBottom: '0.25rem', paddingLeft: '0.25rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}
                  >
                    <span>{player}</span>
                    <span style={{ fontSize: '0.7rem', color: '#6d28d9' }}>{isOpen ? '▼' : '▶'}</span>
                  </div>
                  {isOpen && visibleDecks.map(deck => (
                    <div
                      key={deck.id}
                      onClick={() => setSelectedDeckId(deck.id)}
                      style={{
                        padding: '0.3rem 0.6rem',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: '0.88rem',
                        background: selectedDeckId === deck.id ? '#7c3aed' : 'transparent',
                        color: selectedDeckId === deck.id ? '#fff' : '#e0e0e0',
                        marginBottom: '0.15rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>{deck.name}</span>
                      <span style={{ color: selectedDeckId === deck.id ? '#ddd' : '#475569', fontSize: '0.75rem' }}>{deck.games}g</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 300 }}>
          {!selectedDeckId && (
            <p style={{ color: '#64748b', marginTop: '2rem' }}>Select a deck to view its stats.</p>
          )}

          {loading && <p style={{ color: '#64748b' }}>Loading…</p>}
          {error && <p style={{ color: '#f87171' }}>{error}</p>}

          {stats && !loading && (
            <>
              <h3 style={{ marginBottom: '0.25rem' }}>
                {stats.deck_name}
                <span style={{ color: '#94a3b8', fontWeight: 'normal', fontSize: '0.9rem' }}> — {stats.player}</span>
              </h3>

              {/* Stat boxes */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '1rem 0 1.5rem' }}>
                <StatBox label="Wins" value={stats.wins} color="#4ade80" />
                <StatBox label="Losses" value={stats.losses} color="#f87171" />
                <StatBox label="Draws" value={stats.draws} color="#94a3b8" />
                <StatBox label="Win Rate" value={`${stats.win_rate}%`} color="#a855f7" />
                <StatBox label="Total Games" value={stats.games} />
              </div>

              {/* Win rate over time chart */}
              {stats.history.length > 0 ? (
                <div style={{ background: '#16213e', borderRadius: 8, padding: '1rem' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '0.5rem' }}>Win Rate Over Time</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={stats.history} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                      <XAxis
                        dataKey="game_number"
                        stroke="#aaa"
                        label={{ value: 'Game #', position: 'insideBottom', offset: -10, fill: '#aaa' }}
                      />
                      <YAxis stroke="#aaa" domain={[0, 100]} tickFormatter={v => `${v}%`} />
                      <Tooltip
                        contentStyle={{ background: '#16213e', border: 'none', color: '#e0e0e0' }}
                        formatter={v => [`${v}%`, 'Win Rate']}
                        labelFormatter={n => `Game ${n}`}
                      />
                      <ReferenceLine y={50} stroke="#475569" strokeDasharray="4 4" />
                      <Line
                        type="monotone"
                        dataKey="cumulative_win_rate"
                        stroke="#a855f7"
                        dot={false}
                        strokeWidth={2.5}
                        name="Win Rate"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p style={{ color: '#64748b' }}>No non-draw games recorded yet.</p>
              )}

              {/* Matchup cards */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1.25rem' }}>
                <MatchupCard
                  title="Most Won Against"
                  items={stats.most_won_against}
                  countColor="#4ade80"
                  emptyMsg="No wins recorded yet."
                />
                <MatchupCard
                  title="Most Lost Against"
                  items={stats.most_lost_against}
                  countColor="#f87171"
                  emptyMsg="No losses recorded yet."
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
