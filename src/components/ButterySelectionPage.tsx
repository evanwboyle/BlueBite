import type { User } from '../types';
import { GlassPanel, Text } from './ui';
const MarbleBackground = () => (
  <iframe
    src="/marble-bg.html"
    style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 'none', zIndex: 0, pointerEvents: 'none' }}
    title="background"
  />
);

interface ButterySelectionPageProps {
  currentUser: User;
  butteryOptions: Array<{ name: string; itemCount: number }>;
  onSelectButtery: (buttery: string) => void;
}

const COLLEGE_CRESTS: Record<string, string> = {
  'Benjamin Franklin': '/assets/resco-icons/Benjamin Franklin.svg',
  'Berkeley': '/assets/resco-icons/Berkeley.svg',
  'Branford': '/assets/resco-icons/Branford.svg',
  'Davenport': '/assets/resco-icons/Davenport.svg',
  'Ezra Stiles': '/assets/resco-icons/Ezra Stiles.svg',
  'Grace Hopper': '/assets/resco-icons/Grace Hopper.svg',
  'Jonathan Edwards': '/assets/resco-icons/Jonathan Edwards.svg',
  'Morse': '/assets/resco-icons/Morse.svg',
  'Pauli Murray': '/assets/resco-icons/Pauli Murray.svg',
  'Pierson': '/assets/resco-icons/Pierson.svg',
  'Saybrook': '/assets/resco-icons/Saybrook.svg',
  'Silliman': '/assets/resco-icons/Silliman.svg',
  'Timothy Dwight': '/assets/resco-icons/Timothy Dwight.svg',
  'Trumbull': '/assets/resco-icons/Trumbull.svg',
};

function getCrestPath(butteryName: string): string | null {
  // Try to match "X Buttery" -> "X" against known colleges
  const normalized = butteryName.replace(/\s*Buttery$/i, '').trim();
  if (COLLEGE_CRESTS[normalized]) return COLLEGE_CRESTS[normalized];
  // Fallback: try partial match
  const match = Object.keys(COLLEGE_CRESTS).find(
    (key) => normalized.toLowerCase().includes(key.toLowerCase())
  );
  return match ? COLLEGE_CRESTS[match] : null;
}

function getRoleLabel(role?: string): string {
  switch (role) {
    case 'admin': return 'Admin';
    case 'staff': return 'Staff';
    case 'manager': return 'Manager';
    default: return 'Customer';
  }
}

export function ButterySelectionPage({
  currentUser,
  butteryOptions,
  onSelectButtery,
}: ButterySelectionPageProps) {
  return (
    <div className="relative h-screen w-full overflow-hidden">
      <MarbleBackground />

      {/* Content layer */}
      <div
        className="relative flex items-center justify-center h-full"
        style={{ zIndex: 10 }}
      >
        {/* Centered modal container — ~75% of screen */}
        <div
          className="flex flex-col"
          style={{ width: '80%', maxHeight: '80vh' }}
        >
          {/* Header bar */}
          <GlassPanel
            level="modal"
            className="flex items-center justify-between mb-3"
            style={{
              padding: '16px 28px',
              borderRadius: 'var(--radius-card)',
            }}
          >
            <Text variant="heading" as="h1">Buttery Selection</Text>

            <div className="flex items-center gap-2">
              <Text variant="label" style={{ color: 'var(--text-primary)' }}>
                {currentUser.netId}
              </Text>
              <Text variant="whisper" style={{ color: 'var(--text-muted)' }}>
                {getRoleLabel(currentUser.role)}
              </Text>
            </div>
          </GlassPanel>

          {/* Buttery grid */}
          <GlassPanel
            level="modal"
            className="flex-1 overflow-auto"
            style={{
              padding: '24px',
              borderRadius: 'var(--radius-modal)',
            }}
          >
            {butteryOptions.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <Text variant="label">Loading butteries...</Text>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4 auto-rows-fr">
                {butteryOptions.map((option) => {
                  const crest = getCrestPath(option.name);
                  return (
                    <button
                      key={option.name}
                      onClick={() => onSelectButtery(option.name)}
                      className="text-left transition-transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      style={{ borderRadius: 'var(--radius-card)' }}
                    >
                      <GlassPanel
                        level="card"
                        className="flex flex-col h-full"
                        style={{ padding: 0, overflow: 'hidden' }}
                      >
                        {/* Crest image area */}
                        <div
                          className="flex items-center justify-center"
                          style={{
                            padding: '20px 16px 12px',
                            minHeight: '140px',
                          }}
                        >
                          {crest ? (
                            <img
                              src={crest}
                              alt={`${option.name} crest`}
                              className="h-28 w-auto object-contain drop-shadow-lg"
                            />
                          ) : (
                            <div
                              className="h-28 w-28 rounded-full flex items-center justify-center"
                              style={{ background: 'var(--glass-mist)' }}
                            >
                              <Text variant="heading" as="span" style={{ fontSize: '2rem' }}>
                                {option.name.charAt(0)}
                              </Text>
                            </div>
                          )}
                        </div>

                        {/* Info area */}
                        <div style={{ padding: '0 16px 16px' }}>
                          <Text
                            variant="title"
                            as="span"
                            style={{
                              fontFamily: 'var(--font-heading)',
                              fontSize: '1rem',
                              display: 'block',
                              lineHeight: 1.3,
                            }}
                          >
                            {option.name}
                          </Text>

                          {/* Status indicator */}
                          <div className="flex items-center gap-1.5 mt-2">
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{ background: option.itemCount > 0 ? '#4ade80' : '#9ca3af' }}
                            />
                            <Text
                              variant="label"
                              as="span"
                              style={{
                                fontSize: '0.75rem',
                                color: option.itemCount > 0 ? '#4ade80' : 'var(--text-muted)',
                                fontWeight: 600,
                              }}
                            >
                              {option.itemCount > 0 ? 'Open' : 'Closed'}
                            </Text>
                          </div>

                          <Text
                            variant="whisper"
                            as="span"
                            style={{
                              display: 'block',
                              marginTop: '2px',
                              textTransform: 'none',
                              letterSpacing: 'normal',
                            }}
                          >
                            {option.itemCount > 0
                              ? `${option.itemCount} items available`
                              : 'No items listed'}
                          </Text>
                        </div>
                      </GlassPanel>
                    </button>
                  );
                })}
              </div>
            )}
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
