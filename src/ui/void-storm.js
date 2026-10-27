const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
const displayTime = value => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
const inputTime = value => new Date(new Date(value).getTime() + 8 * 3600000).toISOString().slice(0, 19);
const percent = value => value === null ? '暂无可核验样本' : `${(value * 100).toFixed(1)}%`;

export function renderStormForecast(target, result) {
  target.replaceChildren();
  const overview = el('section', 'card storm-overview');
  const origin = { network: '官方实时快照', import: '本地导入快照', sample: '内置示例 · 非实时', history: '历史演示 · 非实时' }[result.snapshotKind] ?? result.snapshotKind;
  overview.append(el('h3', '', `${origin} · 条件外推`), el('p', 'muted', `锚点采集于 ${displayTime(result.observedAt)} · 预测参考 ${displayTime(result.issuedAt)}`));
  if (result.refreshError) overview.append(el('p', 'hint error', `刷新失败，沿用已有快照：${result.refreshError}`));
  for (const warning of result.warnings) overview.append(el('p', 'storm-note', warning));
  if (result.lanes.length) overview.append(el('p', '', result.lanes.map(lane => `每小时 :${String(lane.phaseMinute).padStart(2, '0')} 组（锚点观测 ${lane.observedCount} 条）`).join('；')));
  target.append(overview);

  const backtest = result.backtest, accuracy = el('section', 'card storm-accuracy');
  accuracy.append(el('h3', '', '历史回测 · 已观测未来波次时间命中率'));
  const metrics = el('div', 'storm-metrics');
  for (const [value, label] of [[percent(backtest.rate), `${backtest.hits} / ${backtest.total} 个可核验波次 · ±${backtest.toleranceSeconds} 秒`], [String(backtest.sampleCount), '本服来源快照'], [String(backtest.observedWaves), `全部观测波次 · 其中 ${backtest.notEvaluableWaves} 个无法回测`]]) {
    const metric = el('div'); metric.append(el('strong', '', value), el('span', '', label)); metrics.append(metric);
  }
  accuracy.append(metrics);
  const bands = el('div', 'storm-bands');
  for (const band of backtest.bands) {
    const row = el('div'); row.append(el('span', '', `提前 ${band.fromHours}–${band.toHours} 小时`), el('strong', '', percent(band.rate)), el('small', '', `${band.hits} / ${band.total}`)); bands.append(row);
  }
  accuracy.append(bands);
  for (const note of backtest.limitations) accuracy.append(el('p', 'storm-note', note));
  if (backtest.lastObservedAt) accuracy.append(el('p', 'muted', `回测证据：${displayTime(backtest.firstObservedAt)} 至 ${displayTime(backtest.lastObservedAt)}。`));
  const details = el('details', 'storm-evaluations'); details.append(el('summary', '', '查看逐波次回测证据'));
  const evidenceTable = el('table'), evidenceHead = el('tr');
  for (const label of ['历史回放参考时刻', '实际开始', '提前量', '结果／最大误差']) evidenceHead.append(el('th', '', label));
  evidenceTable.append(evidenceHead);
  for (const evaluation of backtest.evaluations) {
    const row = el('tr');
    for (const text of [displayTime(evaluation.issuedAt), displayTime(evaluation.observedStartsAt), `${evaluation.leadHours.toFixed(1)} 小时`, `${evaluation.matched ? '命中' : '未命中'}${evaluation.maxErrorSeconds === null ? ' · 未预测该时间组' : ` · ${evaluation.maxErrorSeconds.toFixed(3)} 秒`}`]) row.append(el('td', '', text));
    evidenceTable.append(row);
  }
  details.append(evidenceTable); accuracy.append(details); target.append(accuracy);

  const content = result.contentBacktest, model = result.contentModel;
  if (content && model) {
    const section = el('section', 'card storm-content');
    section.append(el('h3', '', '节点与任务类型 · 历史频次 MVP'), el('p', 'muted', '按本服、开始分钟组、纪元统计。节点候选附带其任务类型；“类型首选”单独取该组历史最常见类型。'));
    const contentMetrics = el('div', 'storm-metrics');
    for (const [key, label] of [['nodeTop1', '节点首选命中'], ['nodeTop3', '节点前三覆盖'], ['missionTop1', '任务类型首选命中']]) {
      const value = content[key], metric = el('div');
      metric.append(el('strong', '', percent(value.rate)), el('span', '', `${label} · ${value.hits} / ${value.total} 条实测任务`)); contentMetrics.append(metric);
    }
    section.append(contentMetrics, el('p', 'storm-note', `本次训练使用 ${model.sourceRows} 条去重任务；${model.resolvedRows} 条精确关联节点 ID，${model.unmappedRows} 条保留原始名称。占比仅为历史频次，未来仍待验证。`));
    for (const note of content.limitations) section.append(el('p', 'storm-note', note));
    const cards = el('div', 'storm-candidate-grid');
    const tierName = tier => ({ 1: '古纪', 2: '前纪', 3: '中纪', 4: '后纪', 5: '安魂', 6: '全能' })[tier] || `纪元 ${tier}`;
    for (const group of model.groups) {
      const card = el('article', 'storm-candidate-card');
      card.append(el('h4', '', `:${String(group.phaseMinute).padStart(2, '0')} 组 · ${tierName(group.tier)}`), el('p', 'muted', `${group.trainingRows} 条历史任务 / ${group.observedWaves} 个批次 · 数量众数 ${group.expectedCount}`));
      const top = group.missionCandidates[0];
      card.append(el('p', '', top ? `类型首选：${top.name} · 历史占比 ${percent(top.share)}` : '暂无可用类型证据'));
      const list = el('ol');
      for (const candidate of group.nodeCandidates) {
        const item = el('li'); item.append(el('strong', '', candidate.name), el('span', 'muted', ` ${candidate.missionType || '类型待补'} · 历史占比 ${percent(candidate.share)}`)); list.append(item);
      }
      card.append(list); cards.append(card);
    }
    if (!model.groups.length) cards.append(el('p', 'hint', '没有可用的历史内容记录。请加载每日快照数据。'));
    section.append(cards);
    const evidence = el('details', 'storm-evaluations storm-content-evaluations'); evidence.append(el('summary', '', '查看逐任务回测与提前量'));
    const table = el('table'), head = el('tr');
    for (const text of ['实际开始', '提前量', '实际节点／类型', '首选节点／类型', '节点首选／前三／类型']) head.append(el('th', '', text));
    table.append(head);
    for (const test of content.evaluations) {
      const row = el('tr');
      for (const text of [displayTime(test.observedStartsAt), `${test.leadHours.toFixed(1)} 小时`, `${test.actualNode} / ${test.actualMission || '—'}`, `${test.predictedNode || '—'} / ${test.predictedMission || '—'}`, [test.nodeTop1, test.nodeTop3, test.missionTop1].map(hit => hit === null ? '无类型证据' : hit ? '命中' : '未命中').join(' / ')]) row.append(el('td', '', text));
      table.append(row);
    }
    evidence.append(table); section.append(evidence); target.append(section);
  }

  const schedule = el('section', 'card storm-schedule');
  schedule.append(el('h3', '', `未来 24 小时 · ${result.entries.length} 个预测窗口`), el('p', 'muted', `开始时间早于 ${displayTime(result.horizonEndsAt)}；最后一批的结束时间可能超出此范围。`));
  if (!result.entries.length) schedule.append(el('p', 'hint', '没有时间锚点。请刷新或查看历史演示。'));
  else {
    const table = el('table'), head = el('tr');
    for (const label of ['批次', '预计开始', '预计结束', '内容候选', '验证状态']) head.append(el('th', '', label));
    table.append(head);
    result.entries.forEach((entry, index) => {
      const row = el('tr'); row.dataset.stormWindow = String(index);
      const content = entry.contentCandidates?.length ? `采用上方 :${String(entry.phaseMinute).padStart(2, '0')} 组 · ${entry.contentCandidates.length} 个纪元候选` : '暂无内容候选';
      for (const text of [String(index + 1).padStart(2, '0'), displayTime(entry.startsAt), displayTime(entry.endsAt), content, '预测 · 尚未验证']) row.append(el('td', '', text));
      table.append(row);
    });
    schedule.append(table);
  }
  target.append(schedule);
}

