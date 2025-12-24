import { useState, useEffect, useRef } from 'react';
import './App.css';
// import WebGLPlayer from './components/Player/WebGLPlayer';
import Timeline from './components/Timeline/Timeline';
import ExportModal from './components/ExportModal';
import { Clip, Track, ClipStyle } from './types';

const getFilterString = (clip: Clip) => {
  if (clip.filters && Object.keys(clip.filters).length > 0) {
    return Object.entries(clip.filters)
      .map(([key, value]) => `${key}(${value})`)
      .join(' ');
  }
  return clip.effect || 'none';
};

function App() {
  const [assets, setAssets] = useState<string[]>([]);
  const [tracks, setTracks] = useState<Track[]>([
    { id: 'video-1', type: 'video', name: 'Video 1' },
    { id: 'text-1', type: 'text', name: 'Text' },
    { id: 'audio-1', type: 'audio', name: 'Audio 1' }
  ]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Undo/Redo State
  const [history, setHistory] = useState<Clip[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const draggedItem = useRef<{ src: string, type: 'video' | 'audio' | 'image' } | null>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});

  useEffect(() => {
    // Sync Video
    Object.keys(videoRefs.current).forEach(id => {
      const video = videoRefs.current[id];
      const clip = clips.find(c => c.id === id);
      if (video && clip) {
        const timeInClip = currentTime - clip.offset + clip.start;
        const isActive = currentTime >= clip.offset && currentTime < clip.offset + (clip.end - clip.start);

        if (isPlaying && isActive) {
          if (video.paused) video.play().catch(() => { });
          if (Math.abs(video.currentTime - timeInClip) > 0.3) {
            video.currentTime = timeInClip;
          }
        } else {
          if (!video.paused) video.pause();
          if (Math.abs(video.currentTime - timeInClip) > 0.1) {
            video.currentTime = timeInClip;
          }
        }
      }
    });

    // Sync Audio
    Object.keys(audioRefs.current).forEach(id => {
      const audio = audioRefs.current[id];
      const clip = clips.find(c => c.id === id);
      if (audio && clip) {
        const timeInClip = currentTime - clip.offset + clip.start;
        const isActive = currentTime >= clip.offset && currentTime < clip.offset + (clip.end - clip.start);

        if (isPlaying && isActive) {
          if (audio.paused) audio.play().catch(() => { });
          if (Math.abs(audio.currentTime - timeInClip) > 0.3) {
            audio.currentTime = timeInClip;
          }
        } else {
          if (!audio.paused) audio.pause();
          if (Math.abs(audio.currentTime - timeInClip) > 0.1) {
            audio.currentTime = timeInClip;
          }
        }
      }
    });
  }, [currentTime, isPlaying, clips]);

  const updateClipsWithHistory = (newClips: Clip[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newClips);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setClips(newClips);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setClips(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setClips(history[historyIndex + 1]);
    }
  };

  const deleteClip = () => {
    if (!selectedClipId) return;
    const newClips = clips.filter(c => c.id !== selectedClipId);
    updateClipsWithHistory(newClips);
    setSelectedClipId(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Prevent deleting if input is focused
        if (document.activeElement?.tagName === 'INPUT') return;
        deleteClip();
      }
      if (e.code === 'Space') {
        if (document.activeElement?.tagName === 'INPUT') return;
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, historyIndex, selectedClipId, clips]);

  useEffect(() => {
    if (clips.length > 0) {
      const maxEnd = Math.max(...clips.map(c => c.offset + (c.end - c.start)));
      setDuration(Math.max(60, maxEnd));
    } else {
      setDuration(60);
    }
  }, [clips]);

  useEffect(() => {
    let animationFrame: number;
    if (isPlaying) {
      const startTime = Date.now();
      const startCurrentTime = currentTime;

      const loop = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const newTime = startCurrentTime + elapsed;

        if (newTime >= duration) {
          setCurrentTime(duration);
          setIsPlaying(false);
        } else {
          setCurrentTime(newTime);
          animationFrame = requestAnimationFrame(loop);
        }
      };
      animationFrame = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying, duration]);

  // Sync video elements with global time
  useEffect(() => {
    clips.forEach(clip => {
      const videoEl = videoRefs.current[clip.id];
      if (!videoEl) return;

      const clipDuration = clip.end - clip.start;
      const isActive = currentTime >= clip.offset && currentTime < clip.offset + clipDuration;

      if (isActive) {
        // Calculate where the video head should be
        const targetTime = (currentTime - clip.offset) + clip.start;

        // Sync time if significantly off (seeking)
        if (Math.abs(videoEl.currentTime - targetTime) > 0.2) {
          videoEl.currentTime = targetTime;
        }

        // Play/Pause state sync
        if (isPlaying) {
          // Only play if not already playing to avoid promise interruptions
          if (videoEl.paused) videoEl.play().catch(e => console.error("Play error", e));
        } else {
          if (!videoEl.paused) videoEl.pause();
        }
      } else {
        // If not active, ensure paused
        if (!videoEl.paused) videoEl.pause();
      }
    });

    // Handle audio sync similarly
    clips.forEach(clip => {
      const audioEl = audioRefs.current[clip.id];
      if (!audioEl) return;
      const isActive = currentTime >= clip.offset && currentTime < clip.offset + (clip.end - clip.start);
      if (isActive) {
        const targetTime = (currentTime - clip.offset) + clip.start;
        if (Math.abs(audioEl.currentTime - targetTime) > 0.2) {
          audioEl.currentTime = targetTime;
        }
        if (isPlaying) {
          if (audioEl.paused) audioEl.play().catch(e => console.error("Audio play error", e));
        } else {
          if (!audioEl.paused) audioEl.pause();
        }
      } else {
        if (!audioEl.paused) audioEl.pause();
      }
    });
  }, [currentTime, isPlaying, clips]);

  const handleImport = async () => {
    const filePath = await window.ipcRenderer.invoke('dialog:openFile');
    if (filePath) {
      setAssets([...assets, filePath]);

      // Check if video and generate proxy
      if (filePath.match(/\.(mp4|mov|mkv|webm)$/i)) {
        console.log('Generating proxy for:', filePath);
        (window as any).ipcRenderer.invoke('generate-proxy', filePath).then((proxyPath: string) => {
          console.log('Proxy generated:', proxyPath);

          // Format as media URL
          const normalizedPath = proxyPath.replace(/\\/g, '/');
          const parts = normalizedPath.split('/');
          const encodedParts = parts.map(p => p.includes(':') ? p : encodeURIComponent(p));
          const mediaUrl = `media:///${encodedParts.join('/')}`;

          const tempVideo = document.createElement('video');
          tempVideo.style.display = 'none';
          document.body.appendChild(tempVideo);
          tempVideo.src = mediaUrl;

          tempVideo.onloadedmetadata = () => {
            const duration = tempVideo.duration;
            // Update clip with proxy URL (media protocol) and duration
            setClips(prev => prev.map(c => c.src === filePath ? { ...c, src: mediaUrl, end: duration, sourceDuration: duration } : c));

            // Generate thumbnails with adaptive density
            console.log('Generating thumbnails for:', filePath, 'duration:', duration);
            (window as any).ipcRenderer.invoke('generate-thumbnails', filePath, duration).then((thumbnails: string[]) => {
              console.log('Thumbnails generated:', thumbnails.length);
              // Format thumb paths with media protocol
              const mediaTrailedThumbs = thumbnails.map(t => {
                const normalized = t.replace(/\\/g, '/');
                const parts = normalized.split('/');
                const encoded = parts.map(p => p.includes(':') ? p : encodeURIComponent(p));
                return `media:///${encoded.join('/')}`;
              });

              setClips(prev => prev.map(c => c.src === filePath || c.src === mediaUrl ? { ...c, thumbnails: mediaTrailedThumbs } : c));
            });

            document.body.removeChild(tempVideo);
          };
          tempVideo.onerror = (e) => {
            console.error("Proxy load error", e);
            // Fallback to mediaUrl even if metadata failed, rendering loop might have better luck?
            setClips(prev => prev.map(c => c.src === filePath ? { ...c, src: mediaUrl } : c));
            document.body.removeChild(tempVideo);
          };


        });
      }

      if (clips.length === 0) {
        addClipToTimeline(filePath);
      }
    }
  };

  const addClipToTimeline = (src: string, type: 'video' | 'audio' | 'image' = 'video', startTime?: number, targetTrackId?: string) => {
    let style: ClipStyle | undefined;
    if (type === 'image') {
      style = { left: '50%', top: '50%', scale: 1, opacity: 1 };
    } else if (type === 'video') {
      style = {
        left: '50%',
        top: '50%',
        width: '100%',
        height: '100%',
        transform: 'translate(-50%, -50%)'
      };
    } else {
      style = {};
    }

    const newClip: Clip = {
      id: `clip-${Date.now()}`,
      src,
      type,
      start: 0,
      end: 5, // Default duration 5s
      sourceDuration: 5, // Default source duration
      offset: startTime !== undefined ? startTime : currentTime,
      style,
      filters: {},
      trackId: targetTrackId || tracks.find(t => t.type === (type === 'audio' ? 'audio' : 'video'))?.id || tracks[0].id,
    };

    if (type === 'video' || type === 'audio') {
      const media = document.createElement(type);
      media.style.display = 'none';
      document.body.appendChild(media);

      // Use custom media protocol for temp element if it's a local file path
      let fileUrl = src;
      if (!fileUrl.startsWith('media:') && !fileUrl.startsWith('http')) {
        const normalizedPath = src.replace(/\\/g, '/');
        const parts = normalizedPath.split('/');
        const encodedParts = parts.map(p => p.includes(':') ? p : encodeURIComponent(p));
        fileUrl = `media:///${encodedParts.join('/')}`;
      }
      media.src = fileUrl;

      media.onloadedmetadata = () => {
        setClips(prev => prev.map(c => c.id === newClip.id ? { ...c, end: media.duration, sourceDuration: media.duration } : c));
        document.body.removeChild(media);
      };
      media.onerror = () => {
        console.error("Initial clip load error");
        document.body.removeChild(media);
      };
    }

    setClips(prev => [...prev, newClip]);
  };

  const addTextClip = () => {
    const newClip: Clip = {
      id: `clip-${Date.now()}`,
      src: '',
      type: 'text',
      content: 'New Text',
      start: 0,
      end: 5,
      offset: currentTime,
      style: {
        left: '50%',
        top: '50%',
        fontSize: '40px',
        color: 'white',
        fontWeight: 'bold',
        textShadow: '2px 2px 4px black'
      },
      trackId: tracks.find(t => t.type === 'text')?.id || 'text-1'
    };
    setClips(prev => [...prev, newClip]);
    if (currentTime + 5 > duration) {
      setDuration(currentTime + 5);
    }
  };

  const addTrack = () => {
    const newTrack: Track = {
      id: `track-${Date.now()}`,
      type: 'video',
      name: `Track ${tracks.length + 1}`
    };
    setTracks([...tracks, newTrack]);
  };

  const activeClip = clips.find(
    clip => clip.type === 'video' && currentTime >= clip.offset && currentTime < clip.offset + (clip.end - clip.start)
  );

  const handleSeek = (time: number) => {
    setCurrentTime(time);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const splitClip = () => {
    if (!activeClip) return;

    const splitTime = currentTime - activeClip.offset + activeClip.start;

    if (splitTime <= activeClip.start + 0.1 || splitTime >= activeClip.end - 0.1) return;

    const firstHalf: Clip = {
      ...activeClip,
      end: splitTime
    };

    const secondHalf: Clip = {
      ...activeClip,
      id: Date.now().toString(),
      start: splitTime,
      end: activeClip.end,
      offset: activeClip.offset + (splitTime - activeClip.start)
    };

    const newClips = clips.map(c => c.id === activeClip.id ? firstHalf : c);
    const index = newClips.findIndex(c => c.id === firstHalf.id);
    newClips.splice(index + 1, 0, secondHalf);

    updateClipsWithHistory(newClips);
  };

  const updateClip = (id: string, changes: Partial<Clip>) => {
    const newClips = clips.map(c => c.id === id ? { ...c, ...changes } : c);
    updateClipsWithHistory(newClips);
  };

  const toggleKeyframe = (clipId: string, property: string, value: number) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    const timeInClip = currentTime - clip.offset;
    const keyframes = clip.keyframes?.[property] || [];
    const existingIndex = keyframes.findIndex(k => Math.abs(k.time - timeInClip) < 0.1);

    let newKeyframes;
    if (existingIndex >= 0) {
      // Remove keyframe
      newKeyframes = keyframes.filter((_, i) => i !== existingIndex);
    } else {
      // Add keyframe
      newKeyframes = [...keyframes, { time: timeInClip, value }];
    }

    updateClip(clipId, {
      keyframes: {
        ...clip.keyframes,
        [property]: newKeyframes
      }
    });
  };

  const handleSave = async () => {
    const projectData = {
      version: '1.0.0',
      name: 'My Project',
      timeline: { duration, clips },
      lastModified: Date.now()
    };
    const result = await (window as any).ipcRenderer.invoke('save-project', projectData);
    if (result.success) alert('Project saved!');
    else if (result.message !== 'Cancelled') alert('Save failed: ' + result.message);
  };

  const handleLoad = async () => {
    const result = await (window as any).ipcRenderer.invoke('load-project');
    if (result && result.success) {
      const data = result.data;
      if (data.timeline) {
        setClips(data.timeline.clips);
        setDuration(data.timeline.duration);
        setHistory([data.timeline.clips]);
        setHistoryIndex(0);
      }
    } else if (result && result.message !== 'Cancelled') {
      alert('Load failed: ' + result.message);
    }
  };

  const getInterpolatedValue = (clip: Clip, property: string, currentTime: number, defaultValue: number): number => {
    if (!clip.keyframes || !clip.keyframes[property] || clip.keyframes[property].length === 0) {
      return defaultValue;
    }

    const kfs = clip.keyframes[property].sort((a, b) => a.time - b.time);
    const timeInClip = currentTime - clip.offset;

    if (timeInClip <= kfs[0].time) return kfs[0].value;
    if (timeInClip >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;

    for (let i = 0; i < kfs.length - 1; i++) {
      if (timeInClip >= kfs[i].time && timeInClip < kfs[i + 1].time) {
        const t = (timeInClip - kfs[i].time) / (kfs[i + 1].time - kfs[i].time);
        return kfs[i].value + t * (kfs[i + 1].value - kfs[i].value);
      }
    }

    return defaultValue;
  };

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSettings, setExportSettings] = useState({
    resolution: '1920x1080',
    format: 'mp4',
    frameRate: 30
  });

  const handleExportClick = () => {
    setShowExportModal(true);
  };

  const confirmExport = async () => {
    setShowExportModal(false);
    setIsExporting(true);
    try {
      const result = await (window as any).ipcRenderer.invoke('export-video', {
        clips, tracks, duration, settings: exportSettings
      });
      if (result && result.success) alert(`Export successful! Saved to: ${result.path}`);
      else if (result && result.message !== 'Cancelled') alert('Export failed: ' + result.message);
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. See console for details.');
    } finally {
      setIsExporting(false);
    }
  };



  const [activeSidebarTab, setActiveSidebarTab] = useState<'import' | 'stock' | 'stickers' | 'filters' | 'adjustment'>('import');

  const stockAssets = [
    { name: 'Big Buck Bunny', src: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4', type: 'video' },
    { name: 'Jellyfish', src: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4', type: 'video' },
    { name: 'Sample Audio', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', type: 'audio' }
  ];

  const stickers = [
    { name: 'Emoji Smile', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Noto_Emoji_KitKat_263a.svg/1200px-Noto_Emoji_KitKat_263a.svg.png' },
    { name: 'Emoji Cool', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Noto_Emoji_KitKat_1f60e.svg/1200px-Noto_Emoji_KitKat_1f60e.svg.png' },
    { name: 'Star', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Gold_Star.svg/1200px-Gold_Star.svg.png' }
  ];

  const filters: { name: string; value: { [key: string]: string } }[] = [
    { name: 'None', value: {} },
    { name: 'Grayscale', value: { grayscale: '100%' } },
    { name: 'Sepia', value: { sepia: '100%' } },
    { name: 'Blur', value: { blur: '5px' } },
    { name: 'Invert', value: { invert: '100%' } },
    { name: 'Warm', value: { sepia: '50%', contrast: '110%', brightness: '110%' } },
    { name: 'Cool', value: { 'hue-rotate': '180deg', contrast: '110%' } },
    { name: 'Vintage', value: { sepia: '80%', contrast: '120%', brightness: '90%' } },
  ];

  const handleTimelineDrop = (time: number, trackId?: string) => {
    if (draggedItem.current) {
      addClipToTimeline(draggedItem.current.src, draggedItem.current.type, time, trackId);
      draggedItem.current = null;
    }
  };

  return (
    <div className="app-container">
      <div className="top-bar">
        <div className="menu-item" onClick={() => setActiveSidebarTab('import')} style={{ cursor: 'pointer', color: activeSidebarTab === 'import' ? '#00b5ad' : 'white' }}>Media</div>
        <div className="menu-item" onClick={handleSave} style={{ cursor: 'pointer' }}>Save</div>
        <div className="menu-item" onClick={handleLoad} style={{ cursor: 'pointer' }}>Load</div>
        <div className="menu-item" onClick={addTextClip} style={{ cursor: 'pointer' }}>Text +</div>
        <div className="menu-item" onClick={() => setActiveSidebarTab('stickers')} style={{ cursor: 'pointer', color: activeSidebarTab === 'stickers' ? '#00b5ad' : 'white' }}>Stickers</div>
        <div className="menu-item" onClick={() => setActiveSidebarTab('filters')} style={{ cursor: 'pointer', color: activeSidebarTab === 'filters' ? '#00b5ad' : 'white' }}>Filters</div>
        <div className="menu-item" onClick={() => setActiveSidebarTab('adjustment')} style={{ cursor: 'pointer', color: activeSidebarTab === 'adjustment' ? '#00b5ad' : 'white' }}>Adjustment</div>
        <div className="menu-item" onClick={addTrack} style={{ cursor: 'pointer' }}>+ Track</div>
        <div className="menu-item" style={{ marginLeft: 'auto', background: '#00b5ad', padding: '5px 15px', borderRadius: '4px', cursor: 'pointer' }} onClick={handleExportClick}>
          {isExporting ? 'Exporting...' : 'Export'}
        </div>
      </div>

      <div className="main-workspace">
        <div className="sidebar-panel">
          <div className="sidebar-tabs" style={{ display: 'flex', marginBottom: '10px', borderBottom: '1px solid #333' }}>
            <div
              className={`tab ${activeSidebarTab === 'import' ? 'active' : ''}`}
              onClick={() => setActiveSidebarTab('import')}
              style={{ padding: '10px', cursor: 'pointer', borderBottom: activeSidebarTab === 'import' ? '2px solid #00b5ad' : 'none', color: activeSidebarTab === 'import' ? 'white' : '#888' }}
            >
              Import
            </div>
            <div
              className={`tab ${activeSidebarTab === 'stock' ? 'active' : ''}`}
              onClick={() => setActiveSidebarTab('stock')}
              style={{ padding: '10px', cursor: 'pointer', borderBottom: activeSidebarTab === 'stock' ? '2px solid #00b5ad' : 'none', color: activeSidebarTab === 'stock' ? 'white' : '#888' }}
            >
              Stock
            </div>
          </div>

          {activeSidebarTab === 'import' ? (
            <div className="import-area">
              <button className="import-btn" onClick={handleImport}>+ Import</button>
              <div className="assets-list">
                {assets.map((asset, index) => (
                  <div key={index} className="asset-item" onClick={() => addClipToTimeline(asset)}>
                    {asset.split(/[\\/]/).pop()}
                  </div>
                ))}
              </div>
            </div>
          ) : activeSidebarTab === 'stock' ? (
            <div className="stock-area">
              <div className="assets-list">
                {stockAssets.map((asset, index) => (
                  <div key={index} className="asset-item" onClick={() => addClipToTimeline(asset.src)} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{asset.name}</div>
                    <div style={{ fontSize: '10px', color: '#666' }}>{asset.type}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeSidebarTab === 'stickers' ? (
            <div className="stickers-area">
              <div className="assets-list" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {stickers.map((sticker, index) => (
                  <div
                    key={index}
                    className="asset-item"
                    draggable
                    onDragStart={() => {
                      draggedItem.current = { src: sticker.src, type: 'image' };
                    }}
                    onClick={() => addClipToTimeline(sticker.src, 'image')}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', padding: '10px', cursor: 'grab' }}
                  >
                    <img src={sticker.src} alt={sticker.name} style={{ width: '50px', height: '50px', objectFit: 'contain', pointerEvents: 'none' }} />
                    <div style={{ fontSize: '12px', textAlign: 'center' }}>{sticker.name}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeSidebarTab === 'filters' ? (
            <div className="filters-area">
              <div className="assets-list">
                {filters.map((filter, index) => (
                  <div
                    key={index}
                    className="asset-item"
                    onClick={() => {
                      if (selectedClipId) {
                        const selectedClip = clips.find(c => c.id === selectedClipId);
                        if (selectedClip) {
                          updateClip(selectedClipId, { filters: { ...selectedClip.filters, ...filter.value } });
                        }
                      } else {
                        alert('Select a clip to apply filter');
                      }
                    }}
                    style={{ padding: '15px', textAlign: 'center' }}
                  >
                    {filter.name}
                  </div>
                ))}
              </div>
            </div>
          ) : activeSidebarTab === 'adjustment' ? (
            <div className="adjustment-area" style={{ padding: '20px', color: 'white' }}>
              {selectedClipId ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h3>Adjustments</h3>
                  <div>
                    <label style={{ display: 'block', marginBottom: '10px' }}>Brightness</label>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={(() => {
                        const selectedClip = clips.find(c => c.id === selectedClipId);
                        return parseInt(selectedClip?.filters?.brightness || '100');
                      })()}
                      onChange={(e) => {
                        const val = e.target.value;
                        const selectedClip = clips.find(c => c.id === selectedClipId);
                        if (selectedClip) {
                          updateClip(selectedClipId, { filters: { ...selectedClip.filters, brightness: `${val}%` } });
                        }
                      }}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '10px' }}>Contrast</label>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={(() => {
                        const selectedClip = clips.find(c => c.id === selectedClipId);
                        return parseInt(selectedClip?.filters?.contrast || '100');
                      })()}
                      onChange={(e) => {
                        const val = e.target.value;
                        const selectedClip = clips.find(c => c.id === selectedClipId);
                        if (selectedClip) {
                          updateClip(selectedClipId, { filters: { ...selectedClip.filters, contrast: `${val}%` } });
                        }
                      }}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '10px' }}>Saturation</label>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={(() => {
                        const selectedClip = clips.find(c => c.id === selectedClipId);
                        return parseInt(selectedClip?.filters?.saturate || '100');
                      })()}
                      onChange={(e) => {
                        const val = e.target.value;
                        const selectedClip = clips.find(c => c.id === selectedClipId);
                        if (selectedClip) {
                          updateClip(selectedClipId, { filters: { ...selectedClip.filters, saturate: `${val}%` } });
                        }
                      }}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginTop: '10px' }}>
                    Note: Adjustments stack with other filters.
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#666', marginTop: '50px' }}>
                  Select a clip to adjust
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="preview-panel">
          <div className="preview-content">
            {clips.filter(c => c.type === 'audio').map(clip => {
              // Use custom media protocol to bypass security restrictions
              let fileUrl = clip.src;
              if (!fileUrl.startsWith('media:') && !fileUrl.startsWith('http')) {
                const normalizedPath = clip.src.replace(/\\/g, '/');
                const parts = normalizedPath.split('/');
                const encodedParts = parts.map(p => p.includes(':') ? p : encodeURIComponent(p));
                fileUrl = `media:///${encodedParts.join('/')}`;
              }
              return (
                <audio
                  key={clip.id}
                  src={fileUrl}
                  ref={(el) => {
                    if (el) {
                      audioRefs.current[clip.id] = el;
                    } else {
                      delete audioRefs.current[clip.id];
                    }
                  }}
                />
              );
            })}

            {clips.filter(c => c.type === 'video').map(clip => {
              const isActive = currentTime >= clip.offset && currentTime < clip.offset + (clip.end - clip.start);
              if (!isActive) return null;

              // Use custom media protocol to bypass security restrictions
              let fileUrl = clip.src;
              if (!fileUrl.startsWith('media:') && !fileUrl.startsWith('http')) {
                const normalizedPath = clip.src.replace(/\\/g, '/');
                const parts = normalizedPath.split('/');
                const encodedParts = parts.map(p => p.includes(':') ? p : encodeURIComponent(p));
                fileUrl = `media:///${encodedParts.join('/')}`;
              }

              return (
                <video
                  key={clip.id}
                  src={fileUrl}
                  className="clip-video"
                  style={{
                    width: '100%',
                    height: '100%',
                    opacity: getInterpolatedValue(clip, 'opacity', currentTime, 1),
                    filter: getFilterString(clip),
                    transform: `scale(${getInterpolatedValue(clip, 'scale', currentTime, parseFloat(clip.style?.scale as string) || 1)}) translate(${getInterpolatedValue(clip, 'x', currentTime, 0)}px, ${getInterpolatedValue(clip, 'y', currentTime, 0)}px)`
                  }}
                  preload="auto"
                  ref={el => {
                    if (el) {
                      videoRefs.current[clip.id] = el;
                    } else {
                      delete videoRefs.current[clip.id];
                    }
                  }}
                  onError={(e) => {
                    const target = e.currentTarget;
                    console.error('Video load error:', target.error?.code, target.error?.message, target.src);
                  }}
                  onLoadedMetadata={(e) => console.log(`Video metadata loaded: ${clip.id}, duration: ${e.currentTarget.duration}`)}
                  onCanPlay={() => console.log(`Video can play: ${clip.id}`)}
                  onWaiting={() => console.log(`Video waiting: ${clip.id}`)}
                  onTimeUpdate={(e) => {
                    // throttling logging
                    if (Math.random() < 0.05) console.log(`Video time update: ${clip.id}, time: ${e.currentTarget.currentTime}`);
                  }}
                />
              );
            })}

            {clips.filter(c => c.type === 'image').map(clip => {
              const isActive = currentTime >= clip.offset && currentTime < clip.offset + (clip.end - clip.start);
              if (!isActive) return null;
              return (
                <img
                  key={clip.id}
                  src={clip.src}
                  className="clip-image"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: 'auto',
                    height: 'auto',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    opacity: getInterpolatedValue(clip, 'opacity', currentTime, 1),
                    filter: getFilterString(clip),
                    transform: `translate(-50%, -50%) scale(${getInterpolatedValue(clip, 'scale', currentTime, parseFloat(clip.style?.scale as string) || 1)}) translate(${getInterpolatedValue(clip, 'x', currentTime, 0)}px, ${getInterpolatedValue(clip, 'y', currentTime, 0)}px)`
                  }}
                />
              );
            })}

            {clips.filter(c => c.type === 'text').map(clip => {
              const isActive = currentTime >= clip.offset && currentTime < clip.offset + (clip.end - clip.start);
              if (!isActive) return null;

              const animationStyle: React.CSSProperties = clip.animation ? {
                animationName: clip.animation.type,
                animationDuration: `${clip.animation.duration}s`,
                animationFillMode: 'both'
              } : {};

              return (
                <div
                  key={clip.id}
                  className="clip-text"
                  style={{
                    ...clip.style,
                    opacity: getInterpolatedValue(clip, 'opacity', currentTime, 1),
                    transform: `translate(-50%, -50%) scale(${getInterpolatedValue(clip, 'scale', currentTime, 1)})`,
                    ...animationStyle
                  }}
                >
                  {clip.content}
                </div>
              );
            })}

          </div>
          <div className="player-controls">
            <button onClick={() => handleSeek(0)}>⏮</button>
            <button onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
            <button onClick={() => handleSeek(duration)}>⏭</button>
            <button onClick={splitClip} disabled={!activeClip}>✂ Split</button>
            <button onClick={deleteClip} disabled={!selectedClipId} title="Delete Selected (Del)">🗑 Delete</button>
          </div>
        </div>

        <div className="properties-panel">
          <h3>Properties</h3>
          {selectedClipId ? (() => {
            const selectedClip = clips.find(c => c.id === selectedClipId);
            if (!selectedClip) return <div>No clip selected</div>;

            return (
              <div className="property-group">
                <label>{selectedClip.type.charAt(0).toUpperCase() + selectedClip.type.slice(1)}</label>

                {selectedClip.type === 'text' && (
                  <>
                    <div className="control-row">
                      <span>Content</span>
                      <input
                        type="text"
                        value={selectedClip.content || ''}
                        onChange={(e) => updateClip(selectedClip.id, { content: e.target.value })}
                      />
                    </div>
                    <div className="control-row">
                      <span>Color</span>
                      <input
                        type="color"
                        value={selectedClip.style?.color as string || '#ffffff'}
                        onChange={(e) => updateClip(selectedClip.id, {
                          style: { ...selectedClip.style, color: e.target.value }
                        })}
                      />
                    </div>
                    <div className="control-row">
                      <span>Size</span>
                      <input
                        type="number"
                        value={parseInt(selectedClip.style?.fontSize as string) || 24}
                        onChange={(e) => updateClip(selectedClip.id, {
                          style: { ...selectedClip.style, fontSize: `${e.target.value}px` }
                        })}
                      />
                    </div>
                    <div className="control-row">
                      <span>Animation</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' }}>
                        <select
                          value={selectedClip.animation?.type || ''}
                          onChange={(e) => {
                            const type = e.target.value as any;
                            if (type) {
                              updateClip(selectedClip.id, {
                                animation: {
                                  type,
                                  duration: selectedClip.animation?.duration || 1
                                }
                              });
                            } else {
                              updateClip(selectedClip.id, { animation: undefined });
                            }
                          }}
                          style={{ background: '#333', color: 'white', border: 'none', padding: '5px', borderRadius: '4px', width: '100%' }}
                        >
                          <option value="">None</option>
                          <option value="fadeIn">Fade In</option>
                          <option value="slideIn">Slide In</option>
                          <option value="zoomIn">Zoom In</option>
                        </select>
                        {selectedClip.animation && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '12px', color: '#aaa' }}>Dur:</span>
                            <input
                              type="number"
                              min="0.1"
                              max="5"
                              step="0.1"
                              value={selectedClip.animation.duration}
                              onChange={(e) => updateClip(selectedClip.id, {
                                animation: {
                                  ...selectedClip.animation!,
                                  duration: parseFloat(e.target.value)
                                }
                              })}
                              style={{ width: '60px' }}
                            />
                            <span style={{ fontSize: '12px', color: '#aaa' }}>s</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {(selectedClip.type === 'video' || selectedClip.type === 'image') && (
                  <>
                    <div className="control-row">
                      <span>Scale</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <input
                          type="range"
                          min="0.1"
                          max="3"
                          step="0.1"
                          value={getInterpolatedValue(selectedClip, 'scale', currentTime, parseFloat(selectedClip.style?.scale as string) || 1)}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (selectedClip.keyframes?.['scale']?.length) {
                              toggleKeyframe(selectedClip.id, 'scale', val);
                            } else {
                              updateClip(selectedClip.id, {
                                style: { ...selectedClip.style, scale: val }
                              });
                            }
                          }}
                        />
                        <button
                          onClick={() => toggleKeyframe(selectedClip.id, 'scale', parseFloat(selectedClip.style?.scale as string) || 1)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: selectedClip.keyframes?.['scale']?.some(k => Math.abs(k.time - (currentTime - selectedClip.offset)) < 0.1) ? '#00b5ad' : '#666'
                          }}
                        >
                          ♦
                        </button>
                      </div>
                    </div>
                    <div className="control-row">
                      <span>Position</span>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <input
                          type="number"
                          placeholder="X"
                          value={parseInt(getInterpolatedValue(selectedClip, 'x', currentTime, parseFloat(selectedClip.style?.left as string) || 0).toString())}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (selectedClip.keyframes?.['x']?.length) {
                              toggleKeyframe(selectedClip.id, 'x', val);
                            } else {
                              updateClip(selectedClip.id, {
                                style: { ...selectedClip.style, left: `${val}px` }
                              });
                            }
                          }}
                        />
                        <button
                          onClick={() => toggleKeyframe(selectedClip.id, 'x', parseFloat(selectedClip.style?.left as string) || 0)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: selectedClip.keyframes?.['x']?.some(k => Math.abs(k.time - (currentTime - selectedClip.offset)) < 0.1) ? '#00b5ad' : '#666'
                          }}
                        >
                          ♦
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                        <input
                          type="number"
                          placeholder="Y"
                          value={parseInt(getInterpolatedValue(selectedClip, 'y', currentTime, parseFloat(selectedClip.style?.top as string) || 0).toString())}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (selectedClip.keyframes?.['y']?.length) {
                              toggleKeyframe(selectedClip.id, 'y', val);
                            } else {
                              updateClip(selectedClip.id, {
                                style: { ...selectedClip.style, top: `${val}px` }
                              });
                            }
                          }}
                        />
                        <button
                          onClick={() => toggleKeyframe(selectedClip.id, 'y', parseFloat(selectedClip.style?.top as string) || 0)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: selectedClip.keyframes?.['y']?.some(k => Math.abs(k.time - (currentTime - selectedClip.offset)) < 0.1) ? '#00b5ad' : '#666'
                          }}
                        >
                          ♦
                        </button>
                      </div>
                    </div>
                    <div className="control-row">
                      <span>Opacity</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={getInterpolatedValue(selectedClip, 'opacity', currentTime, 1)}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (selectedClip.keyframes?.['opacity']?.length) {
                              toggleKeyframe(selectedClip.id, 'opacity', val);
                            } else {
                              updateClip(selectedClip.id, {
                                style: { ...selectedClip.style, opacity: val }
                              });
                            }
                          }}
                        />
                        <button
                          onClick={() => toggleKeyframe(selectedClip.id, 'opacity', 1)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: selectedClip.keyframes?.['opacity']?.some(k => Math.abs(k.time - (currentTime - selectedClip.offset)) < 0.1) ? '#00b5ad' : '#666'
                          }}
                        >
                          ♦
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })() : (
            <div style={{ textAlign: 'center', color: '#666', marginTop: '50px' }}>
              Select a clip to edit properties
            </div>
          )}
        </div>
      </div>

      <div className="timeline-panel">
        <Timeline
          tracks={tracks}
          clips={clips}
          currentTime={currentTime}
          duration={duration}
          onSeek={handleSeek}
          onUpdateClip={updateClip}
          onDrop={handleTimelineDrop}
          onSelectClip={setSelectedClipId}
          selectedClipId={selectedClipId}
        />
      </div>

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onConfirm={confirmExport}
        exportSettings={exportSettings}
        setExportSettings={setExportSettings}
      />
    </div>
  );
}

export default App;
