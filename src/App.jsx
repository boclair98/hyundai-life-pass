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
  Share2,
  ShieldCheck,
  ThermometerSun,
  UserRound,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  advanceHandover,
  advanceRelease,
  bookService,
  cancelCharging,
  cancelService,
  connectVehicle,
  hyundaiAuthorizationPath,
  loadAuditLogs,
  loadPassport,
  loadPlatform,
  loadReleases,
  loadServiceCenters,
  pauseRelease,
  readNotification,
  reserveCharging,
  revokeHyundaiConnection,
  startHandover,
  startRelease,
  syncHyundaiVehicles,
  loadVehicles,
} from './api';
import { demoVehicles, passportEvents, releases, stations } from './data';
import './app.css';

const navigation = [
  { id: 'home', label: '홈', icon: CarFront },
  { id: 'charge', label: '충전', icon: BatteryCharging },
  { id: 'care', label: '내 차 케어', icon: Activity },
  { id: 'passport', label: '차량 여권', icon: FileCheck2 },
];

const validPages = new Set([...navigation.map((item) => item.id), 'lab', 'privacy', 'terms']);

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
  const [vehicles, setVehicles] = useState(demoVehicles);
  const [selectedVehicleId, setSelectedVehicleId] = useState(demoVehicles[0].id);
  const [dataSource, setDataSource] = useState('sample-loading');
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [platform, setPlatform] = useState({ stations: [], chargingReservations: [], serviceBookings: [], handovers: [], notifications: [], unreadNotifications: 0, environment: 'OFFLINE', providers: [{ id: 'platform', name: '플랫폼 API', mode: 'SIMULATION', state: 'OFFLINE', source: '클라이언트 샘플', message: '서버 연결 전에는 기능 사용 예시만 표시합니다.' }] });
  const [liveReleases, setLiveReleases] = useState([]);
  const [passport, setPassport] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);

  const vehicle = vehicles.find((item) => item.id === selectedVehicleId) ?? vehicles[0];

  useEffect(() => {
    loadVehicles().then((result) => {
      setVehicles(result.vehicles);
      setDataSource(result.source);
      if (!result.vehicles.some((item) => item.id === selectedVehicleId)) {
        setSelectedVehicleId(result.vehicles[0]?.id);
      }
    });
  }, []);

  const refreshPlatform = useCallback(async () => {
    const [snapshot, releaseItems, auditItems] = await Promise.all([
      loadPlatform(),
      loadReleases(),
      loadAuditLogs(),
    ]);
    setPlatform(snapshot);
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
    const timer = window.setInterval(() => refreshPlatform().catch(() => undefined), 10000);
    return () => window.clearInterval(timer);
  }, [page, refreshPlatform]);

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

  function navigate(nextPage) {
    setPage(nextPage);
    setMenuOpen(false);
    window.location.hash = nextPage;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function notify(message) {
    setToast(message);
  }

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
    connectVehicle: () => transact(() => connectVehicle(vehicle.id), `${vehicle.name} 연결과 데이터 동기화가 완료됐습니다.`),
    reserveCharge: (station) => transact(() => reserveCharging({ vehicleExternalId: vehicle.id, stationId: station.id, scheduledAt: new Date(Date.now() + 3600000).toISOString(), targetSoc: 80 }), station.source === 'SAMPLE' || station.source === 'CLIENT_SAMPLE' ? `${station.name} 샘플 예약 흐름을 완료했습니다.` : `${station.name} 충전 예약이 확정됐습니다.`),
    cancelCharge: (id) => transact(() => cancelCharging(id), '충전 예약을 취소했습니다.'),
    bookService: () => transact(() => bookService({ vehicleExternalId: vehicle.id, centerName: '성수 현대서비스', serviceType: '타이어 위치 교환·차량 점검', scheduledAt: new Date(Date.now() + 4 * 86400000).toISOString() }), '블루핸즈 연동 전 샘플 예약 흐름을 완료했습니다.'),
    cancelService: (id) => transact(() => cancelService(id), '정비 예약을 취소했습니다.'),
    startHandover: () => transact(() => startHandover({ vehicleExternalId: vehicle.id, buyerEmail: 'next.owner@example.com' }), '차량 인수인계가 시작됐습니다.'),
    advanceHandover: (id) => transact(() => advanceHandover(id), '인수인계 다음 단계가 완료됐습니다.'),
    markNotification: (id) => transact(() => readNotification(id), '알림을 확인했습니다.'),
    startRelease: (id) => transact(() => startRelease(id), 'Canary 배포가 시작됐습니다.'),
    advanceRelease: (id) => transact(() => advanceRelease(id), '검증 통과 후 배포 범위를 확대했습니다.'),
    pauseRelease: (id) => transact(() => pauseRelease(id), '이상 분석을 위해 배포를 일시 중지했습니다.'),
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

      <main>
        {page === 'home' && <HomePage {...shared} />}
        {page === 'charge' && <ChargePage {...shared} />}
        {page === 'care' && <CarePage {...shared} />}
        {page === 'passport' && <PassportPage {...shared} />}
        {page === 'lab' && <CanaryLab {...shared} />}
        {page === 'privacy' && <LegalPage type="privacy" />}
        {page === 'terms' && <LegalPage type="terms" />}
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
          <label className="vehicle-picker">
            <CarFront size={15} />
            <select value={selectedVehicleId} onChange={(event) => setSelectedVehicleId(event.target.value)} aria-label="차량 선택">
              {vehicles.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.plate}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>
          <div className="notification-wrap">
            <button className="header-icon" onClick={() => setAlertsOpen((value) => !value)} aria-label={`알림 ${platform.unreadNotifications ?? 0}개`}><Bell size={18} />{platform.unreadNotifications > 0 && <i className="notification-count">{platform.unreadNotifications}</i>}</button>
            {alertsOpen && <div className="notification-panel"><div><strong>알림 센터</strong><span>{platform.environment === 'LIVE' ? '실데이터 동기화' : platform.environment === 'HYBRID' ? '일부 실데이터 연결' : '샘플 데이터 환경'}</span></div>{platform.notifications?.length ? platform.notifications.slice(0, 5).map((item) => <button key={item.id} className={item.read ? 'read' : ''} onClick={() => actions.markNotification(item.id)}><span>{item.category}</span><strong>{item.title}</strong><small>{item.message}</small></button>) : <p>새로운 알림이 없습니다.</p>}</div>}
          </div>
          <button className={`account-button ${connected ? 'connected' : ''}`} disabled={busy} onClick={accountAction}><UserRound size={16} /><span><small>현대 통합계정</small><strong>{hyundaiStatusLabel(hyundai)}</strong></span></button>
          <button className={`lab-button ${page === 'lab' ? 'active' : ''}`} onClick={() => navigate('lab')}><Code2 size={15} /><span>Developer Lab</span></button>
          <button className="mobile-menu-button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}>{menuOpen ? <X size={21} /> : <Menu size={21} />}{platform.unreadNotifications > 0 && <i className="notification-count">{platform.unreadNotifications}</i>}</button>
        </div>
      </div>

      {menuOpen && (
        <div className="mobile-drawer">
          <div className="mobile-vehicle"><span>{vehicle.name}</span><strong>{vehicle.plate}</strong><small>{dataSource === 'platform' ? '플랫폼 서버 연결' : '오프라인 샘플'}</small></div>
          <div className={`mobile-account ${connected ? 'connected' : ''}`}><div><UserRound size={19} /><span><small>현대 통합계정</small><strong>{hyundaiStatusLabel(hyundai)}</strong></span></div><button disabled={busy} onClick={accountAction}>{connected ? '새로고침' : hyundai?.state === 'CONSENT_REQUIRED' ? '동의 계속' : '연결하기'}</button></div>
          {navigation.map((item) => <button key={item.id} onClick={() => navigate(item.id)}><item.icon size={18} />{item.label}<ChevronRight size={16} /></button>)}
          <button onClick={() => navigate('lab')}><Code2 size={18} />Developer Lab<ChevronRight size={16} /></button>
        </div>
      )}
    </header>
  );
}

