import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BatteryCharging,
  Bell,
  CalendarClock,
  CarFront,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleGauge,
  Clock3,
  CloudCog,
  Code2,
  FileCheck2,
  Gauge,
  KeyRound,
  LocateFixed,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Menu,
  Navigation,
  Plus,
  RefreshCcw,
  Route,
  Search,
  Settings2,
  Share2,
  ShieldCheck,
  Smartphone,
  ThermometerSun,
  Trash2,
  UserRound,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  hyundaiAuthorizationPath,
  loadAuditLogs,
  loadChargingStations,
  loadPassport,
  loadPlatform,
  loadReleases,
  loadServiceCenters,
  readNotification,
  revokeHyundaiConnection,
  syncHyundaiVehicles,
  loadVehicles,
} from './api';
import { releases } from './data';
import './app.css';

const navigation = [
  { id: 'home', label: '홈', icon: CarFront },
  { id: 'charge', label: '충전', icon: BatteryCharging },
  { id: 'care', label: '내 차 케어', icon: Activity },
  { id: 'passport', label: '차량 여권', icon: FileCheck2 },
  { id: 'settings', label: '설정', icon: Settings2 },
];

const validPages = new Set([...navigation.map((item) => item.id), 'lab', 'privacy', 'terms', 'guide']);

const hyundaiStatusLabel = (provider) => {
  if (!provider) return '상태 확인 중';
  if (provider.mode !== 'LIVE') return 'API 연결 준비';
  return {
    CONNECTED: '내 차 연결됨',
    STALE: '동기화 지연',
    OAUTH_REQUIRED: '로그인 필요',
    CONSENT_REQUIRED: '정보 제공 동의 필요',
    REVOKED: '다시 연결 필요',
    MISCONFIGURED: 'API 설정 필요',
    ERROR: '연결 점검 필요',
  }[provider.state] ?? provider.state;
};

