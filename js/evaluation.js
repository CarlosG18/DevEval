/**
 * evaluation.js  v2
 * Sistema de Avaliação.
 * Novidades:
 *  - Links de repositório exibidos junto ao dev selecionado
 *  - Votantes filtrados pela compatibilidade de categoria com o dev
 *  - Badges de PO/SM exibidos no card do dev
 */

const EvaluationView = (() => {

  const FRONTEND_CRITERIA = [
    { key: 'project_types',   label: 'Aplicação de HTML semantico' },
    { key: 'visual_notions',  label: 'Criação dos componentes (Modais, Carrosseis, sliders...)' },
    { key: 'mockup_fidelity', label: 'Fidelidade ao Mockup' },
    { key: 'gitflow',         label: 'GitFlow' },
    { key: 'code_org',        label: 'Boas Práticas de Organização de Código' },
    { key: 'documentation',   label: 'Documentação' },
    { key: 'responsiveness',  label: 'Noções de Responsividade' },
  ];

  const BACKEND_CRITERIA = [
    { key: 'documentation',   label: 'Documentação' },
    { key: 'logic',           label: 'Boas Noções de Lógica' },
    { key: 'gitflow',         label: 'GitFlow' },
    { key: 'code_org',        label: 'Organização de Código' },
    { key: 'databases',       label: 'Bancos de Dados e Modelagem' },
    { key: 'security',        label: 'Noções de Segurança' },
  ];

  const ROLE_LABELS = { po: 'PO', scrum_master: 'SM' };
  const ROLE_COLORS = { po: 'badge-po', scrum_master: 'badge-sm' };

  let state = { selectedDevId: null, selectedVoterId: null, squadFilter: 'all' };

  // ── Render principal ──────────────────────────────────────────────────────

  async function render() {
    const content = document.getElementById('app-content');
    content.innerHTML = renderSkeleton();

    try {
      const [developers, squads, voters, evaluations] = await Promise.all([
        Storage.getDevelopers(),
        Storage.getSquads(),
        Storage.getVoters(),
        Storage.getEvaluations(),
      ]);

      // Dev selecionado (para exibir repos e filtrar votantes)
      const selectedDev = developers.find(d => d.id === state.selectedDevId);
      const selectedSquad = selectedDev ? squads.find(s => s.id === selectedDev.squadId) : null;

      content.innerHTML = `
        <div class="space-y-6">
          <div class="panel">
            <h2 class="section-title"><span class="icon-badge">◎</span> Avaliação</h2>
            <p class="text-zinc-400 text-sm">
              Selecione um desenvolvedor e um votante para iniciar a avaliação.
              Votantes só podem avaliar devs da <strong class="text-amber-400">sua categoria</strong>
              e <strong class="text-amber-400">apenas uma vez</strong> por dev.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

            <!-- Coluna: Desenvolvedores -->
            <div class="panel">
              <p class="text-xs text-zinc-400 font-mono uppercase tracking-widest mb-3">
                1. Selecione o Desenvolvedor
              </p>
              ${squads.length > 0 ? `
                <select id="squad-filter" class="input w-full mb-3 text-sm"
                  onchange="EvaluationView.handleSquadFilter(this.value)">
                  <option value="all">Todos os squads</option>
                  ${squads.map(s =>
                    `<option value="${s.id}" ${state.squadFilter === s.id ? 'selected' : ''}>${esc(s.name)}</option>`
                  ).join('')}
                </select>` : ''}
              <div class="space-y-1 max-h-72 overflow-y-auto pr-1 custom-scroll">
                ${renderDeveloperList(developers, squads, evaluations)}
              </div>
            </div>

            <!-- Coluna: Votantes (filtrados pela categoria do dev) -->
            <div class="panel">
              <p class="text-xs text-zinc-400 font-mono uppercase tracking-widest mb-3">
                2. Selecione o Votante
                ${selectedDev ? `<span class="ml-2 normal-case text-zinc-600">
                  (compatíveis com ${selectedDev.type === 'frontend' ? 'Frontend' : 'Backend'})
                </span>` : ''}
              </p>
              <div class="space-y-1 max-h-80 overflow-y-auto pr-1 custom-scroll">
                ${renderVoterList(voters, evaluations, selectedDev)}
              </div>
            </div>

          </div>

          <!-- Repos do squad (visível quando um dev está selecionado) -->
          ${selectedSquad && (selectedSquad.repo_frontend || selectedSquad.repo_backend || selectedSquad.deploy_url) ? `
            <div class="panel border border-zinc-700/60">
              <p class="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-2">
                Repositórios — ${esc(selectedSquad.name)}
              </p>
              <div class="flex flex-wrap gap-2">
                ${selectedSquad.repo_frontend ? `
                  <a href="${safeHref(selectedSquad.repo_frontend)}" target="_blank" rel="noopener"
                    class="repo-link repo-link-fe">
                    <span>⬡</span> Frontend <span class="repo-link-arrow">↗</span>
                  </a>` : ''}
                ${selectedSquad.repo_backend ? `
                  <a href="${safeHref(selectedSquad.repo_backend)}" target="_blank" rel="noopener"
                    class="repo-link repo-link-be">
                    <span>◈</span> Backend <span class="repo-link-arrow">↗</span>
                  </a>` : ''}
                ${selectedSquad.deploy_url ? `
                  <a href="${safeHref(selectedSquad.deploy_url)}" target="_blank" rel="noopener"
                    class="repo-link repo-link-deploy">
                    <span>▲</span> Deploy <span class="repo-link-arrow">↗</span>
                  </a>` : ''}
              </div>
            </div>
          ` : ''}

          <!-- Formulário de critérios -->
          <div id="eval-form-container">
            ${renderEvalForm(developers, voters, evaluations)}
          </div>

          <!-- Histórico -->
          <div id="eval-history-container">
            ${renderHistory(developers, voters, evaluations)}
          </div>
        </div>
      `;
    } catch (err) {
      content.innerHTML = renderError(err.message);
    }
  }

  // ── Listas de seleção ─────────────────────────────────────────────────────

  function renderDeveloperList(developers, squads, evaluations) {
    let devs = developers;
    if (state.squadFilter !== 'all') devs = devs.filter(d => d.squadId === state.squadFilter);
    if (!devs.length) return `<p class="text-zinc-600 text-sm italic">Nenhum desenvolvedor encontrado.</p>`;

    return devs.map(dev => {
      const squad = squads.find(s => s.id === dev.squadId);
      const devEvals = evaluations.filter(e => e.developer_id === dev.id);
      const avg = devEvals.length
        ? (devEvals.reduce((a, e) => a + parseFloat(e.average), 0) / devEvals.length).toFixed(2)
        : null;
      const isSelected = state.selectedDevId === dev.id;

      return `
        <button onclick="EvaluationView.handleSelectDev('${dev.id}')"
          class="select-row w-full text-left ${isSelected ? 'select-row-active' : ''}">
          <div class="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
            <span class="dev-type-badge ${dev.type === 'frontend' ? 'badge-fe' : 'badge-be'} text-xs">
              ${dev.type === 'frontend' ? 'FE' : 'BE'}
            </span>
            ${dev.role ? `<span class="dev-type-badge ${ROLE_COLORS[dev.role]} text-xs">${ROLE_LABELS[dev.role]}</span>` : ''}
            <span class="truncate text-sm">${esc(dev.name)}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-zinc-500 text-xs">${squad ? esc(squad.name) : '—'}</span>
            ${avg !== null ? `<span class="score-pill-sm ${scoreClass(avg)}">${avg}</span>` : ''}
          </div>
        </button>
      `;
    }).join('');
  }

  /**
   * Filtra votantes de acordo com a categoria do dev selecionado:
   * - Votante "frontend" → pode avaliar apenas devs frontend
   * - Votante "backend"  → pode avaliar apenas devs backend
   * - Votante "both"     → pode avaliar qualquer dev
   * Votantes incompatíveis ficam ocultos (não apenas desabilitados).
   */
  function renderVoterList(voters, evaluations, selectedDev) {
    if (!voters.length) {
      return `<p class="text-zinc-600 text-sm italic">Nenhum votante cadastrado. Vá para a aba Votantes.</p>`;
    }

    // Se nenhum dev selecionado, mostra todos
    const visibleVoters = !selectedDev
      ? voters
      : voters.filter(v =>
          v.voter_type === 'both' || v.voter_type === selectedDev.type
        );

    const hiddenCount = voters.length - visibleVoters.length;

    const rows = visibleVoters.map(voter => {
      const alreadyVoted = selectedDev &&
        evaluations.some(e => e.developer_id === selectedDev.id && e.voter_id === voter.id);
      const isSelected = state.selectedVoterId === voter.id;
      const typeLabel = voter.voter_type === 'both' ? 'Ambos' : voter.voter_type === 'frontend' ? 'FE' : 'BE';
      const typeBadge = voter.voter_type === 'frontend' ? 'badge-fe' : voter.voter_type === 'backend' ? 'badge-be' : 'badge-both';

      return `
        <button
          onclick="${alreadyVoted ? '' : `EvaluationView.handleSelectVoter('${voter.id}')`}"
          class="select-row w-full text-left ${isSelected ? 'select-row-active' : ''} ${alreadyVoted ? 'select-row-disabled' : ''}"
          ${alreadyVoted ? 'disabled' : ''}>
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <span class="voter-avatar-sm">${voter.name.charAt(0).toUpperCase()}</span>
            <span class="text-sm ${alreadyVoted ? 'text-zinc-500' : ''} truncate">${esc(voter.name)}</span>
            <span class="dev-type-badge ${typeBadge} text-xs shrink-0">${typeLabel}</span>
          </div>
          ${alreadyVoted ? `<span class="text-xs text-zinc-600 font-mono shrink-0">✓ já votou</span>` : ''}
        </button>
      `;
    }).join('');

    const notice = hiddenCount > 0
      ? `<p class="text-zinc-600 text-xs italic mt-2 text-center">
           ${hiddenCount} votante${hiddenCount > 1 ? 's' : ''} oculto${hiddenCount > 1 ? 's' : ''}
           por categoria incompatível
         </p>`
      : '';

    return rows + notice;
  }

  // ── Formulário de critérios ───────────────────────────────────────────────

  function renderEvalForm(developers, voters, evaluations) {
    if (!state.selectedDevId || !state.selectedVoterId) return '';
    const dev   = developers.find(d => d.id === state.selectedDevId);
    const voter = voters.find(v => v.id === state.selectedVoterId);
    if (!dev || !voter) return '';

    const alreadyVoted = evaluations.some(
      e => e.developer_id === dev.id && e.voter_id === voter.id
    );
    if (alreadyVoted) return `
      <div class="panel border border-zinc-700">
        <p class="text-amber-400 text-sm font-mono">
          ⚠ <strong>${esc(voter.name)}</strong> já avaliou <strong>${esc(dev.name)}</strong>.
          Selecione outro votante.
        </p>
      </div>`;

    const criteria = dev.type === 'frontend' ? FRONTEND_CRITERIA : BACKEND_CRITERIA;

    return `
      <div class="panel border border-amber-900/40">
        <div class="flex items-start justify-between mb-5">
          <div>
            <h3 class="text-amber-300 font-semibold font-mono">Formulário de Avaliação</h3>
            <p class="text-zinc-400 text-sm mt-1">
              <strong class="text-zinc-300">${esc(voter.name)}</strong> avaliando
              <strong class="text-zinc-300">${esc(dev.name)}</strong>
              <span class="ml-1 dev-type-badge ${dev.type === 'frontend' ? 'badge-fe' : 'badge-be'} text-xs">
                ${dev.type === 'frontend' ? 'Frontend' : 'Backend'}
              </span>
              ${dev.role ? `<span class="ml-1 dev-type-badge ${ROLE_COLORS[dev.role]} text-xs">${ROLE_LABELS[dev.role]}</span>` : ''}
            </p>
          </div>
          <div class="text-right shrink-0 ml-4">
            <div class="text-zinc-500 text-xs font-mono">Prévia</div>
            <div id="preview-avg" class="text-2xl font-bold font-mono text-zinc-400">—</div>
          </div>
        </div>

        <div class="space-y-4 mb-6">
          ${criteria.map((c, i) => `
            <div class="criterion-row">
              <div class="flex items-center justify-between mb-1">
                <label class="text-sm text-zinc-300">${i + 1}. ${c.label}</label>
                <span id="score-display-${c.key}" class="font-mono text-lg font-bold text-amber-400">—</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-zinc-600 font-mono w-4">0</span>
                <input type="range" id="score-${c.key}" min="0" max="10" step="0.5"
                  class="score-range flex-1" data-touched="false"
                  oninput="EvaluationView.handleScoreChange('${c.key}', this.value)" />
                <span class="text-xs text-zinc-600 font-mono w-4">10</span>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="flex justify-end">
          <button onclick="EvaluationView.handleSubmit()" class="btn-primary px-8">
            Confirmar Avaliação →
          </button>
        </div>
      </div>
    `;
  }

  // ── Histórico ─────────────────────────────────────────────────────────────

  function renderHistory(developers, voters, evaluations) {
    if (!state.selectedDevId) return '';
    const dev = developers.find(d => d.id === state.selectedDevId);
    const devEvals = evaluations.filter(e => e.developer_id === state.selectedDevId);
    if (!dev || !devEvals.length) return '';

    const criteria = dev.type === 'frontend' ? FRONTEND_CRITERIA : BACKEND_CRITERIA;
    const globalAvg = (devEvals.reduce((a, e) => a + parseFloat(e.average), 0) / devEvals.length).toFixed(2);
    const criteriaAvgs = criteria.map(c => {
      const vals = devEvals.map(e => e.scores[c.key] ?? 0);
      return { ...c, avg: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) };
    });

    return `
      <div class="panel">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-zinc-300 font-semibold">
            Histórico —
            <span class="text-amber-300 font-mono">${esc(dev.name)}</span>
            ${dev.role ? `<span class="ml-1 dev-type-badge ${ROLE_COLORS[dev.role]} text-xs">${ROLE_LABELS[dev.role]}</span>` : ''}
          </h3>
          <div class="text-right">
            <div class="text-zinc-500 text-xs font-mono">Média Geral</div>
            <div class="text-3xl font-bold font-mono ${scoreClass(globalAvg)} score-pill">${globalAvg}</div>
          </div>
        </div>

        <!-- Barras por critério -->
        <div class="mb-5">
          <p class="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-2">Médias por Critério</p>
          <div class="space-y-2">
            ${criteriaAvgs.map(c => `
              <div class="flex items-center gap-3">
                <span class="text-zinc-400 text-sm flex-1 min-w-0 truncate">${c.label}</span>
                <div class="flex items-center gap-2 shrink-0">
                  <div class="w-24 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                    <div class="h-full rounded-full ${barClass(c.avg)}"
                      style="width:${(parseFloat(c.avg)/10*100).toFixed(0)}%"></div>
                  </div>
                  <span class="font-mono text-sm text-zinc-300 w-8 text-right">${c.avg}</span>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <!-- Votos individuais -->
        <div>
          <p class="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-2">
            Votos Individuais (${devEvals.length})
          </p>
          <div class="space-y-1">
            ${devEvals.map(e => {
              const voter = voters.find(v => v.id === e.voter_id);
              const date  = new Date(e.created_at).toLocaleDateString('pt-BR');
              return `
                <div class="flex items-center justify-between py-1.5 px-3 rounded bg-zinc-800/50">
                  <div class="flex items-center gap-2">
                    <span class="voter-avatar-sm">${voter ? voter.name.charAt(0).toUpperCase() : '?'}</span>
                    <span class="text-sm text-zinc-300">${voter ? esc(voter.name) : 'Removido'}</span>
                    <span class="text-zinc-600 text-xs font-mono">${date}</span>
                  </div>
                  <span class="font-mono font-bold ${scoreClass(e.average)} score-pill-sm">
                    ${parseFloat(e.average).toFixed(2)}
                  </span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSquadFilter(value) {
    state.squadFilter = value;
    state.selectedDevId = null;
    state.selectedVoterId = null;
    render();
  }

  function handleSelectDev(devId) {
    state.selectedDevId = devId;
    state.selectedVoterId = null;
    render();
  }

  function handleSelectVoter(voterId) {
    state.selectedVoterId = voterId;
    render();
  }

  function handleScoreChange(key, value) {
    const display = document.getElementById(`score-display-${key}`);
    const slider  = document.getElementById(`score-${key}`);
    if (display) display.textContent = parseFloat(value).toFixed(1);
    if (slider)  slider.dataset.touched = 'true';
    recalcPreview();
  }

  function recalcPreview() {
    const sliders = document.querySelectorAll('[id^="score-"]');
    let total = 0, count = 0;
    sliders.forEach(s => {
      if (s.dataset.touched === 'true') { total += parseFloat(s.value); count++; }
    });
    const preview = document.getElementById('preview-avg');
    if (!preview) return;
    if (count > 0) {
      const avg = (total / count).toFixed(2);
      preview.textContent = avg;
      preview.className = `text-2xl font-bold font-mono ${scoreClass(avg)}`;
    } else {
      preview.textContent = '—';
      preview.className = 'text-2xl font-bold font-mono text-zinc-400';
    }
  }

  async function handleSubmit() {
    if (!state.selectedDevId || !state.selectedVoterId) {
      return showToast('Selecione desenvolvedor e votante.', 'warn');
    }
    const sliders = document.querySelectorAll('[id^="score-"]');
    const scores = {};
    let allFilled = true;
    sliders.forEach(s => {
      if (s.dataset.touched !== 'true') { allFilled = false; return; }
      scores[s.id.replace('score-', '')] = parseFloat(s.value);
    });
    if (!allFilled || !Object.keys(scores).length) {
      return showToast('Preencha todos os critérios antes de confirmar.', 'warn');
    }
    const values  = Object.values(scores);
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    try {
      setLoading(true);
      await Storage.addEvaluation(state.selectedDevId, state.selectedVoterId, scores, average);
      showToast(`Avaliação registrada! Média: ${average.toFixed(2)}`, 'success');
      state.selectedVoterId = null;
      await render();
    } catch (err) {
      showToast(err.message.includes('unique') ? 'Este votante já avaliou este dev.' : err.message, 'warn');
    } finally { setLoading(false); }
  }

  // ── Utilitários ───────────────────────────────────────────────────────────

  function esc(str) {
    return String(str).replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  /** Para uso em atributos href — só escapa " para não quebrar o atributo */
  function safeHref(url) {
    return String(url || '').replace(/"/g, '%22');
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

  return {
    render, handleSquadFilter,
    handleSelectDev, handleSelectVoter,
    handleScoreChange, handleSubmit,
  };
})();
