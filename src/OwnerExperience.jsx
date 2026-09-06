import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, ArrowUpRight, BatteryCharging, CalendarDays, CarFront, Check, ChevronRight, CircleGauge, Download, FileText, Fuel, MapPin, Navigation, Plus, RefreshCcw, Search, ShieldCheck, Sparkles, Wallet, Wrench, X } from 'lucide-react';
import { loadJournal, createJournalEntry, changeJournalStatus } from './api';
import './cinematic.css';

export const categories = { MAINTENANCE: '정비', CHARGE: '충전', FUEL: '주유', INSURANCE: '보험', WASH: '세차', PARKING: '주차', OTHER: '기타' };
const categoryIcons = { MAINTENANCE: Wrench, CHARGE: BatteryCharging, FUEL: Fuel, INSURANCE: ShieldCheck, WASH: Sparkles, PARKING: MapPin, OTHER: FileText };
const money = (value) => `${Number(value).toLocaleString('ko-KR')}원`;
const dateKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
const metric = (value, unit) => value == null ? '연결 후 확인' : `${Number(value).toLocaleString('ko-KR')}${unit}`;
const dateLabel = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

export function useVehicleJournal(vehicleId) {
  const [state, setState] = useState({ vehicleId: null, entries: [], loading: false, error: '' });
  const requestId = useRef(0);
  const currentVehicle = useRef(vehicleId);
  currentVehicle.current = vehicleId;
  const refresh = useCallback(async () => {
    if (currentVehicle.current !== vehicleId) return;
    const id = ++requestId.current;
    if (!vehicleId) { setState({ vehicleId, entries: [], loading: false, error: '' }); return; }
    setState((old) => ({ vehicleId, entries: old.vehicleId === vehicleId ? old.entries : [], loading: true, error: '' }));
    try {
      const entries = await loadJournal(vehicleId);
      if (id === requestId.current && currentVehicle.current === vehicleId) setState({ vehicleId, entries, loading: false, error: '' });
    } catch (error) {
      if (id === requestId.current) setState((old) => ({ ...old, loading: false, error: error.message }));
    }
  }, [vehicleId]);
  useEffect(() => { refresh(); return () => { requestId.current += 1; }; }, [refresh]);
  return { entries: state.vehicleId === vehicleId ? state.entries : [], loading: Boolean(vehicleId) && (state.vehicleId !== vehicleId || state.loading), error: state.vehicleId === vehicleId ? state.error : '', refresh };
}

