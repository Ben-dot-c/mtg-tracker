import { useState } from 'react'
import Leaderboard from './components/Leaderboard'
import GameLog from './components/GameLog'
import AdminPanel from './components/AdminPanel'
import DeckStats from './components/DeckStats'

export default function App() {
  const [page, setPage] = useState('leaderboard')

  return (
    <>
      <nav>
        <h1>MTG Tracker</h1>
        <button className={page === 'leaderboard' ? 'active' : ''} onClick={() => setPage('leaderboard')}>Leaderboard</button>
        <button className={page === 'decks' ? 'active' : ''} onClick={() => setPage('decks')}>Decks</button>
        <button className={page === 'games' ? 'active' : ''} onClick={() => setPage('games')}>Game Log</button>
        <button className={page === 'admin' ? 'active' : ''} onClick={() => setPage('admin')}>Admin</button>
      </nav>
      <main>
        {page === 'leaderboard' && <Leaderboard />}
        {page === 'decks'       && <DeckStats />}
        {page === 'games'       && <GameLog />}
        {page === 'admin'       && <AdminPanel />}
      </main>
    </>
  )
}
