'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Identity = { token: string; role: 'A' | 'B'; coupleId: string; sessionId: string; inviteCode?: string };
type PublicState = {
  sessionId: string; version: number; status: 'waiting_partner' | 'editing' | 'ready';
  shared: null | { startsAt: string; endsAt: string; budgetTwdTotal: number; stops: number };
  members: Array<{ role: 'A' | 'B'; online: boolean; confirmed: boolean }>;
};
type Stop = {
  stop_id: string; venue_id: string; order_no: number; venue_name: string; category: string; district: string;
  arrival_at: string; leave_at: string; travel_minutes: number; travel_mode: string;
  estimated_cost: number; locked: boolean; google_maps_url: string;
  booking_status: 'not_required' | 'recommended' | 'required'; booking_url: string | null;
};
type Itinerary = {
  itinerary_id: string; title: string; stops: Stop[]; total_cost: number; total_duration_minutes: number;
  travel_minutes: number; couple_score: number; public_reason: string; data_mode: 'approved_dataset' | 'synthetic_demo';
  dataset_version: string; route_matrix_version: string; sponsored_content: boolean;
};
type OwnFeedback = {
  feedbackId: string; venueId: string; rating: number | null; visitState: 'saved' | 'visited'; updatedAt: string;
};

const storageKey = 'sideby.formal.v1';
const errorText: Record<string, string> = {
  UNAUTHENTICATED: '這個匿名工作階段已失效，請重新建立或加入房間。',
  INVITE_UNAVAILABLE: '邀請碼不存在或已過期。', ROOM_FULL: '這個房間已經有兩個人。',
  VERSION_CONFLICT: '另一位剛更新了內容，畫面已同步，請再試一次。',
  PARTNER_REQUIRED: '需要另一位加入後才能確認。', SHARED_REQUIRED: '請先設定共同條件。',
  TERMS_REQUIRED: '請先閱讀並儲存同意設定。', PERSONALIZATION_REQUIRED: '要長期記住偏好，請先開啟個人化。',
  PRIVATE_INPUT_UNRESOLVED: '其中一人的需求還需要改寫成更明確的句子。',
  SESSION_NOT_READY: '兩位都要輸入需求並確認最新版本。',
  RECOMMENDATION_DATA_UNAVAILABLE: '目前沒有可用且版本一致的推薦資料。',
  RECOMMENDATION_DATA_INVALID: '推薦資料未通過安全檢查，沒有顯示替代內容。',
  NO_FEASIBLE_ITINERARIES: '目前條件找不到三套可執行行程，請放寬時間或預算。',
  NO_FEASIBLE_REPLAN: '保留已鎖定地點後，沒有安全可行的替代行程。',
  REACTION_REQUIRED: '請先標記想更換的地點。', LOCKED_STOP_CONFLICT: '雙方已喜歡的地點已鎖定，不能更換。',
  SESSION_FINALIZED: '這次約會已由雙方定案。', INVALID_INPUT: '輸入格式不完整，請檢查後再試。',
  SERVICE_UNAVAILABLE: '服務暫時無法使用，沒有產生假結果。',
  NETWORK_UNAVAILABLE: '目前連不上 Sideby。既有結果仍可閱讀，請稍後再試。',
  INVALID_RESPONSE: '服務回應格式不完整，沒有顯示假成功。',
};

class ApiFailure extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}

