import { PlayIcon, ShuffleIcon } from './Icons.tsx'
import type { Song } from '../types.ts'

interface PlayAllGroupProps {
  songs: Song[]
  shuffleEnabled: boolean
  onPlayAll: (songs: Song[], startFrom: Song) => void
  onShuffleToggle: () => void
}

export function PlayAllGroup({
  songs,
  shuffleEnabled,
  onPlayAll,
  onShuffleToggle,
}: PlayAllGroupProps) {
  return (
    <div className="play-all-group">
      <button
        className="btn-play-all"
        onClick={() => {
          if (songs.length > 0) {
            onPlayAll(songs, songs[0])
          }
        }}
      >
        <PlayIcon /> Play All
      </button>
      <button
        className={`btn-shuffle${shuffleEnabled ? ' active' : ''}`}
        onClick={onShuffleToggle}
        title="Shuffle"
      >
        <ShuffleIcon />
        Shuffle
      </button>
    </div>
  )
}