function HomePage({ vehicle, navigate, setModal }) {
  const isSample = vehicle.source !== 'HYUNDAI_DEVELOPERS';
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
            <p>충전·정비·소프트웨어 업데이트·차량 여권을 하나로.<br />내 현대차의 모든 생애주기가 끊김 없이 이어집니다.</p>
            <div className="hero-buttons">
              <button className="button primary" onClick={() => setModal('connect')}>현대차 연결하기 <ArrowRight size={17} /></button>
              <button className="button glass" onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}>서비스 둘러보기</button>
            </div>
          </div>
        </div>
        <div className="hero-status container">
          <div><span className="status-dot" /><p>현재 연결 차량</p><strong>{vehicle.name}</strong></div>
          <div><BatteryCharging size={20} /><p>배터리</p><strong>{vehicle.batterySoc}%</strong></div>
          <div><Navigation size={20} /><p>주행 가능</p><strong>{vehicle.range}km</strong></div>
          <div><ShieldCheck size={20} /><p>차량 건강도</p><strong>{vehicle.healthScore}</strong></div>
          <button onClick={() => setModal('connect')}>다른 차량 연결 <Plus size={16} /></button>
        </div>
      </section>

      <section className="section container" id="services">
        <SectionHeading eyebrow="ONE CONNECTED JOURNEY" title="한 번 연결하면, 차의 모든 순간이 이어집니다." description="매일 쓰는 기능부터 미래의 차량 가치까지 네 가지 경험으로 정리했습니다." />
        <div className="service-grid">
          <ServiceCard number="01" icon={BatteryCharging} title="스마트 충전" description="가격·거리·혼잡도를 비교해 지금 가장 좋은 충전소와 시간을 추천합니다." action="충전 플랜 보기" onClick={() => navigate('charge')} tone="blue" />
          <ServiceCard number="02" icon={Activity} title="예측 케어" description="차량 상태와 주행 패턴을 읽어 고장이 나기 전에 점검 시점을 알려줍니다." action="내 차 건강 보기" onClick={() => navigate('care')} tone="sky" />
          <ServiceCard number="03" icon={CloudCog} title="안전한 OTA" description="업데이트 과정을 투명하게 보여주고 이상 발생 시 차량군별로 자동 중지합니다." action="업데이트 확인" onClick={() => navigate('care')} tone="navy" />
          <ServiceCard number="04" icon={FileCheck2} title="디지털 차량 여권" description="정비·배터리·소프트웨어 이력을 검증 가능한 기록으로 남겨 차량 가치를 증명합니다." action="차량 여권 열기" onClick={() => navigate('passport')} tone="ice" />
        </div>
      </section>

      <section className="section section-soft">
        <div className="container vehicle-today-grid">
          <div>
            <SectionHeading eyebrow="TODAY'S VEHICLE" title="오늘의 내 차" description="복잡한 센서 정보 대신 지금 필요한 것만 보여드립니다." />
            <div className="vehicle-summary-card">
              <div className="vehicle-summary-top"><div><span className="connected"><i /> {isSample ? '샘플 차량 데이터' : '현대 커넥티드카 연결'}</span><h3>{vehicle.name}</h3><p>{vehicle.trim} · {vehicle.plate}</p></div><div className="health-score"><span>HEALTH</span><strong>{vehicle.healthScore}</strong><small>/100</small></div></div>
              <div className="summary-metrics">
                <Metric icon={BatteryCharging} label="배터리" value={`${vehicle.batterySoc}%`} detail={`${vehicle.range}km 주행 가능`} />
                <Metric icon={Gauge} label="누적 주행" value={`${vehicle.odometer.toLocaleString()}km`} detail={isSample ? '사용 예시 수치' : '현대차 데이터 동기화'} />
                <Metric icon={CloudCog} label="소프트웨어" value={vehicle.softwareVersion} detail={isSample ? '샘플 버전' : '제조사 동기화'} />
              </div>
              <div className="vehicle-location"><MapPin size={15} /><span>{vehicle.location}</span><small>{isSample ? '샘플 위치' : '동의 기반 갱신'}</small></div>
            </div>
          </div>

          <div className="next-actions">
            <div className="next-actions-head"><span>지금 필요한 일</span><strong>2</strong></div>
            <ActionRow icon={BatteryCharging} color="blue" title="오늘 밤 11시 충전 추천" detail={isSample ? '샘플: 예상 비용 8,400원 · 42분' : '요금 공급자 연결 시 계산'} badge={isSample ? '예시' : '추천'} onClick={() => navigate('charge')} />
            <ActionRow icon={Wrench} color="orange" title="타이어 위치 교환이 가까워요" detail={`권장 점검까지 ${vehicle.nextServiceKm.toLocaleString()}km`} badge="예정" onClick={() => navigate('care')} />
            <ActionRow icon={ShieldCheck} color="green" title={`차량 여권 신뢰도 ${vehicle.healthScore}%`} detail={isSample ? '샘플 이력으로 사용 흐름 시연' : '연결된 이력의 서명 검증'} badge={isSample ? '예시' : '검증'} onClick={() => navigate('passport')} />
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
  const stationList = useMemo(() => platform.stations?.length ? platform.stations.map((item) => ({ ...item, distance: `${item.distanceKm}km`, speed: `${item.speedKw}kW`, price: `${item.pricePerKwh}원/kWh`, eta: `${item.etaMinutes}분` })) : stations.map((item) => ({ ...item, source: 'CLIENT_SAMPLE', reservable: true, operator: '샘플 운영사', statusLabel: '시뮬레이션' })), [platform.stations]);
  const [selectedStation, setSelectedStation] = useState(stations[0]);
  const [search, setSearch] = useState('성수동');
  const chargerProvider = platform.providers?.find((provider) => provider.id === 'ev-charger');
  const chargerLive = chargerProvider?.mode === 'LIVE' && ['CONNECTED', 'STALE'].includes(chargerProvider.state);
  const activeReservation = platform.chargingReservations?.find((item) => item.vehicleExternalId === vehicle.id && item.status === 'CONFIRMED');
  useEffect(() => {
    if (stationList.length) setSelectedStation((current) => stationList.find((item) => item.id === current.id) ?? stationList[0]);
  }, [platform.stations]);
  return (
    <div className="page container">
      <PageIntro eyebrow="SMART CHARGE" title="기다리지 않는 충전" description="내 위치, 예상 도착시간, 실시간 충전 가능 여부를 함께 계산합니다." />
      {chargerProvider && <div className={`provider-inline ${chargerLive ? 'live' : 'sample'}`}><span>{chargerLive ? 'LIVE DATA' : chargerProvider.mode === 'LIVE' ? 'LIVE ERROR' : 'SAMPLE DATA'}</span><strong>{chargerProvider.source}</strong><small>{chargerProvider.message}</small></div>}
      <OperationBanner
        tone={activeReservation ? 'active' : 'ready'}
        icon={BatteryCharging}
        label={activeReservation ? '샘플 예약 기록' : '샘플 예약 시나리오'}
        title={activeReservation ? activeReservation.stationName : chargerLive ? '공공데이터 충전소는 길찾기만 제공합니다.' : '충전 예약 UX의 사용 예시입니다.'}
        detail={activeReservation ? `${formatDateTime(activeReservation.scheduledAt)} · 목표 ${activeReservation.targetSoc}% · 예시 금액 ₩${activeReservation.estimatedCost.toLocaleString()}` : chargerLive ? '실제 예약·결제는 충전사업자 제휴 후 활성화됩니다.' : '실제 예약이 생성되거나 결제가 발생하지 않습니다.'}
        action={activeReservation ? <button onClick={() => actions.cancelCharge(activeReservation.id)} disabled={busy}>샘플 취소</button> : null}
      />
      <div className="charge-layout">
        <section className="charge-map panel">
          <div className="map-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="충전소 검색" /><button onClick={() => notify(`${search} 검색은 지도 API 키 연결 후 위치 기반으로 동작합니다.`)}><LocateFixed size={17} /></button></div>
          <KakaoStationMap stations={stationList} selectedStation={selectedStation} onSelect={setSelectedStation} notify={notify} />
        </section>
        <aside className="station-panel panel">
          <div className="station-panel-head"><span>가까운 충전소</span><small>{chargerLive ? '공공데이터 실시간' : '사용 예시'}</small></div>
          {stationList.map((station) => (
            <button key={station.id} className={`station-row ${selectedStation.id === station.id ? 'active' : ''}`} onClick={() => setSelectedStation(station)}>
              <div className="station-availability"><strong>{station.available}</strong><span>/{station.total}</span></div>
              <div><strong>{station.name}</strong><span>{station.distance} · {station.speed} · {station.eta}</span><small>{station.operator} · {station.statusLabel}</small></div>
              <ChevronRight size={16} />
            </button>
          ))}
          <div className="station-detail">
            <div><span>선택한 충전소</span><strong>{selectedStation.name}</strong><p>{selectedStation.address}</p></div>
            <div className="charge-price"><span>예상 충전비</span><strong>₩8,420</strong><small>{selectedStation.price}</small></div>
            <button className="button primary full" disabled={busy || !!activeReservation} onClick={() => selectedStation.reservable ? actions.reserveCharge(selectedStation) : window.open(`https://map.kakao.com/link/to/${encodeURIComponent(selectedStation.name)},${selectedStation.latitude},${selectedStation.longitude}`, '_blank', 'noopener,noreferrer')}>{busy ? <LoaderCircle className="spin" size={16} /> : <Navigation size={16} />}{activeReservation ? '예약된 충전 일정 있음' : selectedStation.reservable ? '샘플 예약 흐름 실행' : '카카오맵에서 길찾기'} </button>
          </div>
        </aside>
      </div>
      <div className="charge-plan-grid">
        <div className="panel plan-card"><div className="plan-icon"><Clock3 size={20} /></div><div><span>요금 최적화</span><strong>{selectedStation.reservable ? '샘플: 오늘 23:00–02:00' : 'CPO 요금 API 연결 필요'}</strong><p>{selectedStation.reservable ? '예약 시나리오 동작 예시' : '공공데이터에는 충전요금·예약 정보가 포함되지 않습니다.'}</p></div><button onClick={() => selectedStation.reservable ? actions.reserveCharge(selectedStation) : notify('충전사업자 제휴 API를 연결하면 활성화됩니다.')} disabled={busy || !!activeReservation}>{selectedStation.reservable ? '샘플 실행' : '연동 필요'}</button></div>
        <div className="panel plan-card"><div className="plan-icon"><Route size={20} /></div><div><span>내일 일정 기준</span><strong>오전 8시까지 80%</strong><p>예상 주행 64km · 출발 시 331km 가능</p></div><button onClick={() => notify('내일 일정에 맞춰 충전 계획을 저장했습니다.')}>계획 저장</button></div>
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

function KakaoStationMap({ stations: stationItems, selectedStation, onSelect, notify }) {
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
      stationItems.forEach((station) => {
        const marker = new kakao.maps.Marker({ position: new kakao.maps.LatLng(station.latitude, station.longitude), map });
        kakao.maps.event.addListener(marker, 'click', () => onSelect(station));
      });
      setMapReady(true);
    }).catch(() => notifyRef.current('카카오 지도 키 또는 허용 도메인을 확인해 주세요.'));
    return () => { cancelled = true; };
  }, [key, stationItems, selectedStation?.id, onSelect]);

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
  const isSample = vehicle.source !== 'HYUNDAI_DEVELOPERS';
  const bars = [62, 68, 65, 72, 76, 81, 84, 88, 92, vehicle.healthScore];
  const activeBooking = platform.serviceBookings?.find((item) => item.vehicleExternalId === vehicle.id && item.status === 'CONFIRMED');
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
      <PageIntro eyebrow="PREDICTIVE CARE" title="고장 나기 전에 먼저" description="차량 상태와 주행 패턴을 바탕으로 지금 필요한 관리만 알려드립니다." actions={<button className="button outline" onClick={() => notify('차량 케어 리포트를 준비했습니다.')}>리포트 받기 <Share2 size={16} /></button>} />
      {activeBooking && <OperationBanner tone="active" icon={CalendarClock} label="샘플 정비 예약" title={`${activeBooking.centerName} · ${activeBooking.serviceType}`} detail={`${formatDateTime(activeBooking.scheduledAt)} · 예시 금액 ₩${activeBooking.estimatedCost.toLocaleString()}`} action={<button onClick={() => actions.cancelService(activeBooking.id)} disabled={busy}>샘플 취소</button>} />}
      <section className="care-overview panel">
        <div className="care-score-block"><span>오늘의 차량 건강도</span><div className="score-ring" style={{ '--score': `${vehicle.healthScore * 3.6}deg` }}><strong>{vehicle.healthScore}</strong><small>/100</small></div><em>매우 좋음</em></div>
        <div className="care-copy"><span className="live-label"><i /> {vehicle.name} {isSample ? '샘플 분석' : '동의 기반 차량 분석'}</span><h2>지금은 안심하고<br />주행하셔도 좋아요.</h2><p>{isSample ? '아래 진단값은 API 연결 후 제공될 기능의 사용 예시입니다.' : '연결된 차량 데이터에서 즉시 확인할 이상 신호가 없습니다.'}</p><div className="care-inline-metrics"><div><ThermometerSun size={18} /><span>배터리 온도</span><strong>{isSample ? '예시 24°C' : '24°C'}</strong></div><div><CircleGauge size={18} /><span>타이어 공기압</span><strong>{isSample ? '예시 정상' : '정상'}</strong></div><div><Zap size={18} /><span>배터리 SOH</span><strong>{vehicle.batterySoh}%</strong></div></div></div>
      </section>
      <div className="care-content-grid">
        <section className="panel health-chart"><div className="panel-title"><div><span>최근 10회 건강도</span><h3>안정적으로 유지 중</h3></div><span className="positive">+2.8%</span></div><div className="bar-chart">{bars.map((bar, index) => <div key={index}><span style={{ height: `${bar}%` }} /><small>{index + 1}</small></div>)}</div><div className="chart-legend"><span><i /> 차량 건강도</span><small>최근 30일</small></div></section>
        <section className="panel maintenance-card"><div className="panel-title"><div><span>다가오는 정비</span><h3>타이어 위치 교환</h3></div><div className="maintenance-icon"><Wrench size={19} /></div></div><div className="maintenance-distance"><strong>{vehicle.nextServiceKm.toLocaleString()}</strong><span>km 후 권장</span></div><p>주행 패턴을 기준으로 약 5주 뒤가 적당합니다.</p><div className="maintenance-meta"><span><CalendarClock size={15} /> {isSample ? '차량 연결 후 개인화' : '차량 주행거리 기준'}</span><span>실제 거점에 문의</span></div><button className="button primary full" onClick={() => document.getElementById('service-centers')?.scrollIntoView({ behavior: 'smooth' })}>가까운 서비스 거점 찾기 <ArrowRight size={16} /></button></section>
      </div>
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
      <section className="section-sub">
        <SectionHeading eyebrow="SOFTWARE STATUS" title="내 차의 소프트웨어" description="업데이트가 어떻게 검증되었는지 소비자도 이해할 수 있게 보여드립니다." />
        <div className="software-card panel"><div className="software-icon"><CloudCog size={25} /></div><div className="software-copy"><span>표시 버전 {vehicle.softwareVersion}</span><h3>{isSample ? 'OTA 운영 화면의 사용 예시입니다.' : '연결된 소프트웨어 상태입니다.'}</h3><p>{isSample ? '실제 배포 데이터가 아닌 포트폴리오 시나리오' : '현대차 OTA 공급자에서 동기화된 상태'}</p></div><div className="software-proof"><ShieldCheck size={18} /><div><strong>{isSample ? '샘플 검증 결과' : '안전 검증 완료'}</strong><span>{isSample ? '가상 차량군 · 예시 이상률' : '제조사 데이터 기준'}</span></div></div><button onClick={() => notify('업데이트 상세 이력을 열었습니다.')}><ChevronRight size={18} /></button></div>
      </section>
    </div>
  );
}

