import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, ArrowUpRight, BatteryCharging, CalendarDays, CarFront, Check, CheckCircle2, ChevronRight, CircleGauge, Download, ExternalLink, FileText, Fuel, Gift, MapPin, Navigation, Plus, RefreshCcw, Search, ShieldCheck, Sparkles, Wallet, Wrench, X } from 'lucide-react';
import { loadJournal, loadJournalReport, createJournalEntry, changeJournalStatus } from './api';
import { demoJournalEntries } from './data';
import './cinematic.css';
import { FeatureImage, SceneControls } from './MobilityBackdrop';

export const categories = { MAINTENANCE: '정비', CHARGE: '충전', FUEL: '주유', INSURANCE: '보험', WASH: '세차', PARKING: '주차', OTHER: '기타' };
const categoryIcons = { MAINTENANCE: Wrench, CHARGE: BatteryCharging, FUEL: Fuel, INSURANCE: ShieldCheck, WASH: Sparkles, PARKING: MapPin, OTHER: FileText };
const money = (value) => `${Number(value).toLocaleString('ko-KR')}원`;
const dateKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
const metric = (value, unit) => value == null ? '연결 후 확인' : `${Number(value).toLocaleString('ko-KR')}${unit}`;
const dateLabel = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
const CHECKLIST_STORAGE_KEY = 'life-pass:departure-checklist:v1';

function vehicleBrief(vehicle) {
  if (!vehicle) return {
    tone: 'idle',
    icon: CarFront,
    kicker: 'MY CAR BRIEF',
    title: '내 차를 연결하면, 오늘의 신호가 보여요',
    detail: '현대 공식 계정 연결 후 배터리·주행거리·안전 신호를 받은 만큼만 안내합니다.',
    action: '내 차 연결하기',
  };
  const warnings = Number(vehicle.warningCount ?? 0);
  if (warnings > 0) return {
    tone: 'warning',
    icon: ShieldCheck,
    kicker: 'CHECK FIRST',
    title: `확인이 필요한 차량 신호 ${warnings}건`,
    detail: '받은 경고 내용을 먼저 확인하고, 필요하면 가까운 서비스 거점으로 이어가세요.',
    action: '안전 점검 보기',
    target: 'care',
  };
  const battery = vehicle.batterySoc == null || vehicle.batterySoc === '' ? null : Number(vehicle.batterySoc);
  if (Number.isFinite(battery) && battery <= 20) return {
    tone: 'charge',
    icon: BatteryCharging,
    kicker: 'ENERGY CHECK',
    title: `배터리 ${battery}% · 충전을 준비해요`,
    detail: '현재 수신한 배터리 잔량을 기준으로 내 위치 주변 충전소를 찾아볼 수 있어요.',
    action: '충전소 찾기',
    target: 'charge',
  };
  const nextService = vehicle.nextServiceKm == null || vehicle.nextServiceKm === '' ? null : Number(vehicle.nextServiceKm);
  if (Number.isFinite(nextService) && nextService <= 1000) return {
    tone: 'care',
    icon: Wrench,
    kicker: 'CARE CHECK',
    title: `${nextService.toLocaleString('ko-KR')}km 후 점검을 준비해요`,
    detail: '차량에서 받은 다음 점검 기준을 바탕으로 가까운 서비스 거점을 확인할 수 있어요.',
    action: '서비스 거점 보기',
    target: 'care',
  };
  const signalCount = [vehicle.batterySoc, vehicle.range, vehicle.odometer, vehicle.chargingState].filter((value) => value != null && value !== '').length;
  if (!signalCount) return {
    tone: 'waiting',
    icon: RefreshCcw,
    kicker: 'SYNC CHECK',
    title: '차량 신호를 확인하고 있어요',
    detail: '연결은 되었지만 아직 받은 값이 없습니다. 잠시 후 새로고침해 주세요.',
    action: '차량 상태 보기',
    target: 'care',
  };
  return {
    tone: 'ready',
    icon: Check,
    kicker: 'READY FOR TODAY',
    title: '오늘의 출발 준비가 좋아요',
    detail: `차량에서 받은 신호 ${signalCount}개를 기준으로 다음 행동을 준비해 두었어요.`,
    action: '차량 상태 보기',
    target: 'care',
  };
}

