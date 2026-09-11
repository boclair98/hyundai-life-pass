import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BatteryCharging,
  Bookmark,
  Bell,
  CarFront,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  Clock3,
  CloudCog,
  FileCheck2,
  Gauge,
  HeartHandshake,
  LocateFixed,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Menu,
  Minus,
  Navigation,
  Plus,
  RefreshCcw,
  Route,
  Search,
  Settings2,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Star,
  Trash2,
  UserRound,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  hyundaiAuthorizationPath,
  loadChargingStations,
  loadPassport,
  loadPlatform,
  loadServiceCenters,
  loadReleases,
  readNotification,
  revokeHyundaiConnection,
  syncHyundaiVehicles,
  loadVehicles,
} from './api';
import { OwnerHome, OwnershipPage, useVehicleJournal } from './OwnerExperience';
import './app.css';
import './platform.css';
import { MobilityBackdrop, useMobilityTour, FeatureImage } from './MobilityBackdrop';
import './mobility.css';
import './journey.css';

// 오너가 매일 쓰는 핵심 흐름만 1차 메뉴에 둡니다.
// 주행 계산·주차 저장은 드라이브 도구, 계정 연결은 설정에서 보조적으로 제공합니다.
const primaryNavigation = [
  { id: 'home', label: '내 차', icon: CarFront },
  { id: 'charge', label: '충전', icon: BatteryCharging },
  { id: 'care', label: '정비·점검', icon: Activity },
  { id: 'passport', label: '관리 기록', icon: FileCheck2 },
];

const secondaryNavigation = [
  { id: 'drive', label: '주행 도구', icon: Route },
  { id: 'settings', label: '설정', icon: Settings2 },
];

const navigation = [...primaryNavigation, ...secondaryNavigation];

const validPages = new Set([...navigation.map((item) => item.id), 'privacy', 'terms', 'guide', 'proposal', 'canary']);

const hyundaiStatusLabel = (provider) => {
  if (!provider) return '상태 확인 중';
  if (provider.mode !== 'LIVE') return '연결 준비 중';
  return {
    CONNECTED: '내 차 연결됨',
    STALE: '동기화 지연',
    OAUTH_REQUIRED: '로그인 필요',
    CONSENT_REQUIRED: '정보 제공 동의 필요',
    REVOKED: '다시 연결 필요',
    MISCONFIGURED: '연결 확인 필요',
    ERROR: '연결 점검 필요',
  }[provider.state] ?? provider.state;
};

const FAVORITES_STORAGE_KEY = 'life-pass:favorites:v1';
const DRIVE_CHECKLIST_STORAGE_KEY = 'life-pass:drive-checklist:v1';
const PARKING_STORAGE_KEY = 'life-pass:parking-position:v1';

const driveChecklistItems = [
  { id: 'surroundings', title: '차량 주변 확인', detail: '보행자·장애물·바닥 누유 확인' },
  { id: 'tires', title: '타이어 육안 점검', detail: '눌림·손상·이물질 확인' },
  { id: 'cable', title: '충전 케이블 분리', detail: '커넥터와 충전구 닫힘 확인' },
  { id: 'route', title: '거리와 잔량 확인', detail: '목적지까지 필요한 여유 확인' },
];

function sharePage({ title, text, path = window.location.hash || '#home', notify }) {
  const normalizedPath = path.startsWith('#') ? path : `#${path.replace(/^\//, '')}`;
  const url = `${window.location.origin}/${normalizedPath}`;
  if (navigator.share) {
    navigator.share({ title, text, url }).then(() => notify('링크를 공유했습니다.')).catch(() => undefined);
    return;
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(() => notify('공유 링크를 복사했습니다.')).catch(() => notify(`공유 링크: ${url}`));
    return;
  }
  notify(`공유 링크: ${url}`);
}

const tirePositions = [
  { id: 'frontLeft', label: '앞 왼쪽', key: 'frontLeft' },
  { id: 'frontRight', label: '앞 오른쪽', key: 'frontRight' },
  { id: 'rearLeft', label: '뒤 왼쪽', key: 'rearLeft' },
  { id: 'rearRight', label: '뒤 오른쪽', key: 'rearRight' },
];

function tireCheck(vehicle) {
  return vehicle?.healthChecks?.find((check) => check.id === 'TIRE_PRESSURE') ?? {
    state: vehicle?.tirePressureWarning == null ? 'UNAVAILABLE' : vehicle.tirePressureWarning ? 'WARNING' : 'CLEAR',
  };
}

function tireStatusLabel(state) {
  return state === 'WARNING' ? '점검 필요' : state === 'CLEAR' ? '경고 없음' : '개별값 미제공';
}

function tireValue(vehicle, key) {
  const payload = vehicle?.tirePressure;
  if (payload && payload.exactValuesAvailable !== true) return null;
  const values = payload?.values ?? vehicle?.tirePressures;
  if (!values) return null;
  return values[key] ?? values[key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)] ?? null;
}

function getCurrentPosition() {
  if (!navigator.geolocation) return Promise.reject({ code: 'UNSUPPORTED' });
  if (!window.isSecureContext && window.location.hostname !== 'localhost') return Promise.reject({ code: 'INSECURE_CONTEXT' });
  return new Promise((resolve, reject) => {
    let retried = false;
    let settled = false;
    let timer;
    const finishResolve = (value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      reject(error);
    };
    const retryOrReject = (error) => {
      if (settled) return;
      if (!retried && [2, 3].includes(error?.code)) {
        retried = true;
        navigator.geolocation.getCurrentPosition(finishResolve, finishReject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 120000 });
        return;
      }
      finishReject(error);
    };
    // Some mobile browsers leave the permission prompt pending without firing
    // the Geolocation timeout callback. Keep every dependent button recoverable.
    timer = window.setTimeout(() => finishReject({ code: 3 }), 25000);
    try {
      navigator.geolocation.getCurrentPosition(finishResolve, retryOrReject, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
    } catch (error) {
      finishReject(error);
    }
  });
}