function PassportPage({ vehicle, notify, setModal, platform, passport, actions, busy }) {
  const isSample = vehicle.source !== 'HYUNDAI_DEVELOPERS';
  const activeHandover = platform.handovers?.find((item) => item.vehicleExternalId === vehicle.id && !['COMPLETED', 'CANCELLED'].includes(item.status));
  const timelineEvents = passport?.events?.length ? passport.events : passportEvents;
  return (
    <div className="page container">
      <PageIntro eyebrow="DIGITAL VEHICLE PASSPORT" title="내 차의 가치를 증명하는 기록" description="정비·배터리·소프트웨어 이력을 변경 여부까지 확인 가능한 차량 여권으로 남깁니다." actions={<button className="button outline" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/#passport`).then(() => notify('검증 링크를 클립보드에 복사했습니다.')).catch(() => notify('현재 주소를 공유해 주세요.'))}><Share2 size={16} /> 검증 링크 공유</button>} />
      {activeHandover && <OperationBanner tone="active" icon={KeyRound} label={`인수인계 ${activeHandover.step}/4단계`} title={handoverLabel(activeHandover.status)} detail={`구매자 ${activeHandover.buyerEmailMasked} · 전송 코드 ${activeHandover.transferCode}`} action={<button onClick={() => actions.advanceHandover(activeHandover.id)} disabled={busy}>{activeHandover.step === 3 ? '최종 전달' : '다음 단계'}</button>} />}
      <div className="passport-layout">
        <section className="passport-main panel">
          <div className="passport-head"><div><span className="verified"><ShieldCheck size={15} /> {isSample ? 'SAMPLE PASSPORT · 사용 예시' : 'LIFE PASS VERIFIED'}</span><h2>{vehicle.name}</h2><p>{vehicle.trim} · {vehicle.plate}</p></div><div className="passport-id"><span>PASS ID</span><strong>{isSample ? 'SAMPLE' : 'HMC'}-{vehicle.plate.replace(/\s/g, '')}-26</strong></div></div>
          <div className="passport-scores"><PassportScore label="차량 신뢰도" value={passport?.trustScore ?? 98} unit="/100" note="검증 완료" /><PassportScore label="배터리 SOH" value={vehicle.batterySoh} unit="%" note="평균 이상" /><PassportScore label="서명된 기록" value={passport?.signedEvents ?? 0} unit="건" note="DB 동기화" /><PassportScore label="OTA 무결성" value="100" unit="%" note="최신 상태" /></div>
          <div className="passport-signature"><LockKeyhole size={16} /><span>현재 여권 서명</span><code>sha256 · {passport?.hash ?? '동기화 중'}</code><CheckCircle2 size={16} /></div>
        </section>
        <aside className="handover-card panel"><div className="handover-visual"><KeyRound size={29} /></div><span>안전한 차량 인수인계</span><h3>개인정보는 지우고,<br />차량의 가치는 이어주세요.</h3><ul><li><Check size={14} /> 판매자 디지털 키 회수</li><li><Check size={14} /> 목적지·연락처·음성 기록 삭제</li><li><Check size={14} /> 검증 차량 이력 구매자 전달</li></ul><button className="button primary full" disabled={!!activeHandover} onClick={() => setModal('handover')}>{activeHandover ? `${activeHandover.step}/4단계 진행 중` : '인수인계 시작'} <ArrowRight size={16} /></button></aside>
      </div>
      <section className="section-sub">
        <SectionHeading eyebrow="TRUSTED TIMELINE" title="차량 생애주기 기록" description="각 이벤트는 출처와 무결성을 함께 확인할 수 있습니다." />
        <div className="timeline panel">{timelineEvents.map((event, index) => <div className="timeline-row" key={event.id ?? `${event.date}-${index}`}><div className="timeline-marker"><span>{index + 1}</span></div><time>{event.occurredAt ? formatDate(event.occurredAt) : event.date}</time><div><span>{event.type ?? event.category}</span><strong>{event.title}</strong><p>{event.detail}</p></div><code>{event.signature ? `${event.signature.slice(0, 8)}…` : event.hash}</code><span className="timeline-verified"><Check size={12} /> 검증</span></div>)}</div>
      </section>
    </div>
  );
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
        <nav aria-label="서비스 정책"><button onClick={() => navigate('privacy')}>개인정보 안내</button><button onClick={() => navigate('terms')}>서비스 이용안내</button><a href="https://github.com/boclair98/hyundai-life-pass" target="_blank" rel="noreferrer">GitHub</a></nav>
        <small>현대자동차 공식 운영 서비스가 아니며, 실차 데이터는 사용자의 명시적 동의 후에만 조회됩니다.</small>
      </div>
    </footer>
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
          <h2>수집과 이용</h2><p>현대 통합계정 연결 전에는 임의의 브라우저 세션 식별자만 사용합니다. 사용자가 현대자동차 화면에서 직접 동의한 경우에만 차량 식별자, 차종, 주행거리, 주행 가능 거리, EV 배터리 및 충전 상태를 처리합니다.</p>
          <h2>보관과 보호</h2><p>접근·갱신 토큰은 서버에서 AES-256-GCM으로 암호화해 저장하며 브라우저에 전달하지 않습니다. 세션 쿠키는 Secure·HttpOnly로 설정합니다.</p>
          <h2>철회와 삭제</h2><p>연결 해제 또는 현대자동차 데이터 제공 중단 콜백이 수신되면 연결 토큰과 해당 실차 데이터를 삭제합니다. 포트폴리오 샘플은 실제 사용자 정보가 아닙니다.</p>
          <h2>외부 제공자</h2><p>차량 데이터는 Hyundai Developers, 충전소 정보는 공공데이터포털, 지도와 주변 장소 검색은 Kakao API를 사용합니다.</p>
        </> : <>
          <h2>서비스 범위</h2><p>충전소 상태와 주변 서비스 거점은 외부 공급자 정보를 바탕으로 제공합니다. 실제 충전 예약·결제, 블루핸즈 확정 예약, 디지털 키 이전, OTA 제어는 제휴 권한 연결 전까지 제공하지 않습니다.</p>
          <h2>파일럿 고지</h2><p>이 서비스는 현대자동차 공식 서비스가 아닌 개발 포트폴리오 파일럿입니다. 화면에서 SAMPLE 또는 SIMULATED로 표시된 값은 기능 설명을 위한 예시이며 실제 차량 상태가 아닙니다.</p>
          <h2>정보 정확성</h2><p>공공데이터와 장소 정보는 갱신 시점에 따라 실제 현장 상태와 다를 수 있으므로 출발 전 운영기관 또는 서비스 거점에 확인해야 합니다.</p>
        </>}
        <div className="legal-contact"><strong>문의 및 개선 제안</strong><a href="https://github.com/boclair98/hyundai-life-pass/issues" target="_blank" rel="noreferrer">GitHub Issues에서 문의하기 <ArrowRight size={14} /></a></div>
      </section>
    </div>
  );
}

