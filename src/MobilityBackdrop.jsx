const scenes = ['hero', 'charge', 'road', 'care'];
const pageScene = { home: 'hero', charge: 'charge', drive: 'road', care: 'care', passport: 'care' };

// The environment stays mounted while the functional panels change destinations.
// No timer or scroll listener: transitions only respond to deliberate navigation.
export function MobilityBackdrop({ page }) {
  const active = pageScene[page] ?? 'hero';
  return <div className="mobility-backdrop" aria-hidden="true">
    {scenes.map((scene) => <img key={scene} className={scene === active ? 'active' : ''}
      src={`/orbit/orbit-${scene}-v1-1536.webp`}
      srcSet={`/orbit/orbit-${scene}-v1-800.webp 800w, /orbit/orbit-${scene}-v1-1536.webp 1536w`}
      sizes="100vw" alt="" decoding="async" fetchPriority={scene === active ? 'high' : 'low'} />)}
    <div className="mobility-backdrop-shade" />
  </div>;
}