export default function App() {
  const initialPage = window.location.hash.replace('#', '');
  const [page, setPage] = useState(validPages.has(initialPage) ? initialPage : 'home');
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [dataSource, setDataSource] = useState('loading');
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [platform, setPlatform] = useState({ stations: [], chargingReservations: [], serviceBookings: [], handovers: [], notifications: [], unreadNotifications: 0, environment: 'LOADING', providers: [] });
  const [liveReleases, setLiveReleases] = useState([]);
  const [passport, setPassport] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
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

  const refreshLab = useCallback(async () => {
    const [releaseItems, auditItems] = await Promise.all([loadReleases(), loadAuditLogs()]);
    setLiveReleases(releaseItems);
    setAuditLogs(auditItems);
  }, []);

  useEffect(() => {
    refreshPlatform().catch(() => undefined);
  }, [refreshPlatform]);

  useEffect(() => {
    if (!vehicle?.databaseId) return;
    loadPassport(vehicle.databaseId).then(setPassport).catch(() => setPassport(null));
  }, [vehicle?.databaseId]);

  useEffect(() => {
    if (page !== 'lab') return undefined;
    refreshLab().catch(() => undefined);
    const timer = window.setInterval(() => refreshLab().catch(() => undefined), 10000);
    return () => window.clearInterval(timer);
  }, [page, refreshLab]);

  useEffect(() => {
    const onHashChange = () => {
      const nextPage = window.location.hash.replace('#', '');
      if (validPages.has(nextPage)) setPage(nextPage);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

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
      'consent-error': '차량 정보 제공 동의를 완료하지 못했습니다. 현대 Developers 프로젝트의 데이터 API 설정을 확인해 주세요.',
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

  const shared = { vehicle, navigate, notify, setModal, platform, liveReleases, passport, auditLogs, actions, busy };

  return (
    <div className="app">
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

      <DataProvenanceBar platform={platform} actions={actions} busy={busy} />
      {refreshError && <div className="connectivity-banner" role="alert"><span>일부 실시간 정보를 불러오지 못했습니다.</span><button onClick={() => refreshPlatform().catch(() => undefined)}>다시 시도</button></div>}

      <main>
        {page === 'home' && <HomePage {...shared} />}
        {page === 'charge' && <ChargePage {...shared} />}
        {page === 'care' && <CarePage {...shared} />}
        {page === 'passport' && <PassportPage {...shared} />}
        {page === 'settings' && <SettingsPage {...shared} />}
        {page === 'lab' && <CanaryLab {...shared} />}
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

function DataProvenanceBar({ platform, actions, busy }) {
  const [expanded, setExpanded] = useState(false);
  const providers = platform.providers ?? [];
  if (!providers.length) return null;
  const hyundai = providers.find((provider) => provider.id === 'hyundai-connected-car');
  const isLive = (provider) => provider.mode === 'LIVE' && ['CONNECTED', 'STALE'].includes(provider.state);
  const liveCount = providers.filter(isLive).length;
  const environmentLabel = platform.environment === 'LIVE' ? '실데이터 운영' : platform.environment === 'HYBRID' ? '하이브리드 운영' : '시뮬레이션 환경';
  return (
    <aside className={`data-provenance ${platform.environment?.toLowerCase()} ${expanded ? 'open' : ''}`} aria-label="데이터 연결 상태">
      <div className="container">
        <div className="provenance-summary">
          <strong><i />{environmentLabel}</strong>
          <span className="provenance-mobile-summary">{liveCount ? `${liveCount}/${providers.length} 실시간 연결` : `${providers.length}개 샘플 소스`}</span>
          <button className="provenance-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>출처 <ChevronDown size={14} /></button>
        </div>
        <div className="provenance-details">
          <div className="provider-list">{providers.map((provider) => <span key={provider.id} className={isLive(provider) ? 'live' : 'sample'} title={provider.message}><i />{provider.name}: {isLive(provider) ? (provider.state === 'STALE' ? '지연' : '실시간') : provider.state === 'OAUTH_REQUIRED' ? '연결 필요' : provider.state === 'CONSENT_REQUIRED' ? '동의 필요' : provider.state === 'MISCONFIGURED' ? '설정 필요' : provider.state === 'REVOKED' ? '철회됨' : provider.state === 'ERROR' ? '오류' : '샘플'}</span>)}</div>
          <small>{platform.environment === 'LIVE' ? '연결된 공식 공급자에서 갱신됩니다.' : '현재 샘플은 기능의 사용 형태만 보여줍니다. API 키 연결 전에는 실제 데이터로 표시하지 않습니다.'}</small>
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
    notify('Hyundai Developers 프로젝트 키를 연결하면 실제 현대 통합계정 로그인이 열립니다.');
  };
  return (
    <header className="site-header">
      <div className="header-inner">
        <button className="brand" onClick={() => navigate('home')} aria-label="현대 라이프패스 홈">
          <span className="hyundai-mark">H</span>
          <span className="brand-copy"><strong>HYUNDAI</strong><small>LIFE PASS</small></span>
          <span className="concept-chip">PORTFOLIO CONCEPT</span>
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
            {alertsOpen && <div className="notification-panel"><div><strong>알림 센터</strong><span>{platform.environment === 'LIVE' ? '실데이터 동기화' : platform.environment === 'HYBRID' ? '일부 실데이터 연결' : '샘플 데이터 환경'}</span></div>{platform.notifications?.length ? platform.notifications.slice(0, 5).map((item) => <button key={item.id} className={item.read ? 'read' : ''} onClick={() => actions.markNotification(item.id)}><span>{item.category}</span><strong>{item.title}</strong><small>{item.message}</small></button>) : <p>새로운 알림이 없습니다.</p>}</div>}
          </div>
          <button className={`account-button ${connected ? 'connected' : ''}`} disabled={busy} onClick={accountAction}><UserRound size={16} /><span><small>현대 통합계정</small><strong>{connected && hyundai?.accountName ? `${hyundai.accountName}님` : hyundaiStatusLabel(hyundai)}</strong></span></button>
          <button className="mobile-menu-button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}>{menuOpen ? <X size={21} /> : <Menu size={21} />}{platform.unreadNotifications > 0 && <i className="notification-count">{platform.unreadNotifications}</i>}</button>
        </div>
      </div>

      {menuOpen && (
        <div className="mobile-drawer">
          <div className="mobile-vehicle"><span>{vehicle?.name ?? '연결된 차량 없음'}</span><strong>{vehicle?.plate ?? '현대 계정 연결 필요'}</strong><small>{dataSource === 'platform' ? '실차 데이터 연결' : dataSource === 'error' ? '서버 연결 점검 필요' : '게스트 모드'}</small></div>
          <div className={`mobile-account ${connected ? 'connected' : ''}`}><div><UserRound size={19} /><span><small>현대 통합계정</small><strong>{connected && hyundai?.accountName ? `${hyundai.accountName}님` : hyundaiStatusLabel(hyundai)}</strong></span></div><button disabled={busy} onClick={accountAction}>{connected ? '새로고침' : hyundai?.state === 'CONSENT_REQUIRED' ? '동의 계속' : '연결하기'}</button></div>
          {navigation.map((item) => <button key={item.id} onClick={() => navigate(item.id)}><item.icon size={18} />{item.label}<ChevronRight size={16} /></button>)}
        </div>
      )}
    </header>
  );
}

function HomePage({ vehicle, navigate, setModal }) {
  const connected = Boolean(vehicle);
  const careSummary = connected ? vehicle.warningCount > 0
    ? `확인이 필요한 차량 경고 ${vehicle.warningCount}건`
    : vehicle.checkedWarnings > 0 ? `${vehicle.checkedWarnings}개 상태 항목 이상 없음` : '차량 상태를 새로고침해 주세요' : '전화와 카카오맵 길찾기';
  return (
    <>
      <section className="home-hero">
        <img
          src="/hyundai-life-orbit-hero-v2.jpg"
          alt="별빛이 흐르는 미래 도시의 현대 전기차와 충전 네트워크"
          fetchPriority="high"
        />
        <div className="hero-shade" />
        <div className="hero-chapter" aria-hidden="true"><span>01</span><i /><small>CONNECTED MOBILITY</small></div>
        <div className="hero-content container">
          <div className="hero-copy">
            <div className="overline"><i /> HYUNDAI LIFE PASS</div>
            <h1>차의 오늘부터<br /><em>다음 여정까지.</em></h1>
            <p>충전소·서비스 거점·차량 상태·연결 기록을 하나로.<br />오늘 필요한 카라이프 기능부터 바로 시작합니다.</p>
            <div className="hero-buttons">
              <button className="button primary" onClick={() => setModal('connect')}>{connected ? '내 차 새로고침' : '현대차 연결하기'} <ArrowRight size={17} /></button>
              <button className="button glass" onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}>서비스 둘러보기</button>
            </div>
          </div>
        </div>
        <div className={`hero-status container ${connected ? '' : 'guest'}`}>
          {connected ? <>
            <div><span className="status-dot" /><p>현재 연결 차량</p><strong>{vehicle.name}</strong></div>
            <div><BatteryCharging size={20} /><p>배터리</p><strong>{formatMetric(vehicle.batterySoc, '%')}</strong></div>
            <div><Navigation size={20} /><p>주행 가능</p><strong>{formatMetric(vehicle.range, 'km')}</strong></div>
            <div><Gauge size={20} /><p>누적 주행</p><strong>{formatMetric(vehicle.odometer, 'km')}</strong></div>
            <button onClick={() => setModal('connect')}>차량 동기화 <RefreshCcw size={16} /></button>
          </> : <>
            <div className="guest-status-copy"><UserRound size={20} /><p>현재 게스트 모드</p><strong>차량 정보 없이 충전소와 블루핸즈를 먼저 찾아보세요.</strong></div>
            <button onClick={() => setModal('connect')}>내 현대차 연결 <ArrowRight size={16} /></button>
          </>}
        </div>
      </section>

      <section className="section container" id="services">
        <SectionHeading eyebrow="ONE CONNECTED JOURNEY" title="한 번 연결하면, 차의 모든 순간이 이어집니다." description="매일 쓰는 기능부터 미래의 차량 가치까지 네 가지 경험으로 정리했습니다." />
        <div className="service-grid">
          <ServiceCard number="01" icon={BatteryCharging} title="실시간 충전" description="공공데이터로 충전기 사용 가능 상태를 확인하고 카카오맵 길찾기로 이어집니다." action="충전소 찾기" onClick={() => navigate('charge')} tone="blue" />
          <ServiceCard number="02" icon={Activity} title="서비스 케어" description="실제 현대자동차·블루핸즈 거점을 현재 위치에서 가까운 순서로 찾습니다." action="서비스 거점 찾기" onClick={() => navigate('care')} tone="sky" />
          <ServiceCard number="03" icon={CloudCog} title="차량 상태" description="배터리·주행 정보와 타이어·오일 등 7종 차량 경고를 현대 계정에서 확인합니다." action="내 차 연결하기" onClick={() => navigate('care')} tone="navy" />
          <ServiceCard number="04" icon={FileCheck2} title="연결 기록" description="Life Pass에서 실제로 생성된 차량 이벤트와 무결성 서명을 확인합니다." action="차량 기록 열기" onClick={() => navigate('passport')} tone="ice" />
        </div>
      </section>

      <section className="section section-soft">
        <div className="container vehicle-today-grid">
          <div>
            <SectionHeading eyebrow="TODAY'S VEHICLE" title="오늘의 내 차" description="복잡한 센서 정보 대신 지금 필요한 것만 보여드립니다." />
            {connected ? <div className="vehicle-summary-card">
              <div className="vehicle-summary-top"><div><span className="connected"><i /> 현대 커넥티드카 연결</span><h3>{vehicle.name}</h3><p>{vehicle.trim} · {vehicle.plate}</p></div><div className="health-score"><span>SYNC</span><strong>LIVE</strong></div></div>
              <div className="summary-metrics">
                <Metric icon={BatteryCharging} label="배터리" value={formatMetric(vehicle.batterySoc, '%')} detail={vehicle.range == null ? '주행 가능 거리 미제공' : `${vehicle.range.toLocaleString()}km 주행 가능`} />
                <Metric icon={Gauge} label="누적 주행" value={formatMetric(vehicle.odometer, 'km')} detail="현대차 데이터 동기화" />
                <Metric icon={ShieldCheck} label="차량 경고" value={vehicle.warningCount > 0 ? `${vehicle.warningCount}건` : vehicle.checkedWarnings > 0 ? '이상 없음' : '미제공'} detail={`${vehicle.checkedWarnings ?? 0}/7개 항목 확인`} />
              </div>
              <div className="vehicle-location"><RefreshCcw size={15} /><span>현대 통합계정에서 동기화됨</span><small>{vehicle.updatedAt ? formatDateTime(vehicle.updatedAt) : '갱신 확인 중'}</small></div>
            </div> : <VehicleConnectPanel onConnect={() => setModal('connect')} compact />}
          </div>

          <div className="next-actions">
            <div className="next-actions-head"><span>지금 필요한 일</span><strong>2</strong></div>
            <ActionRow icon={BatteryCharging} color="blue" title="가까운 충전소 찾기" detail="실시간 충전 가능 여부와 길찾기" badge="바로 사용" onClick={() => navigate('charge')} />
            <ActionRow icon={Wrench} color="orange" title={connected ? '내 차 점검 상태 확인' : '가까운 블루핸즈 찾기'} detail={careSummary} badge={connected ? (vehicle.warningCount > 0 ? '확인 필요' : '내 차') : '게스트'} onClick={() => navigate('care')} />
            {connected && <ActionRow icon={ShieldCheck} color="green" title="차량 연결 기록 확인" detail="실제로 저장된 이벤트의 서명 검증" badge="기록" onClick={() => navigate('passport')} />}
          </div>
        </div>
      </section>

      <section className="section container">
        <SectionHeading eyebrow="VEHICLE LIFECYCLE" title="출고부터 다음 오너까지" description="차량의 시간이 끊기지 않도록 모든 기록을 하나의 여권에 쌓습니다." />
        <div className="journey">
          <JourneyStep icon={CarFront} number="01" title="차량 연결" detail="커넥티드 계정과 차량 신원을 안전하게 연결" />
          <JourneyStep icon={Activity} number="02" title="운행·케어" detail="충전과 정비 이벤트를 자동으로 기록" />
          <JourneyStep icon={CloudCog} number="03" title="소프트웨어" detail="OTA 버전과 안전 검증 결과를 저장" />
          <JourneyStep icon={KeyRound} number="04" title="안전한 이전" detail="개인정보를 지우고 검증 기록만 다음 오너에게 전달" />
        </div>
      </section>

      <section className="developer-teaser">
        <div className="container developer-teaser-inner"><div><span>FOR HYUNDAI SOFTWARE ENGINEERS</span><h2>소비자 경험 뒤의 안전 기술까지.</h2><p>차량군별 Canary OTA, 이상 탐지, 자동 롤백을 별도 운영 콘솔에서 시연합니다.</p></div><button className="button light" onClick={() => navigate('lab')}>Developer Lab 열기 <ArrowRight size={16} /></button></div>
      </section>
    </>
  );
}

function ChargePage({ vehicle, notify, platform, actions, busy }) {
  const [chargerFeed, setChargerFeed] = useState(() => ({
    stations: platform.stations ?? [],
    provider: platform.providers?.find((provider) => provider.id === 'ev-charger') ?? null,
    search: { latitude: 37.5446, longitude: 127.0559, locationLabel: '서울 성수 기본 위치', radiusKm: 30 },
  }));
  const [locationBusy, setLocationBusy] = useState(false);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);
  const stationList = useMemo(() => (chargerFeed.stations ?? []).map((item) => ({ ...item, distance: `${item.distanceKm.toFixed(1)}km`, speed: `${item.speedKw}kW`, price: `${item.pricePerKwh}원/kWh`, eta: `${item.etaMinutes}분` })), [chargerFeed.stations]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [search, setSearch] = useState('');
  const visibleStations = useMemo(() => stationList.filter((station) => `${station.name} ${station.address} ${station.operator}`.toLowerCase().includes(search.trim().toLowerCase())), [stationList, search]);
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

  const findFromCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      notify('이 기기에서는 위치 기능을 사용할 수 없습니다.');
      return;
    }
    setLocationBusy(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => loadFromCoordinates({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => {
        setLocationBusy(false);
        setUsingCurrentLocation(false);
        const message = error.code === 1
          ? '위치 권한이 꺼져 있습니다. 브라우저 설정에서 이 사이트의 위치 권한을 허용해 주세요.'
          : '현재 위치를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
        notify(message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 },
    );
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
      <PageIntro eyebrow="SMART CHARGE" title="내 주변 충전소" description="현재 위치에서 가까운 충전소와 실시간 사용 가능 충전기를 확인합니다." actions={<button className="button primary location-button" onClick={findFromCurrentLocation} disabled={locationBusy}>{locationBusy ? <LoaderCircle className="spin" size={17} /> : <LocateFixed size={17} />}{locationBusy ? '위치 확인 중' : '내 위치로 찾기'}</button>} />
      <section className={`location-status ${usingCurrentLocation ? 'current' : 'default'}`} aria-live="polite">
        <div><MapPin size={18} /><span><small>{usingCurrentLocation ? '현재 위치 기준' : '기본 위치 기준'}</small><strong>{chargerFeed.search?.locationLabel ?? '서울 성수'} · 반경 {Math.round(chargerFeed.search?.radiusKm ?? 30)}km</strong></span></div>
        <p>{usingCurrentLocation ? '기기의 현재 좌표를 서버에 일시 전달해 거리만 계산하며 브라우저에 저장하지 않습니다.' : '내 위치로 찾기를 누르고 위치 권한을 허용하면 실제 현재 위치 기준으로 바뀝니다.'}</p>
      </section>
      {chargerProvider && <div className={`provider-inline ${chargerLive ? 'live' : 'sample'}`}><span>{chargerLive ? 'LIVE DATA' : chargerProvider.mode === 'LIVE' ? 'LIVE ERROR' : 'SAMPLE DATA'}</span><strong>{chargerProvider.source}</strong><small>{chargerProvider.message}</small></div>}
      <OperationBanner tone={chargerLive ? 'ready' : 'active'} icon={BatteryCharging} label="실시간 충전소 탐색" title={chargerLive ? '사용 가능한 충전기를 확인하고 바로 길찾기 하세요.' : '충전소 데이터를 불러오지 못했습니다.'} detail={chargerLive ? '공공데이터는 위치와 충전기 상태를 제공하며 예약·결제는 지원하지 않습니다.' : '잠시 후 새로고침하거나 공급자 상태를 확인해 주세요.'} />
      <div className="charge-layout">
        <section className="charge-map panel">
          <div className="map-search"><Search size={18} /><input value={search} placeholder="충전소명·주소·운영기관 검색" onChange={(event) => setSearch(event.target.value)} aria-label="충전소 검색" /><button aria-label="검색어 지우기" onClick={() => setSearch('')}><X size={17} /></button></div>
          <KakaoStationMap stations={visibleStations} selectedStation={activeStation} onSelect={setSelectedStation} notify={notify} userLocation={usingCurrentLocation ? chargerFeed.search : null} />
        </section>
        <aside className="station-panel panel">
          <div className="station-panel-head"><span>가까운 충전소</span><small>{chargerLive ? '공공데이터 실시간' : '연결 확인 중'}</small></div>
          {visibleStations.map((station) => (
            <button key={station.id} className={`station-row ${activeStation?.id === station.id ? 'active' : ''}`} onClick={() => setSelectedStation(station)}>
              <div className="station-availability"><strong>{station.available}</strong><span>/{station.total}</span></div>
              <div><strong>{station.name}</strong><span>{station.distance} · {station.speed} · {station.eta}</span><small>{station.operator} · {station.statusLabel}</small></div>
              <ChevronRight size={16} />
            </button>
          ))}
          {activeStation ? <div className="station-detail">
            <div><span>선택한 충전소</span><strong>{activeStation.name}</strong><p>{activeStation.address}</p></div>
            <div className="charge-price"><span>표시 요금</span><strong>{activeStation.price}</strong><small>{activeStation.operator} 제공 범위</small></div>
            <button className="button primary full" onClick={() => window.open(`https://map.kakao.com/link/to/${encodeURIComponent(activeStation.name)},${activeStation.latitude},${activeStation.longitude}`, '_blank', 'noopener,noreferrer')}><Navigation size={16} />카카오맵에서 길찾기</button>
          </div> : <div className="station-empty"><MapPin size={22} /><strong>{stationList.length ? '검색 결과가 없습니다.' : '충전소를 불러오는 중입니다.'}</strong><span>{stationList.length ? '다른 충전소명이나 지역을 입력해 보세요.' : '데이터 연결에 실패하면 잠시 후 다시 시도해 주세요.'}</span></div>}
        </aside>
      </div>
      <div className="charge-plan-grid">
        <div className="panel plan-card"><div className="plan-icon"><Clock3 size={20} /></div><div><span>데이터 갱신</span><strong>{chargerProvider?.refreshedAt ? formatDateTime(chargerProvider.refreshedAt) : '확인 중'}</strong><p>공공데이터 공급 상태에 따라 실제 현장과 차이가 날 수 있습니다.</p></div></div>
        <div className="panel plan-card"><div className="plan-icon"><Route size={20} /></div><div><span>예약·결제 안내</span><strong>현재는 길찾기까지 제공</strong><p>충전사업자 제휴 전에는 예약이나 결제가 발생하지 않습니다.</p></div></div>
      </div>
    </div>
  );
}

let kakaoSdkPromise;
function loadKakaoSdk(key) {
  if (window.kakao?.maps) return Promise.resolve(window.kakao);
  if (!kakaoSdkPromise) {
    kakaoSdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
      script.onload = () => window.kakao.maps.load(() => resolve(window.kakao));
      script.onerror = () => reject(new Error('Kakao Maps SDK load failed'));
      document.head.appendChild(script);
    });
  }
  return kakaoSdkPromise;
}

function KakaoStationMap({ stations: stationItems, selectedStation, onSelect, notify, userLocation }) {
  const mapElement = useRef(null);
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
      const bounds = new kakao.maps.LatLngBounds();
      stationItems.forEach((station) => {
        const position = new kakao.maps.LatLng(station.latitude, station.longitude);
        bounds.extend(position);
        const marker = new kakao.maps.Marker({ position, map });
        kakao.maps.event.addListener(marker, 'click', () => onSelect(station));
      });
      if (userLocation) {
        const current = new kakao.maps.LatLng(userLocation.latitude, userLocation.longitude);
        bounds.extend(current);
        new kakao.maps.Circle({ center: current, radius: 80, strokeWeight: 3, strokeColor: '#00aad2', strokeOpacity: 1, fillColor: '#00aad2', fillOpacity: .28, map });
      }
      if (stationItems.length > 1) map.setBounds(bounds, 48, 48, 48, 48);
      setMapReady(true);
    }).catch(() => notifyRef.current('카카오 지도 키 또는 허용 도메인을 확인해 주세요.'));
    return () => { cancelled = true; };
  }, [key, stationItems, selectedStation?.id, onSelect, userLocation?.latitude, userLocation?.longitude]);

  if (key) return <div ref={mapElement} className={`map-surface kakao-map ${mapReady ? 'ready' : ''}`} aria-label="카카오 실지도 기반 충전소 지도" />;
  return (
    <div className="map-surface" aria-label="API 연결 전 충전소 지도 사용 예시">
      <div className="road road-a" /><div className="road road-b" /><div className="road road-c" />
      <div className="map-river" />
      {stationItems.slice(0, 6).map((station, index) => <button key={station.id} style={{ left: `${18 + (index % 3) * 29}%`, top: `${24 + Math.floor(index / 3) * 40}%` }} className={`map-pin ${selectedStation.id === station.id ? 'active' : ''}`} onClick={() => onSelect(station)}><Zap size={16} fill="currentColor" /><span>{station.available}</span></button>)}
      <div className="my-location"><Navigation size={14} fill="currentColor" /></div>
    </div>
  );
}