export function OwnerHome({ vehicle, navigate, setModal, platform, actions, busy, journal }) {
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
    { label: '주행 계산', detail: '거리와 충전 비용', icon: Navigation, page: 'drive', target: 'plan', tone: 'mint' },
    { label: '주차 위치', detail: '내 차 다시 찾기', icon: MapPin, page: 'drive', target: 'parking', tone: 'mint' },
    { label: '관리 기록', detail: '정비·지출·일정', icon: FileText, page: 'passport', tone: 'blue' },
  ];
  return <div className="owner-home cinematic-home container" ref={homeRoot}>
    <div className="home-greeting"><div><span>MY CAR, MY EVERYDAY</span><p>{vehicle ? `${vehicle.name}와 함께하는 오늘` : '내 차를 위한 좋은 습관'}</p></div><button onClick={() => navigate('settings')}><CarFront size={17} />{vehicle ? '내 차 관리' : '차량 연결'}<ChevronRight size={14} /></button></div>
    <section className="mobility-welcome" aria-labelledby="owner-title">
      <span className="mobility-eyebrow">MY CAR. MY SPACE.</span>
      <h1 id="owner-title">내 차와 함께하는<br /><em>모든 순간.</em></h1>
      <p>차량 상태, 가까운 충전소, 정비와 기록.<br />필요한 곳으로 이동해 보세요.</p>
      <button className="button light" disabled={busy} onClick={vehicle ? actions.syncHyundai : () => setModal('connect')}>{vehicle ? <RefreshCcw size={16} /> : <Plus size={16} />}{vehicle ? '차량 상태 새로고침' : '내 현대차 연결하기'}<ArrowRight size={16} /></button>
      <small>배경은 AI 콘셉트 이미지입니다.</small>
    </section>
    <nav className="owner-shortcuts" aria-label="자주 쓰는 기능">{shortcuts.map(({ label, detail, icon: Icon, page, target, tone }) => <button key={label} onClick={() => navigate(page, target)}><span className={`shortcut-icon ${tone}`}><Icon size={25} strokeWidth={1.6} /></span><strong>{label}</strong><small>{detail}</small></button>)}</nav>
    <section className="home-car-section" id="owner-tools" tabIndex={-1} aria-labelledby="home-car-heading">
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
    <div className="owner-bottom-links"><button onClick={() => navigate('drive', 'checklist')}><ShieldCheck size={22} /><span><strong>출발 전, 한 번 더 확인</strong><small>타이어부터 차량 주변까지 오늘의 체크리스트</small></span><ArrowRight size={17} /></button><button onClick={() => navigate('guide')}><CarFront size={22} /><span><strong>처음 오셨나요?</strong><small>내 차 연결부터 서비스 이용까지</small></span><ArrowRight size={17} /></button></div>
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
  const [draft, setDraft] = useState(() => ({ category: 'MAINTENANCE', title: '', note: '', entryDate: dateKey(), amount: '', odometer: '', status: 'DONE' }));
  const active = journal.entries.filter((item) => item.status !== 'ARCHIVED');
  const monthly = active.filter((item) => item.status === 'DONE' && item.entryDate.startsWith(month));
  const total = monthly.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const upcoming = active.filter((item) => item.status === 'PLANNED');
  const records = journal.entries.filter((item) => (filter === 'archived' ? item.status === 'ARCHIVED' : item.status !== 'ARCHIVED') && (filter !== 'planned' || item.status === 'PLANNED') && (filter !== 'done' || item.status === 'DONE') && `${item.title} ${item.note} ${categories[item.category]}`.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => { setFormOpen(false); setError(''); }, [vehicle?.databaseId]);

  const save = async (event) => {
    event.preventDefault();
    if (!vehicle || saving) return;
    setSaving(true); setError('');
    try {
      await createJournalEntry(vehicle.databaseId, { ...draft, amount: draft.amount === '' ? null : Number(draft.amount), odometer: draft.odometer === '' ? null : Number(draft.odometer) });
      await journal.refresh(); setFormOpen(false); setDraft({ category: 'MAINTENANCE', title: '', note: '', entryDate: dateKey(), amount: '', odometer: '', status: 'DONE' }); notify('내 차량의 관리 기록에 저장했습니다.');
    } catch (failure) { setError(failure.message); } finally { setSaving(false); }
  };
  const change = async (item, status) => {
    setSaving(true); setError('');
    try { await changeJournalStatus(vehicle.databaseId, item.id, status); await journal.refresh(); notify(status === 'ARCHIVED' ? '보관함으로 이동했습니다. 언제든 다시 꺼낼 수 있어요.' : '기록 상태를 변경했습니다.'); } catch (failure) { setError(failure.message); } finally { setSaving(false); }
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
      <section className="journal-summary"><article><span>월별 지출 <input type="month" aria-label="지출 조회 월" value={month} onChange={(event) => setMonth(event.target.value)} /></span><strong>{vehicle && !journal.loading && !journal.error ? money(total) : '—'}</strong><small>직접 입력한 완료 기록 기준</small></article><article><span>예정된 일정</span><strong>{vehicle && !journal.loading && !journal.error ? upcoming.length : '—'}<small>건</small></strong><small>정비·검사·보험 갱신</small></article><article><span>쌓인 관리 기록</span><strong>{vehicle && !journal.loading && !journal.error ? active.length : '—'}<small>건</small></strong><small>내 차량에 저장한 기록</small></article></section>
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
