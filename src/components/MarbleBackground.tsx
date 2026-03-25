import { useState, useRef, useCallback } from 'react';
import { Pause, Play } from 'lucide-react';

export const MarbleBackground = ({ blur, slow }: { blur?: number; slow?: number }) => {
  const [loaded, setLoaded] = useState(false);
  const [paused, setPaused] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const params = new URLSearchParams();
  if (blur) params.set('blur', String(blur));
  if (slow) params.set('slow', String(slow));
  const qs = params.toString();

  const togglePause = useCallback(() => {
    const next = !paused;
    setPaused(next);
    iframeRef.current?.contentWindow?.postMessage(next ? 'pause' : 'resume', '*');
  }, [paused]);

  return (
    <>
      <iframe
        ref={iframeRef}
        src={`/marble-bg.html${qs ? '?' + qs : ''}`}
        onLoad={() => setLoaded(true)}
        style={{
          position: 'fixed', inset: 0, width: '100%', height: '100%',
          border: 'none', zIndex: 0, pointerEvents: 'none',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.6s ease-in',
        }}
        title="background"
      />
      {loaded && (
        <button
          onClick={togglePause}
          aria-label={paused ? 'Resume background' : 'Pause background'}
          style={{
            position: 'fixed',
            bottom: 12,
            right: 12,
            zIndex: 50,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10, 22, 44, 0.7)',
            border: '1px solid rgba(100, 170, 255, 0.25)',
            borderRadius: 8,
            color: 'rgba(255, 255, 255, 0.5)',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            transition: 'color 0.2s, border-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
            e.currentTarget.style.borderColor = 'rgba(100,170,255,0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
            e.currentTarget.style.borderColor = 'rgba(100,170,255,0.25)';
          }}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
      )}
    </>
  );
};
