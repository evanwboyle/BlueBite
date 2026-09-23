import { useState, useRef, useEffect } from 'react';

export const MarbleBackground = ({ blur, slow, paused }: { blur?: number; slow?: number; paused?: boolean }) => {
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const params = new URLSearchParams();
  if (blur) params.set('blur', String(blur));
  if (slow) params.set('slow', String(slow));
  const qs = params.toString();

  useEffect(() => {
    if (!loaded) return;
    iframeRef.current?.contentWindow?.postMessage(paused ? 'pause' : 'resume', '*');
  }, [paused, loaded]);

  return (
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
  );
};