function CarePage({ vehicle, notify, setModal, platform, actions, busy }) {
  const [centerFeed, setCenterFeed] = useState({ centers: [], provider: null });
  const [centerBusy, setCenterBusy] = useState(true);

  const findCenters = useCallback(async (coordinates) => {
    setCenterBusy(true);
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
    if (!navigator.geolocation) {
      notify('이 기기에서는 위치 기능을 사용할 수 없습니다.');
      return;
    }
    setCenterBusy(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => findCenters({ latitude: coords.latitude, longitude: coords.longitude, radius: 20000 }),
      () => { setCenterBusy(false); notify('위치 권한을 허용하면 가까운 순서로 다시 찾아드려요.'); },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 },
    );
  }

  return (
    <div className="page container">
      <PageIntro eyebrow="CONNECTED VEHICLE HEALTH" title="차가 보내는 신호를 바로" description="현대 통합계정의 실제 차량 상태와 가까운 블루핸즈를 한 화면에서 확인합니다." actions={vehicle && <button className="button outline" onClick={() => navigator.share ? navigator.share({ title: `${vehicle.name} 차량 상태`, text: `${vehicle.checkedWarnings ?? 0}개 항목 확인 · 경고 ${vehicle.warningCount ?? 0}건` }).catch(() => undefined) : notify('이 기기에서는 공유 기능을 지원하지 않습니다.')}><Share2 size={16} /> 상태 공유</button>} />
      {vehicle ? <>
      <section className="vehicle-live-summary panel">
        <div><span className="live-label"><i /> HYUNDAI CONNECTED DATA</span><h2>{vehicle.name}</h2><p>{vehicle.trim} · 마지막 동기화 {vehicle.updatedAt ? formatDateTime(vehicle.updatedAt) : '방금 전'}</p></div>
        <div className="live-summary-metrics"><Metric icon={BatteryCharging} label="구동 배터리" value={formatMetric(vehicle.batterySoc, '%')} detail={vehicle.batterySoc == null ? '이 차량에서 미제공' : vehicle.chargingState} /><Metric icon={Navigation} label="주행 가능" value={formatMetric(vehicle.range, 'km')} detail={vehicle.range == null ? '이 차량에서 미제공' : '현대차 제공값'} /><Metric icon={Gauge} label="누적 주행" value={formatMetric(vehicle.odometer, 'km')} detail={vehicle.odometer == null ? '이 차량에서 미제공' : '현대차 제공값'} /></div>
        <small>표시 값은 현대자동차가 해당 차량에 제공한 항목만 사용합니다. 응답이 없는 값은 0으로 꾸미지 않고 ‘미제공’으로 표시합니다.</small>
      </section>
      <section className="section-sub vehicle-health-section">
        <div className="health-section-heading">
          <SectionHeading eyebrow="7-POINT VEHICLE CHECK" title="차량 경고 상태" description="계기판에서 놓치기 쉬운 주요 경고를 현대 차량 데이터로 확인합니다." />
          <div className={`health-result ${vehicle.warningCount > 0 ? 'warning' : vehicle.checkedWarnings > 0 ? 'clear' : 'unknown'}`}><strong>{vehicle.warningCount > 0 ? `${vehicle.warningCount}건 확인 필요` : vehicle.checkedWarnings > 0 ? '확인 항목 이상 없음' : '상태 미제공'}</strong><span>{vehicle.checkedWarnings ?? 0}/7개 응답</span></div>
        </div>
        <div className="health-check-grid">
          {(vehicle.healthChecks ?? []).map((check) => <article className={`health-check-card panel ${check.state.toLowerCase()}`} key={check.id}><span className="health-check-icon">{check.state === 'WARNING' ? <Wrench size={19} /> : check.state === 'CLEAR' ? <CheckCircle2 size={19} /> : <CircleGauge size={19} />}</span><div><strong>{check.label}</strong><small>{check.state === 'WARNING' ? '차량 점검이 필요합니다' : check.state === 'CLEAR' ? '현재 경고 없음' : '이 차량에서 미제공'}</small></div><b>{check.state === 'WARNING' ? '확인 필요' : check.state === 'CLEAR' ? '정상' : '미제공'}</b></article>)}
        </div>
        {vehicle.connectedService && <div className="connected-service-card panel"><div><CloudCog size={21} /><span><small>BLUELINK CONTRACT</small><strong>커넥티드 서비스</strong></span></div><dl><div><dt>가입일</dt><dd>{formatHyundaiDate(vehicle.connectedService.subscribeDate)}</dd></div><div><dt>무료 서비스 종료일</dt><dd>{formatHyundaiDate(vehicle.connectedService.endDate)}</dd></div></dl></div>}
      </section>
      </> : <VehicleConnectPanel onConnect={() => setModal('connect')} />}
      <section className="section-sub service-center-section" id="service-centers">
        <div className="service-center-heading">
          <SectionHeading eyebrow="LIVE SERVICE NETWORK" title="가까운 블루핸즈" description="카카오 장소 데이터에서 실제 현대자동차 서비스 거점을 가까운 순서로 찾습니다." />
          <button className="button outline" onClick={findFromCurrentLocation} disabled={centerBusy}>{centerBusy ? <LoaderCircle className="spin" size={16} /> : <LocateFixed size={16} />} 내 위치로 다시 찾기</button>
        </div>
        <div className={`provider-inline ${centerFeed.provider?.state === 'CONNECTED' || centerFeed.provider?.state === 'STALE' ? 'live' : 'sample'}`}>
          <span>{centerFeed.provider?.state === 'CONNECTED' ? 'LIVE DATA' : centerFeed.provider?.state === 'STALE' ? 'LAST KNOWN' : 'CONNECTING'}</span>
          <strong>{centerFeed.provider?.source ?? 'Kakao Local API'}</strong>
          <small>{centerFeed.provider?.message ?? '주변 서비스 거점을 찾고 있습니다.'}</small>
        </div>
        <div className="service-center-grid">
          {centerFeed.centers?.slice(0, 6).map((center) => (
            <article className="service-center-card panel" key={center.id}>
              <div className="service-center-distance"><MapPin size={16} /><strong>{center.distanceKm.toFixed(1)}km</strong></div>
              <span>HYUNDAI SERVICE</span>
              <h3>{center.name}</h3>
              <p>{center.address}</p>
              <div className="service-center-actions">
                {center.phone && <a href={`tel:${center.phone.replace(/[^0-9+]/g, '')}`}><span>{center.phone}</span><strong>전화</strong></a>}
                <button onClick={() => window.open(center.placeUrl, '_blank', 'noopener,noreferrer')}><span>카카오맵</span><strong>상세·길찾기</strong><Navigation size={14} /></button>
              </div>
            </article>
          ))}
          {!centerBusy && !centerFeed.centers?.length && <div className="service-center-empty panel"><MapPin size={22} /><strong>서비스 거점을 찾지 못했습니다.</strong><span>위치 권한을 허용하거나 잠시 후 다시 시도해 주세요.</span></div>}
        </div>
      </section>
    </div>
  );
}

