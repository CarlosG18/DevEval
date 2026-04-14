/**
 * app.js
 * Roteador principal — refatorado para async/await com Supabase.
 * Inclui: tela de configuração, loading global, toasts e utilitários globais.
 */

const App = (() => {

  let currentPage = 'squads';

  const views = {
    dashboard:  DashboardView,
    squads:     SquadsView,
    voters:     VotersView,
    evaluation: EvaluationView,
  };

  const navItems = [
    { id: 'dashboard',  label: 'Dashboard',    icon: '◉' },
    { id: 'squads',     label: 'Squads & Devs', icon: '⬡' },
    { id: 'voters',     label: 'Votantes',       icon: '◈' },
    { id: 'evaluation', label: 'Avaliação',       icon: '◎' },
  ];

  async function init() {
    renderNav();

    // Verifica configuração antes de qualquer chamada ao Supabase
    try {
      Storage.getClient(); // lança CONFIG_MISSING se não configurado
      await navigate('dashboard');
    } catch (err) {
      if (err.message === 'CONFIG_MISSING') {
        renderConfigScreen();
      } else {
        renderConnectionError(err.message);
      }
    }
  }

  function renderNav() {
    const nav = document.getElementById('app-nav');
    nav.innerHTML = navItems.map(item => `
      <button id="nav-${item.id}" onclick="App.navigate('${item.id}')" class="nav-btn">
        <span class="nav-icon">${item.icon}</span>
        <span>${item.label}</span>
      </button>
    `).join('');
  }

  async function navigate(page) {
    if (!views[page]) return;
    currentPage = page;
    updateNavState();
    try {
      await views[page].render();
    } catch (err) {
      if (err.message === 'CONFIG_MISSING') {
        renderConfigScreen();
      } else {
        document.getElementById('app-content').innerHTML = renderError(err.message);
      }
    }
  }

  function updateNavState() {
    navItems.forEach(item => {
      const btn = document.getElementById(`nav-${item.id}`);
      if (!btn) return;
      btn.className = `nav-btn ${item.id === currentPage ? 'nav-btn-active' : 'nav-btn-inactive'}`;
    });
  }

  /** Tela exibida quando js/config.js ainda não foi preenchido */
  function renderConfigScreen() {
    document.getElementById('app-content').innerHTML = `
      <div class="panel max-w-xl mx-auto mt-8 border border-amber-900/50">
        <div class="flex items-center gap-3 mb-4">
          <span class="text-2xl">⚙</span>
          <h2 class="text-amber-300 font-semibold font-mono text-lg">Configuração necessária</h2>
        </div>
        <p class="text-zinc-400 text-sm mb-4">
          Preencha suas credenciais do Supabase no arquivo
          <code class="bg-zinc-800 text-amber-400 px-1.5 py-0.5 rounded font-mono text-xs">js/config.js</code>:
        </p>
        <pre class="bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-xs font-mono text-zinc-300 overflow-x-auto mb-4">
const SUPABASE_URL      = 'https://SEU_PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_CHAVE_ANON_AQUI';</pre>
        <p class="text-zinc-500 text-xs">
          Encontre suas credenciais em:
          <strong class="text-zinc-400">Supabase Dashboard → Settings → API</strong>
        </p>
        <div class="mt-4 pt-4 border-t border-zinc-700">
          <p class="text-zinc-500 text-xs mb-1">Ainda não criou o banco? Execute o arquivo:</p>
          <code class="bg-zinc-800 text-amber-400 px-1.5 py-0.5 rounded font-mono text-xs">supabase-schema.sql</code>
          <span class="text-zinc-600 text-xs ml-1">no SQL Editor do Supabase.</span>
        </div>
        <button onclick="location.reload()" class="btn-primary mt-5 w-full">
          Recarregar após configurar
        </button>
      </div>
    `;
  }

  return { init, navigate };
})();

// ── Utilitários globais ────────────────────────────────────────────────────────
// Disponíveis para todos os módulos de view.

/** Skeleton de carregamento */
function renderSkeleton() {
  return `
    <div class="space-y-4 animate-pulse">
      ${[1,2,3].map(() => `
        <div class="panel">
          <div class="h-4 bg-zinc-800 rounded w-1/3 mb-3"></div>
          <div class="h-3 bg-zinc-800 rounded w-2/3 mb-2"></div>
          <div class="h-3 bg-zinc-800 rounded w-1/2"></div>
        </div>`).join('')}
    </div>`;
}

/** Tela de erro de conexão */
function renderError(message) {
  return `
    <div class="panel max-w-lg mx-auto mt-8 border border-red-900/50">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-red-400 text-xl">⚠</span>
        <h3 class="text-red-400 font-mono font-semibold">Erro de conexão</h3>
      </div>
      <p class="text-zinc-400 text-sm mb-3">${message}</p>
      <p class="text-zinc-600 text-xs">Verifique suas credenciais em <code class="text-amber-400">js/config.js</code>
      e confirme que o schema SQL foi executado no Supabase.</p>
      <button onclick="location.reload()" class="btn-secondary mt-4">Tentar novamente</button>
    </div>`;
}

/** Spinner global no header durante operações async */
function setLoading(active) {
  const spinner = document.getElementById('global-spinner');
  if (spinner) spinner.style.display = active ? 'inline-block' : 'none';
}

/** Toast de notificação */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  const classes = { success: 'toast-success', warn: 'toast-warn', info: 'toast-info' };
  const icons   = { success: '✓', warn: '⚠', info: 'ℹ' };

  toast.className = `toast ${classes[type] || classes.info}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-show'));
  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => App.init());
