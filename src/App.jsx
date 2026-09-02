import { useEffect, useState } from 'react';
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
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { loadVehicles } from './api';
import { demoVehicles, passportEvents, releases, stations } from './data';
import './app.css';

const navigation = [
  { id: 'home', label: '홈', icon: CarFront },
  { id: 'charge', label: '충전', icon: BatteryCharging },
  { id: 'care', label: '내 차 케어', icon: Activity },
  { id: 'passport', label: '차량 여권', icon: FileCheck2 },
];

const validPages = new Set([...navigation.map((item) => item.id), 'lab']);

export default function App() {
  const initialPage = window.location.hash.replace('#', '');
  const [page, setPage] = useState(validPages.has(initialPage) ? initialPage : 'home');
  const [vehicles, setVehicles] = useState(demoVehicles);
  const [selectedVehicleId, setSelectedVehicleId] = useState(demoVehicles[0].id);
  const [dataSource, setDataSource] = useState('demo');
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);

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

  const shared = { vehicle, navigate, notify, setModal };

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
      />

      <main>
        {page === 'home' && <HomePage {...shared} />}
        {page === 'charge' && <ChargePage {...shared} />}
        {page === 'care' && <CarePage {...shared} />}
        {page === 'passport' && <PassportPage {...shared} />}
        {page === 'lab' && <CanaryLab {...shared} />}
      </main>

      <MobileNav page={page} navigate={navigate} />
      {modal && <Modal type={modal} vehicle={vehicle} close={() => setModal(null)} notify={notify} navigate={navigate} />}
      {toast && <div className="toast" role="status"><Check size={15} />{toast}</div>}
    </div>
  );
}

function Header({ page, navigate, menuOpen, setMenuOpen, vehicle, vehicles, selectedVehicleId, setSelectedVehicleId, dataSource, notify }) {
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
          <button className="header-icon" onClick={() => notify('확인하지 않은 알림이 없습니다.')} aria-label="알림"><Bell size={18} /></button>
          <button className={`lab-button ${page === 'lab' ? 'active' : ''}`} onClick={() => navigate('lab')}><Code2 size={15} /><span>Developer Lab</span></button>
          <button className="mobile-menu-button" onClick={() => setMenuOpen((value) => !value)} aria-label="메뉴 열기">{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
      </div>

      {menuOpen && (
        <div className="mobile-drawer">
          <div className="mobile-vehicle"><span>{vehicle.name}</span><strong>{vehicle.plate}</strong><small>{dataSource === 'api' ? '실차 API 연결' : '시연 데이터 연결'}</small></div>
          {navigation.map((item) => <button key={item.id} onClick={() => navigate(item.id)}><item.icon size={18} />{item.label}<ChevronRight size={16} /></button>)}
          <button onClick={() => navigate('lab')}><Code2 size={18} />Developer Lab<ChevronRight size={16} /></button>
        </div>
      )}
    </header>
  );
}

