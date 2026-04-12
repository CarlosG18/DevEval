/**
 * storage.js
 * Módulo de persistência — agora usando Supabase como backend.
 * Todos os métodos são assíncronos (retornam Promise).
 */

const Storage = (() => {

  // ── Cliente Supabase ───────────────────────────────────────────────────────
  let _client = null;

  function getClient() {
    if (!_client) {
      if (!SUPABASE_URL || SUPABASE_URL.includes('SEU_PROJETO') ||
          !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('SUA_CHAVE')) {
        throw new Error('CONFIG_MISSING');
      }
      _client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return _client;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  async function run(query) {
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  }

  // ── Squads ────────────────────────────────────────────────────────────────

  async function getSquads() {
    return run(
      getClient().from('squads').select('*').order('created_at', { ascending: true })
    );
  }

  async function addSquad(name) {
    const squad = { id: generateId(), name: name.trim(), created_at: Date.now() };
    await run(getClient().from('squads').insert(squad));
    return squad;
  }

  async function deleteSquad(squadId) {
    await run(getClient().from('squads').delete().eq('id', squadId));
  }

  // ── Developers ────────────────────────────────────────────────────────────

  async function getDevelopers() {
    const rows = await run(
      getClient().from('developers').select('*').order('created_at', { ascending: true })
    );
    // Normaliza snake_case do banco para camelCase esperado pelas views
    return rows.map(r => ({ ...r, squadId: r.squad_id }));
  }

  async function addDeveloper(name, squadId, type) {
    const dev = { id: generateId(), name: name.trim(), squad_id: squadId, type, created_at: Date.now() };
    await run(getClient().from('developers').insert(dev));
    return { ...dev, squadId };
  }

  async function deleteDeveloper(devId) {
    await run(getClient().from('developers').delete().eq('id', devId));
  }

  // ── Voters ────────────────────────────────────────────────────────────────

  async function getVoters() {
    return run(
      getClient().from('voters').select('*').order('created_at', { ascending: true })
    );
  }

  async function addVoter(name) {
    const voter = { id: generateId(), name: name.trim(), created_at: Date.now() };
    await run(getClient().from('voters').insert(voter));
    return voter;
  }

  async function deleteVoter(voterId) {
    await run(getClient().from('voters').delete().eq('id', voterId));
  }

  // ── Evaluations ───────────────────────────────────────────────────────────

  async function getEvaluations() {
    return run(
      getClient().from('evaluations').select('*').order('created_at', { ascending: true })
    );
  }

  async function addEvaluation(developerId, voterId, scores, average) {
    const evaluation = {
      id: generateId(),
      developer_id: developerId,
      voter_id: voterId,
      scores,
      average,
      created_at: Date.now(),
    };
    await run(getClient().from('evaluations').insert(evaluation));
    return evaluation;
  }

  async function getEvaluationsForDeveloper(developerId) {
    return run(
      getClient()
        .from('evaluations')
        .select('*')
        .eq('developer_id', developerId)
        .order('created_at', { ascending: true })
    );
  }

  async function hasVoted(developerId, voterId) {
    const { data } = await getClient()
      .from('evaluations')
      .select('id')
      .eq('developer_id', developerId)
      .eq('voter_id', voterId)
      .maybeSingle();
    return !!data;
  }

  async function getDeveloperAverage(developerId) {
    const evals = await getEvaluationsForDeveloper(developerId);
    if (!evals || !evals.length) return null;
    const sum = evals.reduce((acc, e) => acc + parseFloat(e.average), 0);
    return (sum / evals.length).toFixed(2);
  }

  return {
    generateId, getClient,
    getSquads, addSquad, deleteSquad,
    getDevelopers, addDeveloper, deleteDeveloper,
    getVoters, addVoter, deleteVoter,
    getEvaluations, addEvaluation, getEvaluationsForDeveloper,
    hasVoted, getDeveloperAverage,
  };
})();
