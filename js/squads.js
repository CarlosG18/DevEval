/**
 * squads.js
 * View de Squads e Desenvolvedores — refatorada para async/await com Supabase.
 */

const SquadsView = (() => {

  /** Renderiza a view completa */
  async function render() {
    const content = document.getElementById('app-content');
    content.innerHTML = renderSkeleton();

    try {
      const [squads, developers] = await Promise.all([
        Storage.getSquads(),
        Storage.getDevelopers(),
      ]);

      content.innerHTML = `
        <div class="space-y-8">
          <div class="panel">
            <h2 class="section-title"><span class="icon-badge">⬡</span> Squads</h2>
            <div class="flex gap-3 mt-4">
              <input id="squad-name-input" type="text" placeholder="Nome do squad..."
                class="input flex-1"
                onkeydown="if(event.key==='Enter') SquadsView.handleAddSquad()" />
              <button onclick="SquadsView.handleAddSquad()" class="btn-primary">+ Criar Squad</button>
            </div>
          </div>

          ${squads.length === 0
            ? `<div class="empty-state">Nenhum squad criado ainda.</div>`
            : squads.map(s => renderSquadCard(s, developers)).join('')
          }
        </div>
      `;
    } catch (err) {
      content.innerHTML = renderError(err.message);
    }
  }

  function renderSquadCard(squad, allDevelopers) {
    const devs = allDevelopers.filter(d => d.squadId === squad.id);
    return `
      <div class="panel squad-card" id="squad-${squad.id}">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <span class="squad-badge">${squad.name.charAt(0).toUpperCase()}</span>
            <h3 class="text-lg font-semibold text-amber-300 font-mono">${esc(squad.name)}</h3>
            <span class="tag-neutral">${devs.length} dev${devs.length !== 1 ? 's' : ''}</span>
          </div>
          <button onclick="SquadsView.handleDeleteSquad('${squad.id}','${esc(squad.name)}')" class="btn-danger-sm">✕</button>
        </div>

        <div class="space-y-2 mb-4">
          ${devs.length === 0
            ? `<p class="text-zinc-500 text-sm italic">Nenhum desenvolvedor neste squad.</p>`
            : devs.map(renderDevRow).join('')
          }
        </div>

        <div class="border-t border-zinc-700 pt-4">
          <p class="text-xs text-zinc-400 mb-2 font-mono uppercase tracking-widest">Adicionar Desenvolvedor</p>
          <div class="flex gap-2 flex-wrap">
            <input id="dev-name-${squad.id}" type="text" placeholder="Nome do dev..."
              class="input flex-1 min-w-[160px]"
              onkeydown="if(event.key==='Enter') SquadsView.handleAddDeveloper('${squad.id}')" />
            <select id="dev-type-${squad.id}" class="input w-36">
              <option value="frontend">Frontend</option>
              <option value="backend">Backend</option>
            </select>
            <button onclick="SquadsView.handleAddDeveloper('${squad.id}')" class="btn-secondary">+ Adicionar</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderDevRow(dev) {
    return `
      <div class="dev-row">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <span class="dev-type-badge ${dev.type === 'frontend' ? 'badge-fe' : 'badge-be'}">
            ${dev.type === 'frontend' ? 'FE' : 'BE'}
          </span>
          <span class="text-zinc-200 truncate">${esc(dev.name)}</span>
        </div>
        <button onclick="SquadsView.handleDeleteDeveloper('${dev.id}','${esc(dev.name)}')" class="btn-danger-sm">✕</button>
      </div>
    `;
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleAddSquad() {
    const input = document.getElementById('squad-name-input');
    const name = input.value.trim();
    if (!name) return showToast('Digite o nome do squad.', 'warn');
    try {
      setLoading(true);
      await Storage.addSquad(name);
      showToast(`Squad "${name}" criado!`, 'success');
      await render();
    } catch (err) {
      showToast(err.message.includes('unique') ? 'Já existe um squad com este nome.' : err.message, 'warn');
    } finally { setLoading(false); }
  }

  async function handleDeleteSquad(squadId, name) {
    if (!confirm(`Remover squad "${name}" e todos os seus desenvolvedores?`)) return;
    try {
      setLoading(true);
      await Storage.deleteSquad(squadId);
      showToast('Squad removido.', 'info');
      await render();
    } catch (err) {
      showToast(err.message, 'warn');
    } finally { setLoading(false); }
  }

  async function handleAddDeveloper(squadId) {
    const nameInput = document.getElementById(`dev-name-${squadId}`);
    const typeSelect = document.getElementById(`dev-type-${squadId}`);
    const name = nameInput.value.trim();
    if (!name) return showToast('Digite o nome do desenvolvedor.', 'warn');
    try {
      setLoading(true);
      await Storage.addDeveloper(name, squadId, typeSelect.value);
      showToast(`${name} adicionado!`, 'success');
      await render();
    } catch (err) {
      showToast(err.message.includes('unique') ? 'Dev já existe neste squad.' : err.message, 'warn');
    } finally { setLoading(false); }
  }

  async function handleDeleteDeveloper(devId, name) {
    if (!confirm(`Remover "${name}" e todas as suas avaliações?`)) return;
    try {
      setLoading(true);
      await Storage.deleteDeveloper(devId);
      showToast('Desenvolvedor removido.', 'info');
      await render();
    } catch (err) {
      showToast(err.message, 'warn');
    } finally { setLoading(false); }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function esc(str) {
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  return { render, handleAddSquad, handleDeleteSquad, handleAddDeveloper, handleDeleteDeveloper };
})();
