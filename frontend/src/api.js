const BASE = 'https://mtg-tracker-backend.azurewebsites.net'

export async function fetchJSON(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const getPlayers = () => fetchJSON('/players')
export const getDecks   = () => fetchJSON('/decks')
export const getGames   = () => fetchJSON('/games')

export const getLeaderboard  = () => fetchJSON('/stats/leaderboard')
export const getHeadToHead   = () => fetchJSON('/stats/head-to-head')
export const getDeckHistory  = () => fetchJSON('/stats/deck-history')

async function adminFetch(path, adminKey, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const whoami           = (key)           => adminFetch('/admin/whoami',            key)
export const importPlayers    = (names, key)    => adminFetch('/admin/import/players',    key, { method: 'POST', body: JSON.stringify({ names }) })
export const importDecks      = (entries, key)  => adminFetch('/admin/import/decks',      key, { method: 'POST', body: JSON.stringify({ entries }) })
export const deletePlayer     = (id, key)       => adminFetch(`/admin/players/${id}`,     key, { method: 'DELETE' })
export const deleteDeck       = (id, key)       => adminFetch(`/admin/decks/${id}`,       key, { method: 'DELETE' })
export const deleteGame       = (id, key)       => adminFetch(`/admin/games/${id}`,       key, { method: 'DELETE' })
export const logGame          = (game, key)     => adminFetch('/admin/games',             key, { method: 'POST', body: JSON.stringify(game) })
export const clearAll         = (key)           => adminFetch('/admin/clear-all',         key, { method: 'DELETE' })

export const getAdminLogs   = (key)         => adminFetch('/admin/logs',          key)
export const getAdminKeys   = (key)         => adminFetch('/admin/keys',          key)
export const createAdminKey = (name, key)   => adminFetch('/admin/keys',          key, { method: 'POST', body: JSON.stringify({ name }) })
export const deleteAdminKey = (token, key)  => adminFetch(`/admin/keys/${token}`, key, { method: 'DELETE' })