function PassportPage({ vehicle, notify, setModal, passport }) {
  if (!vehicle) return <div className="page container"><PageIntro eyebrow="DIGITAL VEHICLE PASSPORT" title="실차 기록만 보여드립니다" description="현대 계정을 연결하면 동기화된 차량 정보와 서명된 이벤트를 확인할 수 있습니다." /><VehicleConnectPanel onConnect={() => setModal('connect')} /></div>;
  const timelineEvents = passport?.events ?? [];
  return (
    <div className="page container">
      <PageIntro eyebrow="DIGITAL VEHICLE PASSPORT" title="내 차의 연결 기록" description="Life Pass에서 확인된 차량 데이터 이벤트의 변경 여부를 서명으로 검증합니다." actions={<button className="button outline" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/#passport`).then(() => notify('현재 차량 여권 링크를 복사했습니다.')).catch(() => notify('현재 주소를 공유해 주세요.'))}><Share2 size={16} /> 링크 공유</button>} />
      <section className="passport-main panel">
        <div className="passport-head"><div><span className="verified"><ShieldCheck size={15} /> CONNECTED VEHICLE RECORD</span><h2>{vehicle.name}</h2><p>{vehicle.trim} · {vehicle.plate}</p></div><div className="passport-id"><span>PASS ID</span><strong>HLP-{vehicle.databaseId}</strong></div></div>
        <div className="passport-scores"><PassportScore label="서명된 기록" value={passport?.signedEvents ?? 0} unit="건" note="무결성 확인" /><PassportScore label="확인 경고" value={vehicle.warningCount ?? 0} unit="건" note={`${vehicle.checkedWarnings ?? 0}/7개 확인`} /><PassportScore label="배터리" value={vehicle.batterySoc ?? '—'} unit={vehicle.batterySoc == null ? '' : '%'} note={vehicle.batterySoc == null ? '미제공' : '동기화 값'} /><PassportScore label="누적 주행" value={vehicle.odometer == null ? '—' : vehicle.odometer.toLocaleString()} unit={vehicle.odometer == null ? '' : 'km'} note={vehicle.odometer == null ? '미제공' : '동기화 값'} /></div>
        <div className="passport-signature"><LockKeyhole size={16} /><span>현재 레코드 서명</span><code>sha256 · {passport?.hash ?? '불러오는 중'}</code><CheckCircle2 size={16} /></div>
      </section>
      <section className="section-sub">
        <SectionHeading eyebrow="SIGNED TIMELINE" title="검증 가능한 이벤트" description="현재 연결 이후 실제로 저장된 이벤트만 표시합니다." />
        {timelineEvents.length ? <div className="timeline panel">{timelineEvents.map((event, index) => <div className="timeline-row" key={event.id}><div className="timeline-marker"><span>{index + 1}</span></div><time>{formatDate(event.occurredAt)}</time><div><span>{event.type}</span><strong>{event.title}</strong><p>{event.detail}</p></div><code>{event.signature.slice(0, 8)}…</code><span className="timeline-verified"><Check size={12} /> 서명</span></div>)}</div> : <div className="empty-records panel"><FileCheck2 size={24} /><strong>아직 저장된 이벤트가 없습니다.</strong><span>차량 연결과 동기화 이후 생성된 실제 기록이 여기에 표시됩니다.</span></div>}
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
      <PageIntro eyebrow="ACCOUNT & APP" title="내 정보와 앱 설정" description="연결 상태, 데이터 동기화와 삭제 경로를 한곳에서 관리합니다." />
      <div className="settings-grid">
        <section className="panel settings-card">
          <div className="settings-icon"><UserRound size={22} /></div><span>현대 통합계정</span><h2>{connected && hyundai?.accountName ? `${hyundai.accountName}님` : hyundaiStatusLabel(hyundai)}</h2><p>{connected && hyundai?.accountEmailMasked ? `${hyundai.accountEmailMasked} · ${hyundai.message}` : hyundai?.message ?? '연결 상태를 확인하고 있습니다.'}</p>
          {connected ? <div className="settings-actions"><button className="button primary" disabled={busy} onClick={actions.syncHyundai}><RefreshCcw size={16} /> 차량 새로고침</button><button className="button danger" disabled={busy} onClick={removeConnection}><Trash2 size={16} /> 연결 해제·데이터 삭제</button></div> : <button className="button primary" disabled={busy} onClick={actions.connectHyundai}>현대 계정 연결 <ArrowRight size={16} /></button>}
          {!connected && <div className="oauth-flow" aria-label="현대 계정 연결 순서"><span><b>1</b>공식 로그인</span><span><b>2</b>차량 접근 동의</span><span><b>3</b>데이터 제공 동의</span><span><b>4</b>차량 동기화</span></div>}
          {!connected && <small>버튼을 누르면 현대자동차 공식 통합계정 화면으로 이동합니다. Life Pass는 아이디와 비밀번호를 받지 않습니다.</small>}
          {vehicle && <small>연결 차량: {vehicle.name} · 마지막 동기화 {vehicle.updatedAt ? formatDateTime(vehicle.updatedAt) : '확인 중'}</small>}
        </section>
        <section className="panel settings-card">
          <div className="settings-icon"><Smartphone size={22} /></div><span>모바일 앱</span><h2>홈 화면에 설치</h2><p>브라우저 메뉴의 ‘홈 화면에 추가’를 선택하면 앱처럼 전체 화면으로 사용할 수 있습니다.</p><InstallButton notify={notify} />
        </section>
      </div>
      <section className="panel policy-links"><button onClick={() => navigate('guide')}><Route size={18} /><span><strong>처음 사용하는 방법</strong><small>무슨 서비스이고 무엇을 연결해야 하는지</small></span><ChevronRight size={17} /></button><button onClick={() => navigate('privacy')}><LockKeyhole size={18} /><span><strong>개인정보 처리 안내</strong><small>수집·보관·철회 및 삭제 정책</small></span><ChevronRight size={17} /></button><button onClick={() => navigate('terms')}><FileCheck2 size={18} /><span><strong>서비스 이용안내</strong><small>외부 데이터와 제공 기능 범위</small></span><ChevronRight size={17} /></button><a href="https://github.com/boclair98/hyundai-life-pass/issues" target="_blank" rel="noreferrer"><Wrench size={18} /><span><strong>지원 및 오류 신고</strong><small>GitHub Issues</small></span><ChevronRight size={17} /></a></section>
    </div>
  );
}

function InstallButton({ notify }) {
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
  return <button className="button outline" onClick={install}><Smartphone size={16} /> 설치 방법 보기</button>;
}

function VehicleConnectPanel({ onConnect, compact = false }) {
  return <section className={`vehicle-connect-panel panel ${compact ? 'compact' : ''}`}><div className="connect-orbit"><CarFront size={26} /></div><div><span>CONNECTED CAR</span><h2>아직 연결된 차량이 없습니다.</h2><p>현대자동차 공식 로그인 화면에서 직접 동의하면, 제공 범위 안의 차량 정보만 안전하게 동기화합니다.</p></div><button className="button primary" onClick={onConnect}>현대차 연결하기 <ArrowRight size={16} /></button></section>;
}

function CanaryLab({ notify, setModal, liveReleases, auditLogs, actions, busy }) {
  const [guard, setGuard] = useState(true);
  const releaseList = liveReleases.length ? liveReleases : releases.map((item) => ({ ...item, target: item.cohort, status: item.status === '진행 중' ? 'ROLLING' : item.status === '완료' ? 'COMPLETE' : 'PAUSED', risk: item.anomaly }));
  const activeRelease = releaseList.find((item) => item.status === 'ROLLING') ?? releaseList[0];
  return (
    <div className="lab-page">
      <div className="container lab-container">
        <div className="lab-intro"><div><span><Code2 size={15} /> READ-ONLY PILOT · OPERATIONS</span><h1>CanaryDrive Control</h1><p>실차 명령을 보내지 않는 SDV 안전 운영 시뮬레이터입니다.</p></div><div className="lab-status"><i /> Simulator 정상</div></div>
        <div className="lab-metrics"><LabMetric label="배포 진행률" value={activeRelease?.progress ?? 0} unit="%" trend="DB live state" /><LabMetric label="정상 차량" value="99.82" unit="%" trend="+0.11%" /><LabMetric label="감사 이벤트" value={auditLogs.length} unit="건" trend="signed actions" /><LabMetric label="활성 릴리스" value={releaseList.filter((item) => item.status === 'ROLLING').length} unit="개" trend="20s auto tick" /></div>
        <section className="lab-release panel-dark"><div className="lab-release-head"><div><span>SIMULATED RELEASE</span><h2>{activeRelease?.version} · {activeRelease?.title}</h2><p>{activeRelease?.target}</p></div><div className="lab-release-actions"><button className="lab-ghost-button" disabled title="현대차 사내 OTA 권한 연결 후 활성화">실차 명령 잠금</button><button className="lab-new-button" disabled title="현대차 사내 OTA 권한 연결 후 활성화"><LockKeyhole size={15} /> 읽기 전용</button></div></div><div className="rollout-track"><div style={{ width: `${activeRelease?.progress ?? 0}%` }} /><span style={{ left: `${Math.min(activeRelease?.progress ?? 0, 92)}%` }}>{activeRelease?.progress ?? 0}%</span></div><div className="rollout-steps"><span className="done"><Check size={12} /> 1%</span><span className="done"><Check size={12} /> 10%</span><span className="active">{activeRelease?.progress ?? 0}% 현재</span><span>70%</span><span>100%</span></div><div className="guard-row"><div><ShieldCheck size={19} /><span><strong>자동 중지·롤백 규칙</strong><small>시뮬레이터에서 임계값 동작을 확인합니다.</small></span></div><button className={`switch ${guard ? 'on' : ''}`} onClick={() => { setGuard((value) => !value); notify(`시뮬레이션 Guard를 ${guard ? '해제' : '활성화'}했습니다.`); }} aria-label="시뮬레이션 Canary Guard 전환"><span /></button></div></section>
        <div className="lab-grid"><section className="panel-dark"><div className="lab-panel-title"><span>RELEASE TRAINS</span><button onClick={() => notify('서버와 10초마다 자동 동기화됩니다.')}><RefreshCcw size={15} /></button></div>{releaseList.map((release) => <div className="release-row" key={release.id}><i className={releaseTone(release.status)} /><div><strong>{release.version}</strong><span>{release.title}</span><small>{release.target}</small></div><div><span>{releaseStatus(release.status)}</span><strong>{release.progress}%</strong></div><div><span>위험도</span><strong>{release.risk}</strong></div><ChevronRight size={16} /></div>)}</section><section className="panel-dark events-stream"><div className="lab-panel-title"><span>SIGNED AUDIT STREAM</span><small><i /> LIVE</small></div>{auditLogs.length ? auditLogs.slice(0, 5).map((event) => <EventRow key={event.id} time={formatTime(event.createdAt)} tone="good" title={event.action} detail={`${event.resourceType} · ${event.signature.slice(0, 8)}`} />) : <><EventRow time="LIVE" tone="good" title="Platform stream ready" detail="사용자 동작을 기다리는 중" /><EventRow time="SYSTEM" tone="info" title="Audit signing enabled" detail="SHA-256 event chain" /></>}</section></div>
      </div>
    </div>
  );
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

function releaseStatus(status) {
  return { ROLLING: '진행 중', COMPLETE: '완료', PAUSED: '일시 중지', DRAFT: '준비' }[status] ?? status;
}

function releaseTone(status) {
  return { ROLLING: 'active', COMPLETE: 'done', PAUSED: 'paused', DRAFT: 'paused' }[status] ?? 'active';
}

function ServiceCard({ number, icon: Icon, title, description, action, onClick, tone }) {
  return <button className={`service-card service-${tone}`} onClick={onClick}><div className="service-card-top"><span>{number}</span><div><Icon size={23} /></div></div><h3>{title}</h3><p>{description}</p><span className="service-action">{action}<ArrowRight size={15} /></span></button>;
}

function SectionHeading({ eyebrow, title, description }) {
  return <div className="section-heading"><span>{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>;
}

function PageIntro({ eyebrow, title, description, actions }) {
  return <div className="page-intro"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{actions && <div>{actions}</div>}</div>;
}

function Metric({ icon: Icon, label, value, detail }) {
  return <div className="metric"><Icon size={19} /><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>;
}

function ActionRow({ icon: Icon, color, title, detail, badge, onClick }) {
  return <button className="action-row" onClick={onClick}><div className={`action-icon ${color}`}><Icon size={18} /></div><div><strong>{title}</strong><span>{detail}</span></div><em>{badge}</em><ChevronRight size={17} /></button>;
}

function JourneyStep({ icon: Icon, number, title, detail }) {
  return <div className="journey-step"><div><Icon size={20} /></div><span>{number}</span><h3>{title}</h3><p>{detail}</p></div>;
}

function PassportScore({ label, value, unit, note }) {
  return <div className="passport-score"><span>{label}</span><div><strong>{value}</strong><small>{unit}</small></div><em><Check size={11} />{note}</em></div>;
}

function LabMetric({ label, value, unit, trend }) {
  return <div className="lab-metric"><span>{label}</span><div><strong>{value}</strong><small>{unit}</small></div><em>{trend}</em></div>;
}

function EventRow({ time, tone, title, detail }) {
  return <div className="event-row"><time>{time}</time><i className={tone} /><div><strong>{title}</strong><span>{detail}</span></div></div>;
}

function SiteFooter({ navigate }) {
  return (
    <footer className="site-footer">
      <div className="container">
        <div><strong>HYUNDAI LIFE PASS</strong><span>현대자동차 오픈 API 활용 포트폴리오 파일럿</span></div>
        <nav aria-label="서비스 정책"><button onClick={() => navigate('guide')}>사용 가이드</button><button onClick={() => navigate('settings')}>계정·설정</button><button onClick={() => navigate('privacy')}>개인정보 안내</button><button onClick={() => navigate('terms')}>서비스 이용안내</button><button onClick={() => navigate('lab')}>기술 데모</button><a href="https://github.com/boclair98/hyundai-life-pass" target="_blank" rel="noreferrer">GitHub</a></nav>
        <small>현대자동차 공식 운영 서비스가 아니며, 실차 데이터는 사용자의 명시적 동의 후에만 조회됩니다.</small>
      </div>
    </footer>
  );
}

function GuidePage({ navigate }) {
  return (
    <div className="page container guide-page">
      <PageIntro eyebrow="START HERE" title="현대차 오너의 카라이프 허브" description="충전·정비 탐색은 로그인 없이, 내 차 상태와 차량 여권은 현대 계정 연결 후 사용하는 모바일 웹앱입니다." />
      <section className="guide-steps">
        <article className="panel"><span>01 · 로그인 없이</span><div><BatteryCharging size={22} /><h2>내 주변 충전</h2></div><p>위치 권한을 허용하면 현재 시·도의 실제 충전소 상태를 가까운 순으로 찾고 카카오맵 길찾기로 이동합니다.</p><button className="button outline" onClick={() => navigate('charge')}>충전소 찾기 <ArrowRight size={15} /></button></article>
        <article className="panel"><span>02 · 로그인 없이</span><div><Wrench size={22} /><h2>가까운 블루핸즈</h2></div><p>현재 위치 주변 현대자동차 서비스 거점을 찾고 전화하거나 카카오맵 상세 화면을 엽니다.</p><button className="button outline" onClick={() => navigate('care')}>서비스 거점 찾기 <ArrowRight size={15} /></button></article>
        <article className="panel"><span>03 · 현대 계정 연결</span><div><CarFront size={22} /><h2>내 차와 차량 여권</h2></div><p>현대 공식 로그인과 데이터 제공 동의를 마치면 동의 범위의 차량 상태와 Life Pass에서 생성된 서명 기록을 확인합니다.</p><button className="button primary" onClick={() => navigate('settings')}>계정 연결 안내 <ArrowRight size={15} /></button></article>
      </section>
      <section className="panel capability-table">
        <div><span>지금 실제로 작동</span><strong>현재 위치 충전소, 지도·길찾기, 블루핸즈 검색·전화, 현대 통합계정 로그인, 차량 기본 상태·7종 경고·커넥티드 계약 동기화와 삭제</strong></div>
        <div><span>현대 승인 필요</span><strong>일반 고객의 실차 데이터는 Hyundai Developers 상용화 심사 승인 후 제공</strong></div>
        <div><span>파트너 계약 필요</span><strong>충전 예약·결제, 블루핸즈 예약, 디지털 키 이전, 실제 OTA 제어</strong></div>
      </section>
      <section className="guide-stack">
        <div><span>FRONTEND</span><strong>React + Vite PWA</strong><p>휴대폰 브라우저와 홈 화면 설치</p></div>
        <div><span>BACKEND</span><strong>Kotlin + Spring Boot + JPA</strong><p>OAuth, 외부 API, 보안 세션과 비즈니스 로직</p></div>
        <div><span>DATA</span><strong>PostgreSQL + Flyway</strong><p>계정 연결·차량 이벤트·감사 기록</p></div>
        <div><span>LIVE APIs</span><strong>Hyundai + KECO + Kakao</strong><p>차량·충전소·지도와 장소 검색</p></div>
      </section>
    </div>
  );
}

function LegalPage({ type }) {
  const privacy = type === 'privacy';
  return (
    <div className="page container legal-page">
      <PageIntro eyebrow={privacy ? 'PRIVACY' : 'SERVICE GUIDE'} title={privacy ? '개인정보 처리 안내' : '서비스 이용안내'} description="HYUNDAI LIFE PASS 파일럿의 데이터 처리 원칙을 투명하게 안내합니다." />
      <section className="panel legal-card">
        <span>2026년 9월 3일 기준 · 파일럿</span>
        {privacy ? <>
          <h2>수집과 이용</h2><p>현대 통합계정 연결 전에는 임의의 브라우저 세션 식별자만 사용합니다. 사용자가 현대자동차 화면에서 직접 동의한 경우에만 계정 표시 이름·마스킹 이메일, 차량 식별자·차종·주행거리·주행 가능 거리·EV 배터리·충전 상태·차량 경고와 커넥티드 서비스 계약일을 처리합니다.</p>
          <h2>보관과 보호</h2><p>접근·갱신 토큰은 서버에서 AES-256-GCM으로 암호화해 저장하며 브라우저에 전달하지 않습니다. 세션 쿠키는 Secure·HttpOnly로 설정합니다.</p>
          <h2>철회와 삭제</h2><p>설정의 ‘연결 해제·데이터 삭제’ 또는 현대자동차 데이터 제공 중단 콜백이 수신되면 연결 토큰과 해당 실차 데이터를 삭제합니다.</p>
          <h2>외부 제공자</h2><p>차량 데이터는 Hyundai Developers, 충전소 정보는 공공데이터포털, 지도와 주변 장소 검색은 Kakao API를 사용합니다.</p>
        </> : <>
          <h2>서비스 범위</h2><p>충전소 상태와 주변 서비스 거점은 외부 공급자 정보를 바탕으로 제공합니다. 실제 충전 예약·결제, 블루핸즈 확정 예약, 디지털 키 이전, OTA 제어는 제휴 권한 연결 전까지 제공하지 않습니다.</p>
          <h2>파일럿 고지</h2><p>이 서비스는 현대자동차 공식 서비스가 아닌 개발 포트폴리오 파일럿입니다. CanaryDrive 기술 데모의 수치는 시뮬레이션이며 소비자 차량 정보로 사용되지 않습니다.</p>
          <h2>정보 정확성</h2><p>공공데이터와 장소 정보는 갱신 시점에 따라 실제 현장 상태와 다를 수 있으므로 출발 전 운영기관 또는 서비스 거점에 확인해야 합니다.</p>
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
  const content = { eyebrow: 'HYUNDAI ACCOUNT', title: connected ? '내 차가 연결되어 있습니다.' : '현대 통합계정으로 시작하세요.', description: hyundai?.mode === 'LIVE' ? '현대자동차 공식 로그인 화면에서 차량 접근과 정보 제공 범위를 직접 확인합니다. 비밀번호는 Life Pass에 저장되지 않습니다.' : 'Hyundai Developers 프로젝트 설정을 확인하면 공식 로그인과 차량 데이터 동기화가 활성화됩니다.', button: connected ? '차량 데이터 새로고침' : hyundai?.state === 'CONSENT_REQUIRED' ? '정보 제공 동의 계속하기' : hyundai?.mode === 'LIVE' && hyundai.state !== 'MISCONFIGURED' ? '현대 통합계정으로 연결' : '연동 상태 확인' };
  const submit = async () => {
    if (connected) return actions.syncHyundai();
    if (hyundai?.mode === 'LIVE' && hyundai.state === 'CONSENT_REQUIRED') return actions.resumeHyundaiAgreement();
    if (hyundai?.mode === 'LIVE' && !['MISCONFIGURED', 'ERROR'].includes(hyundai.state)) return actions.connectHyundai();
    notify('현재 현대 계정 연동 설정을 확인하고 있습니다. 잠시 후 다시 시도해 주세요.');
    return false;
  };
  return <div className="modal-backdrop" onMouseDown={(event) => event.currentTarget === event.target && close()}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-description"><button className="modal-close" onClick={close} aria-label="닫기"><X size={19} /></button><div className="modal-icon"><UserRound size={22} /></div><span>{content.eyebrow}</span><h2 id="modal-title">{content.title}</h2><p id="modal-description">{content.description}</p><div className="connected-vehicle-preview"><CarFront size={20} /><div><strong>{vehicle?.name ?? '내 현대차 연결'}</strong><span>{vehicle ? `${vehicle.plate} · ${vehicle.trim}` : '현대 통합계정에서 차량을 선택합니다.'}</span></div>{vehicle && <CheckCircle2 size={18} />}</div><button className="button primary full" disabled={busy} onClick={submit}>{busy ? <LoaderCircle className="spin" size={16} /> : null}{content.button}<ArrowRight size={16} /></button><small>로그인 토큰은 서버에서 AES-256-GCM으로 암호화되며 브라우저에 노출되지 않습니다.</small></div></div>;
}