function readinessModel(vehicle) {
  if (!vehicle) return {
    score: null,
    summary: '현대차를 연결하면 출발 준비도를 확인할 수 있어요.',
    action: '내 차 연결하기',
    actionKind: 'connect',
    pillars: [
      { id: 'safety', label: '안전', detail: '차량 연결 필요', state: 'CONNECT', icon: ShieldCheck },
      { id: 'energy', label: '에너지', detail: '배터리 수신 대기', state: 'CONNECT', icon: BatteryCharging },
      { id: 'care', label: '케어', detail: '점검 기준 수신 대기', state: 'CONNECT', icon: Wrench },
    ],
  };

  const warningCount = Number(vehicle.warningCount);
  const checkedWarnings = Number(vehicle.checkedWarnings);
  const hasWarningSignal = Number.isFinite(warningCount) && (warningCount > 0 || checkedWarnings >= 7 || (vehicle.healthChecks?.length > 0 && vehicle.healthChecks.every((check) => check.state !== 'UNAVAILABLE')));
  const battery = vehicle.batterySoc == null || vehicle.batterySoc === '' ? null : Number(vehicle.batterySoc);
  const nextService = vehicle.nextServiceKm == null || vehicle.nextServiceKm === '' ? null : Number(vehicle.nextServiceKm);
  const pillars = [
    hasWarningSignal
      ? { id: 'safety', label: '안전', detail: warningCount > 0 ? `경고 ${warningCount}건 확인` : '수신한 경고 없음', state: warningCount > 0 ? 'ATTENTION' : 'READY', icon: ShieldCheck }
      : { id: 'safety', label: '안전', detail: '아직 확인되지 않음', state: 'WAITING', icon: ShieldCheck },
    Number.isFinite(battery)
      ? { id: 'energy', label: '에너지', detail: battery <= 20 ? `배터리 ${battery}% · 충전 권장` : `배터리 ${battery}%`, state: battery <= 20 ? 'ATTENTION' : 'READY', icon: BatteryCharging }
      : { id: 'energy', label: '에너지', detail: '배터리 수신 대기', state: 'WAITING', icon: BatteryCharging },
    Number.isFinite(nextService)
      ? { id: 'care', label: '케어', detail: nextService <= 1000 ? `${nextService.toLocaleString('ko-KR')}km 후 점검` : `점검까지 ${nextService.toLocaleString('ko-KR')}km`, state: nextService <= 1000 ? 'ATTENTION' : 'READY', icon: Wrench }
      : { id: 'care', label: '케어', detail: '점검 기준 미제공', state: 'WAITING', icon: Wrench },
  ];
  const known = pillars.filter((pillar) => ['READY', 'ATTENTION'].includes(pillar.state));
  const ready = known.filter((pillar) => pillar.state === 'READY').length;
  const priority = pillars.find((pillar) => pillar.state === 'ATTENTION') ?? pillars.find((pillar) => pillar.state === 'WAITING');
  const actionByPillar = { safety: ['안전 점검 보기', 'care'], energy: ['충전소 찾기', 'charge'], care: ['서비스 거점 보기', 'care'] };
  const [action, target] = actionByPillar[priority?.id] ?? ['차량 상태 보기', 'care'];
  return {
    score: known.length ? Math.round((ready / known.length) * 100) : null,
    summary: known.length === 3 ? `${ready}/3개 신호를 기준으로 계산했어요.` : `${known.length}/3개 신호를 확인했어요. 나머지는 아직 수신되지 않았어요.`,
    action,
    actionKind: priority?.state === 'WAITING' ? 'status' : 'navigate',
    target,
    pillars,
  };
}

