import { useEffect } from 'react';
import './VideoPlayer.css';

interface VideoPlayerProps {
    src: string | null;
    onTimeUpdate: (time: number) => void;
    onLoadedMetadata: (duration: number) => void;
    videoRef: React.RefObject<HTMLVideoElement>;
    style?: React.CSSProperties;
    volume?: number;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, onTimeUpdate, onLoadedMetadata, videoRef, style, volume = 1 }) => {

    useEffect(() => {
        if (videoRef.current && src) {
            videoRef.current.load();
        }
    }, [src, videoRef]);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.volume = volume;
        }
    }, [volume, videoRef]);

    return (
        <div className="video-player-container">
            {src ? (
                <video
                    ref={videoRef}
                    className="video-element"
                    controls={false} /* Custom controls will be used */
                    src={src}
                    onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
                    onLoadedMetadata={(e) => onLoadedMetadata(e.currentTarget.duration)}
                    style={style}
                >
                    Your browser does not support the video tag.
                </video>
            ) : (
                <div className="video-placeholder">
                    <span>No Video Selected</span>
                </div>
            )}
        </div>
    );
};

export default VideoPlayer;
