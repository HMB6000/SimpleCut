import React from 'react';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    exportSettings: {
        resolution: string;
        format: string;
        frameRate: number;
    };
    setExportSettings: (settings: { resolution: string; format: string; frameRate: number }) => void;
}

const ExportModal: React.FC<ExportModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    exportSettings,
    setExportSettings
}) => {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div style={{
                backgroundColor: '#2a2a2a', padding: '20px', borderRadius: '8px', width: '300px',
                border: '1px solid #444', color: 'white'
            }}>
                <h3 style={{ marginTop: 0 }}>Export Settings</h3>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#aaa' }}>Resolution</label>
                    <select
                        value={exportSettings.resolution}
                        onChange={(e) => setExportSettings({ ...exportSettings, resolution: e.target.value })}
                        style={{ width: '100%', padding: '8px', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px' }}
                    >
                        <option value="1280x720">720p (1280x720)</option>
                        <option value="1920x1080">1080p (1920x1080)</option>
                        <option value="3840x2160">4K (3840x2160)</option>
                    </select>
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#aaa' }}>Format</label>
                    <select
                        value={exportSettings.format}
                        onChange={(e) => setExportSettings({ ...exportSettings, format: e.target.value })}
                        style={{ width: '100%', padding: '8px', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px' }}
                    >
                        <option value="mp4">MP4 (H.264)</option>
                        <option value="webm">WebM (VP9)</option>
                    </select>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#aaa' }}>Frame Rate</label>
                    <select
                        value={exportSettings.frameRate}
                        onChange={(e) => setExportSettings({ ...exportSettings, frameRate: parseInt(e.target.value) })}
                        style={{ width: '100%', padding: '8px', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px' }}
                    >
                        <option value="30">30 fps</option>
                        <option value="60">60 fps</option>
                    </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #555' }}>Cancel</button>
                    <button onClick={onConfirm} style={{ background: '#00b5ad', border: 'none', color: 'black', fontWeight: 'bold' }}>Export</button>
                </div>
            </div>
        </div>
    );
};

export default ExportModal;