function locationErrorMessage(error) {
  if (error?.code === 'UNSUPPORTED') return '이 기기에서는 위치 기능을 사용할 수 없습니다.';
  if (error?.code === 'INSECURE_CONTEXT') return '위치 기능은 HTTPS에서만 사용할 수 있습니다. 공개 주소로 다시 접속해 주세요.';
  if (error?.code === 1) return '위치 권한이 꺼져 있습니다. 브라우저 설정에서 이 사이트의 위치 권한을 허용해 주세요.';
  if (error?.code === 3) return '위치 확인 시간이 초과되었습니다. 실내·절전 모드를 해제하고 다시 시도해 주세요.';
  return '현재 위치를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

export default function App() {
  const appRef = useRef(null);
  const initialPage = window.location.hash.replace('#', '');
  const [page, setPage] = useState(validPages.has(initialPage) ? initialPage : 'home');
  const [sectionTarget, setSectionTarget] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehicleError, setVehicleError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [platform, setPlatform] = useState({ stations: [], chargingReservations: [], serviceBookings: [], handovers: [], notifications: [], unreadNotifications: 0, environment: 'LOADING', providers: [] });
  const [passport, setPassport] = useState(null);
  const [passportError, setPassportError] = useState('');
  const [refreshError, setRefreshError] = useState('');

  const vehicle = vehicles.find((item) => item.id === selectedVehicleId) ?? vehicles[0] ?? null;
  const journal = useVehicleJournal(vehicle?.databaseId);

  const refreshVehicles = useCallback(async () => {
    const result = await loadVehicles();
    setVehicles(result.vehicles);
    setVehicleError(result.error ?? '');
    setSelectedVehicleId((current) => result.vehicles.some((item) => item.id === current) ? current : result.vehicles[0]?.id ?? '');
    return result;
  }, []);

  useEffect(() => { refreshVehicles().catch(() => undefined); }, [refreshVehicles]);

  const refreshPlatform = useCallback(async () => {
    try {
      const snapshot = await loadPlatform();
      setPlatform(snapshot);
      setRefreshError('');
    } catch (error) {
      setRefreshError(error.message || '서비스 연결을 확인해 주세요.');
      throw error;
    }
  }, []);

  useEffect(() => {
    refreshPlatform().catch(() => undefined);
  }, [refreshPlatform]);

  useEffect(() => {
    let active = true;
    setPassport(null);
    setPassportError('');
    if (vehicle?.databaseId) loadPassport(vehicle.databaseId).then((result) => { if (active) setPassport(result); }).catch((error) => { if (active) setPassportError(error.message || '차량 기록을 불러오지 못했습니다.'); });
    return () => { active = false; };
  }, [vehicle?.databaseId]);

  useEffect(() => {
    const onHashChange = () => {
      const nextPage = window.location.hash.replace('#', '');
      setPage(validPages.has(nextPage) ? nextPage : 'home');
      setMenuOpen(false); setSectionTarget(''); window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const revealItems = [...document.querySelectorAll('[data-reveal]')];
    if (!revealItems.length) return undefined;
    if (!('IntersectionObserver' in window)) {
      revealItems.forEach((item) => item.classList.add('is-visible'));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });
    revealItems.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [page]);

  useEffect(() => {
    let animationFrame = 0;
    const updateScrollMotion = () => {
      animationFrame = 0;
      const root = appRef.current;
      if (!root) return;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      root.style.setProperty('--page-progress', `${Math.min(100, (scrollTop / scrollable) * 100)}%`);
      root.style.setProperty('--hero-shift', `${Math.min(90, scrollTop * .12)}px`);
      root.classList.toggle('is-scrolled', scrollTop > 42);
      const intro = document.querySelector('.orbit-intro');
      if (intro) {
        const rect = intro.getBoundingClientRect();
        const distance = Math.max(1, intro.offsetHeight - window.innerHeight);
        const progress = Math.max(0, Math.min(1, -rect.top / distance));
        intro.style.setProperty('--intro-progress', progress.toFixed(4));
        intro.style.setProperty('--intro-inset-x', `${(progress * 4.4).toFixed(2)}vw`);
        intro.style.setProperty('--intro-inset-y', `${(progress * 3.4).toFixed(2)}vh`);
        intro.style.setProperty('--intro-radius', `${(progress * 34).toFixed(1)}px`);
        intro.style.setProperty('--intro-media-scale', (1.08 - progress * .08).toFixed(4));
        intro.style.setProperty('--intro-copy-opacity', Math.max(0, 1 - progress * 1.55).toFixed(3));
        intro.style.setProperty('--intro-copy-y', `${(-progress * 56).toFixed(1)}px`);
        intro.style.setProperty('--intro-rail-opacity', Math.max(.18, 1 - progress * .72).toFixed(3));
        intro.dataset.phase = progress > .72 ? 'compressed' : progress > .18 ? 'moving' : 'open';
      }
      const story = document.querySelector('.motion-story');
      if (story) {
        const rect = story.getBoundingClientRect();
        const distance = Math.max(1, story.offsetHeight - window.innerHeight);
        const progress = Math.max(0, Math.min(1, -rect.top / distance));
        story.style.setProperty('--story-progress', progress.toFixed(4));
        story.style.setProperty('--story-fill', `${(progress * 100).toFixed(2)}%`);
        story.style.setProperty('--story-scale', (1.09 - progress * .09).toFixed(4));
        story.style.setProperty('--story-angle', `${(progress * 210).toFixed(1)}deg`);
        story.dataset.active = String(Math.min(2, Math.floor(progress * 3)));
      }
    };
    const onScroll = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateScrollMotion);
    };
    updateScrollMotion();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [page]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('hyundai');
    if (!result) return;
    const messages = {
      connected: '현대 계정과 차량 연결이 완료되었습니다.',
      'sync-required': '계정 연결은 완료됐습니다. 설정에서 차량 새로고침을 눌러 주세요.',
      cancelled: '현대 계정 연결을 취소했습니다. 차량 데이터는 저장되지 않았습니다.',
      'oauth-error': '현대 계정 인증을 완료하지 못했습니다. Redirect URL과 프로젝트 상태를 확인해 주세요.',
      'consent-error': '차량 정보 제공 동의를 완료하지 못했습니다. 잠시 후 다시 연결해 주세요.',
    };
    notify(messages[result] ?? '현대 계정 연결 상태를 확인해 주세요.');
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash || '#home'}`);
  }, []);

  function navigate(nextPage, target = '') {
    if (!validPages.has(nextPage)) return;
    setPage(nextPage); setSectionTarget(target); setMenuOpen(false);
    window.history.pushState({}, '', `#${nextPage}`);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  const notify = useCallback((message) => setToast(message), []);

  async function transact(work, message) {
    setBusy(true);
    try {
      await work();
      await refreshPlatform();
      const vehicleResult = await refreshVehicles();
      if (vehicle?.databaseId) await loadPassport(vehicle.databaseId).then(setPassport).catch((error) => setPassportError(error.message || '차량 기록을 불러오지 못했습니다.'));
      notify(vehicleResult.error ? `${message} 다만 차량 정보를 다시 확인하지 못했어요.` : message);
      setModal(null);
      return true;
    } catch (error) {
      notify(error.message || '요청을 처리하지 못했습니다.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const actions = {
    connectHyundai: async () => {
      window.location.assign(hyundaiAuthorizationPath);
    },
    syncHyundai: () => transact(() => syncHyundaiVehicles(), '동의한 현대차 데이터를 동기화했습니다.'),
    resumeHyundaiAgreement: () => window.location.assign('/api/v1/integrations/hyundai/agreement'),
    revokeHyundai: () => transact(() => revokeHyundaiConnection(), '현대 계정 연결과 저장된 실차 데이터를 삭제했습니다.'),
    markNotification: (id) => transact(() => readNotification(id), '알림을 확인했습니다.'),
  };

  const tour = useMobilityTour(page, sectionTarget, Boolean(modal));
  const shared = { vehicle, navigate, notify, setModal, platform, passport, passportError, actions, busy, journal, sectionTarget, tour };
  useEffect(() => {
    const pageTitle = page === 'proposal' ? '현대차 제안' : page === 'canary' ? 'SDV 운영 데모' : navigation.find((item) => item.id === page)?.label ?? '이용 안내';
    document.title = `${pageTitle} · LIFE PASS`;
  }, [page]);
  useEffect(() => {
    const panel = document.getElementById('main-content');
    panel?.scrollTo({ top: 0, behavior: 'instant' });
  }, [page]);

  return (
    <div className={`app platform mobility-shell page-${page}`} ref={appRef}>
      <MobilityBackdrop scene={tour.scene} paused={tour.paused} />
      <a className="skip-to-content" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>본문 바로가기</a>
      <div className="page-progress" aria-hidden="true"><i /></div>
      <Header
        page={page}
        navigate={navigate}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        vehicle={vehicle}
        vehicles={vehicles}
        selectedVehicleId={selectedVehicleId}
        setSelectedVehicleId={setSelectedVehicleId}
        notify={notify}
        platform={platform}
        actions={actions}
        busy={busy}
      />

      <DataProvenanceBar platform={platform} actions={actions} busy={busy} />


      {(refreshError || vehicleError) && <div className="connectivity-banner" role="alert"><span>{vehicleError ? '차량 정보를 아직 불러오지 못했어요.' : '일부 정보를 아직 불러오지 못했어요.'}</span><button onClick={() => Promise.allSettled([refreshPlatform(), refreshVehicles()])}>다시 시도</button></div>}

      <main id="main-content" tabIndex={-1}>
        {page === 'home' && <OwnerHome {...shared} />}
        {page === 'drive' && <DrivePage {...shared} />}
        {page === 'charge' && <ChargePage {...shared} />}
        {page === 'care' && <CarePage {...shared} />}
        {page === 'passport' && <OwnershipPage key={vehicle?.databaseId ?? 'guest'} {...shared}><PassportPage {...shared} /></OwnershipPage>}
        {page === 'settings' && <SettingsPage {...shared} />}
        {page === 'privacy' && <LegalPage type="privacy" />}
        {page === 'terms' && <LegalPage type="terms" />}
        {page === 'guide' && <GuidePage navigate={navigate} />}
        {page === 'proposal' && <ProposalPage navigate={navigate} />}
        {page === 'canary' && <CanaryPage navigate={navigate} />}
      <SiteFooter navigate={navigate} />
      </main>
      <MobileNav page={page} navigate={navigate} />
      {modal && <Modal type={modal} vehicle={vehicle} platform={platform} close={() => setModal(null)} notify={notify} navigate={navigate} actions={actions} busy={busy} />}
      {toast && <div className="toast" role="status"><Check size={15} />{toast}</div>}
    </div>
  );
}

function DataProvenanceBar({ platform, actions, busy }) {
  const [expanded, setExpanded] = useState(false);
  const providers = platform.providers ?? [];
  if (!providers.length) return null;
  const hyundai = providers.find((provider) => provider.id === 'hyundai-connected-car');
  const isLive = (provider) => provider.mode === 'LIVE' && ['CONNECTED', 'STALE'].includes(provider.state);
  const carReady = isLive(hyundai);
  const chargerReady = isLive(providers.find((provider) => provider.id === 'ev-charger'));
  const environmentLabel = carReady ? '오늘도 안전하게 출발해요' : '차량을 연결하면 더 편해져요';
  return (
    <aside className={`data-provenance ${carReady ? 'live' : 'ready'} ${expanded ? 'open' : ''}`} aria-label="서비스 상태 안내">
      <div className="container">
        <div className="provenance-summary">
          <strong><i />{environmentLabel}</strong>
          <span className="provenance-mobile-summary">{carReady ? '내 차 상태가 준비됐어요' : '충전소·블루핸즈는 위치를 허용하면 확인해요'}</span>
          <button className="provenance-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>상태 보기 <ChevronDown size={14} /></button>
        </div>
        <div className="provenance-details">
          <div className="provider-list">
            <span className={carReady ? 'live' : 'sample'}><i />내 차 상태: {carReady ? '최신 상태 확인' : '차량 연결 후 확인'}</span>
            <span className={chargerReady ? 'live' : 'sample'}><i />주변 충전소: {chargerReady ? '지금 이용 가능' : '잠시 확인 중'}</span>
          </div>
          <small>{carReady ? '차량 상태와 주변 생활 정보를 한곳에서 확인할 수 있어요.' : '차량을 연결하지 않아도 위치를 허용하면 주변 충전소와 블루핸즈를 찾을 수 있어요.'}</small>
          {hyundai?.mode === 'LIVE' && ['OAUTH_REQUIRED', 'REVOKED'].includes(hyundai.state) && <button className="provenance-action" disabled={busy} onClick={actions.connectHyundai}>{hyundai.state === 'REVOKED' ? '다시 연결' : '현대 계정 연결'}</button>}
          {hyundai?.mode === 'LIVE' && hyundai.state === 'CONSENT_REQUIRED' && <button className="provenance-action" disabled={busy} onClick={actions.resumeHyundaiAgreement}>동의 계속하기</button>}
        </div>
      </div>
    </aside>
  );
}

function Header({ page, navigate, menuOpen, setMenuOpen, vehicle, vehicles, selectedVehicleId, setSelectedVehicleId, notify, platform, actions, busy }) {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const hyundai = platform.providers?.find((provider) => provider.id === 'hyundai-connected-car');
  const connected = hyundai?.mode === 'LIVE' && ['CONNECTED', 'STALE'].includes(hyundai.state);
  const accountAction = () => {
    if (connected) return navigate('settings');
    if (hyundai?.mode === 'LIVE' && hyundai.state === 'CONSENT_REQUIRED') return actions.resumeHyundaiAgreement();
    if (hyundai?.mode === 'LIVE' && !['MISCONFIGURED', 'ERROR'].includes(hyundai.state)) return actions.connectHyundai();
    notify('잠시 후 다시 시도하거나 현대 계정 연결 상태를 확인해 주세요.');
  };
  return (
    <header className="site-header">
      <div className="header-inner">
        <button className="brand" onClick={() => navigate('home')} aria-label="라이프패스 홈">
          <span className="life-mark" aria-hidden="true"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" /><path d="M13 13v18h11" /><path d="M25 31V13h5a6 6 0 0 1 0 12h-5" /><circle className="life-mark-dot" cx="35" cy="9" r="2.5" /></svg></span>
          <span className="brand-copy"><strong>LIFE PASS<span>.</span></strong><small>현대차와 함께하는 일상</small></span>
        </button>

        <nav className="desktop-nav" aria-label="주요 메뉴">
          {primaryNavigation.map((item) => (
            <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => navigate(item.id)}>{item.label}</button>
          ))}
        </nav>

        <div className="header-actions">
          {vehicle && <label className="vehicle-picker">
            <CarFront size={15} />
            <select value={selectedVehicleId} onChange={(event) => setSelectedVehicleId(event.target.value)} aria-label="차량 선택">
              {vehicles.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.plate}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>}
          <div className="notification-wrap">
            <button className="header-icon" onClick={() => setAlertsOpen((value) => !value)} aria-label={`알림 ${platform.unreadNotifications ?? 0}개`}><Bell size={18} />{platform.unreadNotifications > 0 && <i className="notification-count">{platform.unreadNotifications}</i>}</button>
            {alertsOpen && <div className="notification-panel"><div><strong>알림 센터</strong><span>{vehicle ? '내 차 소식' : '주변 생활 소식'}</span></div>{platform.notifications?.length ? platform.notifications.slice(0, 5).map((item) => <button key={item.id} className={item.read ? 'read' : ''} onClick={() => actions.markNotification(item.id)}><span>{item.category}</span><strong>{item.title}</strong><small>{item.message}</small></button>) : <p>새로운 알림이 없습니다.</p>}</div>}
          </div>
          <button className={`account-button ${connected ? 'connected' : ''}`} disabled={busy} onClick={accountAction}><UserRound size={16} /><span><small>현대 통합계정</small><strong>{connected ? '내 계정' : hyundai?.state === 'CONSENT_REQUIRED' ? '동의 계속' : '계정 연결'}</strong></span></button>
          <button className="mobile-menu-button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}>{menuOpen ? <X size={21} /> : <Menu size={21} />}{platform.unreadNotifications > 0 && <i className="notification-count">{platform.unreadNotifications}</i>}</button>
        </div>
      </div>

      {menuOpen && (
        <div className="mobile-drawer">
          <div className="mobile-vehicle"><span>{vehicle?.name ?? '아직 등록한 차량이 없어요'}</span><strong>{vehicle?.plate ?? '차량을 연결해 보세요'}</strong><small>{vehicle ? '내 차 소식이 준비됐어요' : '주변 충전·정비는 바로 이용할 수 있어요'}</small></div>
          <div className={`mobile-account ${connected ? 'connected' : ''}`}><div><UserRound size={19} /><span><small>현대 통합계정</small><strong>{connected && hyundai?.accountName ? `${hyundai.accountName}님` : hyundaiStatusLabel(hyundai)}</strong></span></div><button disabled={busy} onClick={accountAction}>{connected ? '새로고침' : hyundai?.state === 'CONSENT_REQUIRED' ? '동의 계속' : '연결하기'}</button></div>
          {primaryNavigation.map((item) => <button key={item.id} onClick={() => navigate(item.id)}><item.icon size={18} />{item.label}<ChevronRight size={16} /></button>)}
          <div className="mobile-drawer-label">필요할 때만 쓰는 도구</div>
          {secondaryNavigation.map((item) => <button className="mobile-drawer-secondary" key={item.id} onClick={() => navigate(item.id)}><item.icon size={18} />{item.label}<ChevronRight size={16} /></button>)}
        </div>
      )}
    </header>
  );
}



function TirePressureCard({ vehicle, compact = false, onDetails }) {
  const check = tireCheck(vehicle);
  const exactCount = tirePositions.filter(({ key }) => tireValue(vehicle, key) != null).length;
  const unit = vehicle?.tirePressure?.unit ?? '';
  const overallLabel = check.state === 'UNAVAILABLE' ? (vehicle ? '미수신' : '차량 연결 필요') : check.state === 'WARNING' ? '경고 수신' : '수신한 경고 없음';
  return (
    <article className={`tire-pressure-card panel ${compact ? 'compact' : ''}`}>
      <div className="feature-art tire-art"><FeatureImage scene="tires" /></div>
      <div className="tire-card-heading"><div><span>안전하게 달리기</span><h3>타이어 공기압</h3></div><strong className={`tire-status ${check.state.toLowerCase()}`}>{overallLabel}</strong></div>
      <div className="tire-grid" aria-label="타이어 위치별 상태">{tirePositions.map(({ id, label, key }) => { const value = tireValue(vehicle, key); const valueLabel = value == null ? '미제공' : `${value}${unit ? ` ${unit}` : ''}`; return <div className={`tire-wheel ${check.state.toLowerCase()}`} key={id} aria-label={`${label} ${valueLabel}`}><i /><span>{label}</span><strong>{valueLabel}</strong></div>; })}</div>
      <div className="tire-card-note"><CircleGauge size={15} /><span>{exactCount ? `${exactCount}개 바퀴의 수치를 확인했어요.` : vehicle?.source === 'HYUNDAI_DEVELOPERS' ? '현재는 타이어 경고 여부를 먼저 보여드려요.' : '차량을 연결하면 타이어 상태를 확인할 수 있어요.'}</span></div>
      {onDetails && <button className="tire-details-button" onClick={onDetails}>안전 점검 자세히 보기 <ArrowRight size={14} /></button>}
    </article>
  );
}

function VehicleEnergyCard({ vehicle, onConnect }) {
  const batterySoc = vehicle?.batterySoc == null ? null : Math.max(0, Math.min(100, Number(vehicle.batterySoc)));
  const targetSoc = vehicle?.chargingTargetSoc == null ? null : Math.max(0, Math.min(100, Number(vehicle.chargingTargetSoc)));
  const charging = /charging|충전\s*중|급속\s*충전|완속\s*충전/i.test(vehicle?.chargingState ?? '');
  return (
    <section className={`vehicle-energy-card ${vehicle ? 'connected' : 'guest'} reveal`} data-reveal aria-label="내 차 충전 상태">
      <div className="feature-art energy-art"><FeatureImage scene="battery" /></div>
      <div className="energy-card-copy">
        <span><i /> {vehicle ? 'MY EV ENERGY' : 'CONNECT MY HYUNDAI'}</span>
        <h2>{vehicle ? `${vehicle.name} 충전 상태` : '내 차의 배터리를 한눈에'}</h2>
        <p>{vehicle ? `${vehicle.chargingState || '현재 상태 확인 중'} · ${formatHyundaiTimestamp(vehicle.dataTimestamp)}` : '차량을 연결하면 배터리 잔량, 주행 가능 거리와 목표 충전까지 필요한 정보를 보여드려요.'}</p>
        {!vehicle && <button onClick={onConnect}>내 차 연결하기 <ArrowRight size={15} /></button>}
      </div>
      <div className="battery-visual-wrap">
        <div className={`battery-visual ${charging ? 'charging' : ''}`} style={{ '--battery-level': `${batterySoc ?? 0}%`, '--target-level': `${targetSoc ?? 80}%` }}>
          <div className="battery-terminal" />
          <div className="battery-shell"><div className="battery-liquid"><i /><i /><i /></div><div className="battery-target" /><div className="battery-readout"><strong>{batterySoc ?? '—'}<small>{batterySoc == null ? '' : '%'}</small></strong><span>{batterySoc == null ? '차량 연결 필요' : charging ? '충전 중' : '현재 배터리'}</span></div></div>
        </div>
      </div>
      <div className="energy-card-stats">
        <div><Navigation size={17} /><span>주행 가능</span><strong>{formatMetric(vehicle?.range, 'km')}</strong></div>
        <div><Zap size={17} /><span>목표 충전</span><strong>{formatMetric(targetSoc, '%')}</strong></div>
        <div><Clock3 size={17} /><span>남은 시간</span><strong>{formatMetric(vehicle?.chargingRemainingMinutes, '분')}</strong></div>
      </div>
    </section>
  );
}

function ChargeHero({ availableCount, locationLabel, radiusKm, usingCurrentLocation, live, busy, onLocate }) {
  return (
    <section className="charge-hero" aria-labelledby="charge-title">
      <div className="charge-hero-copy">
        <span><i /> {live ? '실시간 충전 현황' : '충전 현황 확인 중'}</span>
        <h1 id="charge-title">가까운 충전소</h1>
        <p><MapPin size={14} /> {locationLabel} · 반경 {Math.round(radiusKm)}km</p>
      </div>
      <div className="charge-hero-count"><strong>{live ? availableCount : '—'}</strong><span>대 사용 가능</span><small>{usingCurrentLocation ? '내 위치 기준' : '서울 성수 기본 위치 기준'}</small></div>
      <button onClick={onLocate} disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <LocateFixed size={17} />}<span><strong>{busy ? '위치 확인 중' : '내 위치로 다시 찾기'}</strong><small>위치는 저장하지 않아요</small></span><ChevronRight size={17} /></button>
      <div className="charge-hero-symbol" aria-hidden="true"><Zap size={30} fill="currentColor" /><i /><i /></div>
    </section>
  );
}

function ChargePage({ vehicle, notify, platform, setModal }) {
  const [chargerFeed, setChargerFeed] = useState(() => ({
    stations: platform.stations ?? [],
    provider: platform.providers?.find((provider) => provider.id === 'ev-charger') ?? null,
    search: { latitude: 37.5446, longitude: 127.0559, locationLabel: '서울 성수 기본 위치', radiusKm: 30 },
  }));
  const [locationBusy, setLocationBusy] = useState(false);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) ?? '[]');
      return Array.isArray(saved) ? saved.map(String) : [];
    } catch {
      return [];
    }
  });
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortMode, setSortMode] = useState('distance');
  const [quickFilter, setQuickFilter] = useState('all');
  const stationList = useMemo(() => (chargerFeed.stations ?? []).map((item) => ({
    ...item,
    distanceValue: Number(item.distanceKm) || 0,
    distance: `${Number(item.distanceKm ?? 0).toFixed(1)}km`,
    speed: item.speedKw > 0 ? `${item.speedKw}kW` : '출력 확인 필요',
    price: '운영사에서 확인',
    eta: '직선거리 기준',
  })), [chargerFeed.stations]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [stationLimit, setStationLimit] = useState(6);
  const [search, setSearch] = useState('');
  const favoriteKey = (station) => String(station.providerStationId ?? station.id);
  const visibleStations = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = stationList.filter((station) => {
      const matchesQuery = `${station.name} ${station.address} ${station.operator}`.toLowerCase().includes(query);
      const matchesQuickFilter = quickFilter === 'available'
        ? Number(station.available) > 0
        : quickFilter === 'fast'
          ? Number(station.speedKw) >= 100
          : true;
      return matchesQuery && matchesQuickFilter && (!favoritesOnly || favoriteIds.includes(favoriteKey(station)));
    });
    return [...filtered].sort((left, right) => {
      if (sortMode === 'availability') return right.available - left.available || left.distanceValue - right.distanceValue;
      if (sortMode === 'speed') return right.speedKw - left.speedKw || left.distanceValue - right.distanceValue;
      return left.distanceValue - right.distanceValue;
    });
  }, [stationList, search, favoritesOnly, favoriteIds, sortMode, quickFilter]);
  const activeStation = visibleStations.find((station) => station.id === selectedStation?.id) ?? visibleStations.find((station) => Number(station.available) > 0) ?? visibleStations[0] ?? null;
  const availableChargerCount = visibleStations.reduce((sum, station) => sum + Number(station.available || 0), 0);
  const chargerProvider = chargerFeed.provider ?? platform.providers?.find((provider) => provider.id === 'ev-charger');
  const chargerLive = chargerProvider?.mode === 'LIVE' && ['CONNECTED', 'STALE'].includes(chargerProvider.state);
  const chargerError = chargerProvider?.state === 'ERROR';

  useEffect(() => {
    if (usingCurrentLocation || !(platform.stations?.length)) return;
    setChargerFeed({
      stations: platform.stations,
      provider: platform.providers?.find((provider) => provider.id === 'ev-charger') ?? null,
      search: { latitude: 37.5446, longitude: 127.0559, locationLabel: '서울 성수 기본 위치', radiusKm: 30 },
    });
  }, [platform.stations, platform.providers, usingCurrentLocation]);

  const loadFromCoordinates = useCallback(async ({ latitude, longitude }) => {
    setLocationBusy(true);
    try {
      const result = await loadChargingStations({ latitude, longitude, radiusKm: 30 });
      setChargerFeed(result);
      setSelectedStation(null);
      setUsingCurrentLocation(true);
      if (result.provider?.state === 'ERROR') notify(result.provider.message);
    } catch (error) {
      setUsingCurrentLocation(false);
      notify(error.message || '현재 위치 주변 충전소를 불러오지 못했습니다.');
    } finally {
      setLocationBusy(false);
    }
  }, [notify]);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteIds));
    } catch {
      // Private browsing can deny localStorage; favorites remain available in memory.
    }
  }, [favoriteIds]);

  const toggleFavorite = useCallback((station) => {
    const key = favoriteKey(station);
    setFavoriteIds((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
    notify(favoriteIds.includes(key) ? '즐겨찾기에서 삭제했습니다.' : '충전소를 즐겨찾기에 저장했습니다.');
  }, [favoriteIds, notify]);

  const refreshStations = useCallback(async () => {
    const query = chargerFeed.search ?? { latitude: 37.5446, longitude: 127.0559, radiusKm: 30 };
    setLocationBusy(true);
    try {
      const result = await loadChargingStations({ latitude: query.latitude, longitude: query.longitude, radiusKm: query.radiusKm });
      setChargerFeed(result);
      setSelectedStation(null);
      notify('충전소 상태를 새로고침했습니다.');
    } catch (error) {
      notify(error.message || '충전소 상태를 새로고침하지 못했습니다.');
    } finally {
      setLocationBusy(false);
    }
  }, [chargerFeed.search, notify]);

  const findFromCurrentLocation = useCallback(() => {
    setLocationBusy(true);
    getCurrentPosition()
      .then(({ coords }) => loadFromCoordinates({ latitude: coords.latitude, longitude: coords.longitude }))
      .catch((error) => {
        setLocationBusy(false);
        setUsingCurrentLocation(false);
        notify(locationErrorMessage(error));
      });
  }, [loadFromCoordinates, notify]);

  useEffect(() => {
    let active = true;
    if (!navigator.permissions?.query) return undefined;
    navigator.permissions.query({ name: 'geolocation' }).then((permission) => {
      if (active && permission.state === 'granted') findFromCurrentLocation();
    }).catch(() => undefined);
    return () => { active = false; };
  }, [findFromCurrentLocation]);

  return (
    <div className="page container charge-page">
      <ChargeHero availableCount={availableChargerCount} locationLabel={chargerFeed.search?.locationLabel ?? '서울 성수'} radiusKm={chargerFeed.search?.radiusKm ?? 30} usingCurrentLocation={usingCurrentLocation} live={chargerLive} busy={locationBusy} onLocate={findFromCurrentLocation} />
      <div className="charge-quick-filters" aria-label="충전소 빠른 필터">
        <div><span>빠른 조건</span><strong>{visibleStations.length}곳 비교 중</strong></div>
        <div>
          <button className={quickFilter === 'all' ? 'active' : ''} onClick={() => setQuickFilter('all')}>전체</button>
          <button className={quickFilter === 'available' ? 'active' : ''} onClick={() => setQuickFilter('available')}><CheckCircle2 size={14} /> 사용 가능</button>
          <button className={quickFilter === 'fast' ? 'active' : ''} onClick={() => setQuickFilter('fast')}><Zap size={14} /> 100kW 이상</button>
        </div>
      </div>
      <div className="charge-layout">
        <section className="charge-map panel">
          <div className="map-search"><Search size={18} /><input value={search} placeholder="충전소명·주소·운영기관 검색" onChange={(event) => setSearch(event.target.value)} aria-label="충전소 검색" /><button aria-label="검색어 지우기" onClick={() => setSearch('')}><X size={17} /></button></div>
          <div className="station-tools" aria-label="충전소 목록 설정">
            <label><SlidersHorizontal size={15} /><span>정렬</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value)} aria-label="충전소 정렬"><option value="distance">거리순</option><option value="availability">사용 가능 많은 순</option><option value="speed">출력 높은 순</option></select></label>
            <button className={favoritesOnly ? 'active' : ''} onClick={() => setFavoritesOnly((current) => !current)} aria-pressed={favoritesOnly}><Star size={15} fill={favoritesOnly ? 'currentColor' : 'none'} /> 즐겨찾기{favoriteIds.length ? ` ${favoriteIds.length}` : ''}</button>
            <button onClick={refreshStations} disabled={locationBusy}><RefreshCcw className={locationBusy ? 'spin' : ''} size={15} /> 새로고침</button>
          </div>
          <KakaoStationMap stations={visibleStations} selectedStation={activeStation} onSelect={setSelectedStation} userLocation={usingCurrentLocation ? chargerFeed.search : null} />
        </section>
        <aside className="station-panel panel">
          <div className="station-panel-head"><span>가까운 순서</span><small>{chargerLive ? `${Math.min(6, visibleStations.length)}곳 추천` : '확인 중'}</small></div>
          {visibleStations.slice(0, stationLimit).map((station) => (
            <button key={station.id} className={`station-row ${activeStation?.id === station.id ? 'active' : ''}`} onClick={() => setSelectedStation(station)}>
              <div className={`station-availability ${station.available > 0 ? 'available' : 'busy'}`}><strong>{station.available}</strong><span>/{station.total}</span><i /></div>
              <div><strong>{station.name}</strong><span>{station.distance} · {station.speed} · {station.eta}</span><small>{station.operator} · {station.statusLabel}</small></div>
              <ChevronRight size={16} />
            </button>
          ))}
          {visibleStations.length > stationLimit && <button className="station-more" onClick={() => setStationLimit((limit) => limit + 6)}>충전소 6곳 더 보기 <Plus size={15} /></button>}
          {activeStation ? <div className="station-detail">
            <div className="station-detail-heading"><div><span>선택한 충전소</span><strong>{activeStation.name}</strong><p>{activeStation.address}</p></div><button className={`station-favorite ${favoriteIds.includes(favoriteKey(activeStation)) ? 'active' : ''}`} onClick={() => toggleFavorite(activeStation)} aria-label={favoriteIds.includes(favoriteKey(activeStation)) ? '즐겨찾기 삭제' : '즐겨찾기 추가'} aria-pressed={favoriteIds.includes(favoriteKey(activeStation))}><Star size={18} fill={favoriteIds.includes(favoriteKey(activeStation)) ? 'currentColor' : 'none'} /></button></div>
            <div className="charge-price"><span>충전 요금</span><strong>운영사에서 확인</strong><small>회원·로밍·충전기별로 달라 현장 요금을 확인해 주세요.</small></div>
            <button className="button primary full" onClick={() => window.open(`https://map.kakao.com/link/to/${encodeURIComponent(activeStation.name)},${activeStation.latitude},${activeStation.longitude}`, '_blank', 'noopener,noreferrer')}><Navigation size={16} />길찾기 시작</button>
          </div> : <div className="station-empty" role={chargerError ? 'alert' : undefined}><MapPin size={22} /><strong>{stationList.length ? '검색 결과가 없습니다.' : chargerError ? '충전소 연결이 잠시 지연되고 있어요.' : '충전소를 불러오는 중입니다.'}</strong><span>{stationList.length ? '다른 충전소명이나 지역을 입력해 보세요.' : chargerError ? '실시간 데이터를 받지 못했습니다. 잠시 후 다시 확인해 주세요.' : '데이터를 확인하는 동안 잠시만 기다려 주세요.'}</span>{chargerError && <button className="button compact" onClick={refreshStations} disabled={locationBusy}><RefreshCcw size={14} /> 다시 확인</button>}</div>}
        </aside>
      </div>
      <section className="charge-vehicle-section">
        <div className="charge-section-heading"><span>MY EV</span><h2>충전소를 정했다면, 내 차 잔량도 확인하세요.</h2></div>
        <VehicleEnergyCard vehicle={vehicle} onConnect={() => setModal('connect')} />
      </section>
      <div className="charge-plan-grid">
        <div className="panel plan-card"><div className="plan-icon"><Clock3 size={20} /></div><div><span>마지막 확인</span><strong>{chargerProvider?.refreshedAt ? formatDateTime(chargerProvider.refreshedAt) : '확인 중'}</strong><p>충전기 상태는 현장 상황에 따라 달라질 수 있어요.</p></div></div>
        <div className="panel plan-card"><div className="plan-icon"><Route size={20} /></div><div><span>이용 안내</span><strong>길찾기까지 한 번에</strong><p>도착 후 충전기 화면에서 이용 방법을 확인해 주세요.</p></div></div>
      </div>
    </div>
  );
}

