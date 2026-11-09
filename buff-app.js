/* BLOSSOM BUFF v8 — Supabase member-specific settings + countdown deadlines. */
(() => {
  'use strict';
  const API = 'https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/blossom-buffs';
  const SESSION_KEY = 'blossom_test_auth_v1';
  const ICON_FILES = {
    booster: 'Booster.PNG', integration: 'Integration.PNG',
    blessing: 'Blessing.PNG',
  };
  const SOUND_FILES = {
    digivice: 'digivice.wav',
    digivice_alert: 'digivice-alert.mp3',
    voice: 'alert.mp3',
  };
  const SOUND_LABELS = {
    digivice: '① 디지바이스 효과음', digivice_alert: '② 디지바이스 알림', voice: '③ 음성 알림',
  };
  const ICON_LABELS = { booster: '부스터', integration: '통합', blessing: '축복' };
  const $ = id => document.getElementById(id);
  const state = { templates: [], entries: [], canManage: false, role: 'member', busy: false, started: false,
    personalEdit: null, templateEdit: null, armed: new Map(), audioPlayers: [] };

  function session() {
    try {
      const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (typeof value?.access_token === 'string' && Number(value.expires_at) > Date.now() / 1000 + 5) return value;
    } catch (_) {}
    return null;
  }
  function message(text, error = false) {
    $('buffMessage').textContent = text;
    $('buffMessage').classList.toggle('error', !!error);
  }
  function el(tag, klass, value) {
    const node = document.createElement(tag);
    if (klass) node.className = klass;
    if (value !== undefined) node.textContent = String(value);
    return node;
  }
  function btn(text, css, callback) {
    const b = el('button', css, text);
    b.type = 'button';
    if (callback) b.addEventListener('click', callback);
    return b;
  }
  function label(content, input) {
    const l = el('label', 'field');
    l.append(document.createTextNode(content), input);
    return l;
  }
  function inputText(value) {
    const t = el('input'); t.type = 'text'; t.maxLength = 60; t.value = value; t.required = true; return t;
  }
  function inputNumber(value) {
    const t = el('input'); t.type = 'number'; t.min = '1'; t.max = '10080'; t.step = '1'; t.value = String(value); return t;
  }
  function select(options, selected) {
    const s = el('select');
    Object.entries(options).forEach(([value, display]) => {
      const o = el('option', '', display); o.value = value; s.append(o);
    });
    s.value = selected;
    return s;
  }
  function volumeInput(value) {
    const wrap = el('div', 'vol-row');
    const r = el('input'); r.type = 'range'; r.min = '0'; r.max = '100'; r.step = '1'; r.value = String(value);
    const output = el('output', '', value + '%');
    r.addEventListener('input', () => { output.textContent = r.value + '%'; });
    wrap.append(r, output);
    return { wrap, range: r };
  }
  function durationLabel(minutes) {
    const m = Number(minutes) || 0;
    const hours = Math.floor(m / 60);
    return hours ? `${hours}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`;
  }
  function timeFmt(seconds) {
    const sec = Math.max(0, Math.ceil(seconds));
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` :
      `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  function validateFields(o) {
    if (!o.name || o.name.length > 60) throw Error('버프 이름은 1~60자로 입력해 주세요.');
    if (!Number.isInteger(o.duration_minutes) || o.duration_minutes < 1 || o.duration_minutes > 10080)
      throw Error('버프 시간은 1~10080분 사이로 설정해 주세요.');
    if (!(o.icon_key in ICON_FILES) || !(o.sound_key in SOUND_FILES) ||
        !Number.isInteger(o.volume) || o.volume < 0 || o.volume > 100) throw Error('아이콘·알림음·볼륨을 확인해 주세요.');
    return o;
  }
  function fieldsFrom(name, icon, minutes, sound, volume) {
    return validateFields({ name: name.value.trim(), icon_key: icon.value,
      duration_minutes: Number(minutes.value), sound_key: sound.value, volume: Number(volume.value) });
  }
  async function api(payload) {
    const s = session();
    if (!s) throw Error('로그인이 만료됐습니다. 다시 로그인해 주세요.');
    let response;
    try {
      response = await fetch(API, { method: 'POST', headers: {
        'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token,
      }, body: JSON.stringify(payload), cache: 'no-store' });
    } catch (_) { throw Error('Supabase 서버 연결에 실패했습니다. 인터넷 상태를 확인해 주세요.'); }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw Error(data?.message || '서버 요청에 실패했습니다.');
    return data;
  }
  async function fetchData() {
    const data = await api({ action: 'list' });
    state.templates = Array.isArray(data.templates) ? data.templates : [];
    state.entries = Array.isArray(data.entries) ? data.entries : [];
    state.canManage = data.can_manage === true;
    state.role = data.role || 'member';
    render();
  }
  async function transact(payload, success, onComplete) {
    if (state.busy) return false;
    state.busy = true;
    message('서버에 저장하는 중...');
    document.querySelectorAll('main button,main input,main select').forEach(x => { x.disabled = true; });
    try {
      await api(payload);
      await fetchData();
      if (onComplete) onComplete();
      message(success || '저장했습니다.');
      return true;
    } catch (e) {
      message(e.message || '저장에 실패했습니다.', true);
      return false;
    } finally {
      state.busy = false;
      document.querySelectorAll('main button,main input,main select').forEach(x => { x.disabled = false; });
    }
  }
  async function startTimer(item, getFields) {
    if (state.busy) return;
    let fields;
    try { fields = getFields(); } catch (e) { return message(e.message, true); }
    state.busy = true;
    message('설정을 저장하고 타이머를 시작하는 중...');
    try {
      // Save what's currently visible so the new timer always uses the chosen duration.
      if (item.kind === 'template') await api({ action: 'override_save', template_id: item.id, ...fields });
      else await api({ action: 'personal_save', personal_id: item.id, ...fields });
      const data = await api({ action: 'timer_start', kind: item.kind, buff_id: item.id });
      await fetchData();
      if (data.ends_at) state.armed.set(item.kind + ':' + item.id, data.ends_at);
      message('버프 타이머를 시작했습니다. 종료될 때 선택한 알림음이 재생됩니다.');
    } catch (e) { message(e.message, true); }
    finally { state.busy = false; }
  }
  function playSound(sound, vol) {
    if (!SOUND_FILES[sound] || !Number.isFinite(vol) || vol <= 0) return;
    const audio = new Audio(SOUND_FILES[sound]);
    audio.volume = Math.min(1, Math.max(0, vol / 100));
    state.audioPlayers.push(audio);
    audio.addEventListener('ended', () => { state.audioPlayers = state.audioPlayers.filter(a => a !== audio); }, { once: true });
    audio.play().catch(() => {
      state.audioPlayers = state.audioPlayers.filter(a => a !== audio);
      message('브라우저가 소리 재생을 제한했어요. 알림음 미리듣기 버튼을 눌러 활성화해 주세요.', true);
    });
  }
  function armAudioPermission(sound) {
    // Explicit user gesture: a muted preview allows browsers to establish media interaction.
    const a = new Audio(SOUND_FILES[sound] || SOUND_FILES.digivice);
    a.volume = 0;
    const p = a.play();
    if (p && p.then) p.then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
  }
  function previewFrom(sound, volume) {
    if (state.busy) return;
    playSound(sound, Number(volume));
    if (Number(volume) === 0) message('현재 볼륨은 0%여서 무음입니다.');
  }
  function effective() {
    const mine = new Map(state.entries.filter(e => e.template_id).map(e => [e.template_id, e]));
    const base = state.templates.filter(t => t.is_active).map(t => {
      const o = mine.get(t.id);
      return {
        kind: 'template', id: t.id, name: o?.name_override ?? t.name,
        icon_key: o?.icon_override ?? t.icon_key,
        duration_minutes: o?.minutes_override ?? t.duration_minutes,
        sound_key: o?.sound_override ?? t.sound_key,
        volume: o?.volume_override ?? t.volume,
        ends_at: o?.ends_at ?? null,
        customized: Boolean(o && [o.name_override,o.icon_override,o.minutes_override,o.sound_override,o.volume_override].some(v => v !== null)),
      };
    });
    const personal = state.entries.filter(e => !e.template_id).map(e => ({
      kind: 'personal', id: e.id, name: e.custom_name,
      icon_key: e.custom_icon, duration_minutes: e.custom_minutes, sound_key: e.custom_sound,
      volume: e.custom_volume, ends_at: e.ends_at ?? null,
    }));
    return { base, personal };
  }
  function createCard(item) {
    const card = el('article', 'buff-card');
    card.dataset.buffKey = item.kind + ':' + item.id;
    card.dataset.ends = item.ends_at || '';
    card.dataset.duration = String(item.duration_minutes);
    const head = el('div', 'buff-title');
    const image = el('img', 'buff-icon'); image.src = ICON_FILES[item.icon_key]; image.alt = ICON_LABELS[item.icon_key] || '버프';
    const title = el('div', 'buff-title-text');
    title.append(el('strong', '', item.name));
    title.append(el('small', '', item.kind === 'template' ? (item.customized ? '✦ 길드 기본 · 내 설정 적용됨' : '✦ 길드 기본 · 관리자 기본값') : '✿ 나만의 버프'));
    head.append(image, title); card.append(head);

    const count = el('div', 'count-row');
    count.append(el('div', 'clock', timeFmt(item.duration_minutes * 60)));
    count.append(el('div', 'clock-state', '대기 중'));
    card.append(count);
    const bar = el('div', 'bar'); bar.append(el('span')); card.append(bar);

    const edit = el('div', 'editor-grid');
    const name = inputText(item.name), icon = select(ICON_LABELS, item.icon_key);
    const mins = inputNumber(item.duration_minutes), sound = select(SOUND_LABELS, item.sound_key);
    const volume = volumeInput(item.volume);
    edit.append(label('버프 이름', name), label('아이콘', icon), label('버프 지속 시간 (분)', mins),
      label('종료 알림음 (3종)', sound), label('알림 볼륨 (0~100%)', volume.wrap));
    card.append(edit);
    const actions = el('div', 'actions');
    const fields = () => fieldsFrom(name, icon, mins, sound, volume.range);
    actions.append(btn('▶ 시작 / 재시작', 'btn', () => {
      armAudioPermission(sound.value);
      startTimer(item, fields);
    }));
    actions.append(btn('■ 정지', 'secondary', () => transact({ action: 'timer_stop', kind: item.kind, buff_id: item.id }, '타이머를 정지했습니다.')));
    actions.append(btn('♪ 미리듣기', 'secondary', () => previewFrom(sound.value, volume.range.value)));
    actions.append(btn('설정 저장', 'secondary', () => {
      let payload;
      try {
        const f = fields();
        payload = item.kind === 'template' ? { action: 'override_save', template_id: item.id, ...f } :
          { action: 'personal_save', personal_id: item.id, ...f };
      } catch (e) { return message(e.message, true); }
      return transact(payload, '버프 시간·이름·아이콘·알림음·볼륨을 저장했습니다.');
    }));
    if (item.kind === 'template') {
      actions.append(btn('기본값 복원', 'secondary', () => {
        if (confirm('「' + item.name + '」의 내 개인 설정을 길드 기본값으로 되돌릴까요?'))
          transact({ action: 'override_reset', template_id: item.id }, '길드 기본값으로 복원했습니다.');
      }));
    } else {
      actions.append(btn('내 버프 삭제', 'danger', () => {
        if (confirm('「' + item.name + '」을 삭제할까요? 이 버프 설정은 되돌릴 수 없습니다.'))
          transact({ action: 'personal_delete', personal_id: item.id }, '내 버프를 삭제했습니다.');
      }));
    }
    card.append(actions);
    card.append(el('div', 'note', '설정을 바꾼 뒤 「설정 저장」 또는 「시작 / 재시작」을 누르면 서버에 저장돼요. 실행 중인 타이머는 별도로 정지하기 전까지 유지돼요.'));
    // Keep references to the current sound setting for expiration playback.
    card.getSound = () => ({ sound: sound.value, volume: Number(volume.range.value) });
    return card;
  }
  function renderAdmin() {
    $('adminPanel').hidden = !state.canManage;
    if (!state.canManage) return;
    const list = $('adminList'); list.replaceChildren();
    if (!state.templates.length) list.append(el('div', 'empty', '길드 기본 버프가 아직 없어요. 위에서 먼저 등록해 주세요.'));
    state.templates.forEach(t => {
      const row = el('div', 'admin-row' + (t.is_active ? '' : ' off'));
      const left = el('div', 'admin-name');
      const img = el('img'); img.src = ICON_FILES[t.icon_key]; img.alt = '';
      const info = el('div'); info.append(el('strong', '', t.name), el('small', '', durationLabel(t.duration_minutes) + ' · ' + SOUND_LABELS[t.sound_key] + ' · ' + t.volume + '% · ' + (t.is_active ? '공개 중' : '숨김')));
      left.append(img, info);
      const actions = el('div', 'admin-actions');
      actions.append(btn('기본값 수정', 'secondary', () => {
        state.templateEdit = t.id;
        $('adminName').value = t.name; $('adminIcon').value = t.icon_key;
        $('adminMinutes').value = String(t.duration_minutes); $('adminSound').value = t.sound_key;
        $('adminVolume').value = String(t.volume); $('adminVolumeText').textContent = t.volume + '%';
        $('adminSubmit').textContent = '✓ 기본값 수정 저장'; $('adminCancel').hidden = false;
        $('adminForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }));
      actions.append(btn(t.is_active ? '숨기기' : '공개하기', 'secondary', () =>
        transact({ action: 'template_visible', template_id: t.id, is_active: !t.is_active }, '공개 설정을 변경했습니다.')));
      actions.append(btn('삭제', 'danger', () => {
        if (confirm('「' + t.name + '」 기본 버프를 완전히 삭제할까요? 모든 길드원의 이 버프 개인 설정·타이머도 사라집니다.'))
          transact({ action: 'template_delete', template_id: t.id }, '길드 기본 버프를 삭제했습니다.');
      }));
      row.append(left, actions); list.append(row);
    });
  }
  function render() {
    const { base, personal } = effective();
    $('defaultList').replaceChildren(); $('personalList').replaceChildren();
    $('baseCount').textContent = base.length + '개'; $('myCount').textContent = personal.length + '개';
    const s = session();
    $('memberBadge').textContent = (s?.digimon_nickname || s?.username || '길드원') + ' 님';
    if (!base.length) $('defaultList').append(el('div', 'empty', state.canManage ?
      '기본 버프가 아직 없습니다. 아래 관리자 메뉴에서 길드 기본 버프를 등록하세요.' : '관리자가 설정한 길드 기본 버프가 아직 없습니다.'));
    else base.forEach(t => $('defaultList').append(createCard(t)));
    if (!personal.length) $('personalList').append(el('div', 'empty', '등록한 개인 버프가 없습니다. 아래 「내 버프 추가」를 눌러 만들어 보세요.'));
    else personal.forEach(t => $('personalList').append(createCard(t)));
    for (const item of base.concat(personal)) {
      const key = item.kind + ':' + item.id;
      if (item.ends_at && Date.parse(item.ends_at) > Date.now()) {
        state.armed.set(key, item.ends_at);
      } else state.armed.delete(key);
    }
    renderAdmin(); updateClocks();
  }
  function updateClocks() {
    const now = Date.now();
    document.querySelectorAll('.buff-card').forEach(card => {
      const ends = card.dataset.ends;
      const remaining = ends ? (Date.parse(ends) - now) / 1000 : null;
      const clock = card.querySelector('.clock');
      const label = card.querySelector('.clock-state');
      const bar = card.querySelector('.bar span');
      const baseMinutes = Math.max(1, Number(card.dataset.duration) || 1);
      const key = card.dataset.buffKey;
      if (!ends) {
        clock.textContent = timeFmt(baseMinutes * 60); clock.classList.remove('finished');
        label.textContent = '대기 중'; bar.style.width = '0%'; card.classList.remove('running');
        return;
      }
      if (remaining > 0) {
        clock.textContent = timeFmt(remaining); clock.classList.remove('finished');
        label.textContent = '진행 중 · ' + new Date(ends).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) + ' 종료';
        bar.style.width = Math.max(0, Math.min(100, 100 * (1 - remaining / (baseMinutes * 60)))) + '%';
        card.classList.add('running');
        return;
      }
      clock.textContent = '00:00'; clock.classList.add('finished');
      label.textContent = '종료됨 · 재시작 가능'; bar.style.width = '100%'; card.classList.remove('running');
      // The map is armed only for timers that were still running when last seen.
      // Reopening a page after a finished timer does not replay old alerts.
      if (state.armed.get(key) === ends) {
        state.armed.delete(key);
        const selected = typeof card.getSound === 'function' ? card.getSound() : { sound: 'digivice', volume: 70 };
        playSound(selected.sound, selected.volume);
        message('⏰ 「' + card.querySelector('.buff-title-text strong').textContent + '」 버프 시간이 종료됐습니다.');
      }
    });
  }
  function resetPersonalForm() {
    state.personalEdit = null;
    $('personalForm').reset(); $('myVolumeText').textContent = '70%';
    $('mySubmit').textContent = '＋ 내 버프 추가'; $('personalHeading').textContent = '✚ 내 버프 추가';
    $('myCancel').hidden = true;
  }
  function resetAdminForm() {
    state.templateEdit = null;
    $('adminForm').reset(); $('adminVolumeText').textContent = '70%';
    $('adminSubmit').textContent = '＋ 기본 버프 등록'; $('adminCancel').hidden = true;
  }
  function wireForms() {
    for (const prefix of ['my','admin']) {
      $(prefix + 'Volume').addEventListener('input', () => {
        $(prefix + 'VolumeText').textContent = $(prefix + 'Volume').value + '%';
      });
      $(prefix + 'SoundPreview').addEventListener('click', () => previewFrom(
        $(prefix + 'Sound').value, $(prefix + 'Volume').value));
    }
    $('personalForm').addEventListener('submit', async e => {
      e.preventDefault();
      let payload;
      try { payload = fieldsFrom($('myName'), $('myIcon'), $('myMinutes'), $('mySound'), $('myVolume')); }
      catch (err) { return message(err.message, true); }
      const id = state.personalEdit;
      const ok = await transact({ action: 'personal_save', ...(id ? { personal_id: id } : {}), ...payload },
        id ? '내 버프를 수정했습니다.' : '새 개인 버프를 추가했습니다.');
      if (ok) resetPersonalForm();
    });
    $('myCancel').addEventListener('click', resetPersonalForm);
    $('adminForm').addEventListener('submit', async e => {
      e.preventDefault();
      let payload;
      try { payload = fieldsFrom($('adminName'), $('adminIcon'), $('adminMinutes'), $('adminSound'), $('adminVolume')); }
      catch (err) { return message(err.message, true); }
      const id = state.templateEdit;
      const ok = await transact({ action: 'template_save', ...(id ? { template_id: id } : {}), ...payload },
        id ? '길드 기본값을 수정했습니다.' : '길드 기본 버프를 등록했습니다.');
      if (ok) resetAdminForm();
    });
    $('adminCancel').addEventListener('click', resetAdminForm);
    $('refreshBtn').addEventListener('click', refresh);
  }
  async function refresh() {
    if (state.busy) return;
    state.busy = true;
    message('최신 버프 정보를 불러오는 중...');
    try { await fetchData(); message('서버의 최신 버프 설정을 불러왔습니다.'); }
    catch (e) { message(e.message, true); }
    finally { state.busy = false; }
  }
  function init() {
    if (state.started) return;
    state.started = true;
    wireForms();
    setInterval(updateClocks, 1000);
    refresh();
  }
  window.addEventListener('blossom:authorized', init);
  if (document.documentElement.dataset.blossomAccess === 'approved') init();
})();
