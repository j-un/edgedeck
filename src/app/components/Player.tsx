import type {
  AudioPlayerControls,
  AudioPlayerState,
} from '../hooks/useAudioPlayer.ts'

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

type PlayerProps = AudioPlayerState &
  AudioPlayerControls & {
    onStar?: (songId: string) => void
  }

export function Player({
  currentSong,
  isPlaying,
  currentTime,
  duration,
  volume,
  togglePlay,
  seek,
  setVolume,
  next,
  previous,
  onStar,
}: PlayerProps) {
  if (!currentSong) return null

  return (
    <div className="player">
      {currentSong.artwork_r2_key && (
        <img
          className="player-artwork"
          src={`/api/songs/artwork/${currentSong.artwork_r2_key.replace('artwork/', '')}`}
          alt=""
        />
      )}
      <div className="player-info">
        <span className="player-title">{currentSong.title}</span>
        <span className="player-artist">
          {currentSong.artist ?? 'Unknown Artist'}
        </span>
      </div>

      {onStar && (
        <button
          className={`star-btn player-star${currentSong.starred_at ? ' starred' : ''}`}
          onClick={() => onStar(currentSong.id)}
          title={currentSong.starred_at ? 'Unstar' : 'Star'}
        >
          {currentSong.starred_at ? '★' : '☆'}
        </button>
      )}

      <div className="player-controls">
        <button onClick={previous} title="Previous">
          ⏮
        </button>
        <button onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={next} title="Next">
          ⏭
        </button>
      </div>

      <div className="player-seek">
        <span className="player-time">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={currentTime}
          step={0.1}
          onChange={(e) => seek(Number(e.target.value))}
          className="seek-bar"
        />
        <span className="player-time">{formatTime(duration)}</span>
      </div>

      <div className="player-volume">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="volume-bar"
        />
      </div>
    </div>
  )
}
