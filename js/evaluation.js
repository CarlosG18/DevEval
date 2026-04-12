/**
 * evaluation.js
 * View de Avaliação — refatorada para async/await com Supabase.
 */

const EvaluationView = (() => {

  const FRONTEND_CRITERIA = [
    { key: 'project_types',   label: 'Noção de Tipos de Projetos' },
    { key: 'visual_notions',  label: 'Boas Noções Visuais' },
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

  // Estado local da view
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

      content.innerHTML = `
        <div class="space-y-6">
          <div class="panel">
            <h2 class="section-title"><span class="icon-badge">◎</span> Avaliação</h2>
            <p class="text-zinc-400 text-sm">
              Selecione um desenvolvedor e um votante para iniciar a avaliação.
              Cada votante pode avaliar um desenvolvedor <strong class="text-amber-400">apenas uma vez</strong>.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Desenvolvedores -->
            <div class="panel">
              <p class="text-xs text-zinc-400 font-mono uppercase tracking-widest mb-3">1. Selecione o Desenvolvedor</p>
              ${squads.length > 0 ? `
                <select id="squad-filter" class="input w-full mb-3 text-sm"
                  onchange="EvaluationView.handleSquadFilter(this.value)">
                  <option value="all">Todos os squads</option>
                  ${squads.map(s => `<option value="${s.id}" ${state.squadFilter === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
                </select>` : ''}
              <div class="space-y-1 max-h-64 overflow-y-auto pr-1 custom-scroll">
                ${renderDeveloperList(developers, squads, evaluations)}
              </div>
            </div>

            <!-- Votantes -->
            <div class="panel">
              <p class="text-xs text-zinc-400 font-mono uppercase tracking-widest mb-3">2. Selecione o Votante</p>
              <div class="space-y-1 max-h-80 overflow-y-auto pr-1 custom-scroll">
                ${renderVoterList(voters, evaluations)}
              </div>
            </div>
          </div>

          <!-- Formulário -->
          <div id="eval-form-container">${renderEvalForm(developers, voters, evaluations)}</div>

          <!-- Histórico -->
          <div id="eval-history-container">${renderHistory(developers, voters, evaluations)}</div>
        </div>
      `;
    } catch (err) {
      content.innerHTML = renderError(err.message);
    }
  }

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
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <span class="dev-type-badge ${dev.type === 'frontend' ? 'badge-fe' : 'badge-be'} text-xs">
              ${dev.type === 'frontend' ? 'FE' : 'BE'}
            </span>
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

  function renderVoterList(voters, evaluations) {
    if (!voters.length) return `<p class="text-zinc-600 text-sm italic">Nenhum votante. Vá para a aba Votantes.</p>`;

    return voters.map(voter => {
      const alreadyVoted = state.selectedDevId &&
        evaluations.some(e => e.developer_id === state.selectedDevId && e.voter_id === voter.id);
      const isSelected = state.selectedVoterId === voter.id;

      return `
        <button
          onclick="${alreadyVoted ? '' : `EvaluationView.handleSelectVoter('${voter.id}')`}"
          class="select-row w-full text-left ${isSelected ? 'select-row-active' : ''} ${alreadyVoted ? 'select-row-disabled' : ''}"
          ${alreadyVoted ? 'disabled' : ''}>
          <div class="flex items-center gap-2 flex-1">
            <span class="voter-avatar-sm">${voter.name.charAt(0).toUpperCase()}</span>
            <span class="text-sm ${alreadyVoted ? 'text-zinc-500' : ''}">${esc(voter.name)}</span>
          </div>
          ${alreadyVoted ? `<span class="text-xs text-zinc-600 font-mono">✓ já votou</span>` : ''}
        </button>
      `;
    }).join('');
  }

  function renderEvalForm(developers, voters, evaluations) {
    if (!state.selectedDevId || !state.selectedVoterId) return '';
    const dev = developers.find(d => d.id === state.selectedDevId);
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
        <div class="flex items-center justify-between mb-5">
          <div>
            <h3 class="text-amber-300 font-semibold font-mono">Formulário de Avaliação</h3>
            <p class="text-zinc-400 text-sm mt-0.5">
              <strong class="text-zinc-300">${esc(voter.name)}</strong> avaliando
              <strong class="text-zinc-300">${esc(dev.name)}</strong>
              <span class="ml-1 dev-type-badge ${dev.type === 'frontend' ? 'badge-fe' : 'badge-be'} text-xs">
                ${dev.type === 'frontend' ? 'Frontend' : 'Backend'}
              </span>
            </p>
          </div>
          <div class="text-right">
            <div class="text-zinc-500 text-xs font-mono">Prévia da média</div>
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
            Histórico — <span class="text-amber-300 font-mono">${esc(dev.name)}</span>
          </h3>
          <div class="text-right">
            <div class="text-zinc-500 text-xs font-mono">Média Geral</div>
            <div class="text-3xl font-bold font-mono ${scoreClass(globalAvg)} score-pill">${globalAvg}</div>
          </div>
        </div>

        <div class="mb-5">
          <p class="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-2">Médias por Critério</p>
          <div class="space-y-2">
            ${criteriaAvgs.map(c => `
              <div class="flex items-center gap-3">
                <span class="text-zinc-400 text-sm flex-1">${c.label}</span>
                <div class="flex items-center gap-2">
                  <div class="w-24 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                    <div class="h-full rounded-full ${barClass(c.avg)}" style="width:${(parseFloat(c.avg)/10*100).toFixed(0)}%"></div>
                  </div>
                  <span class="font-mono text-sm text-zinc-300 w-8 text-right">${c.avg}</span>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <div>
          <p class="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-2">Votos Individuais (${devEvals.length})</p>
          <div class="space-y-1">
            ${devEvals.map(e => {
              const voter = voters.find(v => v.id === e.voter_id);
              const date = new Date(e.created_at).toLocaleDateString('pt-BR');
              return `
                <div class="flex items-center justify-between py-1.5 px-3 rounded bg-zinc-800/50">
                  <div class="flex items-center gap-2">
                    <span class="voter-avatar-sm">${voter ? voter.name.charAt(0).toUpperCase() : '?'}</span>
                    <span class="text-sm text-zinc-300">${voter ? esc(voter.name) : 'Removido'}</span>
                    <span class="text-zinc-600 text-xs font-mono">${date}</span>
                  </div>
                  <span class="font-mono font-bold ${scoreClass(e.average)} score-pill-sm">${parseFloat(e.average).toFixed(2)}</span>
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
    const slider = document.getElementById(`score-${key}`);
    if (display) display.textContent = parseFloat(value).toFixed(1);
    if (slider) slider.dataset.touched = 'true';
    recalcPreview();
  }

  function recalcPreview() {
    // Detecta os critérios do dev selecionado
    const criteria = document.querySelectorAll('[id^="score-"]');
    let total = 0, count = 0;
    criteria.forEach(slider => {
      if (slider.dataset.touched === 'true') {
        total += parseFloat(slider.value);
        count++;
      }
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

    // Coleta scores dos sliders
    const sliders = document.querySelectorAll('[id^="score-"]');
    const scores = {};
    let allFilled = true;

    sliders.forEach(slider => {
      if (slider.dataset.touched !== 'true') { allFilled = false; return; }
      const key = slider.id.replace('score-', '');
      scores[key] = parseFloat(slider.value);
    });

    if (!allFilled || Object.keys(scores).length === 0) {
      return showToast('Preencha todos os critérios antes de confirmar.', 'warn');
    }

    const values = Object.values(scores);
    const average = values.reduce((a, b) => a + b, 0) / values.length;

    try {
      setLoading(true);
      await Storage.addEvaluation(state.selectedDevId, state.selectedVoterId, scores, average);
      showToast(`Avaliação registrada! Média: ${average.toFixed(2)}`, 'success');
      state.selectedVoterId = null;
      await render();
    } catch (err) {
      if (err.message.includes('unique') || err.message.includes('duplicate')) {
        showToast('Este votante já avaliou este desenvolvedor.', 'warn');
      } else {
        showToast(err.message, 'warn');
      }
    } finally { setLoading(false); }
  }

  // ── Utilitários ───────────────────────────────────────────────────────────
  function esc(str) {
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
