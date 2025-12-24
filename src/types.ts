import React from 'react';

export interface ClipStyle extends React.CSSProperties {
    rotation?: number | string;
    opacity?: number | string;
    scale?: number | string;
}

export interface Clip {
    id: string;
    src: string;
    type: 'video' | 'image' | 'text' | 'audio';
    start: number; // Start time in the source media
    end: number;   // End time in the source media
    sourceDuration?: number; // Total duration of the source media
    offset: number; // Start time on the timeline
    trackId: string;
    style?: ClipStyle;
    content?: string; // For text clips
    effect?: string;
    filters?: { [key: string]: string };
    volume?: number;
    keyframes?: {
        [property: string]: { time: number; value: number }[];
    };
    transition?: {
        type: 'fade' | 'slide' | 'wipe';
        duration: number;
    };
    animation?: {
        type: 'fadeIn' | 'slideIn' | 'zoomIn';
        duration: number;
    };
    thumbnails?: string[];
}

export interface Track {
    id: string;
    type: 'video' | 'audio' | 'text';
    name: string;
}

export interface ProjectFile {
    version: string;
    name: string;
    timeline: {
        duration: number;
        clips: Clip[];
    };
    lastModified: number;
}
