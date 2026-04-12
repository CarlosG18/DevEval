/**
 * voters.js
 * View de Votantes — refatorada para async/await com Supabase.
 */

const VotersView = (() => {

  async function render() {
    const content = document.getElementById('app-content');
    content.innerHTML = renderSkeleton();

    try {
      const [voters, evaluations] = await Promise.all([
        Storage.getVoters(),
        Storage.getEvaluations(),
      ]);

      content.innerHTML = `
        <div class="space-y-6">
          <div class="panel">
            <h2 class="section-title"><span class="icon-badge">◈</span> Votantes</h2>
            <p class="text-zinc-400 text-sm mb-4">
              Cada votante pode avaliar cada desenvolvedor
              <strong class="text-amber-400">uma única vez</strong>.
            </p>
            <div class="flex gap-3">
              <input id="voter-name-input" type="text" placeholder="Nome do votante..."
                class="input flex-1"
                onkeydown="if(event.key==='Enter') VotersView.handleAddVoter()" />
              <button onclick="VotersView.handleAddVoter()" class="btn-primary">+ Adicionar</button>
            </div>
          </div>

          ${voters.length > 0 ? `
            <div class="flex items-center gap-2">
              <span class="text-zinc-500 text-sm font-mono">
                ${voters.length} votante${voters.length !== 1 ? 's' : ''} cadastrado${voters.length !== 1 ? 's' : ''}
              </span>
            </div>` : ''}

          ${voters.length === 0
            ? `<div class="empty-state">Nenhum votante cadastrado ainda.</div>`
            : `<div class="panel"><div class="space-y-2">
                ${voters.map(v => renderVoterRow(v, evaluations)).join('')}
               </div></div>`
          }
        </div>
      `;
    } catch (err) {
      content.innerHTML = renderError(err.message);
    }
  }

  function renderVoterRow(voter, evaluations) {
    const count = evaluations.filter(e => e.voter_id === voter.id).length;
    return `
      <div class="dev-row">
        <div class="flex items-center gap-3 flex-1">
          <span class="voter-avatar">${voter.name.charAt(0).toUpperCase()}</span>
          <div>
            <span class="text-zinc-200">${esc(voter.name)}</span>
            <div class="text-xs font-mono mt-0.5 ${count > 0 ? 'text-zinc-500' : 'text-zinc-600'}">
              ${count > 0 ? `${count} avaliação${count > 1 ? 'ões' : ''} realizada${count > 1 ? 's' : ''}` : 'sem avaliações'}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          ${count > 0 ? `<span class="tag-neutral">${count} voto${count > 1 ? 's' : ''}</span>` : ''}
          <button onclick="VotersView.handleDeleteVoter('${voter.id}','${esc(voter.name)}')" class="btn-danger-sm">✕</button>
        </div>
      </div>
    `;
  }

  async function handleAddVoter() {
    const input = document.getElementById('voter-name-input');
    const name = input.value.trim();
    if (!name) return showToast('Digite o nome do votante.', 'warn');
    try {
      setLoading(true);
      await Storage.addVoter(name);
      showToast(`"${name}" cadastrado!`, 'success');
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
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  return { render, handleAddVoter, handleDeleteVoter };
})();
