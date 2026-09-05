import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BatteryCharging,
  Bookmark,
  Bell,
  CalendarClock,
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
  KeyRound,
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
  ThermometerSun,
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
  readNotification,
  revokeHyundaiConnection,
  syncHyundaiVehicles,
  loadVehicles,
} from './api';
import './app.css';

const navigation = [
  { id: 'home', label: '홈', icon: CarFront },
  { id: 'charge', label: '충전', icon: BatteryCharging },
  { id: 'care', label: '내 차 케어', icon: Activity },
  { id: 'passport', label: '차량 여권', icon: FileCheck2 },
  { id: 'settings', label: '설정', icon: Settings2 },
];

const homeScenes = [
  { id: '01', label: '무엇인가' },
  { id: '02', label: '문제 해결' },
  { id: '03', label: '바로 쓰기' },
  { id: '04', label: '내 차' },
  { id: '05', label: '시작하기' },
];

const spaceGallery = [
  { src: '/space-drive-01-v1.webp', eyebrow: 'LUNAR STATUS', title: '달 위에서도 선명한 내 차 상태' },
  { src: '/space-drive-02-v1.webp', eyebrow: 'ORBIT ROUTE', title: '필요한 곳까지 이어지는 경로' },
  { src: '/space-drive-03-v1.webp', eyebrow: 'MARS CHARGE', title: '충전이 필요할 때 바로 찾기' },
  { src: '/space-drive-04-v1.webp', eyebrow: 'DEEP SPACE CARE', title: '차량 신호를 놓치지 않는 점검' },
  { src: '/space-drive-05-v1.webp', eyebrow: 'ASTEROID DRIVE', title: '이동 중에도 이어지는 관리' },
  { src: '/space-drive-06-v1.webp', eyebrow: 'SATURN RANGE', title: '주행 가능 거리까지 한눈에' },
  { src: '/space-drive-07-v1.webp', eyebrow: 'AURORA SAFETY', title: '출발 전 확인하는 안전 신호' },
  { src: '/space-drive-08-v1.webp', eyebrow: 'LIFE PASS ARRIVAL', title: '모든 차량 생활을 한곳으로' },
];

const pageHeroVisuals = {
  'CHARGE NEAR YOU': { src: '/space-drive-03-v1.webp', index: '01', label: 'ENERGY & ROUTE' },
  'MY CAR CARE': { src: '/space-drive-04-v1.webp', index: '02', label: 'STATUS & CARE' },
  'MY CAR STORY': { src: '/space-drive-05-v1.webp', index: '03', label: 'TRUSTED HISTORY' },
  'MY ACCOUNT': { src: '/space-drive-06-v1.webp', index: '04', label: 'CONNECTION & CONTROL' },
  'START HERE': { src: '/space-drive-02-v1.webp', index: '05', label: 'FIRST ORBIT' },
  'YOUR PRIVACY': { src: '/space-drive-07-v1.webp', index: '06', label: 'CONSENT & PRIVACY' },
  'SERVICE GUIDE': { src: '/space-drive-01-v1.webp', index: '07', label: 'SERVICE BOUNDARY' },
};

const validPages = new Set([...navigation.map((item) => item.id), 'privacy', 'terms', 'guide']);

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

function vehicleReadiness(vehicle) {
  const checked = Number(vehicle?.checkedWarnings ?? 0);
  const warnings = Number(vehicle?.warningCount ?? 0);
  if (!checked) return null;
  return Math.max(0, Math.round(((checked - warnings) / checked) * 100));
}

