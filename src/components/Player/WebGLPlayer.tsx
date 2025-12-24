import { useEffect, useRef, useState } from 'react';
// @ts-ignore
import { Stage, Sprite, Text, Container, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { Clip, Track } from '../../types';

interface WebGLPlayerProps {
    width: number;
    height: number;
    clips: Clip[];
    tracks: Track[];
    currentTime: number;
    isPlaying: boolean;
    onTimeUpdate: (time: number) => void;
}

// Component to handle updates on every tick
const Ticker = ({ onTick }: { onTick: (delta: number) => void }) => {
    useTick((ticker: any) => {
        // @pixi/react v8 might pass ticker object or delta
        const delta = typeof ticker === 'number' ? ticker : ticker.deltaTime;
        onTick(delta);
    });
    return null;
};

const WebGLPlayer: React.FC<WebGLPlayerProps> = ({ width, height, clips, tracks, currentTime, isPlaying, onTimeUpdate }) => {
    const videoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});
    const [textures, setTextures] = useState<{ [key: string]: PIXI.Texture }>({});

    // Initialize video elements for video clips
    useEffect(() => {
        const videoClips = clips.filter(c => c.type === 'video');
        const newTextures: { [key: string]: PIXI.Texture } = {};

        videoClips.forEach(clip => {
            if (!videoRefs.current[clip.id]) {
                const video = document.createElement('video');
                video.src = clip.src;
                video.crossOrigin = 'anonymous';
                video.muted = true;
                video.load();
                videoRefs.current[clip.id] = video;

                // Create texture
                const texture = PIXI.Texture.from(video);
                newTextures[clip.id] = texture;
            }
        });

        setTextures(prev => ({ ...prev, ...newTextures }));

        return () => {
            // Cleanup if needed
        };
    }, [clips]);

    // Sync video playback with currentTime and isPlaying
    useEffect(() => {
        Object.entries(videoRefs.current).forEach(([id, video]) => {
            const clip = clips.find(c => c.id === id);
            if (clip) {
                const isActive = currentTime >= clip.offset && currentTime < clip.offset + (clip.end - clip.start);

                if (isActive) {
                    const clipTime = clip.start + (currentTime - clip.offset);
                    if (Math.abs(video.currentTime - clipTime) > 0.5) {
                        video.currentTime = clipTime;
                    }
                    if (isPlaying && video.paused) {
                        video.play().catch(e => console.error("Play error", e));
                    } else if (!isPlaying && !video.paused) {
                        video.pause();
                    }
                } else {
                    if (!video.paused) video.pause();
                }
            }
        });
    }, [currentTime, isPlaying, clips]);

    // Handle Ticker updates to drive playback
    const handleTick = (delta: number) => {
        if (isPlaying) {
            // delta is frame-independent (1 = 60fps approx)
            // We want to advance time
            // 60fps = 16.6ms per frame
            const timeToAdd = (delta / 60);
            onTimeUpdate(currentTime + timeToAdd);
        }
    };

    const sortedClips = [...clips].sort((a, b) => {
        const trackIndexA = tracks.findIndex(t => t.id === a.trackId);
        const trackIndexB = tracks.findIndex(t => t.id === b.trackId);
        return trackIndexB - trackIndexA;
    });

    return (
        <Stage width={width} height={height} options={{ background: 0x000000 }}>
            <Ticker onTick={handleTick} />
            <Container>
                {sortedClips.map(clip => {
                    const isActive = currentTime >= clip.offset && currentTime < clip.offset + (clip.end - clip.start);
                    if (!isActive) return null;

                    if (clip.type === 'video' && textures[clip.id]) {
                        // Parse style
                        const style = clip.style || {};
                        const x = style.left === '50%' ? width / 2 : parseFloat(style.left as string) || 0;
                        const y = style.top === '50%' ? height / 2 : parseFloat(style.top as string) || 0;
                        const rotation = parseFloat(style.rotation as string) || 0;
                        const opacity = parseFloat(style.opacity as string) || 1;
                        const scale = parseFloat(style.scale as string) || 1;

                        const w = (style.width === '100%' ? width : parseFloat(style.width as string) || width) * scale;
                        const h = (style.height === '100%' ? height : parseFloat(style.height as string) || height) * scale;

                        // Apply filters
                        const filters = [];
                        if (clip.effect) {
                            if (clip.effect.includes('grayscale')) filters.push(new PIXI.ColorMatrixFilter().grayscale(1, true));
                            if (clip.effect.includes('sepia')) filters.push(new PIXI.ColorMatrixFilter().sepia(true));
                        }

                        return (
                            <Sprite
                                key={clip.id}
                                texture={textures[clip.id]}
                                width={w}
                                height={h}
                                x={x}
                                y={y}
                                anchor={0.5}
                                rotation={rotation * (Math.PI / 180)}
                                alpha={opacity}
                                filters={filters.length > 0 ? filters : null}
                            />
                        );
                    } else if (clip.type === 'text') {
                        return (
                            <Text
                                key={clip.id}
                                text={clip.content}
                                x={clip.style?.left === '50%' ? width / 2 : parseFloat(clip.style?.left as string) || 0}
                                y={clip.style?.top === '50%' ? height / 2 : parseFloat(clip.style?.top as string) || 0}
                                anchor={0.5}
                                style={new PIXI.TextStyle({
                                    fill: clip.style?.color || 'white',
                                    fontSize: parseInt(clip.style?.fontSize as string) || 24,
                                    fontFamily: 'Arial',
                                    fontWeight: clip.style?.fontWeight as any || 'normal',
                                    dropShadow: {
                                        color: '#000000',
                                        blur: 4,
                                        distance: 2,
                                        angle: Math.PI / 6,
                                    }
                                })}
                            />
                        );
                    }
                    return null;
                })}
            </Container>
        </Stage>
    );
};

export default WebGLPlayer;
