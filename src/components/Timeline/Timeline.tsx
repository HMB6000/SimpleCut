import React, { useRef, useState, useEffect, useCallback } from 'react';
import './Timeline.css';
import { Clip, Track } from '../../types';
import ClipItem from './ClipItem';

interface TimelineProps {
    duration: number;
    currentTime: number;
    clips: Clip[];
    tracks: Track[];
    onSeek: (time: number) => void;
    onUpdateClip: (id: string, changes: Partial<Clip>) => void;
    selectedClipId: string | null;
    onSelectClip: (id: string) => void;
    onDrop?: (time: number, trackId?: string) => void;
}

const Timeline: React.FC<TimelineProps> = ({ duration, currentTime, clips, tracks, onSeek, onUpdateClip, selectedClipId, onSelectClip, onDrop }) => {
    const timelineRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState<{ id: string, type: 'left' | 'right' | 'move', offset: number } | null>(null);
    const [zoom, setZoom] = useState(1);

    const handleWheel = (e: React.WheelEvent) => {
        // Zoom logic: Scroll up (negative delta) -> Zoom In
        const delta = -e.deltaY * 0.001;
        setZoom(prev => Math.max(0.1, Math.min(10, prev + delta)));
    };

    const [isPanning, setIsPanning] = useState(false);
    const panStart = useRef<{ x: number, scrollLeft: number } | null>(null);

    const handleAreaMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.clip-block') || (e.target as HTMLElement).closest('.handle') || (e.target as HTMLElement).closest('.timeline-ruler')) return;

        if (timelineRef.current) {
            panStart.current = {
                x: e.clientX,
                scrollLeft: timelineRef.current.scrollLeft
            };
            setIsPanning(true);
        }
    };

    useEffect(() => {
        const handleWindowMouseMove = (e: MouseEvent) => {
            if (isPanning && panStart.current && timelineRef.current) {
                const delta = e.clientX - panStart.current.x;
                timelineRef.current.scrollLeft = panStart.current.scrollLeft - delta;
            }
        };

        const handleWindowMouseUp = (e: MouseEvent) => {
            if (isPanning && panStart.current && timelineRef.current) {
                const delta = Math.abs(e.clientX - panStart.current.x);
                if (delta < 5) {
                    // Treat as click/seek
                    const rect = timelineRef.current.getBoundingClientRect();
                    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
                    const percentage = Math.max(0, Math.min(1, x / timelineRef.current.scrollWidth));
                    onSeek(percentage * duration);
                }
                setIsPanning(false);
                panStart.current = null;
            }
        };

        if (isPanning) {
            window.addEventListener('mousemove', handleWindowMouseMove);
            window.addEventListener('mouseup', handleWindowMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
        };
    }, [isPanning, duration, onSeek]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (timelineRef.current && duration > 0 && onDrop) {
            const rect = timelineRef.current.getBoundingClientRect();
            const scrollLeft = timelineRef.current.scrollLeft;
            const x = e.clientX - rect.left + scrollLeft;
            const time = (x / timelineRef.current.scrollWidth) * duration;

            const element = document.elementFromPoint(e.clientX, e.clientY);
            const trackElement = element?.closest('.track-lane');
            const trackId = trackElement?.getAttribute('data-track-id') || undefined;

            onDrop(time, trackId);
        }
    };

    // Removed handleClick in favor of handleAreaMouseDown/Up logic

    const handleMouseDown = useCallback((e: React.MouseEvent, id: string, type: 'left' | 'right' | 'move') => {
        e.stopPropagation();

        let offset = 0;
        if (type === 'move' && timelineRef.current) {
            const rect = timelineRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const time = (x / rect.width) * duration;
            const clip = clips.find(c => c.id === id);
            if (clip) {
                offset = time - clip.offset;
            }
        }

        setDragging({ id, type, offset });
    }, [clips, duration]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragging || !timelineRef.current) return;

            const rect = timelineRef.current.getBoundingClientRect();
            const scrollLeft = timelineRef.current.scrollLeft;
            const x = e.clientX - rect.left + scrollLeft;
            const totalWidth = timelineRef.current.scrollWidth;
            let time = (x / totalWidth) * duration;

            // Snapping Logic
            const SNAP_THRESHOLD_PX = 10;
            const snapThresholdTime = (SNAP_THRESHOLD_PX / totalWidth) * duration;

            let minDiff = Infinity;
            let snapTo = -1;

            // Snap points: 0, duration, currentTime (playhead)
            const snapPoints = [0, duration, currentTime];

            // Add clip edges as snap points
            clips.forEach(c => {
                if (c.id === dragging.id) return; // Don't snap to self
                snapPoints.push(c.offset);
                snapPoints.push(c.offset + (c.end - c.start));
            });

            snapPoints.forEach(point => {
                const diff = Math.abs(time - point);
                if (diff < snapThresholdTime && diff < minDiff) {
                    minDiff = diff;
                    snapTo = point;
                }
            });

            if (snapTo !== -1) {
                time = snapTo;
            }

            const clip = clips.find(c => c.id === dragging.id);
            if (!clip) return;

            if (dragging.type === 'left') {
                const delta = time - clip.offset;
                const newStart = clip.start + delta;

                if (newStart < clip.end && newStart >= 0) {
                    onUpdateClip(clip.id, { start: newStart, offset: time });
                }
            } else if (dragging.type === 'right') {
                const newDuration = time - clip.offset;
                const newEnd = clip.start + newDuration;



                if (newEnd > clip.start) {
                    // Check against sourceDuration if available
                    if (clip.sourceDuration && newEnd > clip.sourceDuration) {
                        // Cap at source duration
                        const cappedEnd = clip.sourceDuration;
                        onUpdateClip(clip.id, { end: cappedEnd });
                    } else {
                        onUpdateClip(clip.id, { end: newEnd });
                    }
                }
            } else if (dragging.type === 'move') {
                // Calculate new offset


                // Snap for move (snap the LEFT edge or RIGHT edge)
                // The 'time' above is where the mouse is. 
                // dragging.offset is the diff between mouse and clip start.
                // So clip.offset would be time - dragging.offset.

                // We should re-calculate snap for the CLIP EDGE, not the mouse.
                // Let's refine snapping for 'move':

                const proposedOffset = time - dragging.offset;
                let snappedOffset = proposedOffset;

                // Re-run snap logic for the proposed start edge
                let minDiffMove = Infinity;
                let snapToMove = -1;

                snapPoints.forEach(point => {
                    // Snap left edge
                    const diffLeft = Math.abs(proposedOffset - point);
                    if (diffLeft < snapThresholdTime && diffLeft < minDiffMove) {
                        minDiffMove = diffLeft;
                        snapToMove = point;
                    }

                    // Snap right edge
                    const clipDuration = clip.end - clip.start;
                    const diffRight = Math.abs((proposedOffset + clipDuration) - point);
                    if (diffRight < snapThresholdTime && diffRight < minDiffMove) {
                        minDiffMove = diffRight;
                        snapToMove = point - clipDuration;
                    }
                });

                if (snapToMove !== -1) {
                    snappedOffset = snapToMove;
                }

                if (snappedOffset < 0) snappedOffset = 0;

                // Handle Track Change
                // Find element under mouse
                const element = document.elementFromPoint(e.clientX, e.clientY);
                const trackElement = element?.closest('.track-lane');
                let newTrackId = clip.trackId;

                if (trackElement) {
                    const trackId = trackElement.getAttribute('data-track-id');
                    if (trackId) {
                        newTrackId = trackId;
                    }
                }

                onUpdateClip(clip.id, { offset: snappedOffset, trackId: newTrackId });
            }
        };

        const handleMouseUp = () => {
            setDragging(null);
        };

        if (dragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragging, clips, duration, onUpdateClip, currentTime]);

    // Auto-scroll logic
    useEffect(() => {
        if (timelineRef.current && duration > 0) {
            const rect = timelineRef.current.getBoundingClientRect();
            const scrollContainer = timelineRef.current;
            const playheadPos = (currentTime / duration) * scrollContainer.scrollWidth;

            // Check if playhead is out of view
            const scrollLeft = scrollContainer.scrollLeft;
            const viewWidth = rect.width;

            if (playheadPos < scrollLeft || playheadPos > scrollLeft + viewWidth) {
                // Scroll to center playhead
                scrollContainer.scrollLeft = playheadPos - viewWidth / 2;
            }
        }
    }, [currentTime, duration, zoom]);

    const handleRulerMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (timelineRef.current && duration > 0) {
                const rect = timelineRef.current.getBoundingClientRect();
                // Account for scroll position
                const scrollLeft = timelineRef.current.scrollLeft;
                const x = moveEvent.clientX - rect.left + scrollLeft;
                const totalWidth = timelineRef.current.scrollWidth;
                const percentage = Math.max(0, Math.min(1, x / totalWidth));
                onSeek(percentage * duration);
            }
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        // Initial seek on click
        if (timelineRef.current && duration > 0) {
            const rect = timelineRef.current.getBoundingClientRect();
            const scrollLeft = timelineRef.current.scrollLeft;
            const x = e.clientX - rect.left + scrollLeft;
            const totalWidth = timelineRef.current.scrollWidth;
            const percentage = Math.max(0, Math.min(1, x / totalWidth));
            onSeek(percentage * duration);
        }
    };

    const formatTime = (seconds: number) => {
        const date = new Date(seconds * 1000);
        const mm = date.getUTCMinutes().toString().padStart(2, '0');
        const ss = date.getUTCSeconds().toString().padStart(2, '0');
        const ms = Math.floor(date.getUTCMilliseconds() / 10).toString().padStart(2, '0');
        return `${mm}:${ss}:${ms}`;
    };

    const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className="timeline-container">
            <div className="timeline-header">
                <div className="time-display">{formatTime(currentTime)}</div>
                <div className="total-time">{formatTime(duration)}</div>
            </div>

            <div className="timeline-body">
                {/* Left Column: Track Labels */}
                <div className="timeline-labels">
                    {tracks.map(track => (
                        <div key={track.id} className="track-label-item">
                            {track.name}
                        </div>
                    ))}
                </div>

                {/* Right Column: Timeline Content */}
                <div
                    className="timeline-track-area"
                    ref={timelineRef}
                    onMouseDown={handleAreaMouseDown}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onWheel={handleWheel}
                    style={{ cursor: isPanning ? 'grabbing' : 'default' }}
                >
                    <div className="timeline-scroll-container" style={{ width: `${Math.max(100, duration * 20 * zoom)}px`, minWidth: '100%', height: '100%', position: 'relative' }}>
                        <div className="timeline-ruler" onMouseDown={handleRulerMouseDown}>
                            {/* Ruler markers could go here */}
                        </div>

                        <div className="timeline-tracks">
                            {tracks.map(track => (
                                <div
                                    key={track.id}
                                    className={`track-lane ${track.type}-track`}
                                    data-track-id={track.id}
                                >
                                    {clips.filter(c => c.trackId === track.id).map(clip => (
                                        <ClipItem
                                            key={clip.id}
                                            clip={clip}
                                            track={track}
                                            duration={duration}
                                            isSelected={selectedClipId === clip.id}
                                            isDragging={dragging?.id === clip.id && dragging?.type === 'move'}
                                            onMouseDown={handleMouseDown}
                                            onSelect={onSelectClip}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>

                        <div
                            className="playhead"
                            style={{ left: `${progressPercentage}%` }}
                        >
                            <div className="playhead-line"></div>
                            <div className="playhead-marker"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Timeline;
