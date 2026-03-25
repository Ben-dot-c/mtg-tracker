import { useState } from 'react'
import {
  getPlayers, getDecks, getGames,
  importPlayers, importDecks,
  deletePlayer, deleteDeck, deleteGame, clearAll,
  whoami, getAdminLogs, getAdminKeys, createAdminKey, deleteAdminKey,
} from '../api'
import AddGame from './AddGame'

export default function AdminPanel() {
  const [key, setKey] = useState('')
  const [admin, setAdmin] = useState(null)
  const [error, setError] = useState('')

  const [players, setPlayers] = useState([])
  const [decks, setDecks] = useState([])
  const [games, setGames] = useState([])

  const [playerText, setPlayerText] = useState('')
  const [deckText, setDeckText] = useState('')
  const [importMsg, setImportMsg] = useState('')

  const [newDeckName, setNewDeckName] = useState('')
  const [newDeckPlayer, setNewDeckPlayer] = useState('')
  const [newDeckMsg, setNewDeckMsg] = useState('')

  // master-only
  const [logs, setLogs] = useState([])
  const [adminKeys, setAdminKeys] = useState([])
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyToken, setNewKeyToken] = useState('')
  const [keyMsg, setKeyMsg] = useState('')

  async function handleUnlock() {
    setError('')
    try {
      const info = await whoami(key)
      setAdmin(info)
      loadData()
      if (info.is_master) loadMasterData()
    } catch (err) {
      setError(err.message)
    }
  }

  async function loadData() {
    const [p, d, g] = await Promise.all([getPlayers(), getDecks(), getGames()])
    setPlayers(p)
    setDecks(d)
    setGames(g)
  }

  async function loadMasterData() {
    const [l, k] = await Promise.all([getAdminLogs(key), getAdminKeys(key)])
    setLogs(l)
    setAdminKeys(k)
  }

  async function handleImportPlayers() {
    setImportMsg('')
    const names = playerText.split('\n').map(n => n.trim()).filter(Boolean)
    if (!names.length) return
    try {
      const res = await importPlayers(names, key)
      setImportMsg(`Players: ${res.added} added, ${res.skipped} skipped.`)
      setPlayerText('')
      loadData()
    } catch (err) {
      setImportMsg('Error: ' + err.message)
    }
  }

  async function handleAddDeck() {
    setNewDeckMsg('')
    if (!newDeckName.trim() || !newDeckPlayer) return
    try {
      const res = await importDecks([`${newDeckName.trim()},${newDeckPlayer}`], key)
      if (res.errors.length) {
        setNewDeckMsg('Error: ' + res.errors[0])
      } else if (res.skipped > 0) {
        setNewDeckMsg('Deck already exists.')
      } else {
        setNewDeckMsg(`"${newDeckName.trim()}" added.`)
        setNewDeckName('')
        setNewDeckPlayer('')
        loadData()
      }
    } catch (err) {
      setNewDeckMsg('Error: ' + err.message)
    }
  }

  async function handleImportDecks() {
    setImportMsg('')
    const entries = deckText.split('\n').map(n => n.trim()).filter(Boolean)
    if (!entries.length) return
    try {
      const res = await importDecks(entries, key)
      let msg = `Decks: ${res.added} added, ${res.skipped} skipped.`
      if (res.errors.length) msg += ' Errors: ' + res.errors.join('; ')
      setImportMsg(msg)
      setDeckText('')
      loadData()
    } catch (err) {
      setImportMsg('Error: ' + err.message)
    }
  }

  async function handleDeletePlayer(id) {
    try {
      await deletePlayer(id, key)
      setPlayers(players.filter(p => p.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteDeck(id) {
    try {
      await deleteDeck(id, key)
      setDecks(decks.filter(d => d.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteGame(id) {
    try {
      await deleteGame(id, key)
      setGames(games.filter(g => g.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleClearAll() {
    if (!window.confirm('Delete ALL data? This cannot be undone.')) return
    try {
      await clearAll(key)
      setPlayers([])
      setDecks([])
      setGames([])
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCreateKey() {
    setKeyMsg('')
    setNewKeyToken('')
    if (!newKeyName.trim()) return
    try {
      const res = await createAdminKey(newKeyName.trim(), key)
      setNewKeyToken(res.token)
      setNewKeyName('')
      setKeyMsg(`Key created for "${res.name}".`)
      loadMasterData()
    } catch (err) {
      setKeyMsg('Error: ' + err.message)
    }
  }

  async function handleDeleteKey(token, name) {
    if (!window.confirm(`Revoke key for "${name}"?`)) return
    try {
      await deleteAdminKey(token, key)
      setAdminKeys(adminKeys.filter(k => k.token !== token))
    } catch (err) {
      setKeyMsg('Error: ' + err.message)
    }
  }

  if (!admin) {
    return (
      <div>
        <h2>Admin Login</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="password"
            placeholder="Admin password"
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            style={{ width: 220 }}
          />
          <button className="btn" onClick={handleUnlock}>Unlock</button>
        </div>
        {error && <p style={{ color: '#f87171', marginTop: '0.5rem' }}>{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <h2>Admin Panel <span style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 'normal' }}>— {admin.name}{admin.is_master ? ' (master)' : ''}</span></h2>

      {/* Log Game */}
      <section style={{ marginBottom: '2rem' }}>
        <AddGame onSaved={loadData} adminKey={key} />
      </section>

      {/* Add Deck */}
      <section style={{ marginBottom: '2rem' }}>
        <h3>Add Deck</h3>
        {newDeckMsg && <p style={{ color: newDeckMsg.startsWith('Error') ? '#f87171' : '#4ade80' }}>{newDeckMsg}</p>}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            placeholder="Deck name"
            value={newDeckName}
            onChange={e => setNewDeckName(e.target.value)}
            style={{ width: 200 }}
          />
          <select value={newDeckPlayer} onChange={e => setNewDeckPlayer(e.target.value)}>
            <option value="">— select player —</option>
            {players.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          <button className="btn" onClick={handleAddDeck}>Add Deck</button>
        </div>
      </section>

      {/* Import */}
      <section style={{ marginBottom: '2rem' }}>
        <h3>Mass Import</h3>
        {importMsg && <p style={{ color: importMsg.startsWith('Error') ? '#f87171' : '#4ade80' }}>{importMsg}</p>}
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div>
            <label>Players — one name per line</label>
            <textarea
              rows={6}
              style={{ display: 'block', width: 220, marginTop: '0.25rem' }}
              placeholder={'Alice\nBob\nCarol'}
              value={playerText}
              onChange={e => setPlayerText(e.target.value)}
            />
            <button className="btn" style={{ marginTop: '0.5rem' }} onClick={handleImportPlayers}>Import Players</button>
          </div>
          <div>
            <label>Decks — "DeckName,PlayerName" per line</label>
            <textarea
              rows={6}
              style={{ display: 'block', width: 260, marginTop: '0.25rem' }}
              placeholder={'Atraxa,Alice\nKrenko,Bob'}
              value={deckText}
              onChange={e => setDeckText(e.target.value)}
            />
            <button className="btn" style={{ marginTop: '0.5rem' }} onClick={handleImportDecks}>Import Decks</button>
          </div>
        </div>
      </section>

      {/* Delete */}
      <section style={{ marginBottom: '2rem' }}>
        <h3>Delete Entries</h3>
        {error && <p style={{ color: '#f87171' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>

          <div style={{ minWidth: 200, flex: 1 }}>
            <h4 style={{ marginBottom: '0.5rem' }}>Players</h4>
            <div style={{ maxHeight: 220, overflowY: 'auto', background: '#1e293b', borderRadius: 6, padding: '0.5rem' }}>
              {players.length === 0 && <p style={{ color: '#94a3b8' }}>None</p>}
              {players.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span>{p.name}</span>
                  <button className="btn" style={{ background: '#dc2626', marginLeft: '0.5rem', padding: '0.2rem 0.6rem', fontSize: '0.85rem' }} onClick={() => handleDeletePlayer(p.id)}>✕</button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ minWidth: 220, flex: 1 }}>
            <h4 style={{ marginBottom: '0.5rem' }}>Decks</h4>
            <div style={{ maxHeight: 220, overflowY: 'auto', background: '#1e293b', borderRadius: 6, padding: '0.5rem' }}>
              {decks.length === 0 && <p style={{ color: '#94a3b8' }}>None</p>}
              {decks.map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span>{d.name} <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>({d.player.name})</span></span>
                  <button className="btn" style={{ background: '#dc2626', marginLeft: '0.5rem', padding: '0.2rem 0.6rem', fontSize: '0.85rem' }} onClick={() => handleDeleteDeck(d.id)}>✕</button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ minWidth: 200, flex: 1 }}>
            <h4 style={{ marginBottom: '0.5rem' }}>Games</h4>
            <div style={{ maxHeight: 220, overflowY: 'auto', background: '#1e293b', borderRadius: 6, padding: '0.5rem' }}>
              {games.length === 0 && <p style={{ color: '#94a3b8' }}>None</p>}
              {games.map(g => (
                <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span>{g.date}{g.notes ? ` — ${g.notes}` : ''}</span>
                  <button className="btn" style={{ background: '#dc2626', marginLeft: '0.5rem', padding: '0.2rem 0.6rem', fontSize: '0.85rem' }} onClick={() => handleDeleteGame(g.id)}>✕</button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* Master-only */}
      {admin.is_master && (
        <>
          <section style={{ marginBottom: '2rem', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
            <h3>Admin Keys</h3>
            {keyMsg && <p style={{ color: newKeyToken ? '#4ade80' : '#94a3b8' }}>{keyMsg}</p>}
            {newKeyToken && (
              <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: 6, marginBottom: '1rem', wordBreak: 'break-all' }}>
                <strong>New key (copy now — won't be shown again):</strong><br />
                <code style={{ color: '#4ade80' }}>{newKeyToken}</code>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
              <input
                placeholder="Name for new key"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateKey()}
                style={{ width: 200 }}
              />
              <button className="btn" onClick={handleCreateKey}>Create Key</button>
            </div>
            {adminKeys.length === 0 && <p style={{ color: '#94a3b8' }}>No regular keys yet.</p>}
            {adminKeys.map(k => (
              <div key={k.token} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span><strong>{k.name}</strong> — <code style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{k.token}</code></span>
                <button className="btn" style={{ background: '#dc2626', marginLeft: '0.5rem' }} onClick={() => handleDeleteKey(k.token, k.name)}>Revoke</button>
              </div>
            ))}
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h3>Activity Log <button className="btn" style={{ fontSize: '0.8rem', marginLeft: '0.5rem' }} onClick={loadMasterData}>Refresh</button></h3>
            {logs.length === 0 && <p style={{ color: '#94a3b8' }}>No activity yet.</p>}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '0.25rem 0.5rem' }}>Time</th>
                  <th style={{ padding: '0.25rem 0.5rem' }}>Who</th>
                  <th style={{ padding: '0.25rem 0.5rem' }}>Action</th>
                  <th style={{ padding: '0.25rem 0.5rem' }}>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} style={{ borderTop: '1px solid #1e293b' }}>
                    <td style={{ padding: '0.25rem 0.5rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>{new Date(l.timestamp).toLocaleString()}</td>
                    <td style={{ padding: '0.25rem 0.5rem' }}>{l.key_name}</td>
                    <td style={{ padding: '0.25rem 0.5rem' }}>{l.action}</td>
                    <td style={{ padding: '0.25rem 0.5rem', color: '#94a3b8' }}>{l.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section style={{ borderTop: '1px solid #dc2626', paddingTop: '1rem' }}>
            <h3 style={{ color: '#dc2626' }}>Danger Zone</h3>
            <button className="btn" style={{ background: '#dc2626' }} onClick={handleClearAll}>Delete All Data</button>
          </section>
        </>
      )}
    </div>
  )
}
