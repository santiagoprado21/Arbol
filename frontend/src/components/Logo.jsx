const SOURCES = {
  icon: '/brand/icon.png',
  wordmark: '/brand/wordmark.png',
  studio: '/brand/studio.png',
  full: '/brand/full.png',
};

export default function Logo({ variant = 'wordmark', className = '' }) {
  return <img src={SOURCES[variant]} alt="Árbol Private Studio" className={`select-none ${className}`} draggable={false} />;
}

export function SeedMark({ className = '' }) {
  return (
    <svg viewBox="0 0 40 16" className={className} aria-hidden="true">
      <path d="M14 14 L30 2 L40 2 L20 14 Z" fill="currentColor" />
    </svg>
  );
}