function VehicleReadiness({ vehicle, navigate, setModal, actions, busy }) {
  const model = readinessModel(vehicle);
  const updatedAt = vehicle?.updatedAt ?? vehicle?.dataTimestamp;
  const updatedLabel = updatedAt && !Number.isNaN(new Date(updatedAt).getTime())
    ? `마지막 수신 ${new Date(updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
    : '수신 시각 확인 필요';
  const handleAction = () => {
    if (model.actionKind === 'connect') return setModal('connect');
    if (model.actionKind === 'status' && actions?.syncHyundai) return actions.syncHyundai();
    navigate(model.target ?? 'care', model.target === 'care' ? 'status' : '');
  };
  return <section className={`vehicle-readiness ${model.score == null ? 'pending' : model.score < 70 ? 'attention' : 'ready'}`} aria-labelledby="readiness-title" data-reveal>
    <div className="readiness-heading"><div><span>DRIVE READINESS</span><h2 id="readiness-title">오늘 출발 준비도</h2><p>{model.summary}</p></div><div className="readiness-score" style={{ '--readiness-score': `${model.score ?? 0}%` }} aria-label={model.score == null ? '출발 준비도 계산 대기' : `출발 준비도 ${model.score}점`}><strong>{model.score ?? '—'}</strong><small>{model.score == null ? '신호 대기' : '점'}</small></div></div>
    <div className="readiness-pillars">{model.pillars.map(({ id, label, detail, state, icon: Icon }) => <article className={`readiness-pillar ${state.toLowerCase()}`} key={id}><span className="readiness-pillar-icon"><Icon size={16} /></span><div><strong>{label}</strong><small>{detail}</small></div><b>{state === 'READY' ? '준비됨' : state === 'ATTENTION' ? '확인 필요' : state === 'CONNECT' ? '연결 필요' : '미수신'}</b></article>)}</div>
    <div className="readiness-footer"><span><i />{vehicle ? '현대차에서 받은 신호 기준' : '현대차 연결 후 실제 신호로 계산'} · {updatedLabel}</span><button type="button" onClick={handleAction} disabled={busy}>{model.action}<ArrowRight size={14} /></button></div>
  </section>;
}

function TodayBrief({ vehicle, navigate, setModal }) {
  const brief = vehicleBrief(vehicle);
  const Icon = brief.icon;
  const onAction = () => brief.target ? navigate(brief.target, brief.target === 'care' ? 'status' : '') : setModal('connect');
  return <section className={`today-brief ${brief.tone}`} aria-labelledby="today-brief-title" data-reveal>
    <div className="today-brief-icon"><Icon size={21} /></div>
    <div className="today-brief-copy"><span>{brief.kicker}</span><h2 id="today-brief-title">{brief.title}</h2><p>{brief.detail}</p></div>
    <button className="today-brief-action" onClick={onAction}>{brief.action}<ArrowRight size={15} /></button>
  </section>;
}

function GuestStartPanel({ navigate, setModal }) {
  const [open, setOpen] = useState(false);
  return <section className="guest-start-panel" aria-labelledby="guest-start-title" data-reveal>
    <div className="guest-start-copy"><span>먼저 둘러보기</span><h2 id="guest-start-title">차량을 연결하기 전에, 필요한 기능부터 확인해 보세요.</h2><p>샘플 차량은 이해를 돕기 위한 예시입니다. 실제 차량 정보는 현대 계정 연결 후에만 표시됩니다.</p></div>
    <div className="guest-start-actions"><button className="button primary" type="button" onClick={() => setOpen((value) => !value)}>{open ? '샘플 닫기' : '샘플 차량으로 둘러보기'} <ArrowRight size={15} /></button><button className="button outline" type="button" onClick={() => navigate('charge')}>주변 충전소 먼저 보기</button></div>
    {open && <div className="guest-demo-grid" role="region" aria-label="샘플 차량 체험">
      <article><span>샘플 차량 · 실제 데이터 아님</span><strong>IONIQ 5</strong><small>배터리 78% · 주행 가능 312km</small><button type="button" onClick={() => setModal('connect')}>내 차 연결하기 <ArrowUpRight size={14} /></button></article>
      <button type="button" onClick={() => navigate('care', 'status')}><ShieldCheck size={19} /><strong>차량 상태</strong><small>배터리·안전 신호 화면 보기</small><ArrowRight size={15} /></button>
      <button type="button" onClick={() => navigate('care', 'centers')}><Wrench size={19} /><strong>정비 거점</strong><small>내 주변 블루핸즈 찾기</small><ArrowRight size={15} /></button>
      <button type="button" onClick={() => navigate('drive', 'checklist')}><Check size={19} /><strong>출발 체크</strong><small>오늘의 간단한 체크리스트</small><ArrowRight size={15} /></button>
    </div>}
  </section>;
}

function NextActionPanel({ vehicle, tasks, navigate, setModal }) {
  const next = vehicle?.warningCount > 0
    ? { icon: ShieldCheck, label: '안전 신호 확인', detail: `확인이 필요한 신호 ${vehicle.warningCount}건이 있어요.`, action: '상태 확인', run: () => navigate('care', 'status') }
    : vehicle?.batterySoc != null && Number(vehicle.batterySoc) <= 20
      ? { icon: BatteryCharging, label: '충전 준비', detail: `배터리 ${vehicle.batterySoc}% · 출발 전에 충전소를 찾아보세요.`, action: '충전소 보기', run: () => navigate('charge') }
      : tasks.length
        ? { icon: CalendarDays, label: tasks[0].title, detail: `${dateLabel(tasks[0].entryDate)} 예정 · 기록에서 완료 여부를 관리하세요.`, action: '일정 열기', run: () => navigate('passport') }
        : { icon: FileText, label: '첫 관리 기록 남기기', detail: '충전 비용이나 다음 점검일을 남겨 두면 다음 방문이 더 편해져요.', action: vehicle ? '기록 시작' : '내 차 연결', run: () => vehicle ? navigate('passport') : setModal('connect') };
  const Icon = next.icon;
  return <section className="next-action-panel" aria-labelledby="next-action-title" data-reveal><div className="next-action-icon"><Icon size={20} /></div><div><span>NEXT BEST ACTION</span><h2 id="next-action-title">{next.label}</h2><p>{next.detail}</p></div><button type="button" onClick={next.run}>{next.action}<ArrowRight size={15} /></button></section>;
}

function DepartureChecklist({ navigate }) {
  const today = dateKey();
  const [checked, setChecked] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CHECKLIST_STORAGE_KEY) ?? '{}');
      return saved.date === today && Array.isArray(saved.items) ? saved.items : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify({ date: today, items: checked })); } catch { /* device storage is optional */ }
  }, [today, checked]);
  const items = ['차량 주변에 장애물이 없는지 확인', '타이어와 외관에 이상이 없는지 확인', '오늘 목적지와 충전 여유를 확인'];
  const toggle = (index) => setChecked((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index]);
  return <section className="departure-checklist" aria-labelledby="departure-checklist-title" data-reveal><div className="checklist-heading"><div><span>DAILY DEPARTURE CHECK</span><h2 id="departure-checklist-title">오늘 출발 전 3분</h2><p>차량 신호와 별개로, 직접 확인할 항목을 매일 새로 시작해요.</p></div><strong>{checked.length}/{items.length}<small>완료</small></strong></div><div className="checklist-items">{items.map((item, index) => <button type="button" className={checked.includes(index) ? 'done' : ''} key={item} onClick={() => toggle(index)} aria-pressed={checked.includes(index)}><CheckCircle2 size={19} /><span>{item}</span></button>)}</div><button className="checklist-more" type="button" onClick={() => navigate('drive', 'checklist')}>전체 출발 체크리스트 보기 <ArrowRight size={15} /></button></section>;
}

function VehicleCareSummary({ vehicle, journal, navigate, setModal }) {
  const doneCount = journal.entries.filter((item) => item.status === 'DONE').length;
  const plannedCount = journal.entries.filter((item) => item.status === 'PLANNED').length;
  const signalCount = vehicle ? [vehicle.batterySoc, vehicle.range, vehicle.odometer, vehicle.chargingState].filter((value) => value != null && value !== '').length : 0;
  return <section className="care-summary-panel" aria-labelledby="care-summary-title" data-reveal><div className="care-summary-heading"><div><span>MY CARE SNAPSHOT</span><h2 id="care-summary-title">내 차 케어 요약</h2><p>{vehicle ? '차량에서 받은 신호와 내가 남긴 기록을 나눠서 보여드려요.' : '차량을 연결하거나 관리 기록을 시작하면 이 공간이 채워져요.'}</p></div><button type="button" onClick={() => vehicle ? navigate('care', 'status') : setModal('connect')}>{vehicle ? '상태 자세히' : '차량 연결'} <ArrowRight size={15} /></button></div><div className="care-summary-grid"><article><span>받은 차량 신호</span><strong>{vehicle ? `${signalCount}개` : '—'}</strong><small>{vehicle ? '마지막 수신 기준' : '연결 후 확인'}</small></article><article><span>예정된 관리</span><strong>{vehicle ? plannedCount : '—'}<small>건</small></strong><small>검사·정비·보험</small></article><article><span>완료한 기록</span><strong>{vehicle ? doneCount : '—'}<small>건</small></strong><small>직접 남긴 타임라인</small></article></div></section>;
}

function JournalInsights({ vehicle, report, loading, error, month }) {
  if (!vehicle) return <section className="journal-insights guest" aria-labelledby="journal-insights-title"><div><span>CARE REPORT</span><h2 id="journal-insights-title">기록이 쌓이면 내 차의 흐름이 보여요.</h2><p>충전·정비·보험 비용을 직접 남기면 월별 관리 리포트로 정리할 수 있습니다.</p></div><div className="journal-insights-empty"><FileText size={22} /><strong>첫 기록부터 시작해 보세요</strong></div></section>;
  if (loading) return <section className="journal-insights" aria-labelledby="journal-insights-title"><div className="journal-insights-empty" role="status"><RefreshCcw className="spin" size={22} /><strong>{month}월 리포트를 계산하고 있어요.</strong></div></section>;
  if (error || !report) return <section className="journal-insights" aria-labelledby="journal-insights-title"><div className="journal-insights-empty" role="alert"><Wallet size={22} /><strong>월별 리포트를 불러오지 못했어요.</strong><p>{error || '잠시 후 다시 시도해 주세요.'}</p></div></section>;
  const categoryTotals = report.categoryTotals ?? [];
  const max = categoryTotals[0]?.totalAmount || 1;
  return <section className="journal-insights" aria-labelledby="journal-insights-title"><div className="journal-insights-heading"><div><span>CARE REPORT</span><h2 id="journal-insights-title">이번 달 관리 흐름</h2><p>직접 남긴 완료 기록 중 금액이 입력된 항목만 지출로 계산합니다. 공식 정비 이력과는 별도로 관리돼요.</p></div><strong>{report.completedRecordCount}<small>건 완료</small></strong></div>{categoryTotals.length ? <div className="journal-insights-content"><div className="journal-bars" aria-label="분류별 지출"><h3>분류별 지출</h3>{categoryTotals.slice(0, 5).map((item) => <div className="journal-bar-row" key={item.category}><div><span>{categories[item.category] ?? item.category}</span><strong>{money(item.totalAmount)}</strong></div><i><b style={{ width: `${Math.max(8, (item.totalAmount / max) * 100)}%` }} /></i></div>)}</div><div className="journal-insights-kpis"><article><span>이번 달 합계</span><strong>{money(report.totalAmount)}</strong><small>{report.costRecordCount}건 금액 입력</small></article><article><span>기록당 평균</span><strong>{money(report.averageAmount)}</strong><small>{report.recordsWithoutAmount ? `금액 미입력 ${report.recordsWithoutAmount}건 제외` : '입력된 금액 기준'}</small></article></div></div> : <div className="journal-insights-empty"><Wallet size={22} /><strong>{month}월 비용 기록이 아직 없어요</strong><p>{report.completedRecordCount ? `완료 기록 ${report.completedRecordCount}건 중 금액이 입력된 기록이 없습니다.` : '충전이나 정비 후 금액을 남기면 다음 달과 비교할 수 있어요.'}</p></div>}</section>;
}

function OwnerValueHub({ vehicle, navigate, spent, journal }) {
  const recordedCost = journal.loading ? '불러오는 중…' : journal.error ? '확인 필요' : vehicle ? money(spent) : '연결 후 확인';
  const recordDetail = journal.loading
    ? '내 차량 기록을 확인하고 있어요.'
    : journal.error
      ? '기록을 다시 불러오면 실제 지출 흐름을 볼 수 있어요.'
      : vehicle
        ? '이번 달 직접 남긴 완료 지출 기준입니다.'
        : '현대차를 연결하면 직접 남긴 비용을 모아볼 수 있어요.';
  return <section className="owner-value-hub" aria-labelledby="owner-value-title" data-reveal>
    <div className="owner-value-heading">
      <div><span>OWNER VALUE LOOP</span><h2 id="owner-value-title">내 차 혜택을 한곳에서</h2><p>기록은 지금 바로, 공식 혜택과 제휴 케어는 승인된 범위에서 이어집니다.</p></div>
      <span className="owner-value-badge">선택형 혜택</span>
    </div>
    <div className="owner-value-grid">
      <article className="owner-value-card recorded">
        <div className="owner-value-icon"><Wallet size={18} /></div>
        <span className="owner-value-kicker">MY RECORD</span>
        <h3>{recordedCost}</h3>
        <p>{recordDetail}</p>
        <button type="button" onClick={() => navigate('passport')}>관리 기록 열기 <ArrowUpRight size={15} /></button>
      </article>
      <article className="owner-value-card official">
        <div className="owner-value-icon"><Gift size={18} /></div>
        <span className="owner-value-kicker">HYUNDAI OFFICIAL</span>
        <h3>공식 오너 혜택</h3>
        <p>블루멤버스 포인트와 현대 공식 서비스는 원문 페이지에서 확인하세요.</p>
        <div className="owner-value-links">
          <a href="https://www.hyundai.com/kr/ko/service-membership/bluemembers/bluemembers-point" target="_blank" rel="noreferrer">포인트 확인 <ExternalLink size={13} /></a>
          <a href="https://www.hyundai.com/kr/ko/service-membership/service-network/service-reservation-search/service-network-reservation" target="_blank" rel="noreferrer">정비 예약 <ExternalLink size={13} /></a>
        </div>
      </article>
      <article className="owner-value-card partner">
        <div className="owner-value-icon"><Wrench size={18} /></div>
        <span className="owner-value-kicker">PARTNER CARE</span>
        <h3>정비·세차·충전을 한 흐름으로</h3>
        <p>공식 파트너가 연결되면 비교·예약·결제까지 확장합니다. 현재는 준비 상태만 안내해요.</p>
        <span className="owner-value-status">제휴 준비 중</span>
      </article>
    </div>
    <p className="owner-value-note"><ShieldCheck size={15} />안전 알림과 기본 차량 상태는 유료로 막지 않습니다. 구독·제휴 혜택은 선택형으로 운영합니다.</p>
  </section>;
}

export function useVehicleJournal(vehicleId, demoMode = false) {
  const [state, setState] = useState({ vehicleId: null, entries: [], loading: false, error: '' });
  const requestId = useRef(0);
  const currentVehicle = useRef(vehicleId);
  currentVehicle.current = vehicleId;
  const refresh = useCallback(async () => {
    if (currentVehicle.current !== vehicleId) return;
    const id = ++requestId.current;
    if (!vehicleId) { setState({ vehicleId, entries: [], loading: false, error: '' }); return; }
    if (demoMode) {
      setState((old) => old.vehicleId === vehicleId && old.entries.length
        ? { ...old, loading: false, error: '' }
        : { vehicleId, entries: demoJournalEntries.map((entry) => ({ ...entry })), loading: false, error: '' });
      return;
    }
    setState((old) => ({ vehicleId, entries: old.vehicleId === vehicleId ? old.entries : [], loading: true, error: '' }));
    try {
      const entries = await loadJournal(vehicleId);
      if (id === requestId.current && currentVehicle.current === vehicleId) setState({ vehicleId, entries, loading: false, error: '' });
    } catch (error) {
      if (id === requestId.current) setState((old) => ({ ...old, loading: false, error: error.message }));
    }
  }, [demoMode, vehicleId]);
  useEffect(() => { refresh(); return () => { requestId.current += 1; }; }, [refresh]);
  const createEntry = useCallback(async (entry) => {
    if (!vehicleId) throw new Error('차량을 먼저 선택해 주세요.');
    if (!demoMode) return createJournalEntry(vehicleId, entry);
    const now = new Date().toISOString();
    const created = { ...entry, id: `demo-entry-${Date.now()}`, vehicleId, createdAt: now, updatedAt: now };
    setState((old) => ({ ...old, vehicleId, entries: [created, ...old.entries] }));
    return created;
  }, [demoMode, vehicleId]);
  const changeStatus = useCallback(async (entryId, status) => {
    if (!vehicleId) throw new Error('차량을 먼저 선택해 주세요.');
    if (!demoMode) return changeJournalStatus(vehicleId, entryId, status);
    setState((old) => ({ ...old, vehicleId, entries: old.entries.map((entry) => entry.id === entryId ? { ...entry, status: status === 'RESTORE' ? entry.archivedStatus ?? 'PLANNED' : status, archivedStatus: status === 'ARCHIVED' ? entry.status : entry.archivedStatus, updatedAt: new Date().toISOString() } : entry) }));
    return true;
  }, [demoMode, vehicleId]);
  const loadReport = useCallback(async (month) => {
    if (!vehicleId) return null;
    if (!demoMode) return loadJournalReport(vehicleId, month);
    const entries = state.vehicleId === vehicleId ? state.entries : demoJournalEntries;
    const completed = entries.filter((entry) => entry.status === 'DONE' && entry.entryDate.startsWith(month));
    const costEntries = completed.filter((entry) => Number.isFinite(Number(entry.amount)) && Number(entry.amount) >= 0);
    const totals = costEntries.reduce((result, entry) => ({ ...result, [entry.category]: (result[entry.category] ?? 0) + Number(entry.amount) }), {});
    const categoryTotals = Object.entries(totals).map(([category, totalAmount]) => ({ category, totalAmount, recordCount: costEntries.filter((entry) => entry.category === category).length })).sort((left, right) => right.totalAmount - left.totalAmount);
    const totalAmount = costEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);
    return { vehicleId, month, currency: 'KRW', source: 'DEMO', completedRecordCount: completed.length, costRecordCount: costEntries.length, recordsWithoutAmount: completed.length - costEntries.length, totalAmount, averageAmount: costEntries.length ? Math.round(totalAmount / costEntries.length) : 0, categoryTotals };
  }, [demoMode, state.entries, state.vehicleId, vehicleId]);
  return { entries: state.vehicleId === vehicleId ? state.entries : [], loading: Boolean(vehicleId) && (state.vehicleId !== vehicleId || state.loading), error: state.vehicleId === vehicleId ? state.error : '', refresh, createEntry, changeStatus, loadReport, demoMode };
}

export function OwnerHome({ vehicle, navigate, setModal, platform, actions, busy, journal, tour }) {
  const homeRoot = useRef(null);
  const tasks = journal.entries.filter((item) => item.status === 'PLANNED').sort((a, b) => a.entryDate.localeCompare(b.entryDate)).slice(0, 3);
  const month = dateKey().slice(0, 7);
  const spent = journal.entries.filter((item) => item.status === 'DONE' && item.entryDate.startsWith(month)).reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const checked = vehicle?.checkedWarnings ?? 0;
  const warnings = vehicle?.warningCount ?? 0;
  const shortcuts = [
    { label: '충전소 찾기', detail: '사용 가능한 곳', icon: BatteryCharging, page: 'charge', tone: 'cyan' },
    { label: '차량 상태', detail: '배터리·안전 신호', icon: Activity, page: 'care', target: 'status', tone: 'blue' },
    { label: '정비소 찾기', detail: '가까운 블루핸즈', icon: Wrench, page: 'care', target: 'centers', tone: 'blue' },
    { label: '관리 기록', detail: '정비·지출·일정', icon: FileText, page: 'passport', tone: 'blue' },
  ];
  return <div className="owner-home cinematic-home container" ref={homeRoot}>
    <div className="home-greeting"><div><span>MY CAR, MY EVERYDAY</span><p>{vehicle ? `${vehicle.name}와 함께하는 오늘` : '내 차를 위한 좋은 습관'}</p></div><button onClick={() => navigate('settings')}><CarFront size={17} />{vehicle ? '내 차 관리' : '차량 연결'}<ChevronRight size={14} /></button></div>
    <section className="mobility-welcome" aria-labelledby="owner-title">
      <span className="mobility-eyebrow">MY CAR. MY SPACE.</span>
      <h1 id="owner-title">내 차와 함께하는<br /><em>모든 순간.</em></h1>
      <p>차량 상태, 가까운 충전소, 정비와 기록.<br />필요한 곳으로 이동해 보세요.</p>
      <button className="button light" disabled={busy} onClick={vehicle ? actions.syncHyundai : () => setModal('connect')}>{vehicle ? <RefreshCcw size={16} /> : <Plus size={16} />}{vehicle ? '차량 상태 새로고침' : '내 현대차 연결하기'}<ArrowRight size={16} /></button>
      <SceneControls tour={tour} />
    </section>
    {!vehicle && <GuestStartPanel navigate={navigate} setModal={setModal} />}
    <TodayBrief vehicle={vehicle} navigate={navigate} setModal={setModal} />
    <VehicleReadiness vehicle={vehicle} navigate={navigate} setModal={setModal} actions={actions} busy={busy} />
    <NextActionPanel vehicle={vehicle} tasks={tasks} navigate={navigate} setModal={setModal} />
    <DepartureChecklist navigate={navigate} />
    <VehicleCareSummary vehicle={vehicle} journal={journal} navigate={navigate} setModal={setModal} />
    <nav className="owner-shortcuts" aria-label="자주 쓰는 기능">{shortcuts.map(({ label, detail, icon: Icon, page, target, tone }, index) => <button key={label} onClick={() => navigate(page, target)}><FeatureImage scene={['charge', 'battery', 'care', 'road', 'parking', 'journal'][index]} priority={index < 2} /><span className={`shortcut-icon ${tone}`}><Icon size={20} strokeWidth={1.6} /></span><span className="journey-card-copy"><strong>{label}</strong><small>{detail}</small></span><ArrowUpRight className="journey-card-arrow" size={17} /></button>)}</nav>
    <section className="home-car-section" id="owner-tools" tabIndex={-1} aria-labelledby="home-car-heading">
      <div className="journey-garage"><FeatureImage scene="care" /><span>내 차를 위한 나만의 공간</span></div>
      <div className="workspace-section-title"><div><span>MY HYUNDAI</span><h2 id="home-car-heading">오늘의 내 차</h2></div><button onClick={() => navigate('care', 'status')}>자세히 보기 <ChevronRight size={15} /></button></div>
      <div className="owner-vitals">
        {[{ icon: BatteryCharging, label: '배터리 잔량', value: metric(vehicle?.batterySoc, '%'), className: 'battery' }, { icon: Navigation, label: '주행 가능 거리', value: metric(vehicle?.range, ' km') }, { icon: CircleGauge, label: '누적 주행거리', value: metric(vehicle?.odometer, ' km') }, { icon: ShieldCheck, label: '차량 경고', value: vehicle ? (checked ? (warnings ? `${warnings}건 확인 필요` : '수신한 경고 없음') : '수신 정보 없음') : '연결 후 확인' }].map(({ icon: Icon, label, value, className }) => <button key={label} className={`owner-vital ${className ?? ''}`} onClick={() => vehicle ? navigate('care', 'status') : setModal('connect')}><Icon size={20} /><span>{label}</span><strong className={!vehicle ? 'unconnected-value' : ''}>{value}</strong>{label === '배터리 잔량' && <i className="vital-battery"><b style={{ width: `${vehicle?.batterySoc ?? 0}%` }} /></i>}</button>)}
      </div>
      <p className="owner-data-note">{vehicle ? `차량 정보는 마지막 수신 기준입니다. ${vehicle.updatedAt ? new Date(vehicle.updatedAt).toLocaleString('ko-KR') : ''}` : '내 차를 연결하면 차량에서 제공하는 상태를 이곳에 보여드려요.'}</p>
    </section>
    <div className="owner-lower-grid">
      <section className="owner-agenda"><div className="workspace-section-title"><div><span>MY SCHEDULE</span><h2>잊지 말아야 할 일</h2></div><button onClick={() => navigate('passport')}>일정 관리 <ChevronRight size={15} /></button></div><div className="agenda-list">{journal.loading ? <p>일정을 불러오고 있어요.</p> : journal.error ? <button onClick={journal.refresh}>일정을 불러오지 못했어요 · 다시 시도</button> : tasks.length ? tasks.map((item) => <button key={item.id} onClick={() => navigate('passport')}><span className="agenda-date">{dateLabel(item.entryDate)}</span><strong>{item.title}</strong><ChevronRight size={15} /></button>) : <div className="agenda-empty"><CalendarDays size={29} /><strong>다음 정비일을 기억해 둘까요?</strong><p>검사, 보험 갱신, 소모품 교체 일정을 남겨보세요.</p><button onClick={() => vehicle ? navigate('passport') : setModal('connect')}>일정 추가하기 <Plus size={15} /></button></div>}</div></section>
      <section className="owner-cost"><div className="workspace-section-title"><div><span>CAR LIFE COST</span><h2>이번 달 차량 지출</h2></div><Wallet size={22} /></div><strong>{journal.loading ? '불러오는 중…' : journal.error ? '기록 확인이 필요해요' : vehicle ? money(spent) : '기록부터 시작해요'}</strong><p>직접 남긴 충전·정비·주유 비용을 모아보세요.</p><button onClick={() => navigate('passport')}>지출 기록하기 <ArrowUpRight size={18} /></button></section>
    </div>
    <OwnerValueHub vehicle={vehicle} navigate={navigate} spent={spent} journal={journal} />
    <div className="owner-bottom-links"><button onClick={() => navigate('drive', 'checklist')}><ShieldCheck size={22} /><span><strong>출발 전, 한 번 더 확인</strong><small>타이어부터 차량 주변까지 오늘의 체크리스트</small></span><ArrowRight size={17} /></button><button onClick={() => navigate('drive')}><Navigation size={22} /><span><strong>주행 도구 열기</strong><small>거리 계산·주차 위치처럼 필요할 때만 쓰는 기능</small></span><ArrowRight size={17} /></button></div>
  </div>;
}

export function OwnershipPage({ vehicle, journal, notify, setModal, children }) {
  const [view, setView] = useState('records');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState(dateKey().slice(0, 7));
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportRevision, setReportRevision] = useState(0);
  const [draft, setDraft] = useState(() => ({ category: 'MAINTENANCE', title: '', note: '', entryDate: dateKey(), amount: '', odometer: '', status: 'DONE' }));
  const active = journal.entries.filter((item) => item.status !== 'ARCHIVED');
  const upcoming = active.filter((item) => item.status === 'PLANNED');
  const records = journal.entries.filter((item) => (filter === 'archived' ? item.status === 'ARCHIVED' : item.status !== 'ARCHIVED') && (filter !== 'planned' || item.status === 'PLANNED') && (filter !== 'done' || item.status === 'DONE') && `${item.title} ${item.note} ${categories[item.category]}`.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => { setFormOpen(false); setError(''); }, [vehicle?.databaseId]);
  useEffect(() => {
    let cancelled = false;
    if (!vehicle) {
      setReport(null); setReportLoading(false); setReportError('');
      return () => { cancelled = true; };
    }
    setReport(null); setReportLoading(true); setReportError('');
    journal.loadReport(month)
      .then((data) => { if (!cancelled) setReport(data); })
      .catch((failure) => { if (!cancelled) setReportError(failure.message); })
      .finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; };
  }, [journal.loadReport, month, reportRevision, vehicle?.databaseId]);

  const save = async (event) => {
    event.preventDefault();
    if (!vehicle || saving) return;
    setSaving(true); setError('');
    try {
      await journal.createEntry({ ...draft, amount: draft.amount === '' ? null : Number(draft.amount), odometer: draft.odometer === '' ? null : Number(draft.odometer) });
      await journal.refresh(); setReportRevision((revision) => revision + 1); setFormOpen(false); setDraft({ category: 'MAINTENANCE', title: '', note: '', entryDate: dateKey(), amount: '', odometer: '', status: 'DONE' }); notify('내 차량의 관리 기록에 저장했습니다.');
    } catch (failure) { setError(failure.message); } finally { setSaving(false); }
  };
  const change = async (item, status) => {
    setSaving(true); setError('');
    try { await journal.changeStatus(item.id, status); await journal.refresh(); setReportRevision((revision) => revision + 1); notify(status === 'ARCHIVED' ? '보관함으로 이동했습니다. 언제든 다시 꺼낼 수 있어요.' : '기록 상태를 변경했습니다.'); } catch (failure) { setError(failure.message); } finally { setSaving(false); }
  };
  const exportRecords = () => {
    const escape = (value) => `"${String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`;
    const rows = [['날짜', '분류', '제목', '금액(원)', '주행거리(km)', '상태', '메모'], ...active.map((item) => [item.entryDate, categories[item.category], item.title, item.amount, item.odometer, item.status === 'DONE' ? '완료' : '예정', item.note])];
    const url = URL.createObjectURL(new Blob(['\uFEFF', rows.map((row) => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = `life-pass-records-${dateKey()}.csv`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); notify('차량 기록 파일을 내려받았습니다.');
  };
  return <div className="page container ownership-page">
    <div className="workspace-heading"><div><span>MY CAR JOURNAL</span><h1>차곡차곡, 내 차 기록</h1><p>정비 일정과 차량 지출을 남기고, 내 차의 시간을 모아보세요.</p></div><button className="button primary" onClick={() => { if (!vehicle) return setModal('connect'); setView('records'); setFormOpen((value) => view === 'passport' || !value); }}><Plus size={17} />기록 추가</button></div>
    <nav className="workspace-tabs" aria-label="차량 기록 보기"><button className={view === 'records' ? 'active' : ''} aria-pressed={view === 'records'} onClick={() => setView('records')}>관리 기록</button><button className={view === 'passport' ? 'active' : ''} aria-pressed={view === 'passport'} onClick={() => setView('passport')}>차량에서 받은 기록</button></nav>
    {view === 'passport' ? <div className="embedded-passport">{children}</div> : <>
      {!vehicle && <div className="journal-connect"><CarFront size={28} /><div><strong>내 차와 함께 오래 남는 기록</strong><p>차량을 연결하면 같은 계정으로 다른 기기에서도 확인할 수 있어요.</p></div><button className="button primary" onClick={() => setModal('connect')}>내 차 연결 <ArrowRight size={16} /></button></div>}
      <section className="journal-summary"><article><span>월별 지출 <input type="month" aria-label="지출 조회 월" value={month} onChange={(event) => setMonth(event.target.value)} /></span><strong>{vehicle && !journal.loading && !journal.error && !reportLoading && !reportError && report ? money(report.totalAmount) : '—'}</strong><small>직접 입력한 완료 기록 중 금액 입력 기준</small></article><article><span>예정된 일정</span><strong>{vehicle && !journal.loading && !journal.error ? upcoming.length : '—'}<small>건</small></strong><small>정비·검사·보험 갱신</small></article><article><span>쌓인 관리 기록</span><strong>{vehicle && !journal.loading && !journal.error ? active.length : '—'}<small>건</small></strong><small>내 차량에 저장한 기록</small></article></section>
      {!journal.loading && !journal.error && <JournalInsights vehicle={vehicle} report={report} loading={reportLoading} error={reportError} month={month} />}
      {formOpen && vehicle && <form className="journal-form" onSubmit={save}><div className="journal-form-heading"><h2>새 기록 남기기</h2><button type="button" onClick={() => setFormOpen(false)} aria-label="기록 입력 닫기"><X size={19} /></button></div><div className="journal-form-grid">
        <label>분류<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>기록 상태<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option value="DONE">완료한 일</option><option value="PLANNED">예정된 일정</option></select></label>
        <label className="wide">기록 제목<input autoFocus required maxLength={100} placeholder="예: 앞 타이어 교체, 자동차 보험 갱신" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label>{draft.status === 'PLANNED' ? '예정일' : '이용일'}<input type="date" required min="1900-01-01" max={draft.status === 'DONE' ? dateKey() : '2200-12-31'} value={draft.entryDate} onChange={(event) => setDraft({ ...draft, entryDate: event.target.value })} /></label>
        <label>금액 · 원 (선택)<input type="number" inputMode="numeric" min="0" max="1000000000" step="1" placeholder="0" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></label>
        <label>주행거리 · km (선택)<input type="number" inputMode="numeric" min="0" max="10000000" step="1" placeholder="계기판 주행거리" value={draft.odometer} onChange={(event) => setDraft({ ...draft, odometer: event.target.value })} /></label>
        <label className="wide">메모 (선택)<textarea maxLength={500} placeholder="이용 장소, 교체 부품 등 기억하고 싶은 내용을 남겨주세요." value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label>
      </div><p>직접 작성한 관리 기록입니다. 정비소 예약이나 공식 정비 이력으로 등록되지는 않습니다.</p><button className="button primary" disabled={saving}>{saving ? '저장 중…' : '내 차량에 저장'}<Check size={16} /></button></form>}
      {(error || journal.error) && <div className="journal-error" role="alert">{error || journal.error}<button onClick={journal.refresh}>다시 불러오기</button></div>}
      <section className="journal-history"><div className="workspace-section-title"><h2>관리 타임라인</h2><button disabled={!active.length} onClick={exportRecords}><Download size={16} />내려받기</button></div><div className="journal-toolbar"><div className="journal-filters">{[['all', '전체'], ['planned', '예정'], ['done', '완료'], ['archived', '보관함']].map(([id, label]) => <button key={id} className={filter === id ? 'active' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div><label className="journal-search"><Search size={17} /><input aria-label="관리 기록 검색" placeholder="기록 검색" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
      {journal.loading ? <div className="journal-empty" role="status"><RefreshCcw className="spin" size={25} /><strong>기록을 불러오고 있어요.</strong></div> : records.length ? <div className="journal-entries">{records.map((item) => { const Icon = categoryIcons[item.category] ?? FileText; return <article key={item.id} className="journal-entry"><div className="journal-entry-icon"><Icon size={21} /></div><div className="journal-entry-copy"><span>{dateLabel(item.entryDate)} · {categories[item.category]} · {item.status === 'PLANNED' ? (item.entryDate < dateKey() ? '지난 예정일' : '예정') : item.status === 'ARCHIVED' ? '보관됨' : '완료'}</span><h3>{item.title}</h3>{item.note && <p>{item.note}</p>}{item.odometer != null && <small>{item.odometer.toLocaleString()}km</small>}</div><div className="journal-entry-actions"><strong>{item.amount == null ? '' : money(item.amount)}</strong><div>{item.status === 'PLANNED' && <button disabled={saving || item.entryDate > dateKey()} onClick={() => change(item, 'DONE')}>완료</button>}<button disabled={saving} onClick={() => change(item, item.status === 'ARCHIVED' ? 'RESTORE' : 'ARCHIVED')}>{item.status === 'ARCHIVED' ? '복원' : '보관'}</button></div></div></article>; })}</div> : <div className="journal-empty"><FileText size={30} /><strong>{query ? '일치하는 기록이 없어요.' : filter === 'archived' ? '보관한 기록이 없어요.' : '첫 번째 관리 기록을 남겨보세요.'}</strong><p>{query ? '다른 검색어로 찾아보세요.' : '오늘 충전한 비용부터, 다음 점검 일정까지.'}</p>{!query && filter !== 'archived' && <button onClick={() => vehicle ? setFormOpen(true) : setModal('connect')}>기록 시작하기 <Plus size={16} /></button>}</div>}</section>
      <p className="journal-footnote">예정 일정은 앱 안에서 확인할 수 있습니다. 푸시 알림은 제공하지 않습니다.</p>
    </>}
  </div>;
}
