import { useCallback, useState } from 'react'
import { useAudioPlayer } from './hooks/useAudioPlayer.ts'
import { useMediaSession } from './hooks/useMediaSession.ts'
import { Player } from './components/Player.tsx'
import { Library, type Tab } from './pages/Library.tsx'
import { toggleStar } from './api.ts'
import type { Song } from './types.ts'
import './App.css'

const TABS: { key: Tab; label: string }[] = [
  { key: 'songs', label: 'Songs' },
  { key: 'albums', label: 'Albums' },
  { key: 'artists', label: 'Artists' },
  { key: 'playlists', label: 'Playlists' },
  { key: 'history', label: 'History' },
]

function App() {
  const [tab, setTab] = useState<Tab>('songs')
  const {
    audioRef,
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    play,
    pause,
    resume,
    togglePlay,
    seek,
    setVolume,
    next,
    previous,
    setPlaylist,
    restoreFromSongs,
    updateCurrentSong,
  } = useAudioPlayer()

  useMediaSession({
    currentSong,
    isPlaying,
    currentTime,
    duration,
    onPlay: resume,
    onPause: pause,
    onNext: next,
    onPrevious: previous,
    onSeek: seek,
  })

  const handleSongsLoaded = useCallback(
    (songs: Song[]) => {
      setPlaylist(songs)
      restoreFromSongs(songs)
    },
    [setPlaylist, restoreFromSongs],
  )

  const handlePlay = useCallback(
    (song: Song) => {
      play(song)
    },
    [play],
  )

  const handlePlayAll = useCallback(
    (songs: Song[], startFrom: Song) => {
      setPlaylist(songs)
      play(startFrom)
    },
    [setPlaylist, play],
  )

  const handleStarFromPlayer = useCallback(
    async (songId: string) => {
      const updated = await toggleStar(songId)
      updateCurrentSong(updated)
    },
    [updateCurrentSong],
  )

  return (
    <div className="app">
      <nav className="nav">
        <h1 className="nav-title">EdgeDeck</h1>
        <div className="nav-links nav-links-top">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={tab === t.key ? 'active' : ''}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="nav-links nav-links-bottom">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'active' : ''}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="main">
        <Library
          tab={tab}
          onTabChange={setTab}
          currentSongId={currentSong?.id ?? null}
          onPlay={handlePlay}
          onPlayAll={handlePlayAll}
          onSongsLoaded={handleSongsLoaded}
        />
      </main>

      <audio ref={audioRef} preload="auto" />
      <Player
        currentSong={currentSong}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        play={play}
        pause={pause}
        resume={resume}
        togglePlay={togglePlay}
        seek={seek}
        setVolume={setVolume}
        next={next}
        previous={previous}
        setPlaylist={setPlaylist}
        restoreFromSongs={restoreFromSongs}
        updateCurrentSong={updateCurrentSong}
        onStar={handleStarFromPlayer}
      />
    </div>
  )
}

export default App
