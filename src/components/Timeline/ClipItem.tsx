import React from 'react';
import { Clip, Track } from '../../types';

interface ClipItemProps {
    clip: Clip;
    track: Track;
    duration: number;
    isSelected: boolean;
    isDragging: boolean;
    onMouseDown: (e: React.MouseEvent, id: string, type: 'left' | 'right' | 'move') => void;
    onSelect: (id: string) => void;
}

const ClipItem: React.FC<ClipItemProps> = React.memo(({
    clip,
    track,
    duration,
    isSelected,
    isDragging,
    onMouseDown,
    onSelect
}) => {
    return (
        <div
            className={`clip-block ${track.type}-clip`}
            style={{
                left: `${(clip.offset / duration) * 100}%`,
                width: `${((clip.end - clip.start) / duration) * 100}%`,
                position: 'absolute',
                backgroundColor: track.type === 'video' ? '#3498db' : track.type === 'audio' ? '#2ecc71' : '#e67e22',
                border: isSelected ? '2px solid #fff' : 'none',
                cursor: 'grab',
                pointerEvents: isDragging ? 'none' : 'auto',
                zIndex: isDragging ? 100 : 1
            }}
            onMouseDown={(e) => {
                if ((e.target as HTMLElement).classList.contains('handle')) return;
                // console.log('MouseDown on clip:', clip.id);
                onMouseDown(e, clip.id, 'move');
                onSelect(clip.id);
            }}
        >
            {clip.trackId === track.id && clip.type === 'video' && clip.thumbnails && (
                <div className="clip-thumbnails" style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    overflow: 'hidden',
                    pointerEvents: 'none',
                    zIndex: 0
                }}>
                    {clip.thumbnails.map((thumb, idx) => (
                        <img
                            key={idx}
                            src={thumb}
                            className="clip-thumbnail"
                            style={{
                                height: '100%',
                                width: 'auto',
                                flexGrow: 1,
                                objectFit: 'cover',
                                minWidth: '32px',
                                opacity: 0.8
                            }}
                            loading="lazy"
                            alt=""
                        />
                    ))}
                </div>
            )}
            <div
                className="handle left"
                onMouseDown={(e) => {
                    // console.log('MouseDown Left Handle');
                    onMouseDown(e, clip.id, 'left');
                }}
            />
            {track.type === 'audio' && (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' }}>
                    {(() => {
                        // Pseudo-waveform generation
                        const seed = clip.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                        let currentSeed = seed;
                        const random = () => {
                            const x = Math.sin(currentSeed++) * 10000;
                            return x - Math.floor(x);
                        };

                        const numPoints = 50;
                        const bars = [];
                        for (let i = 0; i < numPoints; i++) {
                            const height = Math.max(0.2, random()) * 80;
                            bars.push(
                                <div key={i} style={{
                                    position: 'absolute',
                                    left: `${(i / numPoints) * 100}%`,
                                    top: '50%',
                                    height: `${height}%`,
                                    width: `${100 / numPoints}%`,
                                    background: 'rgba(255,255,255,0.6)',
                                    transform: 'translateY(-50%)',
                                    borderRadius: '1px'
                                }} />
                            );
                        }
                        return bars;
                    })()}
                </div>
            )}
            <span style={{ position: 'relative', zIndex: 2, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                {track.type === 'text' ? clip.content : `${track.type} ${clip.id.slice(-4)}`}
            </span>
            <div
                className="handle right"
                onMouseDown={(e) => {
                    // console.log('MouseDown Right Handle');
                    onMouseDown(e, clip.id, 'right');
                }}
            />
        </div>
    );
}, (prev, next) => {
    // Custom comparison to ensure strict equality where it matters
    // Re-render if:
    // 1. Clip data changes (start, end, offset, thumbnail list etc)
    // 2. Track color changes (rare)
    // 3. Duration changes (zooming/scaling)
    // 4. Selection state changes
    // 5. Dragging state changes (specifically for THIS clip or if global dragging state affects pointers)

    if (prev.clip !== next.clip) return false;
    if (prev.track !== next.track) return false;
    if (prev.duration !== next.duration) return false;
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.isDragging !== next.isDragging) return false;

    return true;
});

export default ClipItem;
