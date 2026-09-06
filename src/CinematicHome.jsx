import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ChevronLeft, ChevronRight, Pause, Play, Plus, RefreshCcw } from 'lucide-react';
import './cinematic.css';

const scenes = [
  { asset: 'orbit-hero-v1', label: '내 차와 만나는 새로운 시선', short: '새로운 시선', alt: '지구가 떠오르는 달의 풍경 속 전기차 AI 콘셉트 이미지' },
  { asset: 'orbit-charge-v1', label: '다음 여정을 채우는 시간', short: '충전의 시간', alt: '우주 전망대에서 충전하는 전기차 AI 콘셉트 이미지' },
  { asset: 'orbit-road-v1', label: '일상 너머로 이어지는 길', short: '이어지는 길', alt: '별이 빛나는 해안도로를 달리는 전기차 AI 콘셉트 이미지' },
  { asset: 'orbit-care-v1', label: '오래 함께하기 위한 돌봄', short: '내 차 돌봄', alt: '지구를 바라보는 차량 점검 공간의 AI 콘셉트 이미지' },
];

export function useGentleReveal(root) {
  useEffect(() => {
    const element = root.current;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!element || !('IntersectionObserver' in window)) return;
    let observer;
    const setup = () => {
      observer?.disconnect();
      delete element.dataset.motionReady;
      if (preference.matches) return;
      const cards = element.querySelectorAll('.home-car-section, .owner-lower-grid > section, .owner-bottom-links');
      observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('cinema-visible'); observer.unobserve(entry.target); }
      }), { threshold: .08 });
      cards.forEach((card) => observer.observe(card));
      element.dataset.motionReady = 'true';
    };
    setup();
    preference.addEventListener('change', setup);
    return () => { observer?.disconnect(); preference.removeEventListener('change', setup); delete element.dataset.motionReady; };
  }, [root]);
}

export function CinematicHero({ vehicle, actions, busy, setModal, navigate }) {
  const root = useRef(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(!document.hidden);
  const [inView, setInView] = useState(true);
  const [loaded, setLoaded] = useState(() => new Set([0]));
  const current = scenes[index];

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(preference.matches);
    const visibility = () => setVisible(!document.hidden);
    preference.addEventListener('change', change);
    document.addEventListener('visibilitychange', visibility);
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: .1 }) : null;
    if (root.current) observer?.observe(root.current);
    return () => { preference.removeEventListener('change', change); document.removeEventListener('visibilitychange', visibility); observer?.disconnect(); };
  }, []);

  useEffect(() => {
    if (paused || reduced || !visible || !inView) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % scenes.length), 8000);
    return () => window.clearInterval(timer);
  }, [paused, reduced, visible, inView]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const element = root.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const progress = reduced ? 0 : Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height * .8)));
      element.style.setProperty('--cinema-inset', `${progress * 3.2}%`);
      element.style.setProperty('--cinema-radius', `${progress * 32}px`);
      element.style.setProperty('--cinema-zoom', String(1.06 - progress * .06));
      element.style.setProperty('--cinema-drift', `${progress * 38}px`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); };
  }, [reduced]);

  const choose = (next) => { setIndex((next + scenes.length) % scenes.length); setPaused(true); };
  return <section className="cinema-hero" ref={root} aria-labelledby="owner-title" aria-roledescription="캐러셀">
    <div className="cinema-frame">
      <div className="cinema-images" aria-hidden="true">
        {scenes.map((scene, number) => <img key={scene.asset} src={`/orbit/${scene.asset}-1536.webp`} srcSet={`/orbit/${scene.asset}-800.webp 800w, /orbit/${scene.asset}-1536.webp 1536w`} sizes="100vw" alt="" fetchPriority={number === 0 ? 'high' : 'low'} loading={number === 0 || number === index || number === (index + 1) % scenes.length ? 'eager' : 'lazy'} decoding="async" onLoad={() => setLoaded((previous) => new Set([...previous, number]))} className={number === index && loaded.has(number) ? 'is-current' : number === 0 && !loaded.has(index) ? 'is-current' : ''} />)}
      </div>
      <div className="cinema-shade" />
      <div className="cinema-orbit" aria-hidden="true"><i /><b /></div>
      <div className="cinema-copy">
        <span className="cinema-eyebrow"><i /> 현대차 오너를 위한 차량 생활</span>
        <h1 id="owner-title">내 차 생활,<br /><em>더 넓은 세계로.</em></h1>
        <p>차량 상태부터 충전, 정비, 관리 기록까지.<br />내 차와 함께하는 모든 순간을 한곳에서.</p>
        <div className="cinema-actions"><button className="button light" disabled={busy} onClick={vehicle ? actions.syncHyundai : () => setModal('connect')}>{vehicle ? <RefreshCcw size={16} /> : <Plus size={16} />}{vehicle ? '차량 상태 새로고침' : '내 현대차 연결하기'}<ArrowRight size={16} /></button><button className="cinema-quick" onClick={() => navigate('charge')}>충전소 바로 찾기 <ArrowRight size={15} /></button></div>
      </div>
      <div className="cinema-bottom">
        <button className="cinema-scroll" onClick={() => { const target = document.getElementById('owner-tools'); target?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' }); target?.focus({ preventScroll: true }); }}><ArrowDown size={16} /> 내 차 생활 시작하기</button>
        <div className="cinema-scenes" aria-label="배경 장면 선택">
          <span className="cinema-scene-label">{String(index + 1).padStart(2, '0')} <i /> {current.short}</span>
          <button onClick={() => choose(index - 1)} aria-label="이전 배경 장면"><ChevronLeft size={17} /></button>
          <div className="cinema-dots">{scenes.map((scene, number) => <button key={scene.asset} onClick={() => choose(number)} aria-label={`${number + 1}번 배경: ${scene.label}`} aria-pressed={index === number}><i /></button>)}</div>
          <button onClick={() => choose(index + 1)} aria-label="다음 배경 장면"><ChevronRight size={17} /></button>
          <button onClick={() => setPaused((value) => !value)} disabled={reduced} aria-label={reduced ? '동작 줄이기 설정 적용됨' : paused ? '배경 자동 전환 재생' : '배경 자동 전환 일시정지'}>{paused || reduced ? <Play size={14} /> : <Pause size={14} />}</button>
        </div>
      </div>
      <span className="cinema-disclaimer">AI 콘셉트 이미지 · 실제 차량 정보와는 별개입니다</span>
      <span className="cinema-sr">{current.alt}</span>
    </div>
  </section>;
}