function MobileNav({ page, navigate }) {
  return <nav className="mobile-nav" aria-label="모바일 주요 메뉴">{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={21} /><span>{label}</span></button>)}<button className={page === 'lab' ? 'active' : ''} aria-current={page === 'lab' ? 'page' : undefined} onClick={() => navigate('lab')}><Code2 size={21} /><span>SDV Lab</span></button></nav>;
}

function Modal({ type, vehicle, platform, close, notify, navigate, actions, busy }) {
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
  const content = {
    connect: { icon: UserRound, eyebrow: 'HYUNDAI ACCOUNT', title: connected ? '내 차가 연결되어 있습니다.' : '현대 통합계정으로 시작하세요.', description: hyundai?.mode === 'LIVE' ? '현대자동차 공식 로그인 화면에서 차량 접근과 정보 제공 범위를 직접 확인합니다. 비밀번호는 Life Pass에 저장되지 않습니다.' : 'Hyundai Developers 프로젝트 키를 배포 환경에 등록하면 공식 로그인과 차량 데이터 동기화가 활성화됩니다.', button: connected ? '차량 데이터 새로고침' : hyundai?.state === 'CONSENT_REQUIRED' ? '정보 제공 동의 계속하기' : hyundai?.mode === 'LIVE' && hyundai.state !== 'MISCONFIGURED' ? '현대 통합계정으로 연결' : '연동 준비 항목 확인', done: '현대 계정 연결을 시작했습니다.' },
    service: { icon: Wrench, eyebrow: '블루핸즈 예약', title: '가까운 서비스센터를 찾았습니다.', description: '성수 현대서비스 · 2.1km · 가장 빠른 일정 9월 7일 10:30', button: '이 일정으로 예약', done: '9월 7일 오전 10시 30분으로 예약했습니다.' },
    handover: { icon: KeyRound, eyebrow: '안전한 인수인계', title: '4단계로 차량을 전달합니다.', description: '디지털 키 회수 → 개인정보 삭제 → 차량 여권 서명 → 구매자 초대', button: '인수인계 체크 시작', done: '안전한 인수인계 체크리스트를 시작했습니다.' },
    release: { icon: CloudCog, eyebrow: '새 Canary 배포', title: '1% 차량군부터 시작합니다.', description: 'IONIQ 6 · 2026 · 148대 · 자동 중지 및 롤백 활성화', button: 'Canary 배포 시작', done: 'Canary 배포가 1% 차량군에서 시작됐습니다.' },
  }[type];
  const Icon = content.icon;
  const submit = async () => {
    if (type === 'connect') {
      if (connected) return actions.syncHyundai();
      if (hyundai?.mode === 'LIVE' && hyundai.state === 'CONSENT_REQUIRED') return actions.resumeHyundaiAgreement();
      if (hyundai?.mode === 'LIVE' && !['MISCONFIGURED', 'ERROR'].includes(hyundai.state)) return actions.connectHyundai();
      notify('Client ID와 Secret은 Hyundai Developers 서비스 콘솔에서 발급받아야 합니다. docs/API_KEYS.md에 등록 순서를 정리해 두었습니다.');
      return false;
    }
    const task = { service: actions.bookService, handover: actions.startHandover, release: () => actions.startRelease(3) }[type];
    const completed = await task();
    if (completed && type === 'handover') navigate('passport');
  };
  return <div className="modal-backdrop" onMouseDown={(event) => event.currentTarget === event.target && close()}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-description"><button className="modal-close" onClick={close} aria-label="닫기"><X size={19} /></button><div className="modal-icon"><Icon size={22} /></div><span>{content.eyebrow}</span><h2 id="modal-title">{content.title}</h2><p id="modal-description">{content.description}</p>{type === 'connect' && <div className="connected-vehicle-preview"><CarFront size={20} /><div><strong>{vehicle.name}</strong><span>{vehicle.plate} · {vehicle.trim}</span></div><CheckCircle2 size={18} /></div>}<button className="button primary full" disabled={busy} onClick={submit}>{busy ? <LoaderCircle className="spin" size={16} /> : null}{content.button}<ArrowRight size={16} /></button><small>{type === 'connect' ? '로그인 토큰은 서버에서 AES-256-GCM으로 암호화되며 브라우저에 노출되지 않습니다.' : '작업 결과는 PostgreSQL, 차량 여권 이벤트와 감사 로그에 함께 기록됩니다.'}</small></div></div>;
}