let kakaoSdkPromise;
let kakaoSdkScript;
function loadKakaoSdk(key, retry = 0) {
  if (!key) return Promise.reject(new Error('지도 화면을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.'));
  if (window.kakao?.maps?.Map) return Promise.resolve(window.kakao);
  if (kakaoSdkPromise) return kakaoSdkPromise;

  const load = () => new Promise((resolve, reject) => {
    let settled = false;
    let readyChecks = 0;
    const timeout = window.setTimeout(() => finish(new Error('Kakao Maps SDK load timeout')), 12000);
    const finish = (error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (error) reject(error);
      else resolve(window.kakao);
    };
    const startMapLoad = () => {
      if (settled) return;
      if (!window.kakao?.maps?.load) {
        if (readyChecks++ < 40) {
          window.setTimeout(startMapLoad, 50);
          return;
        }
        finish(new Error('지도 화면을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.'));
        return;
      }
      window.kakao.maps.load(() => {
        if (window.kakao?.maps?.Map) finish();
        else finish(new Error('지도 화면을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.'));
      });
    };

    const existing = kakaoSdkScript || document.querySelector('script[data-lifepass-kakao-sdk]');
    if (existing) {
      kakaoSdkScript = existing;
      existing.addEventListener('load', startMapLoad, { once: true });
      existing.addEventListener('error', () => finish(new Error('지도 화면을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')), { once: true });
      startMapLoad();
      return;
    }

    const script = document.createElement('script');
    script.dataset.lifepassKakaoSdk = 'true';
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
    script.async = true;
    script.onload = startMapLoad;
    script.onerror = () => finish(new Error('지도 화면을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));
    kakaoSdkScript = script;
    document.head.appendChild(script);
  });

  kakaoSdkPromise = load().catch((error) => {
    kakaoSdkPromise = undefined;
    if (kakaoSdkScript && !window.kakao?.maps?.Map) {
      kakaoSdkScript.remove();
      kakaoSdkScript = undefined;
    }
    if (retry < 1) return new Promise((resolve) => window.setTimeout(resolve, 350)).then(() => loadKakaoSdk(key, retry + 1));
    throw error;
  });
  return kakaoSdkPromise;
}

function KakaoStationMap({ stations: stationItems, selectedStation, onSelect, userLocation }) {
  const mapElement = useRef(null);
  const mapRef = useRef(null);
  const kakaoRef = useRef(null);
  const markerElements = useRef([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [mapRetryKey, setMapRetryKey] = useState(0);
  const key = window.__LIFEPASS_CONFIG__?.kakaoJavascriptKey || import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY;

  useEffect(() => {
    setMapError('');
    setMapReady(false);
    if (!key || !mapElement.current || !stationItems.length) return undefined;
    let cancelled = false;
    loadKakaoSdk(key).then((kakao) => {
      if (cancelled || !mapElement.current) return;
      const centerStation = selectedStation ?? stationItems[0];
      const map = new kakao.maps.Map(mapElement.current, {
        center: new kakao.maps.LatLng(centerStation.latitude, centerStation.longitude),
        level: 5,
      });
      mapRef.current = map;
      kakaoRef.current = kakao;
      const bounds = new kakao.maps.LatLngBounds();
      const overlays = [];
      markerElements.current = [];
      stationItems.forEach((station) => {
        const position = new kakao.maps.LatLng(station.latitude, station.longitude);
        bounds.extend(position);
        const marker = document.createElement('button');
        marker.type = 'button';
        marker.className = `kakao-station-marker ${selectedStation?.id === station.id ? 'active' : ''}`;
        marker.setAttribute('aria-label', `${station.name}, 사용 가능 ${station.available}대`);
        const count = document.createElement('strong');
        count.textContent = String(station.available);
        const label = document.createElement('span');
        label.textContent = station.available > 0 ? '가능' : '대기';
        marker.append(count, label);
        marker.addEventListener('click', () => onSelect(station));
        const overlay = new kakao.maps.CustomOverlay({ position, content: marker, yAnchor: 1.2, zIndex: selectedStation?.id === station.id ? 5 : 3 });
        markerElements.current.push({ id: station.id, marker, overlay });
        overlay.setMap(map);
        overlays.push(overlay);
      });
      if (userLocation) {
        const current = new kakao.maps.LatLng(userLocation.latitude, userLocation.longitude);
        bounds.extend(current);
        const currentMarker = document.createElement('div');
        currentMarker.className = 'kakao-current-marker';
        currentMarker.setAttribute('aria-label', '내 현재 위치');
        const currentOverlay = new kakao.maps.CustomOverlay({ position: current, content: currentMarker, zIndex: 6 });
        currentOverlay.setMap(map);
        overlays.push(currentOverlay);
      }
      if (stationItems.length > 1) map.setBounds(bounds, 48, 48, 48, 48);
      setMapReady(true);
      map.__lifePassOverlays = overlays;
    }).catch(() => {
      if (!cancelled) setMapError('지도 연결을 확인해 주세요. 아래 목록에서 길찾기를 이용할 수 있어요.');
    });
    return () => {
      cancelled = true;
      mapRef.current?.__lifePassOverlays?.forEach((overlay) => overlay.setMap(null));
      mapRef.current = null;
      kakaoRef.current = null;
    };
  }, [key, stationItems, onSelect, userLocation?.latitude, userLocation?.longitude, mapRetryKey]);

  useEffect(() => {
    markerElements.current.forEach(({ id, marker, overlay }) => {
      const active = id === selectedStation?.id;
      marker.classList.toggle('active', active);
      overlay.setZIndex(active ? 5 : 3);
    });
    if (mapRef.current && kakaoRef.current && selectedStation) mapRef.current.panTo(new kakaoRef.current.maps.LatLng(selectedStation.latitude, selectedStation.longitude));
  }, [selectedStation?.id, mapReady]);

  const changeZoom = (delta) => {
    const map = mapRef.current;
    if (!map) return;
    map.setLevel(Math.max(1, Math.min(14, map.getLevel() + delta)), { animate: true });
  };
  const focusMap = () => {
    const map = mapRef.current;
    const kakao = kakaoRef.current;
    const target = userLocation ?? selectedStation ?? stationItems[0];
    if (!map || !kakao || !target) return;
    map.panTo(new kakao.maps.LatLng(target.latitude, target.longitude));
  };

  return (
    <div className={`map-experience ${mapReady ? 'ready' : ''}`}>
      {key && stationItems.length ? <div ref={mapElement} className="map-surface kakao-map" aria-label="충전소 지도" /> : <div className="map-unavailable" role="status"><MapPin size={26} /><strong>{key ? '충전소 데이터를 받으면 지도가 열려요.' : '지도 연결이 필요해요'}</strong><span>{key ? '잠시 후 다시 확인하거나 아래 목록에서 길찾기를 이용하세요.' : '아래 목록에서 충전소를 선택해 길찾기를 이용하세요.'}</span></div>}
      {mapError && <div className="map-unavailable" role="status"><MapPin size={26} /><strong>지도를 표시하지 못했어요</strong><span>{mapError}</span><button className="button compact map-retry" type="button" onClick={() => setMapRetryKey((value) => value + 1)}>다시 불러오기</button></div>}
      <div className="map-live-chip"><i /> 충전기 현황</div>
      {key && mapReady && <div className="map-zoom-controls" aria-label="지도 확대 축소"><button onClick={() => changeZoom(-1)} aria-label="지도 확대"><Plus size={18} /></button><button onClick={() => changeZoom(1)} aria-label="지도 축소"><Minus size={18} /></button></div>}
      {mapReady && <button className="map-recenter" onClick={focusMap} aria-label="선택한 위치로 지도 이동"><LocateFixed size={18} /></button>}
      {selectedStation && <button className="map-selected-card" onClick={() => window.open(`https://map.kakao.com/link/to/${encodeURIComponent(selectedStation.name)},${selectedStation.latitude},${selectedStation.longitude}`, '_blank', 'noopener,noreferrer')} aria-label={`${selectedStation.name} 카카오맵 길찾기`}><span><i className={selectedStation.available > 0 ? 'available' : ''} />{selectedStation.available > 0 ? `${selectedStation.available}대 사용 가능` : '현재 대기'}</span><strong>{selectedStation.name}</strong><small>{selectedStation.distance} · {selectedStation.speed} · 눌러서 길찾기</small><Navigation size={17} /></button>}
    </div>
  );
}

function DrivePage({ vehicle, navigate, notify, setModal, sectionTarget, tour }) {
  const [driveTab, setDriveTab] = useState(sectionTarget || 'plan');
  useEffect(() => { if (sectionTarget) setDriveTab(sectionTarget); }, [sectionTarget]);
  const [tripDistance, setTripDistance] = useState(120);
  const [reservePercent, setReservePercent] = useState(20);
  const [efficiency, setEfficiency] = useState(5.2);
  const [energyPrice, setEnergyPrice] = useState(347);
  const [parkingBusy, setParkingBusy] = useState(false);
  const todayKey = useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()), []);
  const [checkedItems, setCheckedItems] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRIVE_CHECKLIST_STORAGE_KEY) ?? '{}');
      return saved.date === new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()) && Array.isArray(saved.items) ? saved.items : [];
    } catch {
      return [];
    }
  });
  const [parkingSpot, setParkingSpot] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PARKING_STORAGE_KEY) ?? 'null');
      return saved && Number.isFinite(saved.latitude) && Number.isFinite(saved.longitude) ? saved : null;
    } catch {
      return null;
    }
  });

  const currentRange = vehicle?.range == null ? null : Math.max(0, Number(vehicle.range));
  const batterySoc = vehicle?.batterySoc == null ? null : Math.max(0, Math.min(100, Number(vehicle.batterySoc)));
  const requiredRange = Math.ceil(Number(tripDistance) / (1 - Number(reservePercent) / 100));
  const requiredEnergy = Number(efficiency) > 0 ? Number(tripDistance) / Number(efficiency) : 0;
  const estimatedCost = Math.round(requiredEnergy * Math.max(0, Number(energyPrice)));
  const arrivalRange = currentRange == null ? null : Math.round(currentRange - Number(tripDistance));
  const canCompleteTrip = currentRange == null ? null : currentRange >= requiredRange;
  const minimumDepartureSoc = currentRange && batterySoc != null ? Math.min(100, Math.ceil((batterySoc * requiredRange) / currentRange)) : null;
  const checkedCount = checkedItems.length;

  useEffect(() => {
    try {
      localStorage.setItem(DRIVE_CHECKLIST_STORAGE_KEY, JSON.stringify({ date: todayKey, items: checkedItems }));
    } catch {
      // The checklist still works in memory if storage is unavailable.
    }
  }, [checkedItems, todayKey]);

  const toggleChecklist = (id) => setCheckedItems((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const saveParkingSpot = () => {
    setParkingBusy(true);
    getCurrentPosition()
      .then(({ coords }) => {
        const nextSpot = { latitude: coords.latitude, longitude: coords.longitude, savedAt: new Date().toISOString() };
        setParkingSpot(nextSpot);
        try { localStorage.setItem(PARKING_STORAGE_KEY, JSON.stringify(nextSpot)); } catch { /* Keep the current-session position. */ }
        notify('현재 위치를 내 차 주차 위치로 저장했습니다.');
      })
      .catch((error) => notify(locationErrorMessage(error)))
      .finally(() => setParkingBusy(false));
  };

  const clearParkingSpot = () => {
    setParkingSpot(null);
    try { localStorage.removeItem(PARKING_STORAGE_KEY); } catch { /* Nothing else to clear. */ }
    notify('저장한 주차 위치를 삭제했습니다.');
  };

  const openParkingSpot = () => {
    if (!parkingSpot) return;
    window.open(`https://map.kakao.com/link/map/${encodeURIComponent('내 차 주차 위치')},${parkingSpot.latitude},${parkingSpot.longitude}`, '_blank', 'noopener,noreferrer');
  };

  const plannerState = canCompleteTrip == null
    ? { className: 'connect', eyebrow: '차량 연결 필요', title: '내 차 주행 가능 거리를 연결해 주세요.', detail: '이동 에너지와 예상 비용은 지금도 계산할 수 있어요.' }
    : canCompleteTrip
      ? { className: 'ready', eyebrow: '거리 여유 있음', title: `도착 후 약 ${Math.max(0, arrivalRange)}km가 남아요.`, detail: `${reservePercent}%의 여유를 포함해도 현재 주행 가능 거리 안에 있습니다.` }
      : { className: 'charge', eyebrow: '충전 먼저', title: `최소 ${Math.max(0, requiredRange - currentRange)}km의 여유가 더 필요해요.`, detail: '출발 전에 가까운 충전소를 확인하는 것을 권장합니다.' };

  return (
    <div className="page container drive-page">
      <PageIntro eyebrow="SMART DRIVE" title="출발부터 주차까지 한 번에" description="예상 주행 여유와 이동 비용을 계산하고, 출발 체크와 주차 위치를 관리하세요." actions={<button className="button primary" onClick={() => navigate('charge')}><BatteryCharging size={17} /> 주변 충전소</button>} />
      <FeaturePurpose icon={Route} title="오늘 이동에 필요한 판단과 기록을 한곳에 모았습니다." description="차량 연결 전에는 예상 에너지와 비용을 계산하고, 연결 후에는 실제 주행 가능 거리로 출발 여부까지 확인합니다." steps={['이동 거리 입력', '잔량·비용 판단', '주차 위치 저장']} />

      <nav className="workspace-tabs" aria-label="드라이브 도구">{[['plan', '주행·비용 계산'], ['checklist', '출발 체크'], ['parking', '주차 위치']].map(([id, label]) => <button key={id} className={driveTab === id ? 'active' : ''} aria-pressed={driveTab === id} onClick={() => { setDriveTab(id); tour.select(id === 'parking' ? 'parking' : id === 'checklist' ? 'tires' : 'road'); }}>{label}</button>)}</nav>

      {driveTab === 'plan' && <section className="drive-planner panel" id="range-planner">
        <div className="drive-planner-heading">
          <div><span>RANGE GUARD</span><h2>이번 이동, 지금 출발해도 될까요?</h2><p>왕복 또는 전체 이동 거리를 입력하면 여유 배터리까지 포함해 판단합니다.</p></div>
          {vehicle ? <div className="drive-vehicle-chip"><CarFront size={18} /><span><small>{vehicle.name}</small><strong>{formatMetric(vehicle.range, 'km')} 주행 가능</strong></span></div> : <button className="button outline" onClick={() => setModal('connect')}>내 차 연결 <ArrowRight size={15} /></button>}
        </div>
        <div className="drive-planner-grid">
          <div className="drive-inputs">
            <label><span><strong>전체 이동 거리</strong><b>{tripDistance}km</b></span><input type="range" min="10" max="600" step="10" value={tripDistance} onChange={(event) => setTripDistance(Number(event.target.value))} /></label>
            <label><span><strong>현재 잔량 중 남길 비율</strong><b>{reservePercent}%</b></span><input type="range" min="0" max="40" step="5" value={reservePercent} onChange={(event) => setReservePercent(Number(event.target.value))} /></label>
            <div className="drive-number-inputs">
              <label><span>내 차 전비</span><div><input type="number" min="1" max="15" step="0.1" value={efficiency} onChange={(event) => setEfficiency(event.target.value)} /><small>km/kWh</small></div></label>
              <label><span>충전 단가</span><div><input type="number" min="0" step="1" value={energyPrice} onChange={(event) => setEnergyPrice(event.target.value)} /><small>원/kWh</small></div></label>
            </div>
            <small className="drive-assumption">전비와 충전 단가는 차량·계절·충전소에 맞게 직접 바꿀 수 있는 계산 기준입니다.</small>
          </div>
          <div className={`drive-verdict ${plannerState.className}`} aria-live="polite">
            <span>{plannerState.eyebrow}</span><h3>{plannerState.title}</h3><p>{plannerState.detail}</p>
            <div className="drive-verdict-meter"><i style={{ width: `${currentRange == null ? 18 : Math.min(100, (currentRange / Math.max(requiredRange, 1)) * 100)}%` }} /></div>
            <div className="drive-verdict-range"><span>필요 거리 <strong>{requiredRange}km</strong></span><span>현재 가능 <strong>{formatMetric(currentRange, 'km')}</strong></span></div>
            {canCompleteTrip === false && <button onClick={() => navigate('charge')}>충전소 찾기 <ArrowRight size={15} /></button>}
          </div>
        </div>
        <div className="drive-calculation-grid" aria-label="이동 계산 결과">
          <article><CircleGauge size={18} /><span>예상 필요 에너지</span><strong>{requiredEnergy.toFixed(1)}<small>kWh</small></strong></article>
          <article><Bookmark size={18} /><span>예상 충전 비용</span><strong>{estimatedCost.toLocaleString()}<small>원</small></strong></article>
          <article><BatteryCharging size={18} /><span>최소 출발 잔량</span><strong>{minimumDepartureSoc == null ? '—' : minimumDepartureSoc}<small>{minimumDepartureSoc == null ? '' : '%'}</small></strong></article>
          <article><Navigation size={18} /><span>도착 예상 거리</span><strong>{arrivalRange == null ? '—' : Math.max(0, arrivalRange)}<small>{arrivalRange == null ? '' : 'km'}</small></strong></article>
        </div>
      </section>}

      <div className="drive-support-grid">
        {driveTab === 'checklist' && <section className="departure-check panel" id="drive-checklist">
          <div className="feature-art"><FeatureImage scene="tires" /></div>
          <div className="drive-tool-heading"><div><span>BEFORE DRIVE</span><h2>오늘의 출발 체크</h2></div><strong>{checkedCount}/{driveChecklistItems.length}</strong></div>
          <div className="departure-progress"><i style={{ width: `${(checkedCount / driveChecklistItems.length) * 100}%` }} /></div>
          <div className="departure-list">{driveChecklistItems.map((item) => {
            const checked = checkedItems.includes(item.id);
            return <button key={item.id} className={checked ? 'checked' : ''} onClick={() => toggleChecklist(item.id)} aria-pressed={checked}><span>{checked ? <Check size={16} /> : null}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div></button>;
          })}</div>
          <button className="drive-reset" onClick={() => setCheckedItems([])} disabled={!checkedCount}><RefreshCcw size={14} /> 오늘 체크 초기화</button>
        </section>}

        {driveTab === 'parking' && <section className="parking-memory panel" id="parking-memory">
          <div className="feature-art"><FeatureImage scene="parking" /></div>
          <div className="drive-tool-heading"><div><span>PARKING MEMORY</span><h2>내 차 어디에 세웠지?</h2></div><MapPin size={23} /></div>
          {parkingSpot ? <>
            <div className="parking-map-preview" aria-label="저장된 주차 위치"><i /><div><Navigation size={19} fill="currentColor" /></div><span>{parkingSpot.latitude.toFixed(4)}, {parkingSpot.longitude.toFixed(4)}</span></div>
            <div className="parking-saved"><span>저장한 시각</span><strong>{formatDateTime(parkingSpot.savedAt)}</strong><small>주차 위치는 이 기기에만 저장됩니다.</small></div>
            <div className="parking-actions"><button className="button primary" onClick={openParkingSpot}>카카오맵으로 찾기 <Navigation size={15} /></button><button className="button outline" onClick={clearParkingSpot}><Trash2 size={15} /> 삭제</button></div>
          </> : <>
            <div className="parking-empty"><MapPin size={31} /><strong>현재 위치를 주차 위치로 남겨보세요.</strong><p>다시 차로 돌아올 때 카카오맵 길찾기로 바로 이어집니다.</p></div>
            <button className="button primary full" onClick={saveParkingSpot} disabled={parkingBusy}>{parkingBusy ? <LoaderCircle className="spin" size={16} /> : <LocateFixed size={16} />}{parkingBusy ? '현재 위치 확인 중' : '이곳을 주차 위치로 저장'}</button>
          </>}
        </section>}
      </div>

      <section className="drive-next-actions">
        <div><span>NEXT</span><h2>판단 다음 행동도 바로 이어집니다.</h2></div>
        <button onClick={() => navigate('charge')}><BatteryCharging size={19} /><span><strong>충전이 필요해요</strong><small>실시간 가용 충전기 찾기</small></span><ArrowRight size={16} /></button>
        <button onClick={() => navigate('care')}><Wrench size={19} /><span><strong>차량이 걱정돼요</strong><small>경고 확인·블루핸즈 찾기</small></span><ArrowRight size={16} /></button>
        <button onClick={() => navigate('passport')}><FileCheck2 size={19} /><span><strong>기록을 확인할래요</strong><small>차량 여권과 변화 이력</small></span><ArrowRight size={16} /></button>
      </section>
    </div>
  );
}

function CarePage({ vehicle, notify, setModal, platform, actions, busy, sectionTarget }) {
  const [careTab, setCareTab] = useState(sectionTarget || (vehicle ? 'status' : 'centers'));
  useEffect(() => { if (sectionTarget) setCareTab(sectionTarget); }, [sectionTarget]);
  const [centerFeed, setCenterFeed] = useState({ centers: [], provider: null });
  const [centerBusy, setCenterBusy] = useState(true);
  const [centerError, setCenterError] = useState('');
  const [centerLocation, setCenterLocation] = useState({ current: false, label: '서울 성수 기본 위치', latitude: null, longitude: null });
  const nextAction = vehicle?.warningCount > 0
    ? { title: '경고 항목부터 확인하세요', detail: `차량 경고 ${vehicle.warningCount}건이 현대 데이터에 보고되었습니다. 가까운 서비스 거점을 확인하고 상담을 준비할 수 있습니다.`, button: '서비스 거점 보기' }
    : vehicle?.nextServiceKm != null
      ? { title: `${Number(vehicle.nextServiceKm).toLocaleString()}km 후 정기 점검 권장`, detail: '차량에 제공된 주행 기준을 바탕으로 다음 점검 시점을 안내합니다.', button: '거점 찾기' }
      : { title: '다음 운행을 위한 거점 저장', detail: '차량별 점검 주기는 현재 제공되지 않아 가까운 블루핸즈를 먼저 저장해 두는 것을 권장합니다.', button: '거점 찾기' };

  const findCenters = useCallback(async (coordinates) => {
    setCenterBusy(true);
    setCenterError('');
    setCenterLocation(coordinates ? {
      current: true,
      label: '현재 위치',
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    } : { current: false, label: '서울 성수 기본 위치', latitude: null, longitude: null });
    try {
      const result = await loadServiceCenters(coordinates);
      setCenterFeed(result);
      if (result.provider?.state === 'ERROR') {
        setCenterError('실시간 서비스 거점 연결이 잠시 지연되고 있어요.');
        notify('실시간 서비스 거점 연결이 잠시 지연되고 있어요.');
      }
    } catch (error) {
      setCenterError(error.message || '주변 서비스 거점을 불러오지 못했습니다.');
      notify(error.message || '주변 서비스 거점을 불러오지 못했습니다.');
    } finally {
      setCenterBusy(false);
    }
  }, [notify]);

  const findFromCurrentLocation = useCallback(() => {
    setCenterBusy(true);
    getCurrentPosition()
      .then(({ coords }) => findCenters({ latitude: coords.latitude, longitude: coords.longitude, radius: 20000 }))
      .catch((error) => { setCenterBusy(false); notify(locationErrorMessage(error)); });
  }, [findCenters, notify]);

  const retryCenters = () => findCenters(centerLocation.current
    ? { latitude: centerLocation.latitude, longitude: centerLocation.longitude, radius: 20000 }
    : undefined);

  // 위치 권한을 이미 허용한 오너라면 정비소도 충전소처럼 처음부터 현재 위치를 사용합니다.
  // 처음 방문자에게 권한 팝업을 강제로 띄우지는 않고, 기본 위치를 보여준 뒤 버튼으로 선택하게 합니다.
  useEffect(() => {
    let active = true;
    if (!navigator.permissions?.query) {
      findCenters();
      return () => { active = false; };
    }
    navigator.permissions.query({ name: 'geolocation' }).then((permission) => {
      if (!active) return;
      if (permission.state === 'granted') findFromCurrentLocation();
      else findCenters();
    }).catch(() => { if (active) findCenters(); });
    return () => { active = false; };
  }, [findCenters, findFromCurrentLocation]);

  return (
    <div className="page container">
      <PageIntro eyebrow="MY CAR CARE" title="차의 신호를 놓치지 않게" description="내 차 상태와 가까운 블루핸즈를 한 화면에서 살펴보세요." actions={vehicle && <button className="button outline" onClick={() => sharePage({ title: `${vehicle.name} 차량 상태`, text: `${vehicle.checkedWarnings ?? 0}개 항목 확인 · 경고 ${vehicle.warningCount ?? 0}건`, path: '#care', notify })}><Share2 size={16} /> 상태 공유</button>} />
      <FeaturePurpose icon={Activity} title="차량 경고를 확인하고 가까운 블루핸즈를 찾는 화면입니다." description="차량 연결 후에는 배터리·주행거리·안전 경고를 확인할 수 있고, 차량 연결 전에도 주변 서비스 거점은 바로 찾을 수 있습니다." steps={['차량 상태 확인', '경고 항목 점검', '블루핸즈 찾기']} />
      <nav className="workspace-tabs" aria-label="차량 관리 도구">{[['status', '내 차 상태'], ['centers', '가까운 정비소']].map(([id, label]) => <button key={id} className={careTab === id ? 'active' : ''} aria-pressed={careTab === id} onClick={() => setCareTab(id)}>{label}</button>)}</nav>
      {careTab === 'status' && (vehicle ? <>
      <section className="vehicle-live-summary panel reveal" data-reveal>
        <div><span className="live-label"><i /> 내 차 상태</span><h2>{vehicle.name}</h2><p>{vehicle.trim} · 마지막 확인 {vehicle.updatedAt ? formatDateTime(vehicle.updatedAt) : '방금 전'}</p></div>
        <div className="live-summary-metrics"><Metric icon={BatteryCharging} label="구동 배터리" value={formatMetric(vehicle.batterySoc, '%')} detail={vehicle.batterySoc == null ? '아직 확인되지 않음' : vehicle.chargingState} /><Metric icon={Navigation} label="주행 가능" value={formatMetric(vehicle.range, 'km')} detail={vehicle.range == null ? '아직 확인되지 않음' : '최근 확인한 값'} /><Metric icon={Gauge} label="누적 주행" value={formatMetric(vehicle.odometer, 'km')} detail={vehicle.odometer == null ? '아직 확인되지 않음' : '최근 확인한 값'} /><Metric icon={Zap} label="목표 충전" value={formatMetric(vehicle.chargingTargetSoc, '%')} detail={vehicle.chargingPlugType ?? '충전기 정보 미제공'} /><Metric icon={Clock3} label="남은 충전" value={formatMetric(vehicle.chargingRemainingMinutes, '분')} detail="목표 충전까지" /></div>
        <small>확인된 정보만 보여드리고, 알 수 없는 값은 억지로 채우지 않아요. · 차량 전송 {formatHyundaiTimestamp(vehicle.dataTimestamp)}</small>
      </section>
      <section className="care-next-action panel reveal" data-reveal aria-label="다음 추천 행동">
        <div className="care-next-icon"><Route size={20} /></div>
        <div><span>NEXT BEST ACTION</span><strong>{nextAction.title}</strong><p>{nextAction.detail}</p></div>
        <button className="button outline" onClick={() => setCareTab('centers')}>{nextAction.button} <ArrowRight size={15} /></button>
      </section>
      <TirePressureCard vehicle={vehicle} onDetails={() => document.getElementById('vehicle-health')?.scrollIntoView({ behavior: 'smooth' })} />
      <section className="section-sub vehicle-health-section reveal" data-reveal id="vehicle-health">
        <div className="health-section-heading">
          <SectionHeading eyebrow="SAFETY CHECK" title="차량 경고 상태" description="계기판에서 놓치기 쉬운 안전 항목을 한눈에 확인하세요." />
          <div className={`health-result ${vehicle.warningCount > 0 ? 'warning' : vehicle.checkedWarnings > 0 ? 'clear' : 'unknown'}`}><strong>{vehicle.warningCount > 0 ? `${vehicle.warningCount}건 확인 필요` : vehicle.checkedWarnings > 0 ? '확인 항목 이상 없음' : '확인 중'}</strong><span>{vehicle.checkedWarnings ?? 0}/7개 확인</span></div>
        </div>
        <div className="health-check-grid">
          {(vehicle.healthChecks ?? []).map((check) => <article className={`health-check-card panel ${check.state.toLowerCase()}`} key={check.id}><span className="health-check-icon">{check.state === 'WARNING' ? <Wrench size={19} /> : check.state === 'CLEAR' ? <CheckCircle2 size={19} /> : <CircleGauge size={19} />}</span><div><strong>{check.label}</strong><small>{check.state === 'WARNING' ? '점검을 권해요' : check.state === 'CLEAR' ? '현재 괜찮아요' : '아직 확인되지 않음'}</small></div><b>{check.state === 'WARNING' ? '확인 필요' : check.state === 'CLEAR' ? '정상' : '확인 중'}</b></article>)}
        </div>
        {vehicle.connectedService && <div className="connected-service-card panel"><div><CloudCog size={21} /><span><small>서비스 이용 기간</small><strong>내 차 케어</strong></span></div><dl><div><dt>가입일</dt><dd>{formatHyundaiDate(vehicle.connectedService.subscribeDate)}</dd></div><div><dt>무료 이용 종료일</dt><dd>{formatHyundaiDate(vehicle.connectedService.endDate)}</dd></div></dl></div>}
      </section>
      </> : <VehicleConnectPanel onConnect={() => setModal('connect')} />)}
      {careTab === 'centers' && <section className="section-sub service-center-section" id="service-centers">
        <div className="service-center-heading">
          <SectionHeading eyebrow="CARE NEAR YOU" title="가까운 블루핸즈" description="현재 위치에서 가까운 현대자동차 서비스 거점을 찾아보세요." />
          <button className="button outline" onClick={findFromCurrentLocation} disabled={centerBusy}>{centerBusy ? <LoaderCircle className="spin" size={16} /> : <LocateFixed size={16} />} 내 위치로 다시 찾기</button>
        </div>
        <section className={`location-status ${centerLocation.current ? 'current' : 'default'}`} aria-live="polite">
          <div><MapPin size={18} /><span><small>{centerLocation.current ? '현재 위치 기준' : '기본 위치 기준'}</small><strong>{centerLocation.current ? `${centerLocation.label} · ${centerLocation.latitude.toFixed(4)}, ${centerLocation.longitude.toFixed(4)}` : centerLocation.label} · 반경 20km</strong></span></div>
          <p>{centerLocation.current ? '현재 위치를 기준으로 가까운 순서로 보여드려요.' : '내 위치로 다시 찾기를 누르면 주변 순서가 바뀝니다.'}</p>
        </section>
        <div className={`provider-inline ${centerFeed.provider?.state === 'CONNECTED' || centerFeed.provider?.state === 'STALE' ? 'live' : 'sample'}`}>
          <span>{centerBusy ? '주변 거점 확인 중' : centerError ? '연결 지연' : centerFeed.provider?.state === 'CONNECTED' ? '지금 확인됨' : centerFeed.provider?.state === 'STALE' ? '최근 확인됨' : '확인 중'}</span>
          <strong>주변 블루핸즈</strong>
          <small>{centerError ? '잠시 후 다시 확인해 주세요.' : centerFeed.provider?.state === 'CONNECTED' ? '가까운 순서로 보여드려요.' : '잠시 후 다시 확인해 주세요.'}</small>
        </div>
        <div className="service-center-grid">
          {centerFeed.centers?.slice(0, 6).map((center) => (
            <article className="service-center-card panel" key={center.id}>
              <div className="service-center-distance"><MapPin size={16} /><strong>{center.distanceKm.toFixed(1)}km</strong></div>
              <span>현대자동차 서비스</span>
              <h3>{center.name}</h3>
              <p>{center.address}</p>
              <div className="service-center-actions">
                {center.phone && <a href={`tel:${center.phone.replace(/[^0-9+]/g, '')}`}><span>{center.phone}</span><strong>전화</strong></a>}
                <button onClick={() => window.open(center.placeUrl, '_blank', 'noopener,noreferrer')}><span>지도 보기</span><strong>상세·길찾기</strong><Navigation size={14} /></button>
              </div>
            </article>
          ))}
          {centerBusy && !centerFeed.centers?.length && <div className="service-center-empty panel"><LoaderCircle className="spin" size={22} /><strong>가까운 블루핸즈를 찾는 중이에요.</strong><span>잠시만 기다려 주세요.</span></div>}
          {!centerBusy && !centerFeed.centers?.length && <div className="service-center-empty panel" role={centerError ? 'alert' : 'status'}><MapPin size={22} /><strong>{centerError ? '서비스 거점 연결이 잠시 지연되고 있어요.' : '서비스 거점을 찾지 못했습니다.'}</strong><span>{centerError ? '실시간 데이터를 받지 못했습니다. 잠시 후 다시 확인해 주세요.' : '위치 권한을 허용하거나 잠시 후 다시 시도해 주세요.'}</span>{centerError && <button className="button compact" onClick={retryCenters} disabled={centerBusy}><RefreshCcw size={14} /> 다시 확인</button>}</div>}
        </div>
      </section>}
    </div>
  );
}

function PassportPage({ vehicle, notify, setModal, passport, passportError }) {
  if (!vehicle) return <div className="page container"><PageIntro eyebrow="MY CAR STORY" title="내 차 기록을 모아보세요" description="차량을 연결하면 내 차의 중요한 정보와 기록을 한곳에서 확인할 수 있어요." /><FeaturePurpose icon={FileCheck2} title="확인된 차량 상태와 주요 변화를 시간순으로 보관하는 기능입니다." description="Life Pass가 실제로 받은 차량 정보만 기록하며, 확인되지 않은 값은 임의로 만들지 않습니다." steps={['내 차 연결', '확인된 이벤트 저장', '기록 확인·공유']} /><VehicleConnectPanel onConnect={() => setModal('connect')} /></div>;
  const timelineEvents = passport?.events ?? [];
  return (
    <div className="page container">
      <PageIntro eyebrow="MY CAR STORY" title="내 차의 시간을 한눈에" description="차량과 함께한 중요한 순간을 시간 순서로 확인하고 필요할 때 공유하세요." actions={<button className="button outline" onClick={() => sharePage({ title: `${vehicle.name} 차량 기록`, text: '내 차와 함께한 중요한 기록을 확인하세요.', path: '#passport', notify })}><Share2 size={16} /> 기록 공유</button>} />
      <FeaturePurpose icon={FileCheck2} title="확인된 차량 상태와 주요 변화를 시간순으로 보관하는 기능입니다." description="차량별 상태 이벤트의 출처를 함께 남겨, 내 차 관리 이력을 다시 확인하거나 공유할 때 활용할 수 있습니다." steps={['차량 정보 수신', '이벤트 서명·보관', '기록 확인·공유']} />
      <section className="passport-main panel reveal" data-reveal>
        <div className="passport-head"><div><span className="verified"><ShieldCheck size={15} /> 확인된 차량 기록</span><h2>{vehicle.name}</h2><p>{vehicle.trim} · {vehicle.plate}</p></div><div className="passport-id"><span>차량 기록 번호</span><strong>HLP-{vehicle.databaseId}</strong></div></div>
        <div className="passport-scores"><PassportScore label="남겨진 기록" value={passport?.signedEvents ?? 0} unit="건" note="확인 완료" /><PassportScore label="확인 경고" value={vehicle.warningCount ?? 0} unit="건" note={`${vehicle.checkedWarnings ?? 0}/7개 확인`} /><PassportScore label="배터리" value={vehicle.batterySoc ?? '—'} unit={vehicle.batterySoc == null ? '' : '%'} note={vehicle.batterySoc == null ? '아직 확인되지 않음' : '최근 확인한 값'} /><PassportScore label="누적 주행" value={vehicle.odometer == null ? '—' : vehicle.odometer.toLocaleString()} unit={vehicle.odometer == null ? '' : 'km'} note={vehicle.odometer == null ? '아직 확인되지 않음' : '최근 확인한 값'} /></div>
        <div className="passport-signature"><LockKeyhole size={16} /><span>안전하게 보관 중인 차량 기록</span><strong>내가 허락한 정보만 보여드려요</strong><CheckCircle2 size={16} /></div>
      </section>
      <section className="section-sub reveal" data-reveal>
        <SectionHeading eyebrow="YOUR CAR TIMELINE" title="차량과 함께한 순간" description="차량을 연결한 뒤 확인된 중요한 기록만 시간 순서로 보여드려요." />
        {passportError ? <div className="empty-records panel" role="alert"><AlertTriangle size={24} /><strong>차량 기록을 확인하지 못했어요.</strong><span>{passportError}</span></div> : timelineEvents.length ? <div className="timeline panel">{timelineEvents.map((event, index) => <div className="timeline-row" key={event.id}><div className="timeline-marker"><span>{index + 1}</span></div><time>{formatDate(event.occurredAt)}</time><div><span>{event.type}</span><strong>{event.title}</strong><p>{event.detail}</p></div><span className="timeline-trust"><ShieldCheck size={13} /> 확인됨</span></div>)}</div> : <div className="empty-records panel"><FileCheck2 size={24} /><strong>아직 남겨진 기록이 없어요.</strong><span>차량을 연결하고 첫 기록을 만들어 보세요.</span></div>}
      </section>
    </div>
  );
}

function SettingsPage({ vehicle, platform, actions, busy, navigate, notify }) {
  const hyundai = platform.providers?.find((provider) => provider.id === 'hyundai-connected-car');
  const connected = hyundai?.mode === 'LIVE' && ['CONNECTED', 'STALE'].includes(hyundai.state);
  const removeConnection = () => {
    if (!window.confirm('현대 계정 연결과 Life Pass에 저장된 실차 데이터를 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) return;
    actions.revokeHyundai();
  };
  return (
    <div className="page container settings-page">
      <PageIntro eyebrow="MY ACCOUNT" title="내 정보와 앱 설정" description="차량 연결과 알림, 앱 사용 방법을 편하게 관리하세요." />
      <FeaturePurpose icon={Settings2} title="현대 계정 연결과 데이터 사용 권한을 직접 관리하는 화면입니다." description="차량을 새로고침하거나 연결을 해제할 수 있습니다. 연결을 끊으면 Life Pass에 저장된 관련 실차 정보도 함께 삭제됩니다." steps={['현대 계정 연결', '차량 정보 새로고침', '연결 해제·삭제']} />
      <div className="settings-grid reveal" data-reveal>
        <section className="panel settings-card">
          <div className="settings-icon"><UserRound size={22} /></div><span>현대 계정</span><h2>{connected && hyundai?.accountName ? `${hyundai.accountName}님` : hyundaiStatusLabel(hyundai)}</h2><p>{connected && hyundai?.accountEmailMasked ? `${hyundai.accountEmailMasked} · ${hyundai.message}` : hyundai?.message ?? '연결 상태를 확인하고 있습니다.'}</p>
          {connected ? <div className="settings-actions"><button className="button primary" disabled={busy} onClick={actions.syncHyundai}><RefreshCcw size={16} /> 내 차 새로고침</button><button className="button danger" disabled={busy} onClick={removeConnection}><Trash2 size={16} /> 연결 해제·정보 삭제</button></div> : <button className="button primary" disabled={busy} onClick={actions.connectHyundai}>내 차 연결하기 <ArrowRight size={16} /></button>}
          {!connected && <div className="oauth-flow" aria-label="차량 연결 순서"><span><b>1</b>공식 로그인</span><span><b>2</b>차량 선택</span><span><b>3</b>정보 확인</span><span><b>4</b>완료</span></div>}
          {!connected && <small>버튼을 누르면 현대자동차 공식 로그인 화면으로 이동해요. 비밀번호는 이곳에 저장하지 않습니다.</small>}
          {vehicle && <small>연결 차량: {vehicle.name} · 마지막 확인 {vehicle.updatedAt ? formatDateTime(vehicle.updatedAt) : '확인 중'}</small>}
        </section>
        <section className="panel settings-card">
          <div className="settings-icon"><Smartphone size={22} /></div><span>모바일 앱</span><h2>홈 화면에 설치</h2><p>브라우저 메뉴의 ‘홈 화면에 추가’를 선택하면 앱처럼 전체 화면으로 사용할 수 있습니다.</p><InstallButton notify={notify} />
        </section>
      </div>

      <section className="panel policy-links"><button onClick={() => navigate('guide')}><Route size={18} /><span><strong>처음 사용하는 방법</strong><small>무슨 서비스이고 무엇을 연결해야 하는지</small></span><ChevronRight size={17} /></button><button onClick={() => navigate('privacy')}><LockKeyhole size={18} /><span><strong>개인정보 처리 안내</strong><small>수집·보관·철회 및 삭제 정책</small></span><ChevronRight size={17} /></button><button onClick={() => navigate('terms')}><FileCheck2 size={18} /><span><strong>서비스 이용안내</strong><small>외부 데이터와 제공 기능 범위</small></span><ChevronRight size={17} /></button><a href="https://github.com/boclair98/hyundai-life-pass/issues" target="_blank" rel="noreferrer"><Wrench size={18} /><span><strong>지원 및 오류 신고</strong><small>GitHub Issues</small></span><ChevronRight size={17} /></a></section>
    </div>
  );
}

function InstallButton({ notify, compact = false }) {
  const [installPrompt, setInstallPrompt] = useState(null);
  useEffect(() => {
    const onPrompt = (event) => { event.preventDefault(); setInstallPrompt(event); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);
  const install = async () => {
    if (!installPrompt) {
      notify(/iphone|ipad|ipod/i.test(navigator.userAgent) ? 'Safari 공유 버튼에서 ‘홈 화면에 추가’를 선택해 주세요.' : '브라우저 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택해 주세요.');
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };
  return <button className={`button outline ${compact ? 'compact' : ''}`} onClick={install}><Smartphone size={16} /> {compact ? '앱으로 저장' : '설치 방법 보기'}</button>;
}

function VehicleConnectPanel({ onConnect, compact = false }) {
  return <section className={`vehicle-connect-panel panel ${compact ? 'compact' : ''}`}><div className="connect-orbit"><CarFront size={26} /></div><div><span>MY HYUNDAI CAR</span><h2>아직 연결된 차량이 없어요.</h2><p>현대자동차 공식 로그인에서 내 차를 선택하면 배터리·주행거리·안전 점검을 한눈에 볼 수 있어요.</p></div><button className="button primary" onClick={onConnect}>내 차 연결하기 <ArrowRight size={16} /></button></section>;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatMetric(value, unit) {
  return value == null ? '미제공' : `${Number(value).toLocaleString()}${unit}`;
}

function formatHyundaiTimestamp(value) {
  if (!value || !/^\d{14}$/.test(value)) return '시각 미제공';
  return `${value.slice(4, 6)}.${value.slice(6, 8)} ${value.slice(8, 10)}:${value.slice(10, 12)}`;
}

function formatHyundaiDate(value) {
  if (!value || !/^\d{8}$/.test(value)) return '미제공';
  return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value));
}

function SectionHeading({ eyebrow, title, description }) {
  return <div className="section-heading"><span>{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>;
}

function PageIntro({ eyebrow, title, description, actions }) {
  return <section className="workspace-heading"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{actions && <div className="workspace-heading-actions">{actions}</div>}</section>;
}

function FeaturePurpose({ icon: Icon, title, description, steps }) {
  return <details className="feature-help"><summary><Icon size={16} /> 이용 방법 <ChevronDown size={14} /></summary><strong>{title}</strong><p>{description}</p><ol>{steps.map((step) => <li key={step}>{step}</li>)}</ol></details>;
}

function Metric({ icon: Icon, label, value, detail }) {
  return <div className="metric"><Icon size={19} /><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>;
}

function PassportScore({ label, value, unit, note }) {
  return <div className="passport-score"><span>{label}</span><div><strong>{value}</strong><small>{unit}</small></div><em><Check size={11} />{note}</em></div>;
}

function SiteFooter({ navigate }) {
  const labMode = new URLSearchParams(window.location.search).get('lab') === '1';
  return (
    <footer className="site-footer">
      <div className="container">
        <div><strong>HYUNDAI LIFE PASS</strong><span>내 차를 더 잘 알고, 더 편하게 돌보는 하루</span></div>
        <nav aria-label="서비스 정책"><button onClick={() => navigate('guide')}>처음 이용하기</button><button onClick={() => navigate('settings')}>내 정보</button><button onClick={() => navigate('privacy')}>개인정보 안내</button><button onClick={() => navigate('terms')}>이용 안내</button>{labMode && <><button onClick={() => navigate('proposal')}>현대차 제안</button><button onClick={() => navigate('canary')}>SDV 운영 데모</button></>}</nav>
        <small>차량 정보는 사용자가 허락한 범위에서만 확인합니다. 현대자동차 공식 서비스와는 별개의 서비스입니다.</small>
      </div>
    </footer>
  );
}

function GuidePage({ navigate }) {
  return (
    <div className="page container guide-page">
      <PageIntro eyebrow="START HERE" title="내 차 생활, 이렇게 시작해요" description="차량을 연결하면 내 차 상태를 보고, 연결하지 않아도 충전소와 블루핸즈를 먼저 찾아볼 수 있어요." />
      <section className="guide-steps reveal" data-reveal>
        <article className="panel"><span>01 · 바로 이용</span><div><BatteryCharging size={22} /><h2>내 주변 충전</h2></div><p>내 위치를 허용하면 가까운 충전소와 사용 가능한 충전기를 찾아 길 안내까지 이어집니다.</p><button className="button outline" onClick={() => navigate('charge')}>충전소 찾기 <ArrowRight size={15} /></button></article>
        <article className="panel"><span>02 · 바로 이용</span><div><Wrench size={22} /><h2>가까운 블루핸즈</h2></div><p>현재 위치에서 가까운 서비스 거점을 보고 전화하거나 길 안내를 시작할 수 있어요.</p><button className="button outline" onClick={() => navigate('care')}>서비스 거점 찾기 <ArrowRight size={15} /></button></article>
        <article className="panel"><span>03 · 내 차 등록</span><div><CarFront size={22} /><h2>내 차 한눈에 보기</h2></div><p>현대 공식 로그인에서 내 차를 연결하면 배터리·주행거리·타이어와 안전 점검을 확인합니다.</p><button className="button primary" onClick={() => navigate('settings')}>내 차 연결하기 <ArrowRight size={15} /></button></article>
      </section>
      <section className="panel capability-table reveal" data-reveal>
        <div><span>지금 이용 가능</span><strong>내 주변 충전소·블루핸즈 찾기, 전화·길 안내, 현대 계정 연결, 배터리·주행거리·안전 점검 확인</strong></div>
        <div><span>내 차를 연결하면</span><strong>차량별 상태와 중요한 기록을 내 차 기준으로 모아볼 수 있어요.</strong></div>
        <div><span>안심 약속</span><strong>모르는 정보는 비워두고, 허락한 정보만 보여드려요.</strong></div>
      </section>
      <section className="guide-trust-panel panel reveal" data-reveal><div><ShieldCheck size={22} /><span><strong>내 차 정보는 내 허락부터</strong><small>연결할 정보와 연결을 끊는 방법을 언제든 직접 선택할 수 있어요.</small></span></div><div><MapPin size={22} /><span><strong>주변 생활은 빠르게</strong><small>충전소와 블루핸즈는 로그인 없이도 내 위치 기준으로 찾아볼 수 있어요.</small></span></div><div><HeartHandshake size={22} /><span><strong>모르는 값은 만들지 않아요</strong><small>확인되지 않은 숫자는 비워두고, 실제로 확인된 내용만 보여드려요.</small></span></div></section>
    </div>
  );
}

function ProposalPage({ navigate }) {
  const pillars = [
    { number: '01', icon: Activity, title: '차량 신호를 오늘의 행동으로', description: '배터리·주행거리·안전 신호를 한 번에 읽고, 충전·점검·출발 확인으로 바로 이어집니다.' },
    { number: '02', icon: MapPin, title: '차량 밖의 생활까지 연결', description: '내 위치 주변 충전소와 서비스 거점을 같은 흐름 안에서 발견하고 길 안내까지 이어갑니다.' },
    { number: '03', icon: FileCheck2, title: '차량의 시간을 오래 보존', description: '직접 남긴 정비·충전·지출 기록과 차량에서 받은 정보를 구분해 내 차의 맥락을 쌓습니다.' },
  ];
  const flow = [
    { icon: CarFront, title: '연결', detail: '사용자가 허락한 현대 계정과 차량만 불러옵니다.' },
    { icon: ShieldCheck, title: '해석', detail: '받은 값과 마지막 확인 시점을 분명하게 보여줍니다.' },
    { icon: Route, title: '행동', detail: '충전·케어·주행·기록 중 다음 한 가지를 제안합니다.' },
  ];
  return <div className="page container proposal-page">
    <PageIntro eyebrow="HYUNDAI MOBILITY PROPOSAL" title="차량을 연결하는 순간, 생활이 먼저 움직입니다." description="HYUNDAI LIFE PASS는 차량 상태를 보여주는 화면에서 멈추지 않고, 오늘 필요한 다음 행동까지 이어주는 오너 경험을 제안합니다." actions={<button className="button light" onClick={() => navigate('home')}>서비스 직접 체험 <ArrowRight size={15} /></button>} />
    <section className="proposal-intent panel reveal" data-reveal>
      <div><span>WHY LIFE PASS</span><h2>차를 아는 일과<br />잘 쓰는 일을 하나로.</h2></div>
      <p>오너는 여러 화면을 오가며 배터리, 정비, 충전, 기록을 따로 확인하지 않아도 됩니다. LIFE PASS는 현대차에서 받은 신호를 생활의 언어로 바꾸고, 필요한 순간에 한 번의 행동으로 연결합니다.</p>
    </section>
    <section className="proposal-pillars" aria-label="서비스 핵심 가치">{pillars.map(({ number, icon: Icon, title, description }) => <article className="proposal-pillar panel reveal" data-reveal key={number}><span>{number}</span><div className="proposal-pillar-icon"><Icon size={20} /></div><h3>{title}</h3><p>{description}</p></article>)}</section>
    <section className="proposal-flow panel reveal" data-reveal>
      <div className="proposal-section-heading"><span>ONE OWNER FLOW</span><h2>연결부터 다음 행동까지, 세 장면으로.</h2><p>복잡한 기능 목록 대신 오너가 실제로 겪는 흐름으로 경험을 설계했습니다.</p></div>
      <div className="proposal-flow-grid">{flow.map(({ icon: Icon, title, detail }, index) => <div key={title} className="proposal-flow-step"><b>0{index + 1}</b><div className="proposal-flow-icon"><Icon size={19} /></div><h3>{title}</h3><p>{detail}</p>{index < flow.length - 1 && <ArrowRight className="proposal-flow-arrow" size={17} />}</div>)}</div>
    </section>
    <section className="proposal-trust-grid" aria-label="출시 원칙">
      <article className="proposal-trust panel"><ShieldCheck size={22} /><div><span>TRUST BY DESIGN</span><h3>허락한 정보만, 확인된 값만</h3><p>연결 범위·최근 수신 시점·제공되지 않은 항목을 숨기지 않고 안내합니다.</p></div></article>
      <article className="proposal-trust panel"><CheckCircle2 size={22} /><div><span>READY TO PILOT</span><h3>작게 검증하고 크게 확장</h3><p>오너의 충전·케어·기록 여정을 먼저 검증한 뒤 차량 라인업과 파트너 서비스로 넓힐 수 있습니다.</p></div></article>
    </section>
    <section className="proposal-next panel"><div><span>NEXT WITH HYUNDAI</span><h2>현대차 오너 경험의 다음 장면을 함께 만듭니다.</h2><p>현재 공개 베타에서 흐름을 확인할 수 있습니다. 상용 출시에는 현대자동차의 공식 승인과 파트너·법무 검토가 필요합니다.</p></div><div className="proposal-next-actions"><button className="button primary" onClick={() => navigate('home')}>공개 베타 둘러보기 <ArrowRight size={15} /></button><button className="button outline" onClick={() => navigate('settings')}>차량 연결 흐름 보기 <CarFront size={15} /></button><button className="button outline" onClick={() => navigate('canary')}>SDV 운영 데모 <Activity size={15} /></button></div></section>
  </div>;
}

const canaryStatus = {
  ROLLING: { label: '배포 진행 중', tone: 'rolling', icon: Activity },
  COMPLETE: { label: '배포 완료', tone: 'complete', icon: CheckCircle2 },
  PAUSED: { label: '자동 보호 모드', tone: 'paused', icon: AlertTriangle },
  DRAFT: { label: '검토 대기', tone: 'draft', icon: Clock3 },
};

function CanaryPage({ navigate }) {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await loadReleases();
      setReleases(Array.isArray(result) ? result : []);
      setUpdatedAt(new Date());
    } catch (failure) {
      setError(failure.message || '릴리스 상태를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const rolling = releases.filter((item) => item.status === 'ROLLING').length;
  const paused = releases.filter((item) => item.status === 'PAUSED').length;
  const averageProgress = releases.length ? Math.round(releases.reduce((sum, item) => sum + Number(item.progress || 0), 0) / releases.length) : 0;
  const requirements = [
    { label: '차량 배포 신호', title: '대상·진행률·실패 사유', detail: '현대차 운영 시스템에서 릴리스 이벤트와 롤백 상태를 받아야 합니다.', tone: 'blue' },
    { label: '보호 규칙', title: '이상 징후 자동 중지', detail: '차량 안전 지표와 운영 승인 규칙을 연결해야 합니다.', tone: 'mint' },
    { label: '운영 권한', title: '담당자만 실행·승인', detail: '현대차 내부 계정과 권한 체계를 연동해야 합니다.', tone: 'violet' },
  ];

  return <div className="page container canary-page">
    <PageIntro eyebrow="SDV / CANARY LAB" title="배포 전에, 차량의 리스크를 먼저 읽습니다." description="실차 명령 없이 OTA 릴리스 진행률과 보호 상태를 검토하는 읽기 전용 공간입니다." actions={<><button className="button light" onClick={() => navigate('proposal')}>제안 배경 <ArrowRight size={15} /></button><button className="button light" onClick={refresh} disabled={loading}>{loading ? <LoaderCircle className="spin" size={15} /> : <RefreshCcw size={15} />} 새로고침</button></>} />
    <section className="canary-notice panel" role="note"><div className="canary-notice-icon"><ShieldCheck size={20} /></div><div><span>PUBLIC BETA · READ ONLY</span><strong>현재 화면은 릴리스 구조를 확인하는 공개 데모입니다.</strong><p>실차 OTA 실행이나 차량 제어는 하지 않습니다. 아래 값은 서비스 API가 반환한 릴리스 상태이며, 운영 전환에는 현대차 승인·운영 계정·차량 이벤트 연동이 필요합니다.</p></div></section>
    <section className="canary-overview" aria-label="릴리스 요약"><article className="panel"><span>확인한 릴리스</span><strong>{loading ? '—' : releases.length}</strong><small>최근 API 응답 기준</small></article><article className="panel"><span>진행 중</span><strong>{loading ? '—' : rolling}</strong><small>자동으로 상태를 확인</small></article><article className="panel"><span>보호 모드</span><strong className={paused ? 'warn' : ''}>{loading ? '—' : paused}</strong><small>검토가 필요한 흐름</small></article><article className="panel"><span>평균 진행률</span><strong>{loading ? '—' : `${averageProgress}%`}</strong><small>{updatedAt ? `마지막 확인 ${formatTime(updatedAt)}` : '확인 중'}</small></article></section>
    <section className="canary-release-section"><div className="canary-section-heading"><div><span>RELEASE STREAM</span><h2>차량에 전달되는 변경을 한눈에</h2><p>위험도가 올라가면 먼저 멈추고 검토하는 흐름을 보여줍니다.</p></div><span className={`canary-data-badge ${error ? 'error' : ''}`}><i /> API 상태 {error ? '확인 필요' : loading ? '확인 중' : '연결됨'}</span></div>
      {error ? <div className="canary-empty panel" role="alert"><AlertTriangle size={22} /><strong>릴리스 상태를 확인하지 못했어요.</strong><p>{error}</p><button className="button compact" onClick={refresh} disabled={loading}><RefreshCcw size={14} /> 다시 시도</button></div> : loading ? <div className="canary-empty panel" role="status"><LoaderCircle className="spin" size={22} /><strong>릴리스 상태를 불러오는 중이에요.</strong><p>서비스 API와 연결하고 있습니다.</p></div> : releases.length ? <div className="canary-release-grid">{releases.map((release) => {
        const meta = canaryStatus[release.status] ?? canaryStatus.DRAFT;
        const Icon = meta.icon;
        return <article className={`canary-release-card panel ${meta.tone}`} key={release.id}><div className="canary-release-top"><span>{release.version}</span><strong><Icon size={14} />{meta.label}</strong></div><h3>{release.title}</h3><p>{release.target}</p><div className="canary-progress-label"><span>진행률</span><b>{Number(release.progress || 0)}%</b></div><div className="canary-progress" aria-label={`${release.title} 진행률 ${release.progress}%`}><i style={{ width: `${Math.max(0, Math.min(100, Number(release.progress || 0)))}%` }} /></div><div className="canary-release-meta"><span><ShieldCheck size={13} /> 위험도 {release.risk === 'Review' ? '검토 필요' : '낮음'}</span><time>{release.createdAt ? formatDateTime(release.createdAt) : '시각 미제공'}</time></div></article>;
      })}</div> : <div className="canary-empty panel" role="status"><Activity size={22} /><strong>확인할 릴리스가 없습니다.</strong><p>운영 API가 릴리스 정보를 반환하면 이곳에 표시됩니다.</p></div>}
    </section>
    <section className="canary-requirements panel"><div className="canary-section-heading"><div><span>NEXT CONNECTIONS</span><h2>상용화를 위해 필요한 연결</h2><p>지금은 구조를 확인하고, 아래 연동이 승인되면 실제 운영 흐름으로 확장할 수 있습니다.</p></div></div><div className="canary-requirement-grid">{requirements.map(({ label, title, detail, tone }) => <article className={`canary-requirement ${tone}`} key={label}><span>{label}</span><h3>{title}</h3><p>{detail}</p></article>)}</div></section>
    <section className="canary-bottom-actions"><button className="button primary" onClick={() => navigate('home')}>오너 서비스로 돌아가기 <ArrowRight size={15} /></button><button className="button outline" onClick={() => navigate('settings')}>현대 계정 연결 흐름 <CarFront size={15} /></button></section>
  </div>;
}

function LegalPage({ type }) {
  const privacy = type === 'privacy';
  return (
    <div className="page container legal-page">
      <PageIntro eyebrow={privacy ? 'YOUR PRIVACY' : 'SERVICE GUIDE'} title={privacy ? '개인정보 처리 안내' : '서비스 이용안내'} description="차량 생활을 편하게 돕는 동안 내 정보가 어떻게 다뤄지는지 쉽게 알려드려요." />
      <section className="panel legal-card">
        <span>2026년 9월 6일 기준</span>
        {privacy ? <>
          <h2>무엇을 확인하나요?</h2><p>차량을 연결하기 전에는 서비스 이용에 필요한 최소 정보만 사용합니다. 차량을 연결한 뒤에는 내가 허락한 범위에서 차종·주행거리·배터리·충전 상태·안전 점검 정보를 확인합니다.</p>
          <h2>직접 남기는 관리 기록</h2><p>입력한 정비·충전·주유 등의 날짜, 비용, 주행거리와 메모, 예정 일정은 연결한 차량에 묶어 서버에 저장합니다. 같은 계정으로 확인할 수 있으며 다른 계정에는 공개하지 않습니다. 보관함 이동은 삭제가 아니므로 기록을 복원할 수 있습니다. 메모에는 주민등록번호나 결제 비밀번호처럼 민감한 정보를 적지 마세요.</p>
          <h2>어떻게 지키나요?</h2><p>계정과 차량 소유권을 확인한 뒤 차량 기록에 접근할 수 있도록 제한합니다. 현대 계정 비밀번호는 이곳에 저장하지 않습니다. 기록을 내려받으면 파일은 이용자의 기기에 남으므로 직접 관리해 주세요.</p>
          <h2>언제든 끊을 수 있어요</h2><p>설정에서 ‘연결 해제·정보 삭제’를 누르면 차량 연결과 함께 저장된 관련 정보도 삭제합니다.</p>
          <h2>위치 정보는요?</h2><p>위치 권한을 허용하면 주변 충전소와 블루핸즈를 검색할 때 현재 위치를 사용합니다. ‘주차 위치로 저장’을 선택한 위치는 이 기기의 브라우저에 보관하며 주차 화면에서 지울 수 있습니다. 길찾기를 누르면 선택한 위치를 카카오맵에 전달합니다. 즐겨찾기와 출발 체크도 이 브라우저에 저장됩니다.</p>
        </> : <>
          <h2>무엇을 할 수 있나요?</h2><p>주변 충전소와 블루핸즈를 찾고, 전화와 길 안내를 이용할 수 있어요. 주행 비용 계산, 출발 체크, 주차 위치 저장도 제공합니다. 차량을 연결하면 내 차 상태를 확인하고 관리 기록과 지출·예정 일정을 남길 수 있습니다.</p>
          <h2>관리 기록과 일정의 범위</h2><p>직접 입력한 기록은 공식 정비 이력이나 정비소 예약이 아닙니다. 예정 일정은 앱 안에서 확인하며 푸시 알림은 제공하지 않습니다. 차량에서 받은 정보는 별도 기록 탭에서 구분해 보여드립니다.</p>
          <h2>출발 전 한 번 더 확인해 주세요</h2><p>충전기 사용 가능 여부와 서비스 거점 운영 시간은 현장 상황에 따라 달라질 수 있습니다. 출발 전 한 번 더 확인하면 더 안심할 수 있어요.</p>
          <h2>현대자동차와의 관계</h2><p>HYUNDAI LIFE PASS는 현대자동차 공식 홈페이지가 아닌 독립 서비스입니다. 차량 정보는 사용자가 직접 허락한 경우에만 확인합니다.</p>
          <h2>화면 이미지 안내</h2><p>배경과 기능 안내 이미지는 생성형 이미지로 연출한 장면입니다. 실제 사용자 차량, 충전소 시설, 차량 구조나 정비 결과를 촬영한 사진이 아닙니다. 차량 수치와 위치 정보는 별도로 표시합니다.</p>
        </>}
        <div className="legal-contact"><strong>문의 및 개선 제안</strong><a href="https://github.com/boclair98/hyundai-life-pass/issues" target="_blank" rel="noreferrer">GitHub Issues에서 문의하기 <ArrowRight size={14} /></a></div>
      </section>
    </div>
  );
}

function MobileNav({ page, navigate }) {
  return <nav className="mobile-nav" aria-label="모바일 주요 메뉴">{primaryNavigation.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={21} /><span>{label}</span></button>)}</nav>;
}

function Modal({ vehicle, platform, close, notify, actions, busy }) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = document.querySelector('[role="dialog"]');
    const focusable = () => [...(dialog?.querySelectorAll('button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]') ?? [])];
    focusable()[0]?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { closeRef.current(); return; }
      if (event.key !== 'Tab') return;
      const items = focusable(), first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, []);
  const hyundai = platform.providers?.find((provider) => provider.id === 'hyundai-connected-car');
  const connected = hyundai?.mode === 'LIVE' && ['CONNECTED', 'STALE'].includes(hyundai.state);
  const content = { eyebrow: 'MY HYUNDAI CAR', title: connected ? '내 차가 연결되어 있어요.' : '내 차를 연결해 보세요.', description: hyundai?.mode === 'LIVE' ? '현대자동차 공식 로그인 화면에서 내 차를 선택하고 확인할 정보만 직접 허락합니다. 비밀번호는 이곳에 저장하지 않습니다.' : '잠시 후 다시 시도하면 현대자동차 공식 로그인과 차량 확인을 시작할 수 있어요.', button: connected ? '내 차 새로고침' : hyundai?.state === 'CONSENT_REQUIRED' ? '정보 확인 계속하기' : hyundai?.mode === 'LIVE' && hyundai.state !== 'MISCONFIGURED' ? '현대 계정으로 연결' : '연결 상태 확인' };
  const submit = async () => {
    if (connected) return actions.syncHyundai();
    if (hyundai?.mode === 'LIVE' && hyundai.state === 'CONSENT_REQUIRED') return actions.resumeHyundaiAgreement();
    if (hyundai?.mode === 'LIVE' && !['MISCONFIGURED', 'ERROR'].includes(hyundai.state)) return actions.connectHyundai();
    notify('현재 차량 연결 상태를 확인하고 있어요. 잠시 후 다시 시도해 주세요.');
    return false;
  };
  return <div className="modal-backdrop" onMouseDown={(event) => event.currentTarget === event.target && close()}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-description"><button className="modal-close" onClick={close} aria-label="닫기"><X size={19} /></button><div className="modal-icon"><UserRound size={22} /></div><span>{content.eyebrow}</span><h2 id="modal-title">{content.title}</h2><p id="modal-description">{content.description}</p><div className="connected-vehicle-preview"><CarFront size={20} /><div><strong>{vehicle?.name ?? '내 현대차 연결'}</strong><span>{vehicle ? `${vehicle.plate} · ${vehicle.trim}` : '로그인 후 연결할 차량을 선택해요.'}</span></div>{vehicle && <CheckCircle2 size={18} />}</div><button className="button primary full" disabled={busy} onClick={submit}>{busy ? <LoaderCircle className="spin" size={16} /> : null}{content.button}<ArrowRight size={16} /></button><small>차량 정보는 내가 허락한 범위에서만 확인하고, 연결을 끊으면 관련 정보도 함께 삭제됩니다.</small></div></div>;
}