function HomePage({ vehicle, navigate, setModal }) {
  return (
    <>
      <section className="home-hero">
        <img src="/hyundai-ioniq6-hero.png" alt="밝은 스튜디오에 놓인 현대 아이오닉 6" />
        <div className="hero-shade" />
        <div className="hero-content container">
          <div className="hero-copy">
            <div className="overline">HYUNDAI LIFE PASS</div>
            <h1>내 차의 모든 순간을<br /><em>하나로 연결합니다.</em></h1>
            <p>충전, 정비, 소프트웨어 업데이트와 중고차 인수인계까지.<br />내 현대차의 생애주기를 한 곳에서 관리하세요.</p>
            <div className="hero-buttons">
              <button className="button primary" onClick={() => navigate('care')}>내 차 시작하기 <ArrowRight size={17} /></button>
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
              <div className="vehicle-summary-top"><div><span className="connected"><i /> 실시간 연결</span><h3>{vehicle.name}</h3><p>{vehicle.trim} · {vehicle.plate}</p></div><div className="health-score"><span>HEALTH</span><strong>{vehicle.healthScore}</strong><small>/100</small></div></div>
              <div className="summary-metrics">
                <Metric icon={BatteryCharging} label="배터리" value={`${vehicle.batterySoc}%`} detail={`${vehicle.range}km 주행 가능`} />
                <Metric icon={Gauge} label="누적 주행" value={`${vehicle.odometer.toLocaleString()}km`} detail="최근 30일 842km" />
                <Metric icon={CloudCog} label="소프트웨어" value={vehicle.softwareVersion} detail="최신 버전" />
              </div>
              <div className="vehicle-location"><MapPin size={15} /><span>{vehicle.location}</span><small>방금 업데이트</small></div>
            </div>
          </div>

          <div className="next-actions">
            <div className="next-actions-head"><span>지금 필요한 일</span><strong>2</strong></div>
            <ActionRow icon={BatteryCharging} color="blue" title="오늘 밤 11시 충전 추천" detail="완충 예상 비용 8,400원 · 42분" badge="추천" onClick={() => navigate('charge')} />
            <ActionRow icon={Wrench} color="orange" title="타이어 위치 교환이 가까워요" detail={`권장 점검까지 ${vehicle.nextServiceKm.toLocaleString()}km`} badge="예정" onClick={() => navigate('care')} />
            <ActionRow icon={ShieldCheck} color="green" title="차량 여권 신뢰도 98%" detail="최근 정비 기록까지 검증 완료" badge="안전" onClick={() => navigate('passport')} />
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

function ChargePage({ vehicle, notify }) {
  const [selectedStation, setSelectedStation] = useState(stations[0]);
  const [search, setSearch] = useState('성수동');
  return (
    <div className="page container">
      <PageIntro eyebrow="SMART CHARGE" title="기다리지 않는 충전" description="내 위치, 예상 도착시간, 실시간 충전 가능 여부를 함께 계산합니다." />
      <div className="charge-layout">
        <section className="charge-map panel">
          <div className="map-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="충전소 검색" /><button onClick={() => notify(`${search} 주변 충전소를 찾았습니다.`)}><LocateFixed size={17} /></button></div>
          <div className="map-surface" aria-label="성수동 주변 충전소 지도">
            <div className="road road-a" /><div className="road road-b" /><div className="road road-c" />
            <div className="map-river" />
            {stations.map((station, index) => <button key={station.id} className={`map-pin pin-${index + 1} ${selectedStation.id === station.id ? 'active' : ''}`} onClick={() => setSelectedStation(station)}><Zap size={16} fill="currentColor" /><span>{station.available}</span></button>)}
            <div className="my-location"><Navigation size={14} fill="currentColor" /></div>
          </div>
        </section>
        <aside className="station-panel panel">
          <div className="station-panel-head"><span>가까운 충전소</span><small>실시간</small></div>
          {stations.map((station) => (
            <button key={station.id} className={`station-row ${selectedStation.id === station.id ? 'active' : ''}`} onClick={() => setSelectedStation(station)}>
              <div className="station-availability"><strong>{station.available}</strong><span>/{station.total}</span></div>
              <div><strong>{station.name}</strong><span>{station.distance} · {station.speed} · {station.eta}</span></div>
              <ChevronRight size={16} />
            </button>
          ))}
          <div className="station-detail">
            <div><span>선택한 충전소</span><strong>{selectedStation.name}</strong><p>{selectedStation.address}</p></div>
            <div className="charge-price"><span>예상 충전비</span><strong>₩8,420</strong><small>{selectedStation.price}</small></div>
            <button className="button primary full" onClick={() => notify(`${selectedStation.name} 경로를 ${vehicle.name}에 전송했습니다.`)}>차량으로 경로 전송 <Navigation size={16} /></button>
          </div>
        </aside>
      </div>
      <div className="charge-plan-grid">
        <div className="panel plan-card"><div className="plan-icon"><Clock3 size={20} /></div><div><span>가장 저렴한 시간</span><strong>오늘 23:00–02:00</strong><p>현재보다 약 18% 절약 · 예상 8,400원</p></div><button onClick={() => notify('오늘 밤 11시 충전 알림을 예약했습니다.')}>알림 받기</button></div>
        <div className="panel plan-card"><div className="plan-icon"><Route size={20} /></div><div><span>내일 일정 기준</span><strong>오전 8시까지 80%</strong><p>예상 주행 64km · 출발 시 331km 가능</p></div><button onClick={() => notify('내일 일정에 맞춰 충전 계획을 저장했습니다.')}>계획 저장</button></div>
      </div>
    </div>
  );
}

function CarePage({ vehicle, notify, setModal }) {
  const bars = [62, 68, 65, 72, 76, 81, 84, 88, 92, vehicle.healthScore];
  return (
    <div className="page container">
      <PageIntro eyebrow="PREDICTIVE CARE" title="고장 나기 전에 먼저" description="차량 상태와 주행 패턴을 바탕으로 지금 필요한 관리만 알려드립니다." actions={<button className="button outline" onClick={() => notify('차량 케어 리포트를 준비했습니다.')}>리포트 받기 <Share2 size={16} /></button>} />
      <section className="care-overview panel">
        <div className="care-score-block"><span>오늘의 차량 건강도</span><div className="score-ring" style={{ '--score': `${vehicle.healthScore * 3.6}deg` }}><strong>{vehicle.healthScore}</strong><small>/100</small></div><em>매우 좋음</em></div>
        <div className="care-copy"><span className="live-label"><i /> {vehicle.name} 실시간 분석</span><h2>지금은 안심하고<br />주행하셔도 좋아요.</h2><p>배터리, 구동계, 타이어에서 즉시 확인할 이상 신호가 없습니다.</p><div className="care-inline-metrics"><div><ThermometerSun size={18} /><span>배터리 온도</span><strong>24°C</strong></div><div><CircleGauge size={18} /><span>타이어 공기압</span><strong>정상</strong></div><div><Zap size={18} /><span>배터리 SOH</span><strong>{vehicle.batterySoh}%</strong></div></div></div>
      </section>
      <div className="care-content-grid">
        <section className="panel health-chart"><div className="panel-title"><div><span>최근 10회 건강도</span><h3>안정적으로 유지 중</h3></div><span className="positive">+2.8%</span></div><div className="bar-chart">{bars.map((bar, index) => <div key={index}><span style={{ height: `${bar}%` }} /><small>{index + 1}</small></div>)}</div><div className="chart-legend"><span><i /> 차량 건강도</span><small>최근 30일</small></div></section>
        <section className="panel maintenance-card"><div className="panel-title"><div><span>다가오는 정비</span><h3>타이어 위치 교환</h3></div><div className="maintenance-icon"><Wrench size={19} /></div></div><div className="maintenance-distance"><strong>{vehicle.nextServiceKm.toLocaleString()}</strong><span>km 후 권장</span></div><p>주행 패턴을 기준으로 약 5주 뒤가 적당합니다.</p><div className="maintenance-meta"><span><CalendarClock size={15} /> 예상 2026.10.08</span><span>예상 비용 ₩84,000</span></div><button className="button primary full" onClick={() => setModal('service')}>블루핸즈 예약하기 <ArrowRight size={16} /></button></section>
      </div>
      <section className="section-sub">
        <SectionHeading eyebrow="SOFTWARE STATUS" title="내 차의 소프트웨어" description="업데이트가 어떻게 검증되었는지 소비자도 이해할 수 있게 보여드립니다." />
        <div className="software-card panel"><div className="software-icon"><CloudCog size={25} /></div><div className="software-copy"><span>현재 버전 {vehicle.softwareVersion}</span><h3>모든 업데이트가 완료되었습니다.</h3><p>배터리 열관리 · 내비게이션 · 주행 보조 시스템 최신</p></div><div className="software-proof"><ShieldCheck size={18} /><div><strong>안전 검증 완료</strong><span>98,422대 · 이상률 0.04%</span></div></div><button onClick={() => notify('업데이트 상세 이력을 열었습니다.')}><ChevronRight size={18} /></button></div>
      </section>
    </div>
  );
}

function PassportPage({ vehicle, notify, setModal }) {
  return (
    <div className="page container">
      <PageIntro eyebrow="DIGITAL VEHICLE PASSPORT" title="내 차의 가치를 증명하는 기록" description="정비·배터리·소프트웨어 이력을 변경 여부까지 확인 가능한 차량 여권으로 남깁니다." actions={<button className="button outline" onClick={() => notify('검증 링크를 클립보드에 복사했습니다.')}><Share2 size={16} /> 검증 링크 공유</button>} />
      <div className="passport-layout">
        <section className="passport-main panel">
          <div className="passport-head"><div><span className="verified"><ShieldCheck size={15} /> HYUNDAI LIFE PASS VERIFIED</span><h2>{vehicle.name}</h2><p>{vehicle.trim} · {vehicle.plate}</p></div><div className="passport-id"><span>PASS ID</span><strong>HMC-{vehicle.plate.replace(/\s/g, '')}-26</strong></div></div>
          <div className="passport-scores"><PassportScore label="차량 신뢰도" value="98" unit="/100" note="검증 완료" /><PassportScore label="배터리 SOH" value={vehicle.batterySoh} unit="%" note="평균 이상" /><PassportScore label="정비 기록" value="12" unit="건" note="누락 없음" /><PassportScore label="OTA 무결성" value="100" unit="%" note="최신 상태" /></div>
          <div className="passport-signature"><LockKeyhole size={16} /><span>마지막 기록 서명</span><code>sha256 · 8b1d5a2c…e42c</code><CheckCircle2 size={16} /></div>
        </section>
        <aside className="handover-card panel"><div className="handover-visual"><KeyRound size={29} /></div><span>안전한 차량 인수인계</span><h3>개인정보는 지우고,<br />차량의 가치는 이어주세요.</h3><ul><li><Check size={14} /> 판매자 디지털 키 회수</li><li><Check size={14} /> 목적지·연락처·음성 기록 삭제</li><li><Check size={14} /> 검증 차량 이력 구매자 전달</li></ul><button className="button primary full" onClick={() => setModal('handover')}>인수인계 시작 <ArrowRight size={16} /></button></aside>
      </div>
      <section className="section-sub">
        <SectionHeading eyebrow="TRUSTED TIMELINE" title="차량 생애주기 기록" description="각 이벤트는 출처와 무결성을 함께 확인할 수 있습니다." />
        <div className="timeline panel">{passportEvents.map((event, index) => <div className="timeline-row" key={event.date}><div className="timeline-marker"><span>{index + 1}</span></div><time>{event.date}</time><div><span>{event.category}</span><strong>{event.title}</strong><p>{event.detail}</p></div><code>{event.hash}</code><span className="timeline-verified"><Check size={12} /> 검증</span></div>)}</div>
      </section>
    </div>
  );
}

function CanaryLab({ notify, setModal }) {
  const [guard, setGuard] = useState(true);
  return (
    <div className="lab-page">
      <div className="container lab-container">
        <div className="lab-intro"><div><span><Code2 size={15} /> DEVELOPER PORTFOLIO · OPERATIONS</span><h1>CanaryDrive Control</h1><p>소비자 앱과 분리된 SDV 차량 소프트웨어 안전 운영 콘솔입니다.</p></div><div className="lab-status"><i /> Fleet stream 정상</div></div>
        <div className="lab-metrics"><LabMetric label="업데이트 중" value="14,820" unit="대" trend="37% rollout" /><LabMetric label="정상 차량" value="99.82" unit="%" trend="+0.11%" /><LabMetric label="이상 이벤트" value="0.18" unit="%" trend="guard threshold 1%" /><LabMetric label="자동 롤백" value="3" unit="건" trend="this month" /></div>
        <section className="lab-release panel-dark"><div className="lab-release-head"><div><span>ACTIVE RELEASE</span><h2>v2.4.1 · ccNC 내비게이션 1.9</h2><p>IONIQ 6 · 2026 · 14,820 vehicles</p></div><button className="lab-new-button" onClick={() => setModal('release')}><Plus size={16} /> 새 배포</button></div><div className="rollout-track"><div style={{ width: '37%' }} /><span style={{ left: '37%' }}>37%</span></div><div className="rollout-steps"><span className="done"><Check size={12} /> 1%</span><span className="done"><Check size={12} /> 10%</span><span className="active">37% 현재</span><span>70%</span><span>100%</span></div><div className="guard-row"><div><ShieldCheck size={19} /><span><strong>자동 중지·롤백</strong><small>이상률 1% 초과 또는 치명 이벤트 발생 시</small></span></div><button className={`switch ${guard ? 'on' : ''}`} onClick={() => { setGuard((value) => !value); notify(`Canary Guard를 ${guard ? '해제' : '활성화'}했습니다.`); }} aria-label="Canary Guard 전환"><span /></button></div></section>
        <div className="lab-grid"><section className="panel-dark"><div className="lab-panel-title"><span>RELEASE TRAINS</span><button onClick={() => notify('배포 목록을 새로고침했습니다.')}><RefreshCcw size={15} /></button></div>{releases.map((release) => <div className="release-row" key={release.id}><i className={release.tone} /><div><strong>{release.version}</strong><span>{release.title}</span><small>{release.cohort}</small></div><div><span>{release.status}</span><strong>{release.progress}%</strong></div><div><span>이상률</span><strong>{release.anomaly}</strong></div><ChevronRight size={16} /></div>)}</section><section className="panel-dark events-stream"><div className="lab-panel-title"><span>LIVE FLEET EVENTS</span><small><i /> LIVE</small></div><EventRow time="09:42:18" tone="good" title="Canary cohort passed" detail="IONIQ 6 · 1,480 vehicles" /><EventRow time="09:41:52" tone="warn" title="Thermal variance flagged" detail="KONA Electric · auto-review" /><EventRow time="09:39:08" tone="good" title="Passport record signed" detail="32가 0318 · verified" /><EventRow time="09:36:20" tone="info" title="Rollout expanded" detail="10% → 37% · policy approved" /></section></div>
      </div>
    </div>
  );
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

function MobileNav({ page, navigate }) {
  return <nav className="mobile-nav" aria-label="모바일 주요 메뉴">{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => navigate(id)}><Icon size={20} /><span>{label}</span></button>)}<button className={page === 'lab' ? 'active' : ''} onClick={() => navigate('lab')}><Code2 size={20} /><span>Lab</span></button></nav>;
}

function Modal({ type, vehicle, close, notify, navigate }) {
  const content = {
    connect: { icon: CarFront, eyebrow: '차량 연결', title: '내 현대차를 연결할까요?', description: '커넥티드 계정 동의 후 차량 상태와 이력을 안전하게 불러옵니다.', button: '현대 통합계정으로 연결', done: '차량 연결 시연이 완료되었습니다.' },
    service: { icon: Wrench, eyebrow: '블루핸즈 예약', title: '가까운 서비스센터를 찾았습니다.', description: '성수 현대서비스 · 2.1km · 가장 빠른 일정 9월 7일 10:30', button: '이 일정으로 예약', done: '9월 7일 오전 10시 30분으로 예약했습니다.' },
    handover: { icon: KeyRound, eyebrow: '안전한 인수인계', title: '4단계로 차량을 전달합니다.', description: '디지털 키 회수 → 개인정보 삭제 → 차량 여권 서명 → 구매자 초대', button: '인수인계 체크 시작', done: '안전한 인수인계 체크리스트를 시작했습니다.' },
    release: { icon: CloudCog, eyebrow: '새 Canary 배포', title: '1% 차량군부터 시작합니다.', description: 'IONIQ 6 · 2026 · 148대 · 자동 중지 및 롤백 활성화', button: 'Canary 배포 시작', done: 'Canary 배포가 1% 차량군에서 시작됐습니다.' },
  }[type];
  const Icon = content.icon;
  return <div className="modal-backdrop" onMouseDown={(event) => event.currentTarget === event.target && close()}><div className="modal" role="dialog" aria-modal="true"><button className="modal-close" onClick={close} aria-label="닫기"><X size={19} /></button><div className="modal-icon"><Icon size={22} /></div><span>{content.eyebrow}</span><h2>{content.title}</h2><p>{content.description}</p>{type === 'connect' && <div className="connected-vehicle-preview"><CarFront size={20} /><div><strong>{vehicle.name}</strong><span>{vehicle.plate} · {vehicle.trim}</span></div><CheckCircle2 size={18} /></div>}<button className="button primary full" onClick={() => { close(); notify(content.done); if (type === 'handover') navigate('passport'); }}>{content.button}<ArrowRight size={16} /></button><small>포트폴리오 데모에서는 실제 계정 정보가 저장되지 않습니다.</small></div></div>;
}
