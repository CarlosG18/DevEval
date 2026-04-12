/**
 * squads.js  v2
 * Gerenciamento de Squads e Desenvolvedores.
 * Novidades: campos de repositório por squad, papel (PO/SM) por dev.
 */

const SquadsView = (() => {

  // Rótulos dos papéis
  const ROLE_LABELS = { po: 'PO', scrum_master: 'SM' };
  const ROLE_COLORS = { po: 'badge-po', scrum_master: 'badge-sm' };

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

          <!-- Form de criação de squad -->
          <div class="panel">
            <h2 class="section-title"><span class="icon-badge">⬡</span> Squads</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <input id="squad-name-input" type="text" placeholder="Nome do squad..."
                class="input sm:col-span-2"
                onkeydown="if(event.key==='Enter') SquadsView.handleAddSquad()" />
              <input id="squad-repo-fe" type="url" placeholder="Repo Frontend (opcional)"
                class="input" />
              <input id="squad-repo-be" type="url" placeholder="Repo Backend (opcional)"
                class="input" />
              <input id="squad-deploy" type="url" placeholder="Link do Deploy (opcional)"
                class="input sm:col-span-2" />
            </div>
            <button onclick="SquadsView.handleAddSquad()" class="btn-primary mt-3">
              + Criar Squad
            </button>
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
    const hasRepos = squad.repo_frontend || squad.repo_backend || squad.deploy_url;

    return `
      <div class="panel squad-card" id="squad-${squad.id}">

        <!-- Cabeçalho -->
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3 flex-wrap">
            <span class="squad-badge">${squad.name.charAt(0).toUpperCase()}</span>
            <h3 class="text-lg font-semibold text-amber-300 font-mono">${esc(squad.name)}</h3>
            <span class="tag-neutral">${devs.length} dev${devs.length !== 1 ? 's' : ''}</span>
          </div>
          <button onclick="SquadsView.handleDeleteSquad('${squad.id}','${esc(squad.name)}')" class="btn-danger-sm mt-0.5">✕</button>
        </div>

        <!-- Links de repositório -->
        ${hasRepos ? `
          <div class="flex flex-wrap gap-2 mb-4">
            ${squad.repo_frontend ? `
              <a href="${safeHref(squad.repo_frontend)}" target="_blank" rel="noopener"
                class="repo-link repo-link-fe">
                <span>⬡</span> Frontend
                <span class="repo-link-arrow">↗</span>
              </a>` : ''}
            ${squad.repo_backend ? `
              <a href="${safeHref(squad.repo_backend)}" target="_blank" rel="noopener"
                class="repo-link repo-link-be">
                <span>◈</span> Backend
                <span class="repo-link-arrow">↗</span>
              </a>` : ''}
            ${squad.deploy_url ? `
              <a href="${safeHref(squad.deploy_url)}" target="_blank" rel="noopener"
                class="repo-link repo-link-deploy">
                <span>▲</span> Deploy
                <span class="repo-link-arrow">↗</span>
              </a>` : ''}
          </div>
        ` : ''}

        <!-- Lista de devs -->
        <div class="space-y-2 mb-4">
          ${devs.length === 0
            ? `<p class="text-zinc-500 text-sm italic">Nenhum desenvolvedor neste squad.</p>`
            : devs.map(renderDevRow).join('')
          }
        </div>

        <!-- Form de adição de dev -->
        <div class="border-t border-zinc-700 pt-4">
          <p class="text-xs text-zinc-400 mb-2 font-mono uppercase tracking-widest">Adicionar Desenvolvedor</p>
          <div class="flex gap-2 flex-wrap">
            <input id="dev-name-${squad.id}" type="text" placeholder="Nome do dev..."
              class="input flex-1 min-w-[140px]"
              onkeydown="if(event.key==='Enter') SquadsView.handleAddDeveloper('${squad.id}')" />
            <select id="dev-type-${squad.id}" class="input w-32">
              <option value="frontend">Frontend</option>
              <option value="backend">Backend</option>
            </select>
            <select id="dev-role-${squad.id}" class="input w-40">
              <option value="">Nenhum papel</option>
              <option value="po">Product Owner (PO)</option>
              <option value="scrum_master">Scrum Master (SM)</option>
            </select>
            <button onclick="SquadsView.handleAddDeveloper('${squad.id}')" class="btn-secondary">
              + Adicionar
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderDevRow(dev) {
    return `
      <div class="dev-row">
        <div class="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
          <span class="dev-type-badge ${dev.type === 'frontend' ? 'badge-fe' : 'badge-be'}">
            ${dev.type === 'frontend' ? 'FE' : 'BE'}
          </span>
          ${dev.role ? `
            <span class="dev-type-badge ${ROLE_COLORS[dev.role]}">
              ${ROLE_LABELS[dev.role]}
            </span>` : ''}
          <span class="text-zinc-200 truncate">${esc(dev.name)}</span>
        </div>
        <button onclick="SquadsView.handleDeleteDeveloper('${dev.id}','${esc(dev.name)}')" class="btn-danger-sm">✕</button>
      </div>
    `;
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleAddSquad() {
    const name      = document.getElementById('squad-name-input').value.trim();
    const repoFe    = document.getElementById('squad-repo-fe').value.trim();
    const repoBack  = document.getElementById('squad-repo-be').value.trim();
    const deployUrl = document.getElementById('squad-deploy').value.trim();

    if (!name) return showToast('Digite o nome do squad.', 'warn');

    try {
      setLoading(true);
      await Storage.addSquad(name, repoFe, repoBack, deployUrl);
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
    const name = document.getElementById(`dev-name-${squadId}`).value.trim();
    const type = document.getElementById(`dev-type-${squadId}`).value;
    const role = document.getElementById(`dev-role-${squadId}`).value;

    if (!name) return showToast('Digite o nome do desenvolvedor.', 'warn');
    try {
      setLoading(true);
      await Storage.addDeveloper(name, squadId, type, role);
      showToast(`${name} adicionado${role ? ` como ${role === 'po' ? 'PO' : 'SM'}` : ''}!`, 'success');
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

  function esc(str) {
    return String(str).replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  /** Para uso em atributos href — só escapa " para não quebrar o atributo */
  function safeHref(url) {
    return String(url || '').replace(/"/g, '%22');
  }

  return { render, handleAddSquad, handleDeleteSquad, handleAddDeveloper, handleDeleteDeveloper };
})();
