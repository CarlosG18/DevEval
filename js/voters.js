/**
 * voters.js  v2
 * Gerenciamento de Votantes.
 * Novidade: categoria do votante (Frontend / Backend / Ambos).
 */

const VotersView = (() => {

  const TYPE_LABELS = { frontend: 'Frontend', backend: 'Backend', both: 'Ambos' };
  const TYPE_BADGES = { frontend: 'badge-fe', backend: 'badge-be', both: 'badge-both' };

  async function render() {
    const content = document.getElementById('app-content');
    content.innerHTML = renderSkeleton();
    try {
      const [voters, evaluations] = await Promise.all([
        Storage.getVoters(),
        Storage.getEvaluations(),
      ]);

      // Agrupa por categoria para exibir contadores
      const counts = { frontend: 0, backend: 0, both: 0 };
      voters.forEach(v => counts[v.voter_type]++);

      content.innerHTML = `
        <div class="space-y-6">

          <!-- Form de cadastro -->
          <div class="panel">
            <h2 class="section-title"><span class="icon-badge">◈</span> Votantes</h2>
            <p class="text-zinc-400 text-sm mb-4">
              Defina a <strong class="text-amber-400">categoria</strong> de cada votante para controlar
              quem pode avaliar devs de Frontend, Backend ou ambos.
            </p>
            <div class="flex gap-3 flex-wrap">
              <input id="voter-name-input" type="text" placeholder="Nome do votante..."
                class="input flex-1 min-w-[160px]"
                onkeydown="if(event.key==='Enter') VotersView.handleAddVoter()" />
              <select id="voter-type-input" class="input w-44">
                <option value="frontend">Frontend</option>
                <option value="backend">Backend</option>
                <option value="both">Ambos</option>
              </select>
              <button onclick="VotersView.handleAddVoter()" class="btn-primary">+ Adicionar</button>
            </div>
          </div>

          <!-- Resumo por categoria -->
          ${voters.length > 0 ? `
            <div class="grid grid-cols-3 gap-3">
              ${[
                { key: 'frontend', icon: '⬡', label: 'Frontend' },
                { key: 'backend',  icon: '◈', label: 'Backend'  },
                { key: 'both',     icon: '◎', label: 'Ambos'    },
              ].map(cat => `
                <div class="panel text-center py-3">
                  <div class="text-lg">${cat.icon}</div>
                  <div class="text-2xl font-bold font-mono ${counts[cat.key] > 0 ? 'text-amber-400' : 'text-zinc-600'}">
                    ${counts[cat.key]}
                  </div>
                  <div class="text-xs text-zinc-500 mt-0.5">${cat.label}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <!-- Lista -->
          ${voters.length === 0
            ? `<div class="empty-state">Nenhum votante cadastrado ainda.</div>`
            : `<div class="panel">
                 <div class="space-y-2">
                   ${voters.map(v => renderVoterRow(v, evaluations)).join('')}
                 </div>
               </div>`
          }
        </div>
      `;
    } catch (err) {
      content.innerHTML = renderError(err.message);
    }
  }

  function renderVoterRow(voter, evaluations) {
    const count = evaluations.filter(e => e.voter_id === voter.id).length;
    const type  = voter.voter_type || 'both';

    return `
      <div class="dev-row">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <span class="voter-avatar">${voter.name.charAt(0).toUpperCase()}</span>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-zinc-200">${esc(voter.name)}</span>
              <span class="dev-type-badge ${TYPE_BADGES[type]}">${TYPE_LABELS[type]}</span>
            </div>
            <div class="text-xs font-mono mt-0.5 ${count > 0 ? 'text-zinc-500' : 'text-zinc-600'}">
              ${count > 0 ? `${count} avaliação${count > 1 ? 'ões' : ''} realizada${count > 1 ? 's' : ''}` : 'sem avaliações'}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          ${count > 0 ? `<span class="tag-neutral">${count} voto${count > 1 ? 's' : ''}</span>` : ''}
          <button onclick="VotersView.handleDeleteVoter('${voter.id}','${esc(voter.name)}')" class="btn-danger-sm">✕</button>
        </div>
      </div>
    `;
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleAddVoter() {
    const name = document.getElementById('voter-name-input').value.trim();
    const type = document.getElementById('voter-type-input').value;
    if (!name) return showToast('Digite o nome do votante.', 'warn');
    try {
      setLoading(true);
      await Storage.addVoter(name, type);
      showToast(`"${name}" cadastrado como votante de ${type === 'both' ? 'ambas categorias' : type}!`, 'success');
      await render();
    } catch (err) {
      showToast(err.message.includes('unique') ? 'Já existe um votante com este nome.' : err.message, 'warn');
    } finally { setLoading(false); }
  }

  async function handleDeleteVoter(voterId, name) {
    if (!confirm(`Remover votante "${name}"? As avaliações já realizadas serão mantidas.`)) return;
    try {
      setLoading(true);
      await Storage.deleteVoter(voterId);
      showToast('Votante removido.', 'info');
      await render();
    } catch (err) {
      showToast(err.message, 'warn');
    } finally { setLoading(false); }
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  return { render, handleAddVoter, handleDeleteVoter };
})();
