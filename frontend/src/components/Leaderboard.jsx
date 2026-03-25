import { useEffect, useState } from 'react'
import { getLeaderboard, getHeadToHead, getDeckHistory } from '../api'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const COLORS = ['#a855f7', '#22d3ee', '#f59e0b', '#4ade80', '#f87171', '#60a5fa', '#fb923c', '#e879f9']

const METRICS = [
  { key: 'wins',            label: 'Wins' },
  { key: 'games',           label: 'Games Played' },
  { key: 'win_rate',        label: 'Win Rate %' },
  { key: 'best_deck_rate',  label: 'Best Deck Win Rate (past 75 games)' },
  { key: 'current_streak',  label: 'Current Streak' },
  { key: 'longest_streak',  label: 'Longest Streak' },
]

function mergeHistories(deckData) {
  const maxLen = Math.max(...deckData.map(d => d.history.length), 0)
  return Array.from({ length: maxLen }, (_, i) => {
    const point = { game: i + 1 }
    for (const deck of deckData) {
      point[`deck_${deck.deck_id}`] = i < deck.history.length
        ? deck.history[i].cumulative_win_rate
        : null
    }
    return point
  })
}

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([])
  const [h2h, setH2h] = useState(null)
  const [deckHistory, setDeckHistory] = useState([])
  const [sortKey, setSortKey] = useState('wins')
  const [sortDesc, setSortDesc] = useState(true)
  const [chartMetric, setChartMetric] = useState('wins')
  const [selectedDecks, setSelectedDecks] = useState([])
  const [deckSearch, setDeckSearch] = useState('')

  useEffect(() => {
    getLeaderboard().then(setLeaderboard).catch(console.error)
    getHeadToHead().then(setH2h).catch(console.error)
    getDeckHistory().then(setDeckHistory).catch(console.error)
  }, [])

  const flat = leaderboard.map(row => ({
    ...row,
    best_deck_name: row.best_deck?.name ?? null,
    best_deck_rate: row.best_deck?.win_rate ?? 0,
  }))

  function toggleSort(key) {
    if (sortKey === key) setSortDesc(d => !d)
    else { setSortKey(key); setSortDesc(true) }
  }

  const sorted = [...flat].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey]
    if (typeof av === 'string') return sortDesc ? bv.localeCompare(av) : av.localeCompare(bv)
    return sortDesc ? (bv ?? 0) - (av ?? 0) : (av ?? 0) - (bv ?? 0)
  })

  const chartData = [...flat]
    .sort((a, b) => (b[chartMetric] ?? 0) - (a[chartMetric] ?? 0))
    .map(r => ({ player: r.player, value: r[chartMetric] ?? 0 }))

  const metricLabel = METRICS.find(m => m.key === chartMetric)?.label ?? ''

  function toggleDeck(deckId) {
    setSelectedDecks(prev =>
      prev.includes(deckId) ? prev.filter(d => d !== deckId) : [...prev, deckId]
    )
  }

  const selectedDeckData = deckHistory.filter(d => selectedDecks.includes(d.deck_id))
  const timeData = mergeHistories(selectedDeckData)

  function Th({ col, label }) {
    const active = sortKey === col
    return (
      <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => toggleSort(col)}>
        {label}{active ? (sortDesc ? ' ↓' : ' ↑') : ''}
      </th>
    )
  }

  return (
    <div>
      <h2>Leaderboard</h2>

      {/* Metric selector */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {METRICS.map(m => (
          <button
            key={m.key}
            className="btn"
            style={{ fontSize: '0.78rem', opacity: chartMetric === m.key ? 1 : 0.5 }}
            onClick={() => setChartMetric(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <XAxis dataKey="player" stroke="#aaa" />
          <YAxis stroke="#aaa" />
          <Tooltip
            contentStyle={{ background: '#16213e', border: 'none', color: '#e0e0e0' }}
            formatter={v => [v, metricLabel]}
          />
          <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 0, 0]} name={metricLabel} />
        </BarChart>
      </ResponsiveContainer>

      {/* Sortable table */}
      <div className="table-wrap" style={{ marginTop: '1.5rem' }}>
      <table>
        <thead>
          <tr>
            <Th col="player" label="Player" />
            <Th col="wins" label="Wins" />
            <Th col="games" label="Games" />
            <Th col="win_rate" label="Win Rate" />
            <Th col="best_deck_rate" label="Best Deck (past 75 games)" />
            <Th col="current_streak" label="Streak" />
            <Th col="longest_streak" label="Best Streak" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => (
            <tr key={row.player}>
              <td>{row.player}</td>
              <td>{row.wins}</td>
              <td>{row.games}</td>
              <td>{row.win_rate}%</td>
              <td>
                {row.best_deck_name
                  ? <>{row.best_deck_rate}% <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>({row.best_deck_name})</span></>
                  : '—'}
              </td>
              <td>{row.current_streak}</td>
              <td>{row.longest_streak}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Head-to-head */}
      {h2h && h2h.players.length > 0 && (
        <section style={{ marginTop: '2.5rem' }}>
          <h3>Head-to-Head <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 'normal' }}>— wins when both players shared a game</span></h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', color: '#94a3b8' }}>↓ beat →</th>
                  {h2h.players.map(p => <th key={p} style={{ color: '#94a3b8' }}>{p}</th>)}
                </tr>
              </thead>
              <tbody>
                {h2h.players.map(rowP => (
                  <tr key={rowP}>
                    <td style={{ fontWeight: 'bold', paddingRight: '0.75rem' }}>{rowP}</td>
                    {h2h.players.map(colP => (
                      <td key={colP} style={{
                        textAlign: 'center',
                        color: rowP === colP ? '#1e293b' : (h2h.matrix[rowP]?.[colP] ?? 0) > 0 ? '#e0e0e0' : '#475569',
                        background: rowP === colP ? '#0f172a' : undefined,
                      }}>
                        {rowP === colP ? '—' : (h2h.matrix[rowP]?.[colP] ?? 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Deck win rate over time */}
      <section style={{ marginTop: '2.5rem' }}>
        <h3>Deck Win Rate Over Time</h3>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ width: '100%', maxWidth: 280, maxHeight: 340, display: 'flex', flexDirection: 'column', background: '#1e293b', borderRadius: 6, padding: '0.5rem' }}>
            <input
              type="text"
              placeholder="Search decks..."
              value={deckSearch}
              onChange={e => setDeckSearch(e.target.value)}
              style={{ marginBottom: '0.5rem', width: '100%', boxSizing: 'border-box', fontSize: '0.82rem' }}
            />
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {[...deckHistory]
                .sort((a, b) => b.history.length - a.history.length)
                .filter(d => d.deck_label.toLowerCase().includes(deckSearch.toLowerCase()))
                .map(deck => {
                  const colorIndex = deckHistory.findIndex(d => d.deck_id === deck.deck_id)
                  const selected = selectedDecks.includes(deck.deck_id)
                  return (
                    <div key={deck.deck_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.82rem', minWidth: 0 }}>
                        <span style={{ color: COLORS[colorIndex % COLORS.length] }}>■</span>{' '}
                        {deck.deck_label}
                        <span style={{ color: '#64748b', fontSize: '0.75rem' }}> {deck.history.length}g</span>
                      </span>
                      <button
                        className="btn"
                        style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem', flexShrink: 0, background: selected ? '#7c3aed' : '#334155' }}
                        onClick={() => toggleDeck(deck.deck_id)}
                      >
                        {selected ? '✓' : '+'}
                      </button>
                    </div>
                  )
                })}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 300 }}>
            {selectedDecks.length === 0
              ? <p style={{ color: '#64748b', marginTop: 0 }}>Select one or more decks to compare.</p>
              : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <XAxis dataKey="game" stroke="#aaa" label={{ value: 'Game #', position: 'insideBottom', offset: -10, fill: '#aaa' }} />
                    <YAxis stroke="#aaa" domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      contentStyle={{ background: '#16213e', border: 'none', color: '#e0e0e0' }}
                      formatter={(v, name) => v != null ? [`${v}%`, name] : [null, name]}
                    />
                    <Legend />
                    {selectedDeckData.map(deck => {
                      const colorIndex = deckHistory.findIndex(d => d.deck_id === deck.deck_id)
                      return (
                        <Line
                          key={deck.deck_id}
                          type="monotone"
                          dataKey={`deck_${deck.deck_id}`}
                          name={deck.deck_label}
                          stroke={COLORS[colorIndex % COLORS.length]}
                          dot={false}
                          strokeWidth={2}
                          connectNulls={false}
                        />
                      )
                    })}
                  </LineChart>
                </ResponsiveContainer>
              )
            }
          </div>
        </div>
      </section>
    </div>
  )
}