function time(value: string) {
  return new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

export default function Home() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [state, setState] = useState<PublicState | null>(null);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [ownFeedback, setOwnFeedback] = useState<OwnFeedback[]>([]);
  const [finalizedId, setFinalizedId] = useState<string | null>(null);
  const [runtimeMode, setRuntimeMode] = useState<'checking' | 'standard' | 'synthetic_demo' | 'unavailable'>('checking');
  const [invite, setInvite] = useState('');
  const [privateText, setPrivateText] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [personalization, setPersonalization] = useState(false);
  const [tripDate, setTripDate] = useState('');
  const [budget, setBudget] = useState('');
  const [meetingLabel, setMeetingLabel] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [learnedStops, setLearnedStops] = useState<Record<string, string>>({});

  useEffect(() => {
    const stored = sessionStorage.getItem(storageKey);
    if (stored) {
      try { setIdentity(JSON.parse(stored)); }
      catch { sessionStorage.removeItem(storageKey); }
    }
    fetch('/api/runtime').then(async response => {
      if (!response.ok) throw new Error('runtime unavailable');
      const value = await response.json();
      if (value.mode !== 'standard' && value.mode !== 'synthetic_demo') throw new Error('invalid runtime mode');
      setRuntimeMode(value.mode);
      if (value.mode === 'synthetic_demo') {
        setTripDate('2026-10-10'); setBudget('1600'); setMeetingLabel('合成集合點');
        setLatitude('25.04'); setLongitude('121.52');
      }
    }).catch(() => setRuntimeMode('unavailable'));
  }, []);

  const api = useCallback(async (method: string, path: string, data?: unknown, overrideToken?: string) => {
    const token = overrideToken ?? identity?.token;
    let response: Response;
    try {
      response = await fetch(path, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
    } catch { throw new ApiFailure(errorText.NETWORK_UNAVAILABLE, 'NETWORK_UNAVAILABLE'); }
    let payload: any = null;
    try { payload = response.status === 204 ? null : await response.json(); }
    catch { throw new ApiFailure(errorText.INVALID_RESPONSE, 'INVALID_RESPONSE'); }
    if (!response.ok) {
      const code = payload?.error?.code ?? 'SERVICE_UNAVAILABLE';
      throw new ApiFailure(errorText[code] ?? `操作失敗（${code}）`, code);
    }
    return payload;
  }, [identity?.token]);

  const refresh = useCallback(async () => {
    if (!identity) return;
    const [nextState, nextItineraries, nextFeedback] = await Promise.all([
      api('GET', `/api/sessions/${identity.sessionId}`),
      api('GET', `/api/sessions/${identity.sessionId}/itineraries`),
      api('GET', '/api/me/venue-feedback'),
    ]);
    setState(nextState);
    setItineraries(nextItineraries.itineraries);
    setFinalizedId(nextItineraries.finalizedItineraryId);
    setOwnFeedback(nextFeedback.items);
  }, [api, identity]);

  useEffect(() => {
    if (!identity) return;
    void api('GET', '/api/me/consents').then(consent => {
      setTermsAccepted(consent.termsAccepted);
      setPersonalization(consent.personalizationEnabled);
    }).catch(reason => setError(reason instanceof Error ? reason.message : '同意設定目前無法讀取。'));
    void refresh().catch(reason => setError(reason.message));
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh().catch(reason => {
        if (reason instanceof ApiFailure && ['UNAUTHENTICATED', 'SERVICE_UNAVAILABLE', 'NETWORK_UNAVAILABLE'].includes(reason.code)) {
          setError(reason.message);
        }
      });
    }, 1200);
    return () => window.clearInterval(timer);
  }, [api, identity, refresh]);

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label); setError(''); setNotice('');
    try { await action(); }
    catch (reason) {
      if (reason instanceof ApiFailure && reason.code === 'VERSION_CONFLICT') await refresh().catch(() => {});
      setError(reason instanceof Error ? reason.message : '操作失敗。');
    }
    finally { setBusy(''); }
  };

  const keepIdentity = (next: Identity) => {
    sessionStorage.setItem(storageKey, JSON.stringify(next));
    setIdentity(next);
  };

  const createRoom = () => run('建立房間', async () => {
    const auth = await api('POST', '/api/auth/anonymous', {}, '');
    const room = await api('POST', '/api/couples', {}, auth.token);
    const session = await api('POST', '/api/sessions', { coupleId: room.coupleId }, auth.token);
    keepIdentity({ token: auth.token, role: 'A', coupleId: room.coupleId, sessionId: session.sessionId, inviteCode: room.inviteCode });
    setNotice('房間已建立，把邀請碼交給另一位。');
  });

  const joinRoom = () => run('加入房間', async () => {
    if (!invite.trim()) throw new Error('請先貼上邀請碼。');
    const auth = await api('POST', '/api/auth/anonymous', {}, '');
    const room = await api('POST', '/api/couples/join', { inviteCode: invite.trim() }, auth.token);
    const session = await api('POST', '/api/sessions', { coupleId: room.coupleId }, auth.token);
    keepIdentity({ token: auth.token, role: 'B', coupleId: room.coupleId, sessionId: session.sessionId });
    setNotice('已加入，現在可以各自輸入私密需求。');
  });

  const shared = useMemo(() => ({
    mode: 'future', startsAt: `${tripDate}T10:00:00+08:00`, endsAt: `${tripDate}T20:00:00+08:00`,
    meetingPoint: { label: meetingLabel, latitude: Number(latitude), longitude: Number(longitude),
      matrixKey: runtimeMode === 'synthetic_demo' ? 'meeting_test' : 'meeting_user' },
    budgetTwdTotal: Number(budget), transport: ['transit'], stops: 2, outdoorAllowed: false, bookingAllowed: false,
    maxLegTravelMinutes: 30, maxTotalTravelMinutes: 60,
    dietaryRequirements: ['vegan'], allergensToAvoid: ['peanut'], accessibilityRequirements: ['wheelchair'],
  }), [budget, latitude, longitude, meetingLabel, runtimeMode, tripDate]);

  const reset = () => { sessionStorage.removeItem(storageKey); location.reload(); };
  const canUseSession = Boolean(identity && state);
  const sharedReady = Boolean(tripDate && meetingLabel.trim() && Number(budget) >= 0
    && latitude !== '' && longitude !== '' && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)));
  const me = state?.members.find(member => member.role === identity?.role);
  const venueNames = new Map(itineraries.flatMap(item => item.stops.map(stop => [stop.venue_id, stop.venue_name])));

  const saveVenue = (stop: Stop, visitState: 'saved' | 'visited') => run(visitState === 'saved' ? '加入私人清單' : '記錄到訪', async () => {
    await api('PUT', `/api/me/venues/${encodeURIComponent(stop.venue_id)}/feedback`, {
      noteText: null, userTags: [], rating: visitState === 'visited' ? 4 : null, visitState,
    });
    await refresh(); setNotice(visitState === 'saved' ? '已加入只有你看得到的清單。' : '已記錄到訪；不會自動公開。');
  });

  const noteExternal = (service: string) => setNotice(`已要求在新分頁開啟 ${service}；若外部服務或網路不可用，Sideby 行程仍會留在本頁。`);

  return <main>
    <header className="hero">
      <div className="brand">Sideby <span>一起選，不必猜</span></div>
      <h1>兩個人的約會，<br />讓彼此都舒服。</h1>
      <p>共同條件一起看；真正私密的偏好，各自保留。Sideby 只公開安全、可執行的推薦理由。</p>
      {runtimeMode === 'synthetic_demo' && <div className="demo-banner" role="status">
        合成展示環境｜場地、交通與日期皆為測試資料，不是現實世界推薦
      </div>}
      {runtimeMode === 'standard' && <div className="runtime-banner" role="status">
        正式模式｜未載入核准場地時，Sideby 會誠實顯示不可用
      </div>}
      {runtimeMode === 'checking' && <div className="runtime-banner" role="status">正在確認資料模式…</div>}
      {runtimeMode === 'unavailable' && <div className="runtime-banner unavailable" role="alert">
        目前無法確認資料模式；不會載入展示資料或假推薦。
      </div>}
    </header>

    {(error || notice) && <div className={error ? 'message error' : 'message success'} role={error ? 'alert' : 'status'}>
      {error || notice}
    </div>}

    <section className="panel room" aria-labelledby="room-title">
      <div className="step">01</div><div>
        <h2 id="room-title">先讓兩個人進到同一個房間</h2>
        {!identity ? <div className="room-grid">
          <button className="primary" onClick={createRoom} disabled={Boolean(busy)}>我是 A，建立房間</button>
          <div className="join-row"><input value={invite} onChange={event => setInvite(event.target.value)} placeholder="貼上 A 的邀請碼" aria-label="邀請碼" />
            <button onClick={joinRoom} disabled={Boolean(busy)}>我是 B，加入</button></div>
        </div> : <div className="identity-row">
          <div><span className="eyebrow">你的身分</span><strong>使用者 {identity.role}</strong></div>
          {identity.inviteCode && <div className="invite"><span className="eyebrow">邀請碼</span><code>{identity.inviteCode}</code>
            <button className="quiet" onClick={() => void navigator.clipboard.writeText(identity.inviteCode!)}>複製</button></div>}
          <button className="quiet danger-text" onClick={reset}>離開這次展示</button>
        </div>}
        {state && <div className="people" aria-label="成員狀態">{(['A', 'B'] as const).map(role => {
          const member = state.members.find(item => item.role === role);
          return <span key={role} className={member ? 'person active' : 'person'}>{role} {member ? (member.online ? '在線' : '已加入') : '等待加入'} {member?.confirmed ? '· 已確認' : ''}</span>;
        })}</div>}
      </div>
    </section>

    <section className="panel" aria-labelledby="shared-title">
      <div className="step">02</div><div>
        <h2 id="shared-title">設定兩人都看得到的條件</h2>
        <p className="muted">共同畫面只保存兩人都能看見的條件。合成展示模式才會帶入明確標示的測試值。</p>
        <div className="fields"><label>日期<input type="date" value={tripDate} onChange={event => setTripDate(event.target.value)} /></label>
          <label>兩人總預算<input type="number" min="0" max="100000" value={budget} onChange={event => setBudget(event.target.value)} /></label>
          <label>集合點名稱<input value={meetingLabel} onChange={event => setMeetingLabel(event.target.value)} placeholder="例如：捷運中山站" /></label>
          <label>緯度<input type="number" step="any" value={latitude} onChange={event => setLatitude(event.target.value)} placeholder="25.052" /></label>
          <label>經度<input type="number" step="any" value={longitude} onChange={event => setLongitude(event.target.value)} placeholder="121.520" /></label></div>
        <button className="primary" disabled={!canUseSession || !sharedReady || Boolean(busy)} onClick={() => run('儲存共同條件', async () => {
          await api('PUT', `/api/sessions/${identity!.sessionId}/shared`, { version: state!.version, shared });
          await refresh(); setNotice('共同條件已同步，兩人的舊確認會自動取消。');
        })}>儲存並同步共同條件</button>
      </div>
    </section>

    <section className="panel private-panel" aria-labelledby="private-title">
      <div className="step">03</div><div>
        <h2 id="private-title">各自留下私密需求</h2>
        <p className="privacy-note">另一位看不到原句、標籤或解析內容；公開結果只保留通過隱私檢查的共同理由。</p>
        <label className="check"><input type="checkbox" checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} />我同意本版服務條款</label>
        <label className="check"><input type="checkbox" checked={personalization} onChange={event => setPersonalization(event.target.checked)} />記住我的偏好，供未來約會使用</label>
        <button className="secondary" disabled={!identity || !termsAccepted || Boolean(busy)} onClick={() => run('儲存同意設定', async () => {
          await api('PUT', '/api/me/consents', { termsVersion: '2026-09-05-v1', acceptTerms: true,
            personalizationEnabled: personalization, modelImprovementOptIn: false });
          setNotice(personalization ? '已開啟個人化；沒有同意用於模型改進。' : '只在本次使用；沒有同意用於模型改進。');
        })}>儲存同意設定</button>
        <label className="textarea-label">只有你看得到的需求
          <textarea value={privateText} onChange={event => setPrivateText(event.target.value)} placeholder={identity?.role === 'B' ? '例如：想安靜聊天。' : '例如：希望明亮。'} />
        </label>
        <button className="primary" disabled={!canUseSession || !termsAccepted || !privateText.trim() || Boolean(busy)} onClick={() => run('儲存私密需求', async () => {
          const result = await api('POST', `/api/sessions/${identity!.sessionId}/private-inputs`, {
            rawText: privateText.trim(), tags: [], visibility: personalization ? 'private_remembered' : 'private_session',
          });
          if (result.parse?.status !== 'parsed') throw new Error('這句需求還不夠明確，請換一種說法。');
          setPrivateText(''); await refresh(); setNotice('私密需求已解析；原句不會出現在共享畫面。');
        })}>安全儲存我的需求</button>
      </div>
    </section>

    <section className="panel" aria-labelledby="ready-title">
      <div className="step">04</div><div>
        <h2 id="ready-title">確認最新版，再產生三套行程</h2>
        <div className="ready-line"><span>共同版本 v{state?.version ?? '—'}</span><span>{me?.confirmed ? '你已確認' : '等待你確認'}</span><span>{state?.status === 'ready' ? '兩人都好了' : '尚未齊全'}</span></div>
        <div className="actions"><button disabled={!canUseSession || !state?.shared || Boolean(busy)} onClick={() => run('確認條件', async () => {
          await api('POST', `/api/sessions/${identity!.sessionId}/confirm`, { version: state!.version }); await refresh();
          setNotice('你已確認最新版。');
        })}>確認最新版</button>
          <button className="primary" disabled={!canUseSession || state?.status !== 'ready' || Boolean(busy)} onClick={() => run('產生三套行程', async () => {
            const result = await api('POST', `/api/sessions/${identity!.sessionId}/generate`, { version: state!.version });
            setItineraries(result.itineraries); setNotice('已產生三套可執行行程。');
          })}>產生三套行程</button></div>
      </div>
    </section>

    <section className="results" aria-labelledby="results-title">
      <div className="results-heading"><div><span className="eyebrow">共同決策</span><h2 id="results-title">三套行程</h2></div>
        {itineraries[0]?.data_mode === 'synthetic_demo' && <span className="data-chip">合成資料</span>}</div>
      {!identity && <div className="empty">建立或加入房間後，這裡會顯示同步狀態。</div>}
      {identity && !itineraries.length && <div className="empty">尚無行程。兩人確認後才會產生，不會用假卡片填滿畫面。</div>}
      <div className="itinerary-grid">{itineraries.map((itinerary, index) => <article className={finalizedId === itinerary.itinerary_id ? 'itinerary finalized' : 'itinerary'} key={itinerary.itinerary_id}>
        <div className="itinerary-top"><span className="option">方案 {index + 1}</span><div className="badges">
          {itinerary.sponsored_content && <span className="sponsor-badge">贊助內容</span>}
          {finalizedId === itinerary.itinerary_id && <span className="final-badge">雙方已定案</span>}
        </div></div>
        <h3>{itinerary.title}</h3><p>{itinerary.public_reason}</p>
        <div className="metrics"><strong>約 NT$ {itinerary.total_cost}</strong><span>{itinerary.total_duration_minutes} 分鐘</span><span>移動 {itinerary.travel_minutes} 分</span></div>
        <ol>{itinerary.stops.map(stop => <li key={stop.stop_id}>
          <div className="route-dot">{stop.order_no}</div><div className="stop-body">
            <div className="stop-title"><strong>{stop.venue_name}</strong>{stop.locked && <span>已鎖定</span>}</div>
            <p>{time(stop.arrival_at)}–{time(stop.leave_at)} · {stop.district} · 移動 {stop.travel_minutes} 分</p>
            <div className="stop-actions"><a href={stop.google_maps_url} target="_blank" rel="noopener noreferrer" onClick={() => noteExternal('Google Maps')}>在 Google Maps 查看</a>
              {stop.booking_url && <a href={stop.booking_url} target="_blank" rel="noopener noreferrer" onClick={() => noteExternal('外部訂位／購票頁')}>前往外部訂位／購票</a>}
              {!finalizedId && <><button className="quiet" onClick={() => run('喜歡地點', async () => {
                await api('POST', `/api/itineraries/${itinerary.itinerary_id}/reactions`, { version: state!.version, stopId: stop.stop_id, reaction: 'like' });
                await refresh(); setNotice('已記下喜歡；兩人都喜歡就會鎖定。');
              })}>喜歡</button><button className="quiet" disabled={stop.locked} onClick={() => run('標記更換', async () => {
                await api('POST', `/api/itineraries/${itinerary.itinerary_id}/reactions`, { version: state!.version, stopId: stop.stop_id, reaction: 'replace' });
                setNotice('已標記；按下局部重排才會更換。');
              })}>換這站</button></>}
              {finalizedId === itinerary.itinerary_id && <button className="quiet" disabled={Boolean(learnedStops[stop.stop_id])} onClick={() => run('記錄太暗', async () => {
                const result = await api('POST', `/api/itineraries/${itinerary.itinerary_id}/preference-feedback`, { version: state!.version, stopId: stop.stop_id, signal: 'too_dark' });
                setLearnedStops(value => ({ ...value, [stop.stop_id]: result.longTermPreferenceVersion
                  ? `已套用本次並更新長期偏好 v${result.longTermPreferenceVersion}` : '只套用於本次偏好' }));
              })}>{learnedStops[stop.stop_id] ?? '這間太暗'}</button>}
              <button className="quiet" disabled={!termsAccepted || Boolean(busy)} onClick={() => saveVenue(stop, 'saved')}>加入我的清單</button>
              <button className="quiet" disabled={!termsAccepted || Boolean(busy)} onClick={() => saveVenue(stop, 'visited')}>記錄去過</button>
            </div>
            {stop.booking_url && <p className="external-disclaimer">訂位／購票由外部商家處理；Sideby 不保證座位，也不代付款。</p>}
          </div></li>)}</ol>
        {!finalizedId && <div className="card-actions"><button onClick={() => run('局部重排', async () => {
          const result = await api('POST', `/api/itineraries/${itinerary.itinerary_id}/replan`, { version: state!.version });
          setItineraries(items => items.map(item => item.itinerary_id === itinerary.itinerary_id ? result.itinerary : item));
          setNotice('只重排未鎖定部分；已鎖定站點保持不變。');
        })}>依回饋局部重排</button><button className="primary" onClick={() => run('選定行程', async () => {
          const result = await api('POST', `/api/sessions/${identity!.sessionId}/finalize`, { version: state!.version, itineraryId: itinerary.itinerary_id });
          if (result.status === 'finalized') setFinalizedId(itinerary.itinerary_id);
          setNotice(result.status === 'pending_partner' ? '已選這套，等待另一位選同一套。'
            : result.status === 'choice_conflict' ? '兩人選了不同方案，請再一起決定。' : '兩人選擇一致，行程已定案。');
        })}>選這套</button></div>}
        <p className="provenance">資料版本 {itinerary.dataset_version} · 交通矩陣 {itinerary.route_matrix_version}</p>
      </article>)}</div>
      <p className="external-note">外部地圖、訂位或購票頁可能因網路或服務狀態不可用；這不會移除已產生的 Sideby 行程。</p>
    </section>

    <section className="panel own-list" aria-labelledby="own-list-title">
      <div className="step">05</div><div>
        <span className="eyebrow">僅本人可見</span><h2 id="own-list-title">我的私人清單與回饋</h2>
        <p className="privacy-note">這裡不會出現在另一位的共同畫面，也不會自動發布成公開評論。</p>
        {!identity && <div className="empty">建立或加入房間後，才能讀取你的私人清單。</div>}
        {identity && !ownFeedback.length && <div className="empty">尚未收藏或記錄到訪；不會用展示資料填滿清單。</div>}
        <ul className="feedback-list">{ownFeedback.map(item => <li key={item.feedbackId}>
          <div><strong>{venueNames.get(item.venueId) ?? item.venueId}</strong><span>{item.visitState === 'visited' ? `去過${item.rating ? ` · ${item.rating} 分` : ''}` : '想去'}</span></div>
          <button className="quiet danger-text" disabled={Boolean(busy)} onClick={() => run('移除私人紀錄', async () => {
            await api('DELETE', `/api/me/venue-feedback/${item.feedbackId}`); await refresh(); setNotice('已從你的私人清單移除。');
          })}>移除</button>
        </li>)}</ul>
      </div>
    </section>

    <footer>Sideby 不把私密原句放進共同結果，也不把合成資料說成真實推薦；Google Maps 僅為即時外部跳轉，不保存頁面內容。</footer>
    {busy && <div className="busy" role="status" aria-live="polite"><span />{busy}中…</div>}
  </main>;
}
