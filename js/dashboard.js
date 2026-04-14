/**
 * dashboard.js
 * View de Dashboard — visão geral do processo de avaliação.
 *
 * Indicadores exibidos:
 *  1. KPIs gerais (squads, devs FE/BE, votantes, avaliações realizadas)
 *  2. Progresso global de votação (barra geral + por área)
 *  3. Ranking de devs por área com notas e barras de progresso
 *  4. Tabela de pendências — quem ainda falta votar em cada dev
 *  5. Destaque: maior e menor nota geral
 *  6. Critérios com menor média (pontos de atenção globais)
 */

const DashboardView = (() => {

  const FRONTEND_CRITERIA = [
    { key: 'project_types',   label: 'Aplicação de HTML semantico' },
    { key: 'visual_notions',  label: 'Criação dos componentes (Modais, Carrosseis, sliders...' },
    { key: 'mockup_fidelity', label: 'Fidelidade ao Mockup' },
    { key: 'gitflow',         label: 'GitFlow' },
    { key: 'code_org',        label: 'Organização de Código' },
    { key: 'documentation',   label: 'Documentação' },
    { key: 'responsiveness',  label: 'Responsividade' },
  ];

  const BACKEND_CRITERIA = [
    { key: 'documentation',   label: 'Documentação' },
    { key: 'logic',           label: 'Lógica' },
    { key: 'gitflow',         label: 'GitFlow' },
    { key: 'code_org',        label: 'Organização de Código' },
    { key: 'databases',       label: 'Bancos de Dados' },
    { key: 'security',        label: 'Segurança' },
  ];

  const ROLE_LABELS = { po: 'PO', scrum_master: 'SM' };
  const ROLE_COLORS = { po: 'badge-po', scrum_master: 'badge-sm' };

  // ── Render principal ──────────────────────────────────────────────────────

  async function render() {
    const content = document.getElementById('app-content');
    content.innerHTML = renderSkeleton();

    try {
      const [squads, developers, voters, evaluations] = await Promise.all([
        Storage.getSquads(),
        Storage.getDevelopers(),
        Storage.getVoters(),
        Storage.getEvaluations(),
      ]);

      // Pré-calcula dados derivados uma vez só
      const stats = computeStats(squads, developers, voters, evaluations);

      content.innerHTML = `
        <div class="space-y-6">

          <!-- Cabeçalho -->
          <div class="flex items-center justify-between">
            <div>
              <h2 class="section-title"><span class="icon-badge">◉</span> Dashboard</h2>
              <p class="text-zinc-500 text-xs mt-1 font-mono">
                Atualizado em ${new Date().toLocaleString('pt-BR')}
              </p>
            </div>
            <button onclick="DashboardView.render()" class="btn-secondary text-xs flex items-center gap-1">
              ↻ Atualizar
            </button>
          </div>

          <!-- KPIs -->
          ${renderKPIs(stats)}

          <!-- Progresso de votação global -->
          ${renderVotingProgress(stats)}

          <!-- Devs por área -->
          ${renderDevsByArea(developers, squads, evaluations, voters, stats)}

          <!-- Pendências de votação -->
          ${renderPendingVotes(developers, voters, evaluations, squads, stats)}

          <!-- Critérios com menor média -->
          ${renderWeakCriteria(developers, evaluations)}

        </div>
      `;
    } catch (err) {
      content.innerHTML = renderError(err.message);
    }
  }

  // ── Cálculo de estatísticas ───────────────────────────────────────────────

  function computeStats(squads, developers, voters, evaluations) {
    const feDevs = developers.filter(d => d.type === 'frontend');
    const beDevs = developers.filter(d => d.type === 'backend');

    // Votantes elegíveis por tipo de dev
    const feVoters = voters.filter(v => v.voter_type === 'frontend' || v.voter_type === 'both');
    const beVoters = voters.filter(v => v.voter_type === 'backend'  || v.voter_type === 'both');

    // Total de votos possíveis = cada dev × votantes elegíveis para ele
    const totalPossible = feDevs.length * feVoters.length + beDevs.length * beVoters.length;
    const totalDone     = evaluations.length;
    const totalPct      = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;

    // Progresso FE
    const fePossible = feDevs.length * feVoters.length;
    const feDone     = evaluations.filter(e => feDevs.some(d => d.id === e.developer_id)).length;
    const fePct      = fePossible > 0 ? Math.round((feDone / fePossible) * 100) : 0;

    // Progresso BE
    const bePossible = beDevs.length * beVoters.length;
    const beDone     = evaluations.filter(e => beDevs.some(d => d.id === e.developer_id)).length;
    const bePct      = bePossible > 0 ? Math.round((beDone / bePossible) * 100) : 0;

    // Médias por dev
    const devAverages = developers.map(dev => {
      const devEvals = evaluations.filter(e => e.developer_id === dev.id);
      const avg = devEvals.length
        ? (devEvals.reduce((a, e) => a + parseFloat(e.average), 0) / devEvals.length)
        : null;
      return { ...dev, avg, evalCount: devEvals.length };
    });

    // Dev com maior e menor nota (apenas os que têm pelo menos 1 avaliação)
    const rated = devAverages.filter(d => d.avg !== null);
    const topDev = rated.length ? rated.reduce((a, b) => a.avg > b.avg ? a : b) : null;
    const lowDev = rated.length ? rated.reduce((a, b) => a.avg < b.avg ? a : b) : null;

    return {
      squads, developers, voters, evaluations,
      feDevs, beDevs, feVoters, beVoters,
      totalPossible, totalDone, totalPct,
      fePossible, feDone, fePct,
      bePossible, beDone, bePct,
      devAverages, topDev, lowDev,
    };
  }

  // ── KPIs ─────────────────────────────────────────────────────────────────

  function renderKPIs(s) {
    const devsWithEvals = s.devAverages.filter(d => d.evalCount > 0).length;
    const globalAvg = s.devAverages.filter(d => d.avg !== null).length
      ? (s.devAverages.filter(d => d.avg !== null)
          .reduce((a, d) => a + d.avg, 0) / s.devAverages.filter(d => d.avg !== null).length
        ).toFixed(2)
      : null;

    const kpis = [
      { icon: '⬡', label: 'Squads',      value: s.squads.length,       sub: '' },
      { icon: '⬡', label: 'Frontend',    value: s.feDevs.length,       sub: 'devs' },
      { icon: '◈', label: 'Backend',     value: s.beDevs.length,       sub: 'devs' },
      { icon: '◈', label: 'Votantes',    value: s.voters.length,       sub: `${s.feVoters.length} FE · ${s.beVoters.length} BE` },
      { icon: '◎', label: 'Avaliações',  value: s.totalDone,           sub: `de ${s.totalPossible} possíveis` },
      { icon: '◉', label: 'Média Geral', value: globalAvg ?? '—',      sub: 'de 10.00', highlight: globalAvg },
    ];

    return `
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        ${kpis.map(k => `
          <div class="panel text-center py-4">
            <div class="text-zinc-500 text-xs font-mono mb-1">${k.icon} ${k.label}</div>
            <div class="text-2xl font-bold font-mono ${k.highlight ? scoreClass(k.highlight) : 'text-zinc-100'}">
              ${k.value}
            </div>
            ${k.sub ? `<div class="text-zinc-600 text-xs mt-0.5">${k.sub}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  // ── Progresso global de votação ───────────────────────────────────────────

  function renderVotingProgress(s) {
    return `
      <div class="panel">
        <h3 class="text-zinc-400 font-semibold mb-4 flex items-center gap-2">
          <span class="icon-badge text-base">◎</span> Progresso de Votação
        </h3>
        <div class="space-y-4">

          <!-- Geral -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm text-zinc-300">Geral</span>
              <div class="flex items-center gap-3">
                <span class="text-zinc-500 text-xs font-mono">${s.totalDone} / ${s.totalPossible} votos</span>
                <span class="font-mono font-bold text-sm ${progressColor(s.totalPct)}">${s.totalPct}%</span>
              </div>
            </div>
            <div class="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all ${progressBar(s.totalPct)}"
                style="width:${s.totalPct}%"></div>
            </div>
          </div>

          <!-- Frontend -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm flex items-center gap-2">
                <span class="dev-type-badge badge-fe text-xs">FE</span>
                <span class="text-zinc-300">Frontend</span>
              </span>
              <div class="flex items-center gap-3">
                <span class="text-zinc-500 text-xs font-mono">${s.feDone} / ${s.fePossible} votos</span>
                <span class="font-mono font-bold text-sm ${progressColor(s.fePct)}">${s.fePct}%</span>
              </div>
            </div>
            <div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full bg-blue-500 transition-all" style="width:${s.fePct}%"></div>
            </div>
          </div>

          <!-- Backend -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm flex items-center gap-2">
                <span class="dev-type-badge badge-be text-xs">BE</span>
                <span class="text-zinc-300">Backend</span>
              </span>
              <div class="flex items-center gap-3">
                <span class="text-zinc-500 text-xs font-mono">${s.beDone} / ${s.bePossible} votos</span>
                <span class="font-mono font-bold text-sm ${progressColor(s.bePct)}">${s.bePct}%</span>
              </div>
            </div>
            <div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full bg-emerald-500 transition-all" style="width:${s.bePct}%"></div>
            </div>
          </div>

        </div>

        <!-- Destaques top/low -->
        ${s.topDev || s.lowDev ? `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 pt-4 border-t border-zinc-800">
            ${s.topDev ? `
              <div class="flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-900/50">
                <span class="text-emerald-400 text-lg">↑</span>
                <div class="flex-1 min-w-0">
                  <div class="text-xs text-emerald-600 font-mono uppercase tracking-widest">Maior nota</div>
                  <div class="text-zinc-200 text-sm font-semibold truncate">${esc(s.topDev.name)}</div>
                </div>
                <span class="font-mono font-bold text-lg score-high">${s.topDev.avg.toFixed(2)}</span>
              </div>` : ''}
            ${s.lowDev && s.lowDev.id !== s.topDev?.id ? `
              <div class="flex items-center gap-3 px-3 py-2 rounded-lg bg-red-950/40 border border-red-900/50">
                <span class="text-red-400 text-lg">↓</span>
                <div class="flex-1 min-w-0">
                  <div class="text-xs text-red-700 font-mono uppercase tracking-widest">Menor nota</div>
                  <div class="text-zinc-200 text-sm font-semibold truncate">${esc(s.lowDev.name)}</div>
                </div>
                <span class="font-mono font-bold text-lg score-low">${s.lowDev.avg.toFixed(2)}</span>
              </div>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  // ── Devs por área ─────────────────────────────────────────────────────────

  function renderDevsByArea(developers, squads, evaluations, voters, stats) {
    return `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        ${renderAreaPanel('frontend', 'FE', 'Frontend', stats.feDevs, squads, evaluations, voters, stats.feVoters)}
        ${renderAreaPanel('backend',  'BE', 'Backend',  stats.beDevs, squads, evaluations, voters, stats.beVoters)}
      </div>
    `;
  }

  function renderAreaPanel(type, abbr, label, devs, squads, evaluations, voters, eligibleVoters) {
    if (!devs.length) return `
      <div class="panel">
        <h3 class="text-zinc-400 font-semibold mb-3 flex items-center gap-2">
          <span class="dev-type-badge ${type === 'frontend' ? 'badge-fe' : 'badge-be'}">${abbr}</span>
          ${label}
        </h3>
        <p class="text-zinc-600 text-sm italic">Nenhum desenvolvedor cadastrado.</p>
      </div>`;

    // Ordena por média desc (sem nota vai para o final)
    const sorted = [...devs].map(dev => {
      const devEvals = evaluations.filter(e => e.developer_id === dev.id);
      const avg = devEvals.length
        ? devEvals.reduce((a, e) => a + parseFloat(e.average), 0) / devEvals.length
        : null;
      const pct = eligibleVoters.length > 0
        ? Math.round((devEvals.length / eligibleVoters.length) * 100)
        : 0;
      const squad = squads.find(s => s.id === dev.squadId);
      return { ...dev, avg, evalCount: devEvals.length, pct, squad };
    }).sort((a, b) => {
      if (a.avg === null && b.avg === null) return 0;
      if (a.avg === null) return 1;
      if (b.avg === null) return -1;
      return b.avg - a.avg;
    });

    return `
      <div class="panel">
        <h3 class="text-zinc-400 font-semibold mb-4 flex items-center gap-2">
          <span class="dev-type-badge ${type === 'frontend' ? 'badge-fe' : 'badge-be'}">${abbr}</span>
          ${label}
          <span class="tag-neutral ml-1">${devs.length} dev${devs.length !== 1 ? 's' : ''}</span>
        </h3>
        <div class="space-y-3">
          ${sorted.map((dev, i) => `
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <!-- Rank -->
                <span class="text-zinc-700 font-mono text-xs w-4 shrink-0">${dev.avg !== null ? i + 1 : '—'}</span>
                <!-- Nome + squad + roles -->
                <div class="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
                  <span class="text-zinc-200 text-sm truncate">${esc(dev.name)}</span>
                  ${dev.role ? `<span class="dev-type-badge ${ROLE_COLORS[dev.role]} text-xs">${ROLE_LABELS[dev.role]}</span>` : ''}
                  <span class="text-zinc-600 text-xs font-mono">${dev.squad ? esc(dev.squad.name) : ''}</span>
                </div>
                <!-- Votos + nota -->
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-zinc-600 text-xs font-mono">${dev.evalCount}/${eligibleVoters.length}</span>
                  ${dev.avg !== null
                    ? `<span class="score-pill ${scoreClass(dev.avg.toFixed(2))}">${dev.avg.toFixed(2)}</span>`
                    : `<span class="text-zinc-700 text-xs font-mono px-2">sem votos</span>`
                  }
                </div>
              </div>
              <!-- Barra de progresso de votos -->
              <div class="flex items-center gap-2 pl-6">
                <div class="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div class="h-full rounded-full ${type === 'frontend' ? 'bg-blue-500' : 'bg-emerald-500'} transition-all"
                    style="width:${dev.pct}%"></div>
                </div>
                <span class="text-zinc-600 text-xs font-mono w-8 text-right">${dev.pct}%</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ── Pendências de votação ─────────────────────────────────────────────────

  function renderPendingVotes(developers, voters, evaluations, squads, stats) {
    // Para cada dev, encontra quais votantes elegíveis ainda não votaram
    const pending = developers.map(dev => {
      const eligible = voters.filter(v =>
        v.voter_type === 'both' || v.voter_type === dev.type
      );
      const voted    = evaluations.filter(e => e.developer_id === dev.id).map(e => e.voter_id);
      const missing  = eligible.filter(v => !voted.includes(v.id));
      const pct      = eligible.length > 0 ? Math.round((voted.length / eligible.length) * 100) : 0;
      const squad    = squads.find(s => s.id === dev.squadId);
      return { dev, eligible, voted, missing, pct, squad };
    }).filter(p => p.missing.length > 0) // só devs com votos pendentes
      .sort((a, b) => a.pct - b.pct);   // menos votados primeiro

    if (!pending.length) return `
      <div class="panel border border-emerald-900/40">
        <div class="flex items-center gap-3">
          <span class="text-2xl">✓</span>
          <div>
            <h3 class="text-emerald-400 font-semibold">Todas as avaliações concluídas!</h3>
            <p class="text-zinc-500 text-sm">Todos os votantes elegíveis já avaliaram todos os desenvolvedores.</p>
          </div>
        </div>
      </div>`;

    return `
      <div class="panel">
        <h3 class="text-zinc-400 font-semibold mb-1 flex items-center gap-2">
          <span class="icon-badge text-base">⚠</span> Pendências de Votação
          <span class="tag-neutral">${pending.length} dev${pending.length !== 1 ? 's' : ''} com votos pendentes</span>
        </h3>
        <p class="text-zinc-600 text-xs mb-4">Votantes elegíveis que ainda não avaliaram cada desenvolvedor.</p>

        <div class="space-y-3">
          ${pending.map(p => `
            <div class="pending-row">
              <!-- Dev info -->
              <div class="flex items-center gap-2 mb-2">
                <span class="dev-type-badge ${p.dev.type === 'frontend' ? 'badge-fe' : 'badge-be'} text-xs">
                  ${p.dev.type === 'frontend' ? 'FE' : 'BE'}
                </span>
                ${p.dev.role ? `<span class="dev-type-badge ${ROLE_COLORS[p.dev.role]} text-xs">${ROLE_LABELS[p.dev.role]}</span>` : ''}
                <span class="text-zinc-200 text-sm font-semibold">${esc(p.dev.name)}</span>
                <span class="text-zinc-600 text-xs font-mono">${p.squad ? esc(p.squad.name) : ''}</span>
                <div class="flex-1"></div>
                <span class="font-mono text-xs ${progressColor(p.pct)}">${p.pct}%</span>
                <span class="text-zinc-600 text-xs font-mono">${p.voted.length}/${p.eligible.length}</span>
              </div>
              <!-- Barra -->
              <div class="h-1 bg-zinc-800 rounded-full overflow-hidden mb-2">
                <div class="h-full rounded-full ${p.dev.type === 'frontend' ? 'bg-blue-500' : 'bg-emerald-500'}"
                  style="width:${p.pct}%"></div>
              </div>
              <!-- Votantes faltando -->
              <div class="flex flex-wrap gap-1.5">
                ${p.missing.map(v => `
                  <span class="pending-voter-chip">
                    <span class="voter-avatar-sm">${v.name.charAt(0).toUpperCase()}</span>
                    ${esc(v.name)}
                  </span>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ── Critérios com menor média ─────────────────────────────────────────────

  function renderWeakCriteria(developers, evaluations) {
    if (!evaluations.length) return '';

    // Calcula média global por critério, separado por área
    function areaCriteria(devs, criteria) {
      const areaDevIds = devs.map(d => d.id);
      const areaEvals  = evaluations.filter(e => areaDevIds.includes(e.developer_id));
      if (!areaEvals.length) return [];

      return criteria.map(c => {
        const vals = areaEvals.map(e => e.scores[c.key]).filter(v => v !== undefined && v !== null);
        if (!vals.length) return null;
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        return { ...c, avg };
      }).filter(Boolean).sort((a, b) => a.avg - b.avg);
    }

    const feDevs = developers.filter(d => d.type === 'frontend');
    const beDevs = developers.filter(d => d.type === 'backend');
    const feCrit = areaCriteria(feDevs, FRONTEND_CRITERIA);
    const beCrit = areaCriteria(beDevs, BACKEND_CRITERIA);

    if (!feCrit.length && !beCrit.length) return '';

    const renderCritList = (crit, type) => {
      if (!crit.length) return `<p class="text-zinc-600 text-sm italic">Sem dados suficientes.</p>`;
      return crit.map((c, i) => `
        <div class="flex items-center gap-3">
          <span class="text-zinc-600 font-mono text-xs w-4">${i + 1}</span>
          <span class="text-zinc-400 text-sm flex-1 min-w-0 truncate">${c.label}</span>
          <div class="flex items-center gap-2 shrink-0">
            <div class="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full ${barClass(c.avg.toFixed(1))}"
                style="width:${(c.avg / 10 * 100).toFixed(0)}%"></div>
            </div>
            <span class="font-mono text-sm w-8 text-right ${scoreClass(c.avg.toFixed(1))}">${c.avg.toFixed(2)}</span>
          </div>
        </div>
      `).join('');
    };

    return `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <div class="panel">
          <h3 class="text-zinc-400 font-semibold mb-4 flex items-center gap-2">
            <span class="dev-type-badge badge-fe">FE</span>
            Critérios Frontend
            <span class="text-zinc-600 text-xs font-mono normal-case font-normal">por média</span>
          </h3>
          <div class="space-y-2.5">
            ${renderCritList(feCrit, 'frontend')}
          </div>
        </div>

        <div class="panel">
          <h3 class="text-zinc-400 font-semibold mb-4 flex items-center gap-2">
            <span class="dev-type-badge badge-be">BE</span>
            Critérios Backend
            <span class="text-zinc-600 text-xs font-mono normal-case font-normal">por média</span>
          </h3>
          <div class="space-y-2.5">
            ${renderCritList(beCrit, 'backend')}
          </div>
        </div>

      </div>
    `;
  }

  // ── Utilitários ───────────────────────────────────────────────────────────

  function esc(str) {
    return String(str).replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function scoreClass(avg) {
    const n = parseFloat(avg);
    if (n >= 8) return 'score-high';
    if (n >= 6) return 'score-mid';
    return 'score-low';
  }
  function barClass(avg) {
    const n = parseFloat(avg);
    if (n >= 8) return 'bg-emerald-500';
    if (n >= 6) return 'bg-amber-500';
    return 'bg-red-500';
  }
  function progressColor(pct) {
    if (pct >= 80) return 'text-emerald-400';
    if (pct >= 40) return 'text-amber-400';
    return 'text-red-400';
  }
  function progressBar(pct) {
    if (pct >= 80) return 'bg-emerald-500';
    if (pct >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  }

  return { render };
})();