export function createVoidStormUI({ api, guarded, notify }) {
  let entered = false, result = null, sequence = 0, historical = false;
  async function query(mode) {
    const current = ++sequence, server = $('storm-server').value;
    result = null; $('storm-copy').disabled = true;
    $('storm-result').replaceChildren(el('p', 'muted', '正在推算与回测…'));
    const at = mode === 'recalculate' ? Date.parse(`${$('storm-at').value}+08:00`) : undefined;
    try {
      const next = await api.call('voidStormForecast', { server, refresh: mode === 'refresh', historical: mode === 'history' || mode === 'recalculate' && historical, ...(at === undefined ? {} : { at }) });
      if (current !== sequence) return;
      result = next; historical = next.snapshotKind === 'history';
      $('storm-at').value = inputTime(next.issuedAt); $('storm-copy').disabled = false;
      renderStormForecast($('storm-result'), next);
    } catch (error) {
      if (current === sequence) $('storm-result').replaceChildren(el('p', 'hint error', error.message));
    }
  }
  return { enter() {
    if (entered) return; entered = true;
    $('storm-at').value = inputTime(Date.now());
    $('storm-server').onchange = () => guarded(() => query(historical ? 'history' : 'cached'));
    $('storm-refresh').onclick = () => guarded(() => query('refresh'));
    $('storm-recalculate').onclick = () => guarded(() => query('recalculate'));
    $('storm-history').onclick = () => guarded(() => query('history'));
    $('storm-copy').onclick = () => guarded(async () => { if (!result) return; await api.copy(JSON.stringify(result, null, 2)); notify('预测与回测 JSON 已复制'); });
    guarded(() => query('cached'));
  } };
}
