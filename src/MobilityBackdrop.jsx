import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

export const mobilityScenes = [
  { id: 'hero', asset: '/orbit/orbit-hero-v1', label: '일상 너머의 여정' },
  { id: 'charge', asset: '/journey/charge-v2', label: '다음 여정을 채우다' },
  { id: 'road', asset: '/journey/road-v2', label: '새로운 길을 만나다' },
  { id: 'care', asset: '/journey/care-v2', label: '오래 함께할 준비' },
  { id: 'parking', asset: '/journey/parking-v2', label: '여정이 머무는 곳' },
  { id: 'battery', asset: '/journey/battery-v2', label: '움직임의 에너지' },
  { id: 'tires', asset: '/journey/tires-v1', label: '길과 맞닿는 순간' },
  { id: 'journal', asset: '/journey/journal-v2', label: '차곡차곡 쌓인 시간' },
  { id: 'connect', asset: '/journey/connect-v1', label: '나와 내 차의 연결' },
  { id: 'observatory', asset: '/orbit/orbit-charge-v1', label: '잠시, 충전의 시간' },
  { id: 'coast', asset: '/orbit/orbit-road-v1', label: '더 멀리 이어지는 길' },
  { id: 'atelier', asset: '/orbit/orbit-care-v1', label: '내 차를 위한 공간' },
];
const defaults = { charge: 'charge', drive: 'road', care: 'care', passport: 'journal', settings: 'connect' };

export function useMobilityTour(page, target, suspended = false) {
  const [choice, setChoice] = useState({ page: 'home', id: 'hero' });
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(() => !document.hidden);
  const destination = page === 'drive' && target === 'parking' ? 'parking' : page === 'care' && target === 'status' ? 'battery' : defaults[page] ?? 'hero';
  const id = choice.page === page ? choice.id : destination;
  const index = Math.max(0, mobilityScenes.findIndex((scene) => scene.id === id));
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(preference.matches);
    const visibility = () => setVisible(!document.hidden);
    preference.addEventListener('change', motion);
    document.addEventListener('visibilitychange', visibility);
    return () => { preference.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    if (page !== 'home' || paused || reduced || !visible || suspended) return;
    const timer = window.setInterval(() => setChoice((old) => {
      const current = old.page === 'home' ? mobilityScenes.findIndex((scene) => scene.id === old.id) : 0;
      return { page: 'home', id: mobilityScenes[(current + 1) % mobilityScenes.length].id };
    }), 5000);
    return () => window.clearInterval(timer);
  }, [page, paused, reduced, visible, suspended]);
  return {
    scene: mobilityScenes[index], index, paused: paused || reduced || suspended, reduced,
    select: (next) => { if (mobilityScenes.some((scene) => scene.id === next)) setChoice({ page, id: next }); },
    step: (direction) => { setPaused(true); setChoice({ page, id: mobilityScenes[(index + direction + mobilityScenes.length) % mobilityScenes.length].id }); },
    toggle: () => setPaused((old) => !old),
  };
}

export function SceneControls({ tour }) {
  return <div className="journey-controls" aria-label="배경 장면 둘러보기">
    <div><span>{String(tour.index + 1).padStart(2, '0')} / {mobilityScenes.length}</span><strong>{tour.scene.label}</strong></div>
    <button onClick={() => tour.step(-1)} aria-label="이전 장면"><ChevronLeft size={18} /></button>
    <button onClick={() => tour.step(1)} aria-label="다음 장면"><ChevronRight size={18} /></button>
    <button onClick={tour.toggle} disabled={tour.reduced} aria-label={tour.reduced ? '동작 줄이기 적용 중' : tour.paused ? '배경 자동 재생' : '배경 일시정지'}>{tour.paused ? <Play size={15} /> : <Pause size={15} />}</button>
  </div>;
}

export function FeatureImage({ scene, className = '', priority = false }) {
  const asset = mobilityScenes.find((item) => item.id === scene)?.asset ?? mobilityScenes[0].asset;
  return <img className={`journey-image ${className}`} src={`${asset}-800.webp`} srcSet={`${asset}-800.webp 800w, ${asset}-1536.webp 1536w`} sizes="(max-width:760px) 50vw, 420px" alt="" aria-hidden="true" loading={priority ? 'eager' : 'lazy'} decoding="async" />;
}

export function MobilityBackdrop({ scene, paused }) {
  const [visited, setVisited] = useState(() => new Set([scene.id]));
  const [loaded, setLoaded] = useState(() => new Set());
  const [lastReady, setLastReady] = useState(scene.id);
  const displayed = loaded.has(scene.id) ? scene.id : lastReady;
  useEffect(() => { setVisited((old) => old.has(scene.id) ? old : new Set([...old, scene.id])); }, [scene.id]);
  useEffect(() => { if (loaded.has(scene.id)) setLastReady(scene.id); }, [scene.id, loaded]);
  return <div className={`mobility-backdrop ${paused ? 'is-paused' : ''}`} aria-hidden="true">
    {mobilityScenes.filter((item) => visited.has(item.id) || item.id === scene.id).map((item) => <img key={item.id} className={item.id === displayed ? 'active' : ''}
      src={`${item.asset}-1536.webp`} srcSet={`${item.asset}-800.webp 800w, ${item.asset}-1536.webp 1536w`}
      sizes="100vw" alt="" decoding="async" fetchPriority={item.id === scene.id ? 'high' : 'low'}
      onLoad={() => { setLoaded((old) => new Set([...old, item.id])); if (item.id === scene.id) setLastReady(item.id); }} />)}
    <div className="mobility-backdrop-shade" />
  </div>;
}