function getCurrentPosition() {
  if (!navigator.geolocation) return Promise.reject({ code: 'UNSUPPORTED' });
  if (!window.isSecureContext && window.location.hostname !== 'localhost') return Promise.reject({ code: 'INSECURE_CONTEXT' });
  return new Promise((resolve, reject) => {
    let retried = false;
    const retryOrReject = (error) => {
      if (!retried && [2, 3].includes(error?.code)) {
        retried = true;
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 120000 });
        return;
      }
      reject(error);
    };
    try {
      navigator.geolocation.getCurrentPosition(resolve, retryOrReject, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
    } catch (error) {
      reject(error);
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
  const [activeScene, setActiveScene] = useState('01');
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [dataSource, setDataSource] = useState('loading');
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [platform, setPlatform] = useState({ stations: [], chargingReservations: [], serviceBookings: [], handovers: [], notifications: [], unreadNotifications: 0, environment: 'LOADING', providers: [] });
  const [passport, setPassport] = useState(null);
  const [refreshError, setRefreshError] = useState('');

  const vehicle = vehicles.find((item) => item.id === selectedVehicleId) ?? vehicles[0] ?? null;

  useEffect(() => {
    loadVehicles().then((result) => {
      setVehicles(result.vehicles);
      setDataSource(result.source);
      if (!result.vehicles.some((item) => item.id === selectedVehicleId)) {
        setSelectedVehicleId(result.vehicles[0]?.id ?? '');
      }
    });
  }, []);

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
    if (!vehicle?.databaseId) return;
    loadPassport(vehicle.databaseId).then(setPassport).catch(() => setPassport(null));
  }, [vehicle?.databaseId]);

  useEffect(() => {
    const onHashChange = () => {
      const nextPage = window.location.hash.replace('#', '');
      if (validPages.has(nextPage)) setPage(nextPage);
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
    if (page !== 'home') return undefined;
    const scenes = [...document.querySelectorAll('[data-scene]')];
    if (!scenes.length || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveScene(visible.target.dataset.scene);
    }, { threshold: [0.18, 0.35, 0.55], rootMargin: '-12% 0px -42% 0px' });
    scenes.forEach((scene) => observer.observe(scene));
    return () => observer.disconnect();
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

  function navigate(nextPage) {
    setPage(nextPage);
    setMenuOpen(false);
    window.location.hash = nextPage;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const notify = useCallback((message) => setToast(message), []);

  async function transact(work, message) {
    setBusy(true);
    try {
      await work();
      await refreshPlatform();
      const refreshedVehicles = await loadVehicles();
      setVehicles(refreshedVehicles.vehicles);
      setDataSource(refreshedVehicles.source);
      if (vehicle?.databaseId) setPassport(await loadPassport(vehicle.databaseId));
      notify(message);
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

  const shared = { vehicle, navigate, notify, setModal, platform, passport, actions, busy };

  return (
    <div className={`app page-${page}`} ref={appRef}>
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
        dataSource={dataSource}
        notify={notify}
        platform={platform}
        actions={actions}
        busy={busy}
      />

      {page === 'home' && <SceneRail activeScene={activeScene} />}

      {page !== 'home' && <DataProvenanceBar platform={platform} actions={actions} busy={busy} />}
      {page !== 'home' && refreshError && <div className="connectivity-banner" role="alert"><span>일부 정보를 아직 불러오지 못했어요.</span><button onClick={() => refreshPlatform().catch(() => undefined)}>다시 시도</button></div>}

      <main>
        {page === 'home' && <HomePage {...shared} />}
        {page === 'charge' && <ChargePage {...shared} />}
        {page === 'care' && <CarePage {...shared} />}
        {page === 'passport' && <PassportPage {...shared} />}
        {page === 'settings' && <SettingsPage {...shared} />}
        {page === 'privacy' && <LegalPage type="privacy" />}
        {page === 'terms' && <LegalPage type="terms" />}
        {page === 'guide' && <GuidePage navigate={navigate} />}
      </main>

      <SiteFooter navigate={navigate} />
      <MobileNav page={page} navigate={navigate} />
      {modal && <Modal type={modal} vehicle={vehicle} platform={platform} close={() => setModal(null)} notify={notify} navigate={navigate} actions={actions} busy={busy} />}
      {toast && <div className="toast" role="status"><Check size={15} />{toast}</div>}
    </div>
  );
}

function SceneRail({ activeScene }) {
  const jumpTo = (id) => document.querySelector(`[data-scene="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <nav className="scene-rail" aria-label="홈 화면 장면 이동">
      {homeScenes.map((scene) => (
        <button key={scene.id} className={activeScene === scene.id ? 'active' : ''} onClick={() => jumpTo(scene.id)} aria-label={`${scene.id} ${scene.label} 장면으로 이동`} aria-current={activeScene === scene.id ? 'step' : undefined}>
          <span>{scene.id}</span><i /><small>{scene.label}</small>
        </button>
      ))}
    </nav>
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
          <span className="provenance-mobile-summary">{carReady ? '내 차 상태가 준비됐어요' : '충전·정비는 바로 이용할 수 있어요'}</span>
          <button className="provenance-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>상태 보기 <ChevronDown size={14} /></button>
        </div>
        <div className="provenance-details">
          <div className="provider-list">
            <span className={carReady ? 'live' : 'sample'}><i />내 차 상태: {carReady ? '최신 상태 확인' : '차량 연결 후 확인'}</span>
            <span className={chargerReady ? 'live' : 'sample'}><i />주변 충전·정비: {chargerReady ? '지금 이용 가능' : '잠시 확인 중'}</span>
          </div>
          <small>{carReady ? '차량 상태와 주변 생활 정보를 한곳에서 확인할 수 있어요.' : '차량을 연결하지 않아도 주변 충전소와 블루핸즈를 먼저 찾아볼 수 있어요.'}</small>
          {hyundai?.mode === 'LIVE' && ['OAUTH_REQUIRED', 'REVOKED'].includes(hyundai.state) && <button className="provenance-action" disabled={busy} onClick={actions.connectHyundai}>{hyundai.state === 'REVOKED' ? '다시 연결' : '현대 계정 연결'}</button>}
          {hyundai?.mode === 'LIVE' && hyundai.state === 'CONSENT_REQUIRED' && <button className="provenance-action" disabled={busy} onClick={actions.resumeHyundaiAgreement}>동의 계속하기</button>}
        </div>
      </div>
    </aside>
  );
}

function Header({ page, navigate, menuOpen, setMenuOpen, vehicle, vehicles, selectedVehicleId, setSelectedVehicleId, dataSource, notify, platform, actions, busy }) {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const hyundai = platform.providers?.find((provider) => provider.id === 'hyundai-connected-car');
  const connected = hyundai?.mode === 'LIVE' && ['CONNECTED', 'STALE'].includes(hyundai.state);
  const accountAction = () => {
    if (connected) return actions.syncHyundai();
    if (hyundai?.mode === 'LIVE' && hyundai.state === 'CONSENT_REQUIRED') return actions.resumeHyundaiAgreement();
    if (hyundai?.mode === 'LIVE' && !['MISCONFIGURED', 'ERROR'].includes(hyundai.state)) return actions.connectHyundai();
    notify('잠시 후 다시 시도하거나 현대 계정 연결 상태를 확인해 주세요.');
  };
  return (
    <header className="site-header">
      <div className="header-inner">
        <button className="brand" onClick={() => navigate('home')} aria-label="라이프패스 홈">
          <span className="life-mark" aria-hidden="true"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" /><path d="M13 13v18h11" /><path d="M25 31V13h5a6 6 0 0 1 0 12h-5" /><circle className="life-mark-dot" cx="35" cy="9" r="2.5" /></svg></span>
          <span className="brand-copy"><strong>LIFE PASS</strong><small>HYUNDAI CAR DATA</small></span>
          <span className="concept-chip">OWNER OS</span>
        </button>

        <nav className="desktop-nav" aria-label="주요 메뉴">
          {navigation.map((item) => (
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
          <button className={`account-button ${connected ? 'connected' : ''}`} disabled={busy} onClick={accountAction}><UserRound size={16} /><span><small>현대 통합계정</small><strong>{connected && hyundai?.accountName ? `${hyundai.accountName}님` : hyundaiStatusLabel(hyundai)}</strong></span></button>
          <button className="mobile-menu-button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}>{menuOpen ? <X size={21} /> : <Menu size={21} />}{platform.unreadNotifications > 0 && <i className="notification-count">{platform.unreadNotifications}</i>}</button>
        </div>
      </div>

      {menuOpen && (
        <div className="mobile-drawer">
          <div className="mobile-vehicle"><span>{vehicle?.name ?? '아직 등록한 차량이 없어요'}</span><strong>{vehicle?.plate ?? '차량을 연결해 보세요'}</strong><small>{vehicle ? '내 차 소식이 준비됐어요' : '주변 충전·정비는 바로 이용할 수 있어요'}</small></div>
          <div className={`mobile-account ${connected ? 'connected' : ''}`}><div><UserRound size={19} /><span><small>현대 통합계정</small><strong>{connected && hyundai?.accountName ? `${hyundai.accountName}님` : hyundaiStatusLabel(hyundai)}</strong></span></div><button disabled={busy} onClick={accountAction}>{connected ? '새로고침' : hyundai?.state === 'CONSENT_REQUIRED' ? '동의 계속' : '연결하기'}</button></div>
          {navigation.map((item) => <button key={item.id} onClick={() => navigate(item.id)}><item.icon size={18} />{item.label}<ChevronRight size={16} /></button>)}
        </div>
      )}
    </header>
  );
}

function HomePage({ vehicle, navigate, setModal, notify, platform }) {
  const connected = Boolean(vehicle);
  const [galleryIndex, setGalleryIndex] = useState(0);
  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return undefined;
    const timer = window.setInterval(() => setGalleryIndex((current) => (current + 1) % spaceGallery.length), 4600);
    return () => window.clearInterval(timer);
  }, []);
  const showGalleryImage = (nextIndex) => setGalleryIndex((nextIndex + spaceGallery.length) % spaceGallery.length);
  return (
    <>
      <section className="orbit-intro" data-scene="01" data-phase="open">
        <div className="orbit-intro-sticky">
          <div className="orbit-intro-frame">
            <div className="space-gallery" aria-live="polite">
              {spaceGallery.map((image, index) => <img key={image.src} className={galleryIndex === index ? 'active' : ''} src={image.src} alt={galleryIndex === index ? image.title : ''} fetchPriority={index === 0 ? 'high' : undefined} loading={index < 2 ? 'eager' : 'lazy'} />)}
            </div>
            <div className="orbit-intro-shade" />
            <div className="orbit-grid" aria-hidden="true" />
            <div className="orbit-system-label" aria-hidden="true"><span>01</span><i /><small>MY CAR, ONE CLEAR FLOW</small></div>
            <div className="orbit-intro-copy container">
              <div className="overline"><i /> 내 차 상태에서 다음 행동까지</div>
              <h1>현대차 오너를 위한<br /><em>차량 관리 플랫폼.</em></h1>
              <p>내 차 상태를 확인하고, 주변 충전소와 블루핸즈를 찾고, 중요한 차량 기록까지 한곳에서 관리하는 서비스입니다.</p>
              <div className="hero-buttons">
                <button className="button primary" onClick={() => setModal('connect')}>{connected ? '내 차 상태 새로고침' : '내 차 연결하기'} <ArrowRight size={17} /></button>
                <button className="button glass" onClick={() => navigate('charge')}>충전소 먼저 찾기</button>
                <button className="button glass hero-share-button" onClick={() => sharePage({ title: 'HYUNDAI LIFE PASS', text: '차량 상태·충전·정비·기록을 하나의 흐름으로 연결하는 카라이프 플랫폼', notify })}><Share2 size={16} /> 공유</button>
              </div>
              <div className="hero-proof" aria-label="서비스 이용 범위">
                <span><strong>비로그인</strong> 충전·정비 탐색</span>
                <span><strong>차량 연결 후</strong> 실차 상태 확인</span>
                <span><strong>동의 기반</strong> 데이터만 사용</span>
              </div>
            </div>
            <div className="space-gallery-ui">
              <div><small>{spaceGallery[galleryIndex].eyebrow}</small><strong>{spaceGallery[galleryIndex].title}</strong></div>
              <nav aria-label="우주 자동차 이미지 선택">
                <button onClick={() => showGalleryImage(galleryIndex - 1)} aria-label="이전 이미지"><ChevronLeft size={14} /></button>
                <span>{spaceGallery.map((image, index) => <button key={image.src} className={galleryIndex === index ? 'active' : ''} onClick={() => showGalleryImage(index)} aria-label={`${index + 1}번 이미지 보기`} aria-current={galleryIndex === index ? 'true' : undefined} />)}</span>
                <button onClick={() => showGalleryImage(galleryIndex + 1)} aria-label="다음 이미지"><ChevronRight size={14} /></button>
              </nav>
            </div>
            <div className="orbit-function-rail" aria-label="주요 차량 생활 기능">
              <button onClick={() => navigate('care')}><Activity size={17} /><span><small>VEHICLE</small><strong>내 차 상태</strong></span><ArrowUpRight size={15} /></button>
              <button onClick={() => navigate('charge')}><BatteryCharging size={17} /><span><small>ENERGY</small><strong>주변 충전</strong></span><ArrowUpRight size={15} /></button>
              <button onClick={() => navigate('passport')}><FileCheck2 size={17} /><span><small>HISTORY</small><strong>차량 기록</strong></span><ArrowUpRight size={15} /></button>
            </div>
            <button className="orbit-scroll-cue" onClick={() => document.getElementById('mission')?.scrollIntoView({ behavior: 'smooth' })} aria-label="다음 장면으로 이동"><span>SCROLL TO EXPLORE</span><i /></button>
          </div>
        </div>
      </section>

      <section className="service-explainer reveal" data-reveal aria-labelledby="service-explainer-title">
        <div className="container service-explainer-inner">
          <div className="service-explainer-heading"><span>WHAT IS HYUNDAI LIFE PASS?</span><h2 id="service-explainer-title">차량을 연결하면,<br /><em>다음 행동까지</em> 한 화면에 보여요.</h2><p>이 서비스는 현대차 오너를 위한 차량 생활 공간입니다. 로그인 한 번으로 내 차의 현재 상태를 살피고, 충전·정비·차량 기록으로 바로 이어집니다.</p></div>
          <div className="service-explainer-flow" aria-label="서비스 이용 흐름">
            <article><div><CarFront size={19} /></div><span>01</span><h3>내 차 연결</h3><p>현대 통합 계정에서 차량을 선택해요.</p></article>
            <i aria-hidden="true"><ArrowRight size={16} /></i>
            <article><div><Activity size={19} /></div><span>02</span><h3>상태 확인</h3><p>배터리·주행거리·안전 신호를 봐요.</p></article>
            <i aria-hidden="true"><ArrowRight size={16} /></i>
            <article><div><BatteryCharging size={19} /></div><span>03</span><h3>바로 행동</h3><p>충전소와 블루핸즈를 찾아요.</p></article>
            <i aria-hidden="true"><ArrowRight size={16} /></i>
            <article><div><FileCheck2 size={19} /></div><span>04</span><h3>기록으로 남기기</h3><p>확인된 차량 정보를 필요할 때 공유해요.</p></article>
          </div>
          <div className="service-explainer-actions"><button className="button primary" onClick={() => setModal('connect')}>{connected ? '내 차 상태 확인하기' : '내 차 연결부터 시작'} <ArrowRight size={16} /></button><button className="explainer-link" onClick={() => navigate('charge')}>차량 연결 없이 충전소 먼저 보기 <ArrowUpRight size={16} /></button></div>
        </div>
      </section>

      <section className="home-manifesto reveal" data-reveal id="mission">
        <div className="container home-manifesto-inner">
          <span>WHAT IS HYUNDAI LIFE PASS?</span>
          <h2>내 차가 궁금할 때,<br />여러 앱과 정보를 헤매지 않도록.</h2>
          <div className="manifesto-answer"><p><strong>HYUNDAI LIFE PASS는 현대차 오너를 위한 차량 생활 허브입니다.</strong> 차량이 보내는 상태를 이해하기 쉬운 말로 보여주고, 필요한 충전과 정비 행동으로 바로 연결합니다.</p><i /></div>
          <div className="project-definition" aria-label="프로젝트 핵심 설명">
            <article><span>FOR</span><strong>현대차 오너</strong><p>내 차 상태와 주변 인프라를 한곳에서 보고 싶은 사람</p></article>
            <article><span>SOLVES</span><strong>흩어진 정보</strong><p>차량 신호를 확인한 뒤 무엇을 해야 할지 바로 알 수 있게</p></article>
            <article><span>CONNECTS</span><strong>상태 → 행동 → 기록</strong><p>확인에서 끝나지 않고 충전·정비·차량 여권으로 연결</p></article>
          </div>
        </div>
      </section>

      <section className="space-reel" aria-label="HYUNDAI LIFE PASS 이미지 여정">
        <div className="container space-reel-heading reveal" data-reveal>
          <span>ONE PLATFORM · EVERY CAR MOMENT</span>
          <h2>상태 확인부터 충전, 정비, 기록까지.</h2>
          <p>HYUNDAI LIFE PASS는 흩어진 차량 생활을 하나의 흐름으로 연결합니다.</p>
        </div>
        <div className="space-reel-window">
          <div className="space-reel-track">
            {[...spaceGallery, ...spaceGallery].map((image, index) => <figure key={`${image.src}-${index}`}><img src={image.src} alt="" loading="lazy" /><figcaption><span>{String((index % spaceGallery.length) + 1).padStart(2, '0')}</span><strong>{image.title}</strong></figcaption></figure>)}
          </div>
        </div>
      </section>

      <section className="motion-story" data-scene="02" data-active="0" aria-label="차량 생활 주요 가치">
        <div className="motion-story-sticky">
          <div className="motion-story-media" aria-hidden="true">
            <figure><img src="/space-drive-07-v1.webp" alt="" loading="lazy" /></figure>
            <figure><img src="/space-drive-03-v1.webp" alt="" loading="lazy" /></figure>
            <figure><img src="/space-drive-04-v1.webp" alt="" loading="lazy" /></figure>
          </div>
          <div className="motion-story-shade" />
          <div className="motion-story-orbit" aria-hidden="true"><i /><b /></div>
          <div className="motion-story-chapter"><span>02</span><i /><small>ONE SIGNAL, ONE NEXT STEP</small></div>
          <div className="motion-story-copy container">
            <article>
              <span>01 · CHECK</span>
              <h2>출발 전 10초,<br />내 차 상태를 확인합니다.</h2>
              <p>배터리 잔량, 주행 가능 거리, 누적 주행거리와 7가지 안전 경고를 한 화면에서 확인합니다. 제공되지 않는 값은 추정하지 않습니다.</p>
              <button onClick={() => navigate('care')}>내 차 상태 보기 <ArrowRight size={18} /></button>
            </article>
            <article>
              <span>02 · ACT</span>
              <h2>충전이 필요하면,<br />지금 갈 수 있는 곳을 찾습니다.</h2>
              <p>현재 위치 주변 충전기의 운영 상태와 거리를 비교하고 길 안내로 이어집니다. 점검이 필요할 때는 가까운 블루핸즈도 같은 흐름에서 찾습니다.</p>
              <button onClick={() => navigate('charge')}>주변 충전소 찾기 <ArrowRight size={18} /></button>
            </article>
            <article>
              <span>03 · REMEMBER</span>
              <h2>점검과 변화는<br />신뢰할 기록으로 남습니다.</h2>
              <p>Life Pass가 실제로 받은 차량 상태 이벤트를 서명해 시간순으로 보관합니다. 중고차 거래나 차량 관리 이력을 확인할 때 출처를 함께 볼 수 있습니다.</p>
              <button onClick={() => navigate('passport')}>차량 기록 보기 <ArrowRight size={18} /></button>
            </article>
          </div>
          <div className="motion-story-progress" aria-hidden="true"><span>01</span><i><b /></i><span>03</span></div>
        </div>
      </section>

      <section className="section service-scene reveal" data-reveal data-scene="03" id="services">
        <div className="container service-scene-inner">
          <SectionHeading eyebrow="START WITH TODAY'S NEED" title="오늘 필요한 일을 바로 시작하세요." description="로그인하지 않아도 주변 충전소와 서비스 거점을 찾을 수 있고, 차량 연결 후에는 내 차 상태와 기록까지 이어집니다." />
          <div className="service-grid">
            <ServiceCard number="01" icon={BatteryCharging} title="충전소 찾기" description="내 주변에서 사용 가능한 충전기를 찾고 길 안내까지 바로 이어갑니다." action="주변 충전소 보기" onClick={() => navigate('charge')} tone="blue" />
            <ServiceCard number="02" icon={Activity} title="블루핸즈 찾기" description="가까운 서비스 거점을 살펴보고 전화나 길 안내를 바로 이용하세요." action="가까운 곳 찾기" onClick={() => navigate('care')} tone="sky" />
            <ServiceCard number="03" icon={CloudCog} title="내 차 상태" description="배터리와 주행 정보, 타이어·안전 점검 결과를 한 화면에서 확인합니다." action="차량 상태 보기" onClick={() => navigate('care')} tone="navy" />
            <ServiceCard number="04" icon={FileCheck2} title="차량 기록" description="차량과 함께 남은 중요한 기록을 시간 순서로 확인하고 필요할 때 공유합니다." action="차량 기록 보기" onClick={() => navigate('passport')} tone="ice" />
          </div>
          <p className="swipe-hint" aria-hidden="true"><span /> 옆으로 넘겨 기능을 살펴보세요</p>
        </div>
      </section>

      <section className="section section-soft garage-scene reveal" data-reveal data-scene="04">
        <div className="container">
          {connected ? <VehicleCommandCenter vehicle={vehicle} navigate={navigate} setModal={setModal} notify={notify} platform={platform} /> : <GuestGaragePanel setModal={setModal} navigate={navigate} />}
        </div>
      </section>

      <section className="section container tutorial-scene reveal" data-reveal data-scene="05">
        <div className="tutorial-heading">
          <SectionHeading eyebrow="HOW IT WORKS" title="처음이라면, 이 순서로 시작하세요." description="탐색은 바로, 실차 데이터는 동의 후에. 실제로 제공되는 범위를 분명하게 나눴습니다." />
          <div className="tutorial-progress" aria-label="차량 생활 준비도">
            <div><strong>{connected ? '2' : '1'} / 4</strong><span>{connected ? '내 차가 준비됐어요' : '첫 단계부터 시작해요'}</span></div>
            <i><b style={{ width: connected ? '50%' : '25%' }} /></i>
          </div>
        </div>
        <div className="journey">
          <JourneyStep icon={CarFront} number="01" title="내 차 연결" detail={connected ? '현대 계정과 차량이 연결되어 있어요.' : '공식 로그인에서 내 차를 선택해 주세요.'} done={connected} onClick={() => setModal('connect')} />
          <JourneyStep icon={BatteryCharging} number="02" title="주변 충전" detail="현재 위치에서 쓸 수 있는 충전기를 바로 찾아요." onClick={() => navigate('charge')} />
          <JourneyStep icon={ShieldCheck} number="03" title="오늘 안전" detail="배터리·타이어·안전 점검을 한 화면에 확인해요." onClick={() => navigate('care')} />
          <JourneyStep icon={FileCheck2} number="04" title="내 차 기록" detail="차와 함께한 중요한 순간을 오래 남겨요." onClick={() => navigate('passport')} />
        </div>
      </section>

      <OpenBetaPanel navigate={navigate} notify={notify} />

    </>
  );
}

function OpenBetaPanel({ navigate, notify }) {
  return (
    <section className="open-beta-panel container reveal" data-reveal aria-labelledby="open-beta-title">
      <div className="open-beta-copy">
        <span className="open-beta-eyebrow"><Bookmark size={14} /> MY HYUNDAI · CAR LIFE</span>
        <h2 id="open-beta-title">오늘부터 내 차를 더 잘 아는 방법.</h2>
        <p>차량을 연결하면 매일 필요한 상태를 한눈에 보고, 연결하지 않아도 주변 충전소와 블루핸즈를 바로 찾아볼 수 있어요.</p>
      </div>
      <div className="open-beta-actions">
        <button className="button light" onClick={() => sharePage({ title: 'HYUNDAI LIFE PASS', text: '충전·정비·차량 상태를 한곳에서 확인하는 차량 생활 서비스', notify })}><Share2 size={16} /> 가족·친구에게 공유</button>
        <button className="button light-outline" onClick={() => navigate('settings')}><CarFront size={16} /> 내 차 등록하기</button>
        <InstallButton notify={notify} compact />
      </div>
      <small className="open-beta-note">내 차 정보는 내가 허락한 범위에서만 확인합니다.</small>
    </section>
  );
}

function VehicleCommandCenter({ vehicle, navigate, setModal, notify, platform }) {
  const readiness = vehicleReadiness(vehicle);
  const warningCount = Number(vehicle.warningCount ?? 0);
  const checkedWarnings = Number(vehicle.checkedWarnings ?? 0);
  const readinessLabel = readiness == null ? '데이터 대기' : readiness >= 90 ? '오늘 운행 준비 완료' : warningCount ? '점검 후 운행 권장' : '확인 후 운행';
  const sourceLabel = vehicle.source === 'HYUNDAI_DEVELOPERS' ? '내 차 상태 최신' : '차량 연결 대기';
  const coverage = [
    ['배터리 잔량', vehicle.batterySoc != null],
    ['주행 가능 거리', vehicle.range != null],
    ['누적 주행', vehicle.odometer != null],
    ['공기압 경고', tireCheck(vehicle).state !== 'UNAVAILABLE'],
    ['바퀴별 수치', vehicle.tirePressure?.exactValuesAvailable === true && Boolean(vehicle.tirePressure?.values ?? vehicle.tirePressures)],
  ];
  const upcomingItems = [
    ...(platform?.chargingReservations ?? []).map((item) => ({ type: '충전', title: item.stationName, date: item.scheduledAt, status: item.status })),
    ...(platform?.serviceBookings ?? []).map((item) => ({ type: '정비', title: item.centerName, date: item.scheduledAt, status: item.status })),
  ].filter((item) => item.status !== 'CANCELLED').sort((left, right) => new Date(left.date) - new Date(right.date)).slice(0, 3);
  return (
    <section className="vehicle-command-center" aria-labelledby="vehicle-command-title">
      <div className="command-heading">
        <div>
          <span className="command-eyebrow"><CarFront size={14} /> MY HYUNDAI GARAGE</span>
          <h2 id="vehicle-command-title">오늘의 {vehicle.name}</h2>
          <p>{vehicle.trim} · {vehicle.plate} · 마지막 동기화 {vehicle.updatedAt ? formatDateTime(vehicle.updatedAt) : '확인 중'}</p>
        </div>
        <div className="command-heading-actions">
          <span className="command-source"><i /> {sourceLabel}</span>
          <button className="command-icon-button" onClick={() => setModal('connect')} aria-label="차량 데이터 새로고침"><RefreshCcw size={17} /></button>
          <button className="command-icon-button" onClick={() => sharePage({ title: `${vehicle.name} 차량 현황`, text: '현대차 오너용 Life Pass 차량 대시보드', path: '#home', notify })} aria-label="차량 현황 공유"><Share2 size={17} /></button>
        </div>
      </div>

      <div className="command-primary-grid">
        <article className="readiness-card panel">
          <div className="readiness-top"><div><span>오늘의 운행 준비</span><h3>{readinessLabel}</h3><p>{warningCount ? `확인이 필요한 경고 ${warningCount}건이 있습니다.` : checkedWarnings ? `${checkedWarnings}/7개 안전 항목을 확인했습니다.` : '차량을 연결하면 안전 항목을 확인할 수 있어요.'}</p></div><div className={`readiness-score ${warningCount ? 'warning' : ''}`}><strong>{readiness == null ? '—' : readiness}</strong><small>{readiness == null ? '점' : '점'}</small></div></div>
          <div className="readiness-meter" aria-label={readiness == null ? '운행 준비도 확인 중' : `운행 준비도 ${readiness}점`}><span style={{ width: `${readiness == null ? 10 : Math.max(readiness, 4)}%` }} /></div>
          <div className="readiness-foot"><span><i className={warningCount ? 'warn' : readiness == null ? 'unknown' : ''} />{warningCount ? '점검 필요' : readiness == null ? '확인 중' : '현재 경고 없음'}</span><button onClick={() => navigate('care')}>안전 점검 보기 <ArrowRight size={14} /></button></div>
        </article>
        <TirePressureCard vehicle={vehicle} compact onDetails={() => navigate('care')} />
      </div>

      <div className="vehicle-vitals-grid">
        <VehicleStat icon={BatteryCharging} label="배터리 잔량" value={formatMetric(vehicle.batterySoc, '%')} detail={vehicle.batterySoc == null ? '아직 확인되지 않음' : vehicle.chargingState || '현재 상태'} tone="blue" />
        <VehicleStat icon={Navigation} label="주행 가능 거리" value={formatMetric(vehicle.range, 'km')} detail={vehicle.range == null ? '아직 확인되지 않음' : '최근 확인한 값'} tone="sky" />
        <VehicleStat icon={Gauge} label="누적 주행" value={formatMetric(vehicle.odometer, 'km')} detail={vehicle.odometer == null ? '아직 확인되지 않음' : '최근 확인한 값'} tone="navy" />
        <VehicleStat icon={ThermometerSun} label="충전 상태" value={vehicle.chargingState || '확인 중'} detail={vehicle.chargingState ? '현재 차량 상태' : '잠시만 기다려 주세요'} tone="green" />
      </div>

      <div className="garage-action-grid" aria-label="차량 바로가기">
        <button onClick={() => navigate('charge')}><span className="garage-action-icon blue"><BatteryCharging size={18} /></span><span><strong>충전소 찾기</strong><small>내 위치 주변을 바로 찾아요</small></span><ChevronRight size={16} /></button>
        <button onClick={() => navigate('care')}><span className="garage-action-icon orange"><Wrench size={18} /></span><span><strong>차량 케어</strong><small>안전 점검과 블루핸즈</small></span><ChevronRight size={16} /></button>
        <button onClick={() => navigate('passport')}><span className="garage-action-icon green"><ShieldCheck size={18} /></span><span><strong>차량 기록</strong><small>차와 함께한 소중한 기록</small></span><ChevronRight size={16} /></button>
      </div>

      <div className="owner-activity panel" aria-label="내 차 일정">
        <div className="owner-activity-heading"><div><span>MY CAR PLAN</span><strong>내 차 일정</strong></div><span>{upcomingItems.length ? `${upcomingItems.length}건 예정` : '아직 비어 있어요'}</span></div>
        {upcomingItems.length ? <div className="owner-activity-list">{upcomingItems.map((item, index) => <div key={`${item.type}-${item.title}-${index}`}><span className={`activity-dot ${item.type === '충전' ? 'charge' : 'care'}`} /><div><strong>{item.type} · {item.title}</strong><small>{formatDateTime(item.date)}</small></div><ChevronRight size={15} /></div>)}</div> : <p className="owner-activity-empty">충전이나 점검 일정을 만들면 이곳에서 한눈에 확인할 수 있어요.</p>}
      </div>

      <div className="coverage-row"><div><span>확인 범위</span><strong>이번에 살펴본 내 차 정보</strong></div><div className="coverage-chips">{coverage.map(([label, available]) => <span key={label} className={available ? 'available' : ''}><i />{label}</span>)}</div></div>
    </section>
  );
}

function GuestGaragePanel({ setModal, navigate }) {
  return (
    <section className="garage-empty-panel" aria-labelledby="garage-empty-title">
      <div className="garage-empty-copy"><span className="command-eyebrow"><Plus size={14} /> MY HYUNDAI GARAGE</span><h2 id="garage-empty-title">내 차를 등록하면<br />매일 필요한 정보가 한 화면에 모여요.</h2><p>차량을 연결하면 배터리, 주행거리, 타이어와 안전 점검을 내 차 기준으로 확인할 수 있습니다.</p><button className="button primary" onClick={() => setModal('connect')}>내 차 등록 시작 <ArrowRight size={16} /></button></div>
      <div className="garage-empty-steps"><div><b>01</b><CarFront size={17} /><strong>차량 등록</strong><small>공식 화면에서 간단히</small></div><div><b>02</b><Activity size={17} /><strong>상태 확인</strong><small>내 차 소식을 한눈에</small></div><div><b>03</b><Route size={17} /><strong>바로 행동</strong><small>충전·케어로 이어져요</small></div></div>
      <div className="garage-empty-links"><button onClick={() => navigate('charge')}>충전소 먼저 둘러보기 <ArrowRight size={14} /></button><button onClick={() => navigate('care')}>주변 블루핸즈 찾아보기 <ArrowRight size={14} /></button></div>
    </section>
  );
}

function TirePressureCard({ vehicle, compact = false, onDetails }) {
  const check = tireCheck(vehicle);
  const exactCount = tirePositions.filter(({ key }) => tireValue(vehicle, key) != null).length;
  const unit = vehicle?.tirePressure?.unit ?? '';
  const overallLabel = check.state === 'UNAVAILABLE' ? '차량 연결 필요' : check.state === 'WARNING' ? '확인 필요' : '현재 정상';
  return (
    <article className={`tire-pressure-card panel ${compact ? 'compact' : ''}`}>
      <div className="tire-card-heading"><div><span>안전하게 달리기</span><h3>타이어 공기압</h3></div><strong className={`tire-status ${check.state.toLowerCase()}`}>{overallLabel}</strong></div>
      <div className="tire-grid" aria-label="타이어 위치별 상태">{tirePositions.map(({ id, label, key }) => { const value = tireValue(vehicle, key); const valueLabel = value == null ? (check.state === 'WARNING' ? '확인' : check.state === 'CLEAR' ? '정상' : '—') : `${value}${unit ? ` ${unit}` : ''}`; return <div className={`tire-wheel ${check.state.toLowerCase()}`} key={id} aria-label={`${label} ${valueLabel}`}><i /><span>{label}</span><strong>{valueLabel}</strong></div>; })}</div>
      <div className="tire-card-note"><CircleGauge size={15} /><span>{exactCount ? `${exactCount}개 바퀴의 수치를 확인했어요.` : vehicle?.source === 'HYUNDAI_DEVELOPERS' ? '현재는 타이어 경고 여부를 먼저 보여드려요.' : '차량을 연결하면 타이어 상태를 확인할 수 있어요.'}</span></div>
      {onDetails && <button className="tire-details-button" onClick={onDetails}>안전 점검 자세히 보기 <ArrowRight size={14} /></button>}
    </article>
  );
}

function VehicleStat({ icon: Icon, label, value, detail, tone }) {
  return <article className={`vehicle-stat panel ${tone}`}><div className="vehicle-stat-icon"><Icon size={18} /></div><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function ChargePage({ vehicle, notify, platform, actions, busy }) {
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
  const stationList = useMemo(() => (chargerFeed.stations ?? []).map((item) => ({
    ...item,
    distanceValue: Number(item.distanceKm) || 0,
    distance: `${Number(item.distanceKm ?? 0).toFixed(1)}km`,
    speed: `${item.speedKw}kW`,
    price: `${item.pricePerKwh}원/kWh`,
    eta: `${item.etaMinutes}분`,
  })), [chargerFeed.stations]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [search, setSearch] = useState('');
  const favoriteKey = (station) => String(station.providerStationId ?? station.id);
  const visibleStations = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = stationList.filter((station) => {
      const matchesQuery = `${station.name} ${station.address} ${station.operator}`.toLowerCase().includes(query);
      return matchesQuery && (!favoritesOnly || favoriteIds.includes(favoriteKey(station)));
    });
    return [...filtered].sort((left, right) => {
      if (sortMode === 'availability') return right.available - left.available || left.distanceValue - right.distanceValue;
      if (sortMode === 'speed') return right.speedKw - left.speedKw || left.distanceValue - right.distanceValue;
      return left.distanceValue - right.distanceValue;
    });
  }, [stationList, search, favoritesOnly, favoriteIds, sortMode]);
  const activeStation = visibleStations.find((station) => station.id === selectedStation?.id) ?? visibleStations[0] ?? null;
  const chargerProvider = chargerFeed.provider ?? platform.providers?.find((provider) => provider.id === 'ev-charger');
  const chargerLive = chargerProvider?.mode === 'LIVE' && ['CONNECTED', 'STALE'].includes(chargerProvider.state);

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
    <div className="page container">
      <PageIntro eyebrow="CHARGE NEAR YOU" title="내 주변 충전소" description="지금 갈 수 있는 충전소를 찾고, 도착까지 편하게 안내받으세요." actions={<button className="button primary location-button" onClick={findFromCurrentLocation} disabled={locationBusy}>{locationBusy ? <LoaderCircle className="spin" size={17} /> : <LocateFixed size={17} />}{locationBusy ? '위치 확인 중' : '내 위치로 찾기'}</button>} />
      <FeaturePurpose icon={BatteryCharging} title="현재 위치 주변의 충전소를 찾아 길 안내까지 연결합니다." description="차량을 연결하지 않아도 이용할 수 있습니다. 충전기 사용 가능 수와 거리, 충전 출력을 비교해 목적지를 선택하세요." steps={['내 위치 확인', '충전기 비교', '길찾기 시작']} />
      {vehicle && <section className="vehicle-charge-strip panel reveal" data-reveal><div><span>CONNECTED VEHICLE</span><strong>{vehicle.name}</strong><small>{vehicle.chargingState} · 최근 차량 데이터 {formatHyundaiTimestamp(vehicle.dataTimestamp)}</small></div><Metric icon={BatteryCharging} label="현재 배터리" value={formatMetric(vehicle.batterySoc, '%')} detail="현대차 전송값" /><Metric icon={Zap} label="목표 충전" value={formatMetric(vehicle.chargingTargetSoc, '%')} detail={vehicle.chargingPlugType ?? '충전기 정보 미제공'} /><Metric icon={Clock3} label="남은 시간" value={formatMetric(vehicle.chargingRemainingMinutes, '분')} detail="목표 충전까지" /></section>}
      <section className={`location-status ${usingCurrentLocation ? 'current' : 'default'}`} aria-live="polite">
        <div><MapPin size={18} /><span><small>{usingCurrentLocation ? '현재 위치 기준' : '기본 위치 기준'}</small><strong>{chargerFeed.search?.locationLabel ?? '서울 성수'} · 반경 {Math.round(chargerFeed.search?.radiusKm ?? 30)}km</strong></span></div>
        <p>{usingCurrentLocation ? '현재 위치를 기준으로 가까운 순서로 보여드리고, 위치는 저장하지 않아요.' : '내 위치로 찾기를 누르고 위치 권한을 허용하면 주변 순서가 바뀝니다.'}</p>
      </section>
      {chargerProvider && <div className={`provider-inline ${chargerLive ? 'live' : 'sample'}`}><span>{chargerLive ? '지금 확인됨' : '확인 중'}</span><strong>주변 충전소</strong><small>{chargerLive ? '사용 가능한 충전기를 먼저 보여드려요.' : '잠시 후 다시 확인해 주세요.'}</small></div>}
      <OperationBanner tone={chargerLive ? 'ready' : 'active'} icon={BatteryCharging} label="충전소 둘러보기" title={chargerLive ? '사용 가능한 충전기를 확인하고 바로 길찾기 하세요.' : '충전소를 불러오는 중이에요.'} detail={chargerLive ? '출발 전 충전기 상태를 한 번 더 확인하면 더 안심할 수 있어요.' : '잠시 후 새로고침해 주세요.'} />
      <div className="charge-layout">
        <section className="charge-map panel">
          <div className="map-search"><Search size={18} /><input value={search} placeholder="충전소명·주소·운영기관 검색" onChange={(event) => setSearch(event.target.value)} aria-label="충전소 검색" /><button aria-label="검색어 지우기" onClick={() => setSearch('')}><X size={17} /></button></div>
          <div className="station-tools" aria-label="충전소 목록 설정">
            <label><SlidersHorizontal size={15} /><span>정렬</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value)} aria-label="충전소 정렬"><option value="distance">거리순</option><option value="availability">사용 가능 많은 순</option><option value="speed">출력 높은 순</option></select></label>
            <button className={favoritesOnly ? 'active' : ''} onClick={() => setFavoritesOnly((current) => !current)} aria-pressed={favoritesOnly}><Star size={15} fill={favoritesOnly ? 'currentColor' : 'none'} /> 즐겨찾기{favoriteIds.length ? ` ${favoriteIds.length}` : ''}</button>
            <button onClick={refreshStations} disabled={locationBusy}><RefreshCcw className={locationBusy ? 'spin' : ''} size={15} /> 새로고침</button>
          </div>
          <KakaoStationMap stations={visibleStations} selectedStation={activeStation} onSelect={setSelectedStation} notify={notify} userLocation={usingCurrentLocation ? chargerFeed.search : null} />
        </section>
        <aside className="station-panel panel">
          <div className="station-panel-head"><span>가까운 충전소</span><small>{chargerLive ? '지금 이용 가능' : '확인 중'}</small></div>
          {visibleStations.map((station) => (
            <button key={station.id} className={`station-row ${activeStation?.id === station.id ? 'active' : ''}`} onClick={() => setSelectedStation(station)}>
              <div className="station-availability"><strong>{station.available}</strong><span>/{station.total}</span></div>
              <div><strong>{station.name}</strong><span>{station.distance} · {station.speed} · {station.eta}</span><small>{station.operator} · {station.statusLabel}</small></div>
              <ChevronRight size={16} />
            </button>
          ))}
          {activeStation ? <div className="station-detail">
            <div className="station-detail-heading"><div><span>선택한 충전소</span><strong>{activeStation.name}</strong><p>{activeStation.address}</p></div><button className={`station-favorite ${favoriteIds.includes(favoriteKey(activeStation)) ? 'active' : ''}`} onClick={() => toggleFavorite(activeStation)} aria-label={favoriteIds.includes(favoriteKey(activeStation)) ? '즐겨찾기 삭제' : '즐겨찾기 추가'} aria-pressed={favoriteIds.includes(favoriteKey(activeStation))}><Star size={18} fill={favoriteIds.includes(favoriteKey(activeStation)) ? 'currentColor' : 'none'} /></button></div>
            <div className="charge-price"><span>예상 요금</span><strong>{activeStation.price}</strong><small>{activeStation.operator} 기준 · 현장과 다를 수 있어요</small></div>
            <button className="button primary full" onClick={() => window.open(`https://map.kakao.com/link/to/${encodeURIComponent(activeStation.name)},${activeStation.latitude},${activeStation.longitude}`, '_blank', 'noopener,noreferrer')}><Navigation size={16} />길찾기 시작</button>
          </div> : <div className="station-empty"><MapPin size={22} /><strong>{stationList.length ? '검색 결과가 없습니다.' : '충전소를 불러오는 중입니다.'}</strong><span>{stationList.length ? '다른 충전소명이나 지역을 입력해 보세요.' : '데이터 연결에 실패하면 잠시 후 다시 시도해 주세요.'}</span></div>}
        </aside>
      </div>
      <div className="charge-plan-grid">
        <div className="panel plan-card"><div className="plan-icon"><Clock3 size={20} /></div><div><span>마지막 확인</span><strong>{chargerProvider?.refreshedAt ? formatDateTime(chargerProvider.refreshedAt) : '확인 중'}</strong><p>충전기 상태는 현장 상황에 따라 달라질 수 있어요.</p></div></div>
        <div className="panel plan-card"><div className="plan-icon"><Route size={20} /></div><div><span>이용 안내</span><strong>길찾기까지 한 번에</strong><p>도착 후 충전기 화면에서 이용 방법을 확인해 주세요.</p></div></div>
      </div>
    </div>
  );
}

let kakaoSdkPromise;
function loadKakaoSdk(key) {
  if (!key) return Promise.reject(new Error('지도 화면을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.'));
  if (window.kakao?.maps?.Map) return Promise.resolve(window.kakao);
  if (!kakaoSdkPromise) {
    kakaoSdkPromise = new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if (error) {
          kakaoSdkPromise = undefined;
          reject(error);
        } else {
          resolve(window.kakao);
        }
      };
      const script = document.createElement('script');
      const timeout = window.setTimeout(() => finish(new Error('Kakao Maps SDK load timeout')), 10000);
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
      script.async = true;
      script.onload = () => {
        if (!window.kakao?.maps?.load) {
          finish(new Error('지도 화면을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.'));
          return;
        }
        window.kakao.maps.load(() => finish());
      };
      script.onerror = () => finish(new Error('지도 화면을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));
      document.head.appendChild(script);
    });
  }
  return kakaoSdkPromise;
}

function KakaoStationMap({ stations: stationItems, selectedStation, onSelect, notify, userLocation }) {
  const mapElement = useRef(null);
  const mapRef = useRef(null);
  const kakaoRef = useRef(null);
  const notifyRef = useRef(notify);
  const [mapReady, setMapReady] = useState(false);
  const key = window.__LIFEPASS_CONFIG__?.kakaoJavascriptKey || import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY;

  useEffect(() => { notifyRef.current = notify; }, [notify]);

  useEffect(() => {
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
  }).catch((error) => notifyRef.current(error.message || '지도 화면을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));
    return () => {
      cancelled = true;
      mapRef.current?.__lifePassOverlays?.forEach((overlay) => overlay.setMap(null));
      mapRef.current = null;
      kakaoRef.current = null;
    };
  }, [key, stationItems, selectedStation?.id, onSelect, userLocation?.latitude, userLocation?.longitude]);

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
      {key ? <div ref={mapElement} className="map-surface kakao-map" aria-label="충전소 지도" /> : <div className="map-surface map-fallback" aria-label="충전소 위치 미리보기">
        <div className="road road-a" /><div className="road road-b" /><div className="road road-c" />
        <div className="map-river" />
        {stationItems.slice(0, 6).map((station, index) => <button key={station.id} style={{ left: `${18 + (index % 3) * 29}%`, top: `${24 + Math.floor(index / 3) * 40}%` }} className={`map-pin ${selectedStation?.id === station.id ? 'active' : ''}`} onClick={() => onSelect(station)}><Zap size={16} fill="currentColor" /><span>{station.available}</span></button>)}
        <div className="my-location"><Navigation size={14} fill="currentColor" /></div>
      </div>}
      <div className="map-live-chip"><i /> 충전기 현황</div>
      {key && <div className="map-zoom-controls" aria-label="지도 확대 축소"><button onClick={() => changeZoom(-1)} aria-label="지도 확대"><Plus size={18} /></button><button onClick={() => changeZoom(1)} aria-label="지도 축소"><Minus size={18} /></button></div>}
      <button className="map-recenter" onClick={focusMap} aria-label="선택한 위치로 지도 이동"><LocateFixed size={18} /></button>
      {selectedStation && <button className="map-selected-card" onClick={() => onSelect(selectedStation)}><span><i className={selectedStation.available > 0 ? 'available' : ''} />{selectedStation.available > 0 ? `${selectedStation.available}대 사용 가능` : '현재 대기'}</span><strong>{selectedStation.name}</strong><small>{selectedStation.distance} · {selectedStation.speed}</small><ChevronRight size={17} /></button>}
    </div>
  );
}

function CarePage({ vehicle, notify, setModal, platform, actions, busy }) {
  const [centerFeed, setCenterFeed] = useState({ centers: [], provider: null });
  const [centerBusy, setCenterBusy] = useState(true);
  const [centerLocation, setCenterLocation] = useState({ current: false, label: '서울 성수 기본 위치', latitude: null, longitude: null });
  const nextAction = vehicle?.warningCount > 0
    ? { title: '경고 항목부터 확인하세요', detail: `차량 경고 ${vehicle.warningCount}건이 현대 데이터에 보고되었습니다. 가까운 서비스 거점에서 점검을 예약할 수 있습니다.`, button: '서비스 거점 보기' }
    : vehicle?.nextServiceKm != null
      ? { title: `${Number(vehicle.nextServiceKm).toLocaleString()}km 후 정기 점검 권장`, detail: '차량에 제공된 주행 기준을 바탕으로 다음 점검 시점을 안내합니다.', button: '거점 찾기' }
      : { title: '다음 운행을 위한 거점 저장', detail: '차량별 점검 주기는 현재 제공되지 않아 가까운 블루핸즈를 먼저 저장해 두는 것을 권장합니다.', button: '거점 찾기' };

  const findCenters = useCallback(async (coordinates) => {
    setCenterBusy(true);
    setCenterLocation(coordinates ? {
      current: true,
      label: '현재 위치',
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    } : { current: false, label: '서울 성수 기본 위치', latitude: null, longitude: null });
    try {
      const result = await loadServiceCenters(coordinates);
      setCenterFeed(result);
      if (result.provider?.state === 'ERROR') notify(result.provider.message);
    } catch (error) {
      notify(error.message || '주변 서비스 거점을 불러오지 못했습니다.');
    } finally {
      setCenterBusy(false);
    }
  }, [notify]);

  useEffect(() => { findCenters(); }, [findCenters]);

  function findFromCurrentLocation() {
    setCenterBusy(true);
    getCurrentPosition()
      .then(({ coords }) => findCenters({ latitude: coords.latitude, longitude: coords.longitude, radius: 20000 }))
      .catch((error) => { setCenterBusy(false); notify(locationErrorMessage(error)); });
  }

  return (
    <div className="page container">
      <PageIntro eyebrow="MY CAR CARE" title="차의 신호를 놓치지 않게" description="내 차 상태와 가까운 블루핸즈를 한 화면에서 살펴보세요." actions={vehicle && <button className="button outline" onClick={() => sharePage({ title: `${vehicle.name} 차량 상태`, text: `${vehicle.checkedWarnings ?? 0}개 항목 확인 · 경고 ${vehicle.warningCount ?? 0}건`, path: '#care', notify })}><Share2 size={16} /> 상태 공유</button>} />
      <FeaturePurpose icon={Activity} title="차량 경고를 확인하고 가까운 블루핸즈를 찾는 화면입니다." description="차량 연결 후에는 배터리·주행거리·안전 경고를 확인할 수 있고, 차량 연결 전에도 주변 서비스 거점은 바로 찾을 수 있습니다." steps={['차량 상태 확인', '경고 항목 점검', '블루핸즈 찾기']} />
      {vehicle ? <>
      <section className="vehicle-live-summary panel reveal" data-reveal>
        <div><span className="live-label"><i /> 내 차 상태</span><h2>{vehicle.name}</h2><p>{vehicle.trim} · 마지막 확인 {vehicle.updatedAt ? formatDateTime(vehicle.updatedAt) : '방금 전'}</p></div>
        <div className="live-summary-metrics"><Metric icon={BatteryCharging} label="구동 배터리" value={formatMetric(vehicle.batterySoc, '%')} detail={vehicle.batterySoc == null ? '아직 확인되지 않음' : vehicle.chargingState} /><Metric icon={Navigation} label="주행 가능" value={formatMetric(vehicle.range, 'km')} detail={vehicle.range == null ? '아직 확인되지 않음' : '최근 확인한 값'} /><Metric icon={Gauge} label="누적 주행" value={formatMetric(vehicle.odometer, 'km')} detail={vehicle.odometer == null ? '아직 확인되지 않음' : '최근 확인한 값'} /><Metric icon={Zap} label="목표 충전" value={formatMetric(vehicle.chargingTargetSoc, '%')} detail={vehicle.chargingPlugType ?? '충전기 정보 미제공'} /><Metric icon={Clock3} label="남은 충전" value={formatMetric(vehicle.chargingRemainingMinutes, '분')} detail="목표 충전까지" /></div>
        <small>확인된 정보만 보여드리고, 알 수 없는 값은 억지로 채우지 않아요. · 차량 전송 {formatHyundaiTimestamp(vehicle.dataTimestamp)}</small>
      </section>
      <section className="care-next-action panel reveal" data-reveal aria-label="다음 추천 행동">
        <div className="care-next-icon"><Route size={20} /></div>
        <div><span>NEXT BEST ACTION</span><strong>{nextAction.title}</strong><p>{nextAction.detail}</p></div>
        <button className="button outline" onClick={() => document.getElementById('service-centers')?.scrollIntoView({ behavior: 'smooth' })}>{nextAction.button} <ArrowRight size={15} /></button>
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
      </> : <VehicleConnectPanel onConnect={() => setModal('connect')} />}
      <section className="section-sub service-center-section reveal" data-reveal id="service-centers">
        <div className="service-center-heading">
          <SectionHeading eyebrow="CARE NEAR YOU" title="가까운 블루핸즈" description="현재 위치에서 가까운 현대자동차 서비스 거점을 찾아보세요." />
          <button className="button outline" onClick={findFromCurrentLocation} disabled={centerBusy}>{centerBusy ? <LoaderCircle className="spin" size={16} /> : <LocateFixed size={16} />} 내 위치로 다시 찾기</button>
        </div>
        <section className={`location-status ${centerLocation.current ? 'current' : 'default'}`} aria-live="polite">
          <div><MapPin size={18} /><span><small>{centerLocation.current ? '현재 위치 기준' : '기본 위치 기준'}</small><strong>{centerLocation.current ? `${centerLocation.label} · ${centerLocation.latitude.toFixed(4)}, ${centerLocation.longitude.toFixed(4)}` : centerLocation.label} · 반경 20km</strong></span></div>
          <p>{centerLocation.current ? '현재 위치를 기준으로 가까운 순서로 보여드려요.' : '내 위치로 다시 찾기를 누르면 주변 순서가 바뀝니다.'}</p>
        </section>
        <div className={`provider-inline ${centerFeed.provider?.state === 'CONNECTED' || centerFeed.provider?.state === 'STALE' ? 'live' : 'sample'}`}>
          <span>{centerFeed.provider?.state === 'CONNECTED' ? '지금 확인됨' : centerFeed.provider?.state === 'STALE' ? '최근 확인됨' : '확인 중'}</span>
          <strong>주변 블루핸즈</strong>
          <small>{centerFeed.provider?.state === 'CONNECTED' ? '가까운 순서로 보여드려요.' : '잠시 후 다시 확인해 주세요.'}</small>
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
          {!centerBusy && !centerFeed.centers?.length && <div className="service-center-empty panel"><MapPin size={22} /><strong>서비스 거점을 찾지 못했습니다.</strong><span>위치 권한을 허용하거나 잠시 후 다시 시도해 주세요.</span></div>}
        </div>
      </section>
    </div>
  );
}

function PassportPage({ vehicle, notify, setModal, passport }) {
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
        {timelineEvents.length ? <div className="timeline panel">{timelineEvents.map((event, index) => <div className="timeline-row" key={event.id}><div className="timeline-marker"><span>{index + 1}</span></div><time>{formatDate(event.occurredAt)}</time><div><span>{event.type}</span><strong>{event.title}</strong><p>{event.detail}</p></div><span className="timeline-trust"><ShieldCheck size={13} /> 확인됨</span></div>)}</div> : <div className="empty-records panel"><FileCheck2 size={24} /><strong>아직 남겨진 기록이 없어요.</strong><span>차량을 연결하고 첫 기록을 만들어 보세요.</span></div>}
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
      <ApiCoveragePanel />
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

function OperationBanner({ icon: Icon, label, title, detail, action, tone }) {
  return <section className={`operation-banner ${tone}`}><div><Icon size={20} /></div><div><span>{label}</span><strong>{title}</strong><small>{detail}</small></div>{action && <div>{action}</div>}</section>;
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

function handoverLabel(status) {
  return { INITIATED: '디지털 키 회수 준비', PRIVACY_CLEARED: '개인정보 삭제 완료', PASSPORT_SIGNED: '차량 여권 서명 완료', COMPLETED: '인수인계 완료' }[status] ?? status;
}

function ServiceCard({ number, icon: Icon, title, description, action, onClick, tone }) {
  return <button className={`service-card service-${tone}`} onClick={onClick}><div className="service-card-top"><span>{number}</span><div><Icon size={23} /></div></div><h3>{title}</h3><p>{description}</p><span className="service-action">{action}<ArrowRight size={15} /></span></button>;
}

function SectionHeading({ eyebrow, title, description }) {
  return <div className="section-heading"><span>{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>;
}

function PageIntro({ eyebrow, title, description, actions }) {
  const visual = pageHeroVisuals[eyebrow] ?? { src: '/space-drive-08-v1.webp', index: '00', label: 'LIFE PASS' };
  return <section className="page-intro"><img className="page-intro-media" src={visual.src} alt="" fetchPriority="high" /><div className="page-intro-shade" /><div className="page-intro-orbit" aria-hidden="true"><i /></div><div className="page-intro-content"><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-intro-actions">{actions}</div>}<div className="page-intro-scene" aria-hidden="true"><span>{visual.index}</span><i /><small>{visual.label}</small></div></section>;
}

function FeaturePurpose({ icon: Icon, title, description, steps }) {
  return <section className="feature-purpose reveal" data-reveal aria-label="기능 설명"><div className="feature-purpose-icon"><Icon size={19} /></div><div className="feature-purpose-copy"><span>이 기능은 무엇인가요?</span><strong>{title}</strong><p>{description}</p></div><ol>{steps.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol></section>;
}

function ApiCoveragePanel() {
  return <section className="api-coverage reveal" data-reveal aria-labelledby="api-coverage-title"><div className="api-coverage-heading"><span>CONNECTED DATA MAP</span><h2 id="api-coverage-title">어떤 API가 실제로 연결되어 있나요?</h2><p>공개 규격과 현재 프로젝트 승인 범위를 분리해 보여드립니다. 제공되지 않는 값은 추정하지 않습니다.</p></div><div className="api-coverage-grid"><article><span>01 · ACCOUNT</span><strong>계정·차량 연결</strong><p>현대 통합계정 OAuth, 사용자 확인, 동의 차량 목록, 커넥티드 서비스 계약기간</p><small>현재 연동</small></article><article><span>02 · VEHICLE STATUS</span><strong>차량 상태 11종+</strong><p>배터리, 주행 가능 거리, 누적 주행거리, 충전 여부·목표량·남은 시간, 7종 경고</p><small>현재 연동</small></article><article><span>03 · NEARBY LIFE</span><strong>충전·정비 인프라</strong><p>한국환경공단 충전기 현황과 Kakao 위치·지도·블루핸즈 검색</p><small>현재 연동</small></article><article className="planned"><span>04 · NEXT APPROVAL</span><strong>다음 확장 후보</strong><p>차량 제원·옵션, 운행 기록, 최종 주차 위치, 고장코드, 안전운전점수</p><small>현대차 추가 승인·규격 확인 필요</small></article></div></section>;
}

function Metric({ icon: Icon, label, value, detail }) {
  return <div className="metric"><Icon size={19} /><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>;
}

function ActionRow({ icon: Icon, color, title, detail, badge, onClick }) {
  return <button className="action-row" onClick={onClick}><div className={`action-icon ${color}`}><Icon size={18} /></div><div><strong>{title}</strong><span>{detail}</span></div><em>{badge}</em><ChevronRight size={17} /></button>;
}

function JourneyStep({ icon: Icon, number, title, detail, done = false, onClick }) {
  return <button className={`journey-step ${done ? 'done' : ''}`} onClick={onClick} aria-label={`${number} ${title} ${done ? '완료' : '시작하기'}`}><div><Icon size={20} /></div><span>{done ? <CheckCircle2 size={15} /> : number}</span><h3>{title}</h3><p>{detail}</p><strong className="journey-cta">{done ? '다시 확인' : '시작하기'} <ArrowRight size={14} /></strong></button>;
}

function PassportScore({ label, value, unit, note }) {
  return <div className="passport-score"><span>{label}</span><div><strong>{value}</strong><small>{unit}</small></div><em><Check size={11} />{note}</em></div>;
}

function SiteFooter({ navigate }) {
  return (
    <footer className="site-footer">
      <div className="container">
        <div><strong>HYUNDAI LIFE PASS</strong><span>내 차를 더 잘 알고, 더 편하게 돌보는 하루</span></div>
        <nav aria-label="서비스 정책"><button onClick={() => navigate('guide')}>처음 이용하기</button><button onClick={() => navigate('settings')}>내 정보</button><button onClick={() => navigate('privacy')}>개인정보 안내</button><button onClick={() => navigate('terms')}>이용 안내</button></nav>
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

function LegalPage({ type }) {
  const privacy = type === 'privacy';
  return (
    <div className="page container legal-page">
      <PageIntro eyebrow={privacy ? 'YOUR PRIVACY' : 'SERVICE GUIDE'} title={privacy ? '개인정보 처리 안내' : '서비스 이용안내'} description="차량 생활을 편하게 돕는 동안 내 정보가 어떻게 다뤄지는지 쉽게 알려드려요." />
      <section className="panel legal-card">
        <span>2026년 9월 3일 기준</span>
        {privacy ? <>
          <h2>무엇을 확인하나요?</h2><p>차량을 연결하기 전에는 서비스 이용에 필요한 최소 정보만 사용합니다. 차량을 연결한 뒤에는 내가 허락한 범위에서 차종·주행거리·배터리·충전 상태·안전 점검 정보를 확인합니다.</p>
          <h2>어떻게 지키나요?</h2><p>차량 정보는 안전하게 보관하고 화면에는 필요한 내용만 보여드려요. 비밀번호는 이곳에 저장하지 않습니다.</p>
          <h2>언제든 끊을 수 있어요</h2><p>설정에서 ‘연결 해제·정보 삭제’를 누르면 차량 연결과 함께 저장된 관련 정보도 삭제합니다.</p>
          <h2>위치 정보는요?</h2><p>충전소와 블루핸즈를 찾을 때만 현재 위치를 잠시 사용하고, 위치 자체는 저장하지 않습니다.</p>
        </> : <>
          <h2>무엇을 할 수 있나요?</h2><p>주변 충전소와 블루핸즈를 찾고, 전화와 길 안내를 이용할 수 있어요. 차량을 연결하면 내 차 상태와 기록도 함께 볼 수 있습니다.</p>
          <h2>출발 전 한 번 더 확인해 주세요</h2><p>충전기 사용 가능 여부와 서비스 거점 운영 시간은 현장 상황에 따라 달라질 수 있습니다. 출발 전 한 번 더 확인하면 더 안심할 수 있어요.</p>
          <h2>현대자동차와의 관계</h2><p>HYUNDAI LIFE PASS는 현대자동차 공식 홈페이지가 아닌 독립 서비스입니다. 차량 정보는 사용자가 직접 허락한 경우에만 확인합니다.</p>
        </>}
        <div className="legal-contact"><strong>문의 및 개선 제안</strong><a href="https://github.com/boclair98/hyundai-life-pass/issues" target="_blank" rel="noreferrer">GitHub Issues에서 문의하기 <ArrowRight size={14} /></a></div>
      </section>
    </div>
  );
}

function MobileNav({ page, navigate }) {
  return <nav className="mobile-nav" aria-label="모바일 주요 메뉴">{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={21} /><span>{label}</span></button>)}</nav>;
}

function Modal({ vehicle, platform, close, notify, actions, busy }) {
  useEffect(() => {
    const onKeyDown = (event) => event.key === 'Escape' && close();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [close]);
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
