import {
  aaciim,
  documents,
  history,
  messages,
  pendencies,
  phaseOptions,
  processes,
  roles,
  statusOptions,
  users,
} from './data.js';

const state = {
  userList: [],
  currentUserId: 'usr-paulo',
  route: 'dashboard',
  selectedProcessId: processes[0].id,
  searchTerm: '',
  searchDraft: '',
  activeSearchBox: '',
  mfaVerified: false,
  sessionLocked: false,
  lockReason: '',
  pendingMfaCode: '',
  mfaCodeIssuedAt: '',
  lastActivityAt: Date.now(),
  processList: [],
  pendencyList: [],
  messageList: [],
  documentList: [],
  aaciimList: [],
  historyList: [],
  incidentList: [],
  auditList: [],
  notificationList: [],
  replyToMessageId: '',
  composeMessageWarning: '',
  replyWarning: '',
  documentUploadWarning: '',
  composeSensitiveOverrideReady: false,
  replySensitiveOverrideReady: false,
  documentSensitiveOverrideReady: false,
  composeDraft: {
    processo: '',
    ciclo: 'Ciclo 1',
    destinatario: '',
    tipo: 'Solicitação de ajuste',
    assunto: '',
    mensagem: '',
    gera_pendencia: false,
    tipo_pendencia: 'Documental',
    prazo: '',
    anexo: null,
    anexoNome: '',
    registrar_biblioteca: true,
    tipo_documento_anexo: 'Outro',
  },
  replyDrafts: {},
  documentUploadDraft: {
    processo: '',
    ciclo: 'Ciclo 1',
    tipo_documento: 'Projeto inicial',
    file: null,
    fileName: '',
  },
};

const app = document.querySelector('#app');

const STORAGE_KEY = 'nit-prototype-state-v1';
const today = new Date('2026-04-24T12:00:00');
const todayStr = '2026-04-24';
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

function currentUser() {
  return state.userList.find((user) => user.id === state.currentUserId);
}

function isResearcher(user = currentUser()) {
  return user?.role === 'pesquisador';
}

function viewMode(user = currentUser()) {
  return isResearcher(user) ? 'externa' : 'interna';
}

function availableRoutes(user = currentUser()) {
  if (isResearcher(user)) {
    return ['dashboard', 'processo', 'submissao', 'documentos', 'mensagens', 'notificacoes', 'conta'];
  }
  return ['dashboard', 'processo', 'submissao', 'documentos', 'mensagens', 'notificacoes', 'pendencias', 'relatorios', 'seguranca', 'conta'];
}

function defaultUsers() {
  return structuredClone(users).map((user) => ({
    ...user,
    notificationEmail: user.email,
    notifications: {
      email: true,
      inApp: true,
      dailyDigest: false,
    },
  }));
}

function defaultState() {
  return {
    userList: defaultUsers(),
    processList: structuredClone(processes),
    pendencyList: structuredClone(pendencies),
    messageList: structuredClone(messages),
    documentList: structuredClone(documents),
    aaciimList: structuredClone(aaciim),
    historyList: structuredClone(history),
    incidentList: [],
    auditList: [],
    notificationList: [],
  };
}

function hydrateState() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    const fallback = defaultState();
    Object.assign(state, fallback, saved || {});
    const baselineUsers = defaultUsers();
    const savedUsers = Array.isArray(state.userList) ? state.userList : [];
    state.userList = baselineUsers.map((baseUser) => {
      const existing = savedUsers.find((savedUser) => savedUser.id === baseUser.id);
      return existing ? {
        ...baseUser,
        ...existing,
        notifications: {
          ...baseUser.notifications,
          ...(existing.notifications || {}),
        },
      } : baseUser;
    });
  } catch {
    Object.assign(state, defaultState());
  }
}

function persistState() {
  const payload = {
    userList: state.userList,
    processList: state.processList,
    pendencyList: state.pendencyList,
    messageList: state.messageList,
    documentList: state.documentList,
    aaciimList: state.aaciimList,
    historyList: state.historyList,
    incidentList: state.incidentList,
    auditList: state.auditList,
    notificationList: state.notificationList,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function nowLabel() {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date());
}

function auditTimestamp() {
  return `${todayStr} ${nowLabel()}`;
}

function addAuditEntry(action, detail, context = {}) {
  state.auditList = [
    {
      Auditoria_ID: `aud-${state.auditList.length + 1}`,
      DataHora: auditTimestamp(),
      Usuario_ID: currentUser().id,
      Usuario_Nome: currentUser().name,
      Acao: action,
      Detalhe: detail,
      ProcessoNIT_ID: context.ProcessoNIT_ID || '',
      Rota: state.route,
    },
    ...state.auditList,
  ];
}

function createNotification({
  title,
  detail,
  recipientId = currentUser().id,
  ProcessoNIT_ID = '',
  route = 'notificacoes',
  kind = 'info',
}) {
  state.notificationList = [
    {
      Notificacao_ID: `notif-${state.notificationList.length + 1}`,
      title,
      detail,
      recipientId,
      ProcessoNIT_ID,
      route,
      kind,
      date: todayStr,
      time: nowLabel(),
      read: false,
    },
    ...state.notificationList,
  ];
}

function visibleNotifications(user = currentUser()) {
  return state.notificationList.filter((item) => item.recipientId === user.id);
}

function unreadNotificationCount(user = currentUser()) {
  return visibleNotifications(user).filter((item) => !item.read).length;
}

function markNotificationRead(notificationId) {
  state.notificationList = state.notificationList.map((item) =>
    item.Notificacao_ID === notificationId ? { ...item, read: true } : item
  );
  persistState();
  render();
}

function markAllNotificationsRead() {
  const userId = currentUser().id;
  state.notificationList = state.notificationList.map((item) =>
    item.recipientId === userId ? { ...item, read: true } : item
  );
  persistState();
  render();
}

function detectSensitiveSignals(values) {
  const joined = values
    .filter(Boolean)
    .map((value) => String(value))
    .join(' ')
    .toLocaleLowerCase('pt-BR');

  const patterns = [
    { label: 'senha', regex: /\bsenha\b/ },
    { label: 'token', regex: /\btoken\b/ },
    { label: 'código MFA', regex: /\bmfa\b|\bcodigo\b|\bcódigo\b/ },
    { label: 'CPF', regex: /\bcpf\b|\d{3}\.?\d{3}\.?\d{3}-?\d{2}/ },
    { label: 'credencial', regex: /\bcredencial\b|\blogin\b/ },
    { label: 'chave de API', regex: /\bapi key\b|\bapi-key\b|\bsecret\b|\bchave\b/ },
  ];

  return patterns.filter((pattern) => pattern.regex.test(joined)).map((pattern) => pattern.label);
}

function buildSensitiveWarning(values, channel) {
  const hits = detectSensitiveSignals(values);
  if (!hits.length) return null;
  const message = `Possível dado sensível detectado em ${channel}: ${hits.join(', ')}. Remova esse conteúdo antes de continuar no protótipo.`;
  return { message, hits };
}

function guardSensitiveSubmission(values, channel, onFailure = null) {
  const warning = buildSensitiveWarning(values, channel);
  if (!warning) return true;
  if (typeof onFailure === 'function') {
    onFailure(warning.message, warning.hits);
  } else {
    window.alert(warning.message);
  }
  return false;
}

function touchActivity() {
  state.lastActivityAt = Date.now();
}

function beginFreshSession(message = 'Validação MFA obrigatória para acessar o protótipo.') {
  state.mfaVerified = false;
  state.sessionLocked = false;
  state.lockReason = message;
  state.pendingMfaCode = '';
  state.mfaCodeIssuedAt = '';
  touchActivity();
}

function lockSession(reason = 'Sessão bloqueada por segurança. Faça nova validação MFA.') {
  state.mfaVerified = false;
  state.sessionLocked = true;
  state.lockReason = reason;
  state.pendingMfaCode = '';
  state.mfaCodeIssuedAt = '';
  addAuditEntry('Bloqueio de sessão', reason);
  render();
}

function switchUser(userId) {
  state.currentUserId = userId;
  const first = visibleProcesses()[0];
  state.selectedProcessId = first?.id || state.selectedProcessId;
  state.route = 'dashboard';
  beginFreshSession('Troca de perfil detectada. Faça nova validação MFA.');
  render();
}

function issueMfaCode() {
  state.pendingMfaCode = String(Math.floor(100000 + Math.random() * 900000));
  state.mfaCodeIssuedAt = nowLabel();
  state.lockReason = state.sessionLocked
    ? 'Sessão bloqueada. Informe o novo código MFA para desbloquear.'
    : 'Código MFA gerado para esta sessão.';
  render();
}

function validateMfa(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const code = String(form.get('codigo') || '').trim();
  if (!state.pendingMfaCode) {
    state.lockReason = 'Gere um código MFA antes de validar.';
    render();
    return;
  }
  if (code !== state.pendingMfaCode) {
    state.lockReason = 'Código MFA inválido. Gere um novo código e tente novamente.';
    state.pendingMfaCode = '';
    state.mfaCodeIssuedAt = '';
    render();
    return;
  }
  state.mfaVerified = true;
  state.sessionLocked = false;
  state.lockReason = '';
  state.pendingMfaCode = '';
  state.mfaCodeIssuedAt = '';
  touchActivity();
  render();
}

function maybeLockForInactivity() {
  if (!state.mfaVerified || state.sessionLocked) return;
  if (Date.now() - state.lastActivityAt < SESSION_TIMEOUT_MS) return;
  lockSession('Sessão bloqueada por inatividade. Refaça a validação MFA para continuar.');
}

function installSecurityWatchers() {
  ['click', 'keydown', 'touchstart'].forEach((eventName) => {
    window.addEventListener(eventName, () => {
      if (state.mfaVerified && !state.sessionLocked) touchActivity();
    }, { passive: true });
  });
  window.setInterval(maybeLockForInactivity, 10000);
}

function userName(id) {
  return state.userList.find((user) => user.id === id)?.name || 'Não atribuído';
}

function roleLabel(role) {
  if (['nit', 'coordenador', 'admin'].includes(role)) return 'NIT';
  if (role === 'juridico') return 'Jurídico';
  if (role === 'secretaria') return 'Secretaria/Coordenação';
  return roles[role] || 'Equipe interna';
}

function displayActorName(id, viewer = currentUser()) {
  const user = state.userList.find((item) => item.id === id);
  if (!user) return 'Não atribuído';
  if (!isResearcher(viewer)) return user.name;
  if (user.role === 'pesquisador') return user.name;
  return roleLabel(user.role);
}

function sanitizeForResearcher(text) {
  if (!isResearcher() || !text) return text;
  return String(text)
    .replaceAll('Marina Costa', 'NIT')
    .replaceAll('Ricardo Alves', 'NIT')
    .replaceAll('Paulo Mendes', 'NIT')
    .replaceAll('Lívia Fernandes', 'Jurídico')
    .replaceAll('Carla Nogueira', 'Secretaria/Coordenação');
}

function internalRouteForProcess(process) {
  if (!process) return '';
  if (process.Fase_Atual.includes('Ciclo 2')) return process.Juridico_Atribuido_ID || process.Responsavel_Atual_ID || 'usr-paulo';
  if (process.Fase_Atual.includes('Ciclo 3')) return process.Responsavel_Atual_ID || 'usr-carla' || 'usr-paulo';
  return process.MembroNIT_Atribuido_ID || process.Responsavel_Atual_ID || 'usr-paulo';
}

function maskedResponsibleLabel(process, viewer = currentUser()) {
  const responsible = state.userList.find((user) => user.id === process.Responsavel_Atual_ID);
  if (!responsible) return 'Não atribuído';
  if (!isResearcher(viewer)) return responsible.name;
  return roleLabel(responsible.role);
}

function canViewProcess(process, user = currentUser()) {
  if (['admin', 'coordenador'].includes(user.role)) return true;
  if (user.role === 'pesquisador') return process.Pesquisador_ID === user.id;
  if (user.role === 'juridico') return process.Juridico_Atribuido_ID === user.id;
  if (user.role === 'nit') return process.MembroNIT_Atribuido_ID === user.id;
  if (user.role === 'secretaria') return ['Ciclo 3 - Dissertação Final', 'Concluído'].includes(process.Fase_Atual);
  return false;
}

function canEditGlobalStatus(user = currentUser()) {
  return ['admin', 'coordenador'].includes(user.role);
}

function canExportReports(user = currentUser()) {
  return ['admin', 'coordenador'].includes(user.role);
}

function canCreateMessage(user = currentUser()) {
  return ['pesquisador', 'nit', 'coordenador', 'juridico', 'secretaria', 'admin'].includes(user.role);
}

function canManagePendency(pendency, user = currentUser()) {
  if (!pendency) return false;
  return ['admin', 'coordenador'].includes(user.role) || pendency.Responsavel_Resposta_ID === user.id;
}

function canUploadForProcess(process, user = currentUser()) {
  if (!process) return false;
  if (['admin', 'coordenador'].includes(user.role)) return true;
  if (user.role === 'pesquisador') return process.Pesquisador_ID === user.id;
  if (user.role === 'nit') return process.MembroNIT_Atribuido_ID === user.id;
  if (user.role === 'juridico') return process.Juridico_Atribuido_ID === user.id || process.Fase_Atual.includes('Ciclo 2');
  if (user.role === 'secretaria') return process.Fase_Atual.includes('Ciclo 3') || process.Fase_Atual === 'Concluído';
  return false;
}

function processByFunctionalId(ProcessoNIT_ID) {
  return state.processList.find((item) => item.ProcessoNIT_ID === ProcessoNIT_ID);
}

function messageById(messageId) {
  return state.messageList.find((message) => message.Mensagem_ID === messageId) || null;
}

function composeDefaults(allowedIds = [], visibleUsers = []) {
  const defaultProcess = allowedIds[0] || '';
  const routedProcess = defaultProcess ? processByFunctionalId(defaultProcess) : null;
  return {
    processo: defaultProcess,
    ciclo: 'Ciclo 1',
    destinatario: isResearcher() ? internalRouteForProcess(routedProcess) : (visibleUsers[0]?.id || ''),
    tipo: 'Solicitação de ajuste',
    assunto: '',
    mensagem: '',
    gera_pendencia: false,
    tipo_pendencia: 'Documental',
    prazo: '',
    anexo: null,
    anexoNome: '',
    registrar_biblioteca: true,
    tipo_documento_anexo: 'Outro',
  };
}

function ensureComposeDraft(allowedIds = [], visibleUsers = []) {
  const defaults = composeDefaults(allowedIds, visibleUsers);
  state.composeDraft = {
    ...defaults,
    ...state.composeDraft,
    processo: state.composeDraft.processo || defaults.processo,
    destinatario: state.composeDraft.destinatario || defaults.destinatario,
  };
  if (isResearcher()) {
    const selectedProcess = processByFunctionalId(state.composeDraft.processo);
    state.composeDraft.destinatario = internalRouteForProcess(selectedProcess);
  }
}

function documentUploadDefaults(uploadableProcesses = []) {
  return {
    processo: uploadableProcesses[0]?.ProcessoNIT_ID || '',
    ciclo: 'Ciclo 1',
    tipo_documento: documentTypeOptions()[0],
    file: null,
    fileName: '',
  };
}

function ensureDocumentUploadDraft(uploadableProcesses = []) {
  const defaults = documentUploadDefaults(uploadableProcesses);
  state.documentUploadDraft = {
    ...defaults,
    ...state.documentUploadDraft,
    processo: state.documentUploadDraft.processo || defaults.processo,
  };
}

function replySubjectFor(message) {
  return message.Assunto.startsWith('Re:') ? message.Assunto : `Re: ${message.Assunto}`;
}

function ensureReplyDraft(message) {
  if (!message || state.replyDrafts[message.Mensagem_ID]) return;
  state.replyDrafts[message.Mensagem_ID] = {
    assunto: replySubjectFor(message),
    mensagem: '',
    anexo: null,
    anexoNome: '',
    registrar_biblioteca: true,
    tipo_documento_anexo: 'Outro',
  };
}

function activeNitTaskCount(memberId) {
  return state.processList.filter((process) =>
    process.MembroNIT_Atribuido_ID === memberId &&
    !['Concluído', 'Arquivado'].includes(process.Fase_Atual)
  ).length;
}

function lateNitTaskCount(memberId) {
  return state.processList.filter((process) =>
    process.MembroNIT_Atribuido_ID === memberId &&
    !['Concluído', 'Arquivado'].includes(process.Fase_Atual) &&
    isLate(process)
  ).length;
}

function nitCapacityStats() {
  return state.userList
    .filter((user) => user.role === 'nit')
    .map((member) => {
      const active = activeNitTaskCount(member.id);
      const late = lateNitTaskCount(member.id);
      const rate = active ? Math.round((late / active) * 100) : 0;
      return {
        id: member.id,
        name: member.name,
        active,
        late,
        rate,
      };
    })
    .sort((left, right) => {
      if (left.active !== right.active) return left.active - right.active;
      if (left.late !== right.late) return left.late - right.late;
      return left.name.localeCompare(right.name, 'pt-BR');
    });
}

function pickLowestLoadNitMember() {
  const nitMembers = state.userList.filter((user) => user.role === 'nit');
  if (!nitMembers.length) return null;
  return [...nitMembers]
    .sort((left, right) => {
      const loadDiff = activeNitTaskCount(left.id) - activeNitTaskCount(right.id);
      if (loadDiff !== 0) return loadDiff;
      return left.name.localeCompare(right.name, 'pt-BR');
    })[0];
}

function registerMessageAttachmentAsDocument({
  ProcessoNIT_ID,
  Ciclo,
  Tipo_Documento,
  file,
  origemMensagemId,
}) {
  if (!(file instanceof File) || !file.name) return;
  const existingVersions = documentVersions(ProcessoNIT_ID, Tipo_Documento);
  const nextVersion = (existingVersions[0]?.Versao || 0) + 1;
  const replacedDocId = existingVersions[0]?.Documento_ID;

  state.documentList = state.documentList.map((doc) =>
    doc.Documento_ID === replacedDocId ? { ...doc, Status_Documento: 'Substituído' } : doc
  );

  state.documentList = [
    {
      Documento_ID: `doc-${state.documentList.length + 1}`,
      ProcessoNIT_ID,
      Tipo_Documento,
      Ciclo,
      Nome_Arquivo: file.name,
      Versao: nextVersion,
      Status_Documento: nextVersion > 1 ? 'Submetido' : 'Em análise',
      Data_Upload: todayStr,
      EnviadoPor_ID: currentUser().id,
      Tamanho_Arquivo: file.size,
      MimeType: file.type || 'application/octet-stream',
      Origem: 'Mensagem',
      Origem_Mensagem_ID: origemMensagemId,
    },
    ...state.documentList,
  ];

  addHistoryItem(
    ProcessoNIT_ID,
    nextVersion > 1 ? 'Nova versão documental via mensagem' : 'Documento registrado via mensagem',
    `${Tipo_Documento} ${nextVersion > 1 ? `atualizado para v${nextVersion}` : 'registrado'} a partir da mensagem ${origemMensagemId}.`
  );
}

function canGenerateAi(process, user = currentUser()) {
  return ['nit', 'coordenador', 'admin'].includes(user.role) && canViewProcess(process, user);
}

function canAssignNitMember(user = currentUser()) {
  return ['coordenador', 'admin'].includes(user.role);
}

function canIssueInitialOpinion(process, user = currentUser()) {
  return ['nit', 'coordenador', 'admin'].includes(user.role)
    && canViewProcess(process, user)
    && (!process.MembroNIT_Atribuido_ID || process.MembroNIT_Atribuido_ID === user.id || ['coordenador', 'admin'].includes(user.role));
}

function visibleProcesses() {
  return state.processList.filter((process) => canViewProcess(process) && matchesProcessSearch(process));
}

function selectedProcess() {
  const visible = visibleProcesses();
  return visible.find((process) => process.id === state.selectedProcessId) || visible[0] || null;
}

function processPendencyCount(processId) {
  return state.pendencyList.filter((pendency) => pendency.ProcessoNIT_ID === processId && ['Aberta', 'Reaberta'].includes(pendency.Status_Pendencia)).length;
}

function unreadMessageCount(processId) {
  return state.messageList.filter((message) => message.ProcessoNIT_ID === processId && !message.Lida).length;
}

function unreadInboxCount(user = currentUser()) {
  const visibleIds = visibleProcesses().map((process) => process.ProcessoNIT_ID);
  return state.messageList.filter((message) =>
    message.Destinatario_ID === user.id &&
    !message.Lida &&
    visibleIds.includes(message.ProcessoNIT_ID)
  ).length;
}

function daysBetween(start, end) {
  const delta = new Date(end) - new Date(start);
  return Math.max(1, Math.round(delta / 86400000));
}

function deadlineForCurrentPhase(process) {
  if (process.Fase_Atual.includes('Ciclo 1')) return process.Data_Limite_Ciclo1;
  if (process.Fase_Atual.includes('Ciclo 2')) return process.Data_Limite_Ciclo2;
  if (process.Fase_Atual.includes('Ciclo 3')) return process.Data_Limite_Ciclo3;
  return process.Data_Ultima_Atualizacao;
}

function isLate(process) {
  const deadline = new Date(`${deadlineForCurrentPhase(process)}T23:59:00`);
  return !['Concluído', 'Arquivado'].includes(process.Fase_Atual) && deadline < today;
}

function metricData() {
  const visible = visibleProcesses();
  const openPendencies = state.pendencyList.filter((pendency) =>
    visible.some((process) => process.ProcessoNIT_ID === pendency.ProcessoNIT_ID) &&
    ['Aberta', 'Reaberta'].includes(pendency.Status_Pendencia)
  );
  const late = visible.filter(isLate);
  const certificates = visible.filter((process) => process.CertificadoFinal_Numero);
  const averageCycleDays = visible.length
    ? Math.round(visible.reduce((sum, process) => sum + daysBetween(process.Data_Abertura_Processo, process.Data_Ultima_Atualizacao), 0) / visible.length)
    : 0;
  const rework = state.documentList.filter((doc) => doc.Versao > 1 || doc.Status_Documento === 'Substituído').length;

  return { visible, openPendencies, late, certificates, averageCycleDays, rework };
}

function normalizedSearch() {
  return state.searchTerm.trim().toLocaleLowerCase('pt-BR');
}

function applySearch(extraClass = state.activeSearchBox) {
  state.searchTerm = state.searchDraft;
  state.activeSearchBox = extraClass;
  const first = visibleProcesses()[0];
  if (first && !visibleProcesses().some((process) => process.id === state.selectedProcessId)) {
    state.selectedProcessId = first.id;
  }
  render();
}

function searchableText(values) {
  return values
    .filter((value) => value !== null && value !== undefined)
    .join(' ')
    .toLocaleLowerCase('pt-BR');
}

function textMatches(values) {
  const term = normalizedSearch();
  if (!term) return true;
  return searchableText(values).includes(term);
}

function matchesProcessSearch(process) {
  return textMatches([
    process.ProcessoNIT_ID,
    process.Titulo_Projeto,
    process.Resumo_Projeto,
    process.Pesquisador_Nome,
    process.Orientador_Nome,
    process.Programa_Curso,
    process.Tipo_ProdutoTecnico,
    process.Fase_Atual,
    process.Status_Atual,
    process.ParecerInicial_Numero,
    process.CertificadoFinal_Numero,
    maskedResponsibleLabel(process),
  ]);
}

function matchesDocumentSearch(doc) {
  const process = state.processList.find((item) => item.ProcessoNIT_ID === doc.ProcessoNIT_ID);
  const originMessage = doc.Origem_Mensagem_ID ? messageById(doc.Origem_Mensagem_ID) : null;
  return textMatches([
    doc.ProcessoNIT_ID,
    doc.Tipo_Documento,
    doc.Ciclo,
    doc.Nome_Arquivo,
    doc.Versao,
    doc.Status_Documento,
    displayActorName(doc.EnviadoPor_ID),
    doc.Origem,
    originMessage?.Assunto,
    doc.Origem_Mensagem_ID,
    process?.Titulo_Projeto,
    process?.Pesquisador_Nome,
  ]);
}

function matchesMessageSearch(message) {
  const process = state.processList.find((item) => item.ProcessoNIT_ID === message.ProcessoNIT_ID);
  return textMatches([
    message.ProcessoNIT_ID,
    message.Ciclo,
    message.Tipo_Mensagem,
    message.Assunto,
    message.Corpo_Mensagem,
    displayActorName(message.Remetente_ID),
    displayActorName(message.Destinatario_ID),
    process?.Titulo_Projeto,
    process?.Pesquisador_Nome,
  ]);
}

function matchesPendencySearch(pendency) {
  const process = state.processList.find((item) => item.ProcessoNIT_ID === pendency.ProcessoNIT_ID);
  return textMatches([
    pendency.ProcessoNIT_ID,
    pendency.Ciclo,
    pendency.Tipo_Pendencia,
    pendency.Descricao_Pendencia,
    pendency.Status_Pendencia,
    displayActorName(pendency.Responsavel_Resposta_ID),
    process?.Titulo_Projeto,
    process?.Pesquisador_Nome,
  ]);
}

function formatDate(date) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
}

function nextProcessNumber() {
  const year = today.getFullYear();
  const numbers = state.processList
    .map((process) => process.ProcessoNIT_ID)
    .filter((id) => id.startsWith(`NIT-${year}-`))
    .map((id) => Number(id.split('-').at(-1)));
  const next = Math.max(0, ...numbers) + 1;
  return `NIT-${year}-${String(next).padStart(4, '0')}`;
}

function nextSequentialId(prefix, fieldName) {
  const year = today.getFullYear();
  const numbers = state.processList
    .map((process) => process[fieldName])
    .filter(Boolean)
    .filter((id) => id.startsWith(`${prefix}-${year}-`))
    .map((id) => Number(id.split('-').at(-1)));
  const next = Math.max(0, ...numbers) + 1;
  return `${prefix}-${year}-${String(next).padStart(4, '0')}`;
}

function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'value') node.value = value;
    else if (key === 'checked') node.checked = Boolean(value);
    else if (key === 'selected') node.selected = Boolean(value);
    else if (value !== false && value !== null && value !== undefined) node.setAttribute(key, value === true ? '' : value);
  });
  children.forEach((child) => {
    if (child === null || child === undefined) return;
    node.append(child.nodeType ? child : document.createTextNode(child));
  });
  return node;
}

function icon(name) {
  const map = {
    dashboard: '◆',
    process: '▣',
    submit: '+',
    docs: '□',
    messages: '✉',
    notifications: '◉',
    pendencies: '!',
    reports: '▥',
    security: '⛨',
    account: '⚙',
    user: '●',
    pdf: 'PDF',
    ai: 'AI',
  };
  return h('span', { class: `icon ${name}`, text: map[name] || '•', title: name });
}

function setRoute(route) {
  state.route = route;
  render();
}

function selectProcess(id) {
  state.selectedProcessId = id;
  state.route = 'processo';
  render();
}

function updateProcess(id, patch) {
  const before = state.processList.find((process) => process.id === id);
  state.processList = state.processList.map((process) =>
    process.id === id ? { ...process, ...patch, Data_Ultima_Atualizacao: todayStr } : process
  );
  const after = state.processList.find((process) => process.id === id);
  if (before && after && (before.Fase_Atual !== after.Fase_Atual || before.Status_Atual !== after.Status_Atual)) {
    addAuditEntry(
      'Atualização de fase/status',
      `${after.ProcessoNIT_ID} mudou para ${after.Fase_Atual} / ${after.Status_Atual}.`,
      { ProcessoNIT_ID: after.ProcessoNIT_ID }
    );
  }
  persistState();
  render();
}

function addHistoryItem(ProcessoNIT_ID, label, detail) {
  state.historyList = [
    { ProcessoNIT_ID, date: todayStr, label, detail },
    ...state.historyList,
  ];
}

function upsertAaciimRecord(ProcessoNIT_ID, patch) {
  const existing = state.aaciimList.find((item) => item.ProcessoNIT_ID === ProcessoNIT_ID);
  if (existing) {
    state.aaciimList = state.aaciimList.map((item) => item.ProcessoNIT_ID === ProcessoNIT_ID ? { ...item, ...patch } : item);
    return;
  }
  state.aaciimList = [{ ProcessoNIT_ID, ...patch }, ...state.aaciimList];
}

function cycleLabelFromPhase(phase) {
  if (phase.includes('Ciclo 1')) return 'Ciclo 1';
  if (phase.includes('Ciclo 2')) return 'Ciclo 2';
  if (phase.includes('Ciclo 3')) return 'Ciclo 3';
  return 'Ciclo 1';
}

function documentTypeOptions() {
  return [
    'Projeto inicial',
    'Contrato de Convênio Acadêmico',
    'Contrato de Prestação de Serviço',
    'Termo Aditivo ao Contrato',
    'Termo de Cessão de Direito',
    'Dissertação final',
    'Produto técnico final',
    'Parecer inicial',
    'Certificado final',
    'Outro',
  ];
}

function createMessage({
  ProcessoNIT_ID,
  Ciclo,
  Destinatario_ID,
  Tipo_Mensagem,
  Assunto,
  Corpo_Mensagem,
  Gera_Pendencia = false,
  Prazo_Resposta = '',
  Tipo_Pendencia = 'Técnica',
  Mensagem_Pai_ID = '',
  Anexo = null,
  RegistrarBiblioteca = false,
  TipoDocumentoAnexo = 'Outro',
}) {
  const process = processByFunctionalId(ProcessoNIT_ID);
  if (!process) return;
  const messageId = `msg-${state.messageList.length + 1}`;
  let pendenciaId = '';

  if (Gera_Pendencia) {
    pendenciaId = `pend-${state.pendencyList.length + 1}`;
    state.pendencyList = [
      {
        Pendencia_ID: pendenciaId,
        ProcessoNIT_ID,
        Ciclo,
        Tipo_Pendencia,
        Descricao_Pendencia: Corpo_Mensagem,
        Prazo_Resposta: Prazo_Resposta || todayStr,
        Status_Pendencia: 'Aberta',
        Responsavel_Resposta_ID: Destinatario_ID,
        Critica: Tipo_Pendencia === 'Jurídica' || Tipo_Pendencia === 'Documental',
      },
      ...state.pendencyList,
    ];
    addHistoryItem(ProcessoNIT_ID, 'Pendência criada', `${Tipo_Pendencia} aberta para ${displayActorName(Destinatario_ID)}.`);
    addAuditEntry('Abertura de pendência', `${pendenciaId} criada a partir de mensagem.`, { ProcessoNIT_ID });
    createNotification({
      title: 'Nova pendência vinculada',
      detail: `A comunicação "${Assunto}" abriu a pendência ${pendenciaId}.`,
      recipientId: Destinatario_ID,
      ProcessoNIT_ID,
      route: 'pendencias',
      kind: 'alert',
    });
  }

  const attachmentMeta = Anexo instanceof File && Anexo.name
    ? {
        name: Anexo.name,
        size: Anexo.size,
        type: Anexo.type || 'application/octet-stream',
        registeredInLibrary: RegistrarBiblioteca,
        documentType: TipoDocumentoAnexo,
      }
    : null;

  state.messageList = [
    {
      Mensagem_ID: messageId,
      ProcessoNIT_ID,
      Ciclo,
      Remetente_ID: currentUser().id,
      Destinatario_ID,
      Tipo_Mensagem,
      Assunto,
      Corpo_Mensagem,
      Data_Envio: todayStr,
      Lida: false,
      Pendencia_ID: pendenciaId,
      Mensagem_Pai_ID,
      Anexo: attachmentMeta,
    },
    ...state.messageList,
  ];

  if (attachmentMeta && RegistrarBiblioteca) {
    registerMessageAttachmentAsDocument({
      ProcessoNIT_ID,
      Ciclo,
      Tipo_Documento: TipoDocumentoAnexo,
      file: Anexo,
      origemMensagemId: messageId,
    });
    addAuditEntry('Documento registrado via mensagem', `${Anexo.name} registrado também na biblioteca.`, { ProcessoNIT_ID });
  }

  addHistoryItem(ProcessoNIT_ID, Mensagem_Pai_ID ? 'Resposta enviada' : 'Mensagem enviada', `${Tipo_Mensagem}: ${Assunto}.`);
  addAuditEntry(Mensagem_Pai_ID ? 'Resposta enviada' : 'Mensagem enviada', `${Assunto} para ${displayActorName(Destinatario_ID)}.`, { ProcessoNIT_ID });
  createNotification({
    title: Mensagem_Pai_ID ? 'Nova resposta recebida' : 'Nova mensagem recebida',
    detail: `${displayActorName(currentUser().id, state.userList.find((user) => user.id === Destinatario_ID))} enviou: ${Assunto}.`,
    recipientId: Destinatario_ID,
    ProcessoNIT_ID,
    route: 'mensagens',
    kind: 'message',
  });
  persistState();
}

function latestDocuments(list) {
  const grouped = new Map();
  list.forEach((doc) => {
    const key = `${doc.ProcessoNIT_ID}::${doc.Tipo_Documento}`;
    const current = grouped.get(key);
    if (!current || doc.Versao > current.Versao) grouped.set(key, doc);
  });
  return [...grouped.values()].sort((a, b) => new Date(`${b.Data_Upload}T12:00:00`) - new Date(`${a.Data_Upload}T12:00:00`));
}

function documentVersions(ProcessoNIT_ID, Tipo_Documento) {
  return state.documentList
    .filter((doc) => doc.ProcessoNIT_ID === ProcessoNIT_ID && doc.Tipo_Documento === Tipo_Documento)
    .sort((a, b) => b.Versao - a.Versao);
}

function uploadDocument(event, forceSensitiveOverride = false) {
  if (event?.preventDefault) event.preventDefault();
  const form = event?.currentTarget || document.querySelector('[data-document-upload-form]');
  const draft = state.documentUploadDraft;
  const ProcessoNIT_ID = draft.processo;
  const process = processByFunctionalId(ProcessoNIT_ID);
  if (!process || !canUploadForProcess(process)) return;
  const file = draft.file;
  if (!(file instanceof File) || !file.name) return;

  const sensitivity = buildSensitiveWarning([draft.fileName, draft.tipo_documento, process.Titulo_Projeto], 'upload documental');
  if (sensitivity && !forceSensitiveOverride) {
    state.documentUploadWarning = `${sensitivity.message} Se o documento for essencial para a tramitação, revise ou use "Enviar mesmo assim".`;
    state.documentSensitiveOverrideReady = true;
    render();
    return;
  }

  const Tipo_Documento = draft.tipo_documento;
  const existingVersions = documentVersions(ProcessoNIT_ID, Tipo_Documento);
  const nextVersion = (existingVersions[0]?.Versao || 0) + 1;
  const replacedDocId = existingVersions[0]?.Documento_ID;

  state.documentList = state.documentList.map((doc) =>
    doc.Documento_ID === replacedDocId ? { ...doc, Status_Documento: 'Substituído' } : doc
  );

  state.documentList = [
    {
      Documento_ID: `doc-${state.documentList.length + 1}`,
      ProcessoNIT_ID,
      Tipo_Documento,
      Ciclo: draft.ciclo,
      Nome_Arquivo: file.name,
      Versao: nextVersion,
      Status_Documento: nextVersion > 1 ? 'Submetido' : 'Em análise',
      Data_Upload: todayStr,
      EnviadoPor_ID: currentUser().id,
      Tamanho_Arquivo: file.size,
      MimeType: file.type || 'application/octet-stream',
      SensivelConfirmado: Boolean(sensitivity),
    },
    ...state.documentList,
  ];

  addHistoryItem(
    ProcessoNIT_ID,
    nextVersion > 1 ? 'Nova versão documental' : 'Documento enviado',
    `${Tipo_Documento} ${nextVersion > 1 ? `atualizado para v${nextVersion}` : 'enviado'} por ${displayActorName(currentUser().id)}.`
  );
  addAuditEntry(
    nextVersion > 1 ? 'Nova versão documental' : 'Upload documental',
    `${file.name} registrado em ${ProcessoNIT_ID}${sensitivity ? ' com confirmação consciente de dado sensível' : ''}.`,
    { ProcessoNIT_ID }
  );
  state.documentUploadWarning = '';
  state.documentSensitiveOverrideReady = false;
  state.documentUploadDraft = documentUploadDefaults(visibleProcesses().filter((item) => canUploadForProcess(item)));
  persistState();
  if (form?.reset) form.reset();
  render();
}

function assignNitMember(processId, memberId) {
  const process = state.processList.find((item) => item.id === processId);
  if (!process || !canAssignNitMember()) return;
  const wasAssigned = Boolean(process.MembroNIT_Atribuido_ID);
  updateProcess(processId, {
    MembroNIT_Atribuido_ID: memberId,
    Responsavel_Atual_ID: memberId,
    Status_Atual: 'Em triagem',
  });
  addHistoryItem(
    process.ProcessoNIT_ID,
    wasAssigned ? 'Redirecionamento NIT' : 'Atribuição NIT',
    `Processo ${wasAssigned ? 'redirecionado' : 'atribuído'} para ${userName(memberId)} para avaliação inicial.`
  );
  addAuditEntry(wasAssigned ? 'Redirecionamento NIT' : 'Atribuição NIT', `${process.ProcessoNIT_ID} -> ${userName(memberId)}.`, { ProcessoNIT_ID: process.ProcessoNIT_ID });
  createNotification({
    title: wasAssigned ? 'Processo redirecionado para você' : 'Novo processo atribuído',
    detail: `${process.ProcessoNIT_ID} foi ${wasAssigned ? 'redirecionado' : 'atribuído'} para sua fila de trabalho.`,
    recipientId: memberId,
    ProcessoNIT_ID: process.ProcessoNIT_ID,
    route: 'processo',
    kind: 'task',
  });
  persistState();
  render();
}

function generateAiAnalysis(processId) {
  const process = state.processList.find((item) => item.id === processId);
  if (!process || !canGenerateAi(process)) return;
  const base = Math.min(9.4, Math.max(6.1, process.Resumo_Projeto.length / 45));
  const scores = {
    GPT_Aderencia: Number((base + 0.2).toFixed(1)),
    GPT_Aplicabilidade: Number((base + 0.4).toFixed(1)),
    GPT_Complexidade: Number((base - 0.7).toFixed(1)),
    GPT_Inovacao: Number((base + 0.1).toFixed(1)),
    GPT_Impacto: Number((base + 0.3).toFixed(1)),
  };
  const recommendation = scores.GPT_Aderencia >= 8 ? 'Favorável com ajustes' : 'Favorável';
  upsertAaciimRecord(process.ProcessoNIT_ID, {
    PreAnaliseGPT_Gerada: true,
    ...scores,
    GPT_SinteseAnalitica: `Análise preliminar do arquivo do projeto indica boa aderência institucional e potencial de aplicação em ${process.Programa_Curso}.`,
    GPT_PontosFortes: `Clareza do problema, vínculo com produto técnico do tipo ${process.Tipo_ProdutoTecnico} e impacto operacional perceptível.`,
    GPT_Fragilidades: 'Ainda exige validação humana, detalhamento de critérios de implantação e confirmação documental.',
    GPT_RecomendacaoPreliminar: recommendation,
    AvaliadorNIT_ID: process.MembroNIT_Atribuido_ID || currentUser().id,
  });
  updateProcess(process.id, {
    Status_Atual: 'Em avaliação',
    Responsavel_Atual_ID: process.MembroNIT_Atribuido_ID || currentUser().id,
  });
  addHistoryItem(process.ProcessoNIT_ID, 'Pré-análise IA', 'Pré-avaliação AACIIm gerada a partir do arquivo do projeto.');
  addAuditEntry('Pré-análise IA', `${process.ProcessoNIT_ID} avaliado em modo assistivo.`, { ProcessoNIT_ID: process.ProcessoNIT_ID });
  persistState();
  render();
}

function issueInitialOpinion(processId, decision) {
  const process = state.processList.find((item) => item.id === processId);
  if (!process || !canIssueInitialOpinion(process)) return;
  const parecerNumero = process.ParecerInicial_Numero || nextSequentialId('AACIIm', 'ParecerInicial_Numero');
  const mapping = {
    Aprovado: {
      Fase_Atual: 'Ciclo 2 - Jurídico',
      Status_Atual: 'Em tramitação jurídica',
      Responsavel_Atual_ID: process.Juridico_Atribuido_ID || '',
    },
    'Aprovado com ajustes': {
      Fase_Atual: 'Ciclo 1 - AACIIm Inicial',
      Status_Atual: 'Aguardando ajustes',
      Responsavel_Atual_ID: process.Pesquisador_ID,
    },
    Reprovado: {
      Fase_Atual: 'Ciclo 1 - AACIIm Inicial',
      Status_Atual: 'Indeferido',
      Responsavel_Atual_ID: process.Pesquisador_ID,
    },
    'Devolvido para complementação': {
      Fase_Atual: 'Ciclo 1 - AACIIm Inicial',
      Status_Atual: 'Aguardando ajustes',
      Responsavel_Atual_ID: process.Pesquisador_ID,
    },
  };
  upsertAaciimRecord(process.ProcessoNIT_ID, {
    AvaliadorNIT_ID: currentUser().id,
    Humano_SinteseFinal: `Parecer emitido por ${currentUser().name} com decisão "${decision}".`,
    Humano_DecisaoFinal: decision,
    ParecerInicial_Numero: parecerNumero,
  });
  updateProcess(processId, {
    ParecerInicial_Numero: parecerNumero,
    ...mapping[decision],
  });
  if (!state.documentList.some((doc) => doc.ProcessoNIT_ID === process.ProcessoNIT_ID && doc.Tipo_Documento === 'Parecer inicial')) {
    state.documentList = [
      {
        Documento_ID: `doc-${state.documentList.length + 1}`,
        ProcessoNIT_ID: process.ProcessoNIT_ID,
        Tipo_Documento: 'Parecer inicial',
        Ciclo: 'Ciclo 1',
        Nome_Arquivo: `${parecerNumero}.pdf`,
        Versao: 1,
        Status_Documento: 'Emitido',
        Data_Upload: todayStr,
        EnviadoPor_ID: currentUser().id,
      },
      ...state.documentList,
    ];
  }
  addHistoryItem(process.ProcessoNIT_ID, 'Parecer inicial emitido', `${parecerNumero} emitido por ${displayActorName(currentUser().id)}.`);
  addAuditEntry('Emissão de parecer inicial', `${parecerNumero} (${decision}) para ${process.ProcessoNIT_ID}.`, { ProcessoNIT_ID: process.ProcessoNIT_ID });
  createNotification({
    title: 'Parecer inicial emitido',
    detail: `O processo ${process.ProcessoNIT_ID} recebeu o parecer ${parecerNumero}.`,
    recipientId: process.Pesquisador_ID,
    ProcessoNIT_ID: process.ProcessoNIT_ID,
    route: 'processo',
    kind: 'update',
  });
  persistState();
  render();
}

function markMessageAsRead(messageId) {
  const target = state.messageList.find((message) => message.Mensagem_ID === messageId);
  state.messageList = state.messageList.map((message) =>
    message.Mensagem_ID === messageId ? { ...message, Lida: true, Data_Leitura: todayStr } : message
  );
  if (target) {
    addAuditEntry('Leitura de mensagem', `${target.Assunto} marcada como lida.`, { ProcessoNIT_ID: target.ProcessoNIT_ID });
  }
  persistState();
  render();
}

function updatePendencyStatus(pendencyId, status) {
  const pendency = state.pendencyList.find((item) => item.Pendencia_ID === pendencyId);
  if (!pendency || !canManagePendency(pendency)) return;
  state.pendencyList = state.pendencyList.map((item) =>
    item.Pendencia_ID === pendencyId
      ? {
          ...item,
          Status_Pendencia: status,
          Data_Resolucao: ['Resolvida', 'Cancelada'].includes(status) ? todayStr : item.Data_Resolucao,
          Resolucao_Resumo: ['Resolvida', 'Cancelada'].includes(status) ? `Atualizada por ${currentUser().name}.` : item.Resolucao_Resumo,
        }
      : item
  );
  addHistoryItem(pendency.ProcessoNIT_ID, 'Pendência atualizada', `${pendency.Pendencia_ID} agora está como ${status}.`);
  addAuditEntry('Atualização de pendência', `${pendency.Pendencia_ID} -> ${status}.`, { ProcessoNIT_ID: pendency.ProcessoNIT_ID });
  createNotification({
    title: 'Pendência atualizada',
    detail: `${pendency.Pendencia_ID} mudou para ${status}.`,
    recipientId: pendency.Responsavel_Resposta_ID,
    ProcessoNIT_ID: pendency.ProcessoNIT_ID,
    route: 'pendencias',
    kind: 'task',
  });
  persistState();
  render();
}

function addMessageFromForm(event, forceSensitiveOverride = false) {
  event.preventDefault();
  const draft = state.composeDraft;
  const process = processByFunctionalId(draft.processo);
  if (!process) return;

  const sensitivity = buildSensitiveWarning([
    draft.assunto,
    draft.mensagem,
    draft.anexoNome,
    draft.tipo_documento_anexo,
  ], 'mensagem');

  if (sensitivity && !forceSensitiveOverride) {
    state.composeMessageWarning = `${sensitivity.message} Revise o texto ou use "Enviar mesmo assim" se o conteúdo for necessário para a tramitação.`;
    state.composeSensitiveOverrideReady = true;
    render();
    return;
  }

  createMessage({
    ProcessoNIT_ID: draft.processo,
    Ciclo: draft.ciclo,
    Destinatario_ID: draft.destinatario,
    Tipo_Mensagem: draft.tipo,
    Assunto: draft.assunto,
    Corpo_Mensagem: draft.mensagem,
    Gera_Pendencia: draft.gera_pendencia,
    Prazo_Resposta: draft.prazo,
    Tipo_Pendencia: draft.tipo_pendencia || 'Técnica',
    Anexo: draft.anexo,
    RegistrarBiblioteca: draft.registrar_biblioteca,
    TipoDocumentoAnexo: draft.tipo_documento_anexo,
  });

  state.composeDraft = composeDefaults(visibleProcesses().map((candidate) => candidate.ProcessoNIT_ID), visibleRecipientsForCompose());
  state.composeMessageWarning = '';
  state.composeSensitiveOverrideReady = false;
  persistState();
  render();
}

function addReplyMessage(parentMessageId, forceSensitiveOverride = false) {
  const parent = messageById(parentMessageId);
  if (!parent) return;
  ensureReplyDraft(parent);
  const draft = state.replyDrafts[parentMessageId];
  const process = processByFunctionalId(parent.ProcessoNIT_ID);
  if (!process) return;

  const sensitivity = buildSensitiveWarning([
    draft.assunto,
    draft.mensagem,
    draft.anexoNome,
    draft.tipo_documento_anexo,
  ], 'resposta');

  if (sensitivity && !forceSensitiveOverride) {
    state.replyWarning = `${sensitivity.message} Revise o texto ou use "Enviar mesmo assim" se o conteúdo for necessário para a tramitação.`;
    state.replySensitiveOverrideReady = true;
    state.replyToMessageId = parentMessageId;
    render();
    return;
  }

  createMessage({
    ProcessoNIT_ID: parent.ProcessoNIT_ID,
    Ciclo: parent.Ciclo,
    Destinatario_ID: parent.Remetente_ID,
    Tipo_Mensagem: 'Resposta',
    Assunto: draft.assunto,
    Corpo_Mensagem: draft.mensagem,
    Mensagem_Pai_ID: parentMessageId,
    Anexo: draft.anexo,
    RegistrarBiblioteca: draft.registrar_biblioteca,
    TipoDocumentoAnexo: draft.tipo_documento_anexo,
  });

  delete state.replyDrafts[parentMessageId];
  state.replyWarning = '';
  state.replySensitiveOverrideReady = false;
  state.replyToMessageId = '';
  persistState();
  render();
}

function addPendencyFromForm(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const Pendencia_ID = `pend-${state.pendencyList.length + 1}`;
  const ProcessoNIT_ID = form.get('processo');
  state.pendencyList = [
    {
      Pendencia_ID,
      ProcessoNIT_ID,
      Ciclo: form.get('ciclo'),
      Tipo_Pendencia: form.get('tipo'),
      Descricao_Pendencia: form.get('descricao'),
      Prazo_Resposta: form.get('prazo'),
      Status_Pendencia: 'Aberta',
      Responsavel_Resposta_ID: form.get('responsavel'),
      Critica: form.get('critica') === 'on',
    },
    ...state.pendencyList,
  ];
  addHistoryItem(ProcessoNIT_ID, 'Pendência criada', `${Pendencia_ID} aberta manualmente por ${currentUser().name}.`);
  addAuditEntry('Abertura manual de pendência', `${Pendencia_ID} criada manualmente.`, { ProcessoNIT_ID });
  persistState();
  event.currentTarget.reset();
  render();
}

function addIncidentFromForm(event, forceSensitiveOverride = false) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const Categoria = form.get('categoria');
  const ProcessoNIT_ID = form.get('processo') || '';
  const Resumo = form.get('resumo');
  const Acao_Imediata = form.get('acao_imediata');

  const sensitivity = buildSensitiveWarning([Categoria, Resumo, Acao_Imediata], 'reporte de incidente');
  if (sensitivity && !forceSensitiveOverride) {
    window.alert(`${sensitivity.message} Neste protótipo, o texto foi bloqueado até revisão.`);
    return;
  }

  state.incidentList = [
    {
      Incidente_ID: `inc-${state.incidentList.length + 1}`,
      Categoria,
      ProcessoNIT_ID,
      Resumo,
      Acao_Imediata,
      Data_Registro: todayStr,
      Hora_Registro: nowLabel(),
      ReportadoPor_ID: currentUser().id,
      Status: 'Reportado',
    },
    ...state.incidentList,
  ];
  addAuditEntry('Reporte de incidente', `${Categoria}${ProcessoNIT_ID ? ` no processo ${ProcessoNIT_ID}` : ''}.`, { ProcessoNIT_ID });
  persistState();
  event.currentTarget.reset();
  render();
}

function saveAccountSettings(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.userList = state.userList.map((user) =>
    user.id === state.currentUserId
      ? {
          ...user,
          notificationEmail: form.get('notification_email') || user.notificationEmail,
          notifications: {
            email: form.get('notif_email') === 'on',
            inApp: form.get('notif_in_app') === 'on',
            dailyDigest: form.get('notif_digest') === 'on',
          },
        }
      : user
  );
  persistState();
  render();
}

function addDemoProcess(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const file = form.get('arquivo');
  if (!(file instanceof File) || !file.name) return;

  const sensitivity = buildSensitiveWarning([
    form.get('titulo'),
    form.get('resumo'),
    file.name,
  ], 'submissão inicial');
  if (sensitivity) {
    window.alert(`${sensitivity.message} Ajuste o conteúdo antes de prosseguir com a submissão no protótipo.`);
    return;
  }

  const researcher = isResearcher() ? currentUser() : state.userList.find((user) => user.role === 'pesquisador');
  const autoAssignedMember = pickLowestLoadNitMember();
  const ProcessoNIT_ID = nextProcessNumber();
  const newProcess = {
    id: `proc-${state.processList.length + 1}`,
    ProcessoNIT_ID,
    Titulo_Projeto: form.get('titulo'),
    Resumo_Projeto: form.get('resumo'),
    Pesquisador_ID: researcher.id,
    Pesquisador_Nome: researcher.name,
    Orientador_Nome: form.get('orientador'),
    Programa_Curso: form.get('programa'),
    Tipo_ProdutoTecnico: form.get('tipo'),
    Fase_Atual: 'Ciclo 1 - AACIIm Inicial',
    Status_Atual: 'Em triagem',
    Responsavel_Atual_ID: autoAssignedMember?.id || 'usr-paulo',
    Juridico_Atribuido_ID: '',
    MembroNIT_Atribuido_ID: autoAssignedMember?.id || '',
    Data_Abertura_Processo: todayStr,
    Data_Ultima_Atualizacao: todayStr,
    Data_Limite_Ciclo1: todayStr,
    Data_Limite_Ciclo2: '2026-05-20',
    Data_Limite_Ciclo3: '2026-09-01',
    ParecerInicial_Numero: '',
    CertificadoFinal_Numero: '',
    Atrasado: false,
    Dias_Em_Atraso: 0,
  };

  state.processList = [newProcess, ...state.processList];
  state.documentList = [
    {
      Documento_ID: `doc-${state.documentList.length + 1}`,
      ProcessoNIT_ID,
      Tipo_Documento: 'Projeto inicial',
      Ciclo: 'Ciclo 1',
      Nome_Arquivo: file.name,
      Versao: 1,
      Status_Documento: 'Submetido',
      Data_Upload: todayStr,
      EnviadoPor_ID: researcher.id,
      Tamanho_Arquivo: file.size,
      MimeType: file.type || 'application/octet-stream',
    },
    ...state.documentList,
  ];

  addHistoryItem(ProcessoNIT_ID, 'Processo aberto', `Projeto inicial submetido por ${researcher.name}.`);
  if (autoAssignedMember) {
    addHistoryItem(ProcessoNIT_ID, 'Distribuição automática NIT', `Processo direcionado automaticamente para ${autoAssignedMember.name} por menor carga ativa.`);
    createNotification({
      title: 'Novo processo na sua fila',
      detail: `${ProcessoNIT_ID} foi atribuído automaticamente para equilíbrio de carga.`,
      recipientId: autoAssignedMember.id,
      ProcessoNIT_ID,
      route: 'processo',
      kind: 'task',
    });
  }

  createMessage({
    ProcessoNIT_ID,
    Ciclo: 'Ciclo 1',
    Destinatario_ID: researcher.id,
    Tipo_Mensagem: 'Registro de decisão',
    Assunto: 'Submissão inicial recebida',
    Corpo_Mensagem: autoAssignedMember
      ? `Sua submissão foi recebida e direcionada internamente para avaliação pelo NIT.`
      : 'Sua submissão foi recebida e entrará na fila de avaliação do NIT.',
  });

  addAuditEntry('Submissão inicial', `${ProcessoNIT_ID} criado com arquivo ${file.name}.`, { ProcessoNIT_ID });
  state.selectedProcessId = newProcess.id;
  persistState();
  event.currentTarget.reset();
  render();
}

function metricCard(label, value, helper) {
  return h('article', { class: 'metric' }, [
    h('span', { text: label }),
    h('strong', { text: String(value) }),
    h('small', { text: helper }),
  ]);
}

function navItem(route, label, iconName, badgeCount = 0) {
  return h('button', {
    class: `nav-item ${state.route === route ? 'active' : ''}`,
    type: 'button',
    onclick: () => setRoute(route),
  }, [
    icon(iconName),
    h('span', { text: label }),
    badgeCount ? h('span', { class: 'nav-badge', text: String(badgeCount) }) : null,
  ]);
}

function visibleRecipientsForCompose() {
  const process = processByFunctionalId(state.composeDraft.processo);
  if (isResearcher()) {
    const routeTarget = internalRouteForProcess(process);
    const routedUser = state.userList.find((user) => user.id === routeTarget);
    return routedUser ? [routedUser] : [];
  }
  return state.userList.filter((user) => user.id !== currentUser().id);
}

function searchBox({ context = 'sidebar' } = {}) {
  return h('label', { class: 'global-search' }, [
    h('span', { text: 'Busca' }),
    h('input', {
      type: 'search',
      placeholder: 'Pesquisar processo, pessoa, documento ou status',
      value: state.searchDraft,
      'data-search-box': context,
      oninput: (event) => {
        state.searchDraft = event.target.value;
        state.searchTerm = state.searchDraft;
        state.activeSearchBox = context;
        const first = visibleProcesses()[0];
        if (first && !visibleProcesses().some((process) => process.id === state.selectedProcessId)) {
          state.selectedProcessId = first.id;
        }
        render();
      },
      onfocus: () => {
        state.activeSearchBox = context;
      },
      onkeydown: (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          applySearch(context);
        }
      },
    }),
    h('button', {
      class: 'search-trigger',
      type: 'button',
      title: 'Buscar',
      onclick: () => applySearch(context),
    }, ['⌕']),
    h('button', {
      class: 'search-clear',
      type: 'button',
      title: 'Limpar busca',
      onclick: () => {
        state.searchDraft = '';
        state.searchTerm = '';
        state.activeSearchBox = context;
        render();
      },
    }, ['×']),
  ]);
}

function shell(content) {
  const user = currentUser();
  return h('div', { class: 'layout' }, [
    h('aside', { class: 'sidebar' }, [
      h('div', { class: 'brand' }, [
        h('div', { class: 'brand-mark', text: 'NIT' }),
        h('div', {}, [
          h('strong', { text: 'Gerenciador NIT' }),
          h('span', { text: 'Protótipo local de tramitação por ciclos' }),
        ]),
      ]),
      h('label', { class: 'user-switch' }, [
        h('span', { text: 'Perfil ativo' }),
        h('select', {
          value: state.currentUserId,
          onchange: (event) => switchUser(event.target.value),
        }, state.userList.map((candidate) => h('option', {
          value: candidate.id,
          selected: candidate.id === state.currentUserId,
          text: `${candidate.name} · ${roles[candidate.role]}`,
        }))),
      ]),
      searchBox({ context: 'sidebar' }),
      navItem('dashboard', 'Dashboard', 'dashboard'),
      navItem('processo', 'Processos', 'process'),
      navItem('submissao', 'Nova submissão', 'submit'),
      navItem('documentos', 'Documentos', 'docs'),
      navItem('mensagens', 'Mensagens', 'messages', unreadInboxCount()),
      navItem('notificacoes', 'Notificações', 'notifications', unreadNotificationCount()),
      !isResearcher(user) ? navItem('pendencias', 'Pendências', 'pendencies') : null,
      !isResearcher(user) ? navItem('relatorios', 'Relatórios', 'reports') : null,
      !isResearcher(user) ? navItem('seguranca', 'Segurança', 'security') : null,
      navItem('conta', 'Conta e notificações', 'account'),
    ]),
    h('main', { class: 'main' }, [
      securityBanner(),
      h('header', { class: 'topbar' }, [
        h('div', {}, [
          h('p', { class: 'eyebrow', text: 'Fase 1 · protótipo navegável local' }),
          h('h1', { text: 'Núcleo de Inovação Tecnológica' }),
          h('p', { class: 'view-mode-label', text: `Modo ${viewMode()}${isResearcher(user) ? ' · acompanhamento externo do pesquisador' : ' · operação interna institucional'}` }),
        ]),
        h('div', { class: 'topbar-actions' }, [
          h('div', { class: 'user-card' }, [
            icon('user'),
            h('div', {}, [
              h('strong', { text: user.name }),
              h('span', { text: `${roles[user.role]} · ${user.notificationEmail || user.email}` }),
            ]),
          ]),
          h('button', { class: 'secondary-action', type: 'button', onclick: () => lockSession('Sessão bloqueada manualmente. Faça nova validação MFA para continuar.') }, ['Bloquear sessão']),
        ]),
      ]),
      content,
    ]),
  ]);
}

function securityBanner() {
  return h('div', { class: 'security-banner' }, [
    h('div', { class: 'banner-main' }, [
      h('strong', { text: isResearcher() ? 'Canal institucional protegido' : 'Ambiente demonstrativo com controles de segurança' }),
      h('span', { text: isResearcher()
        ? 'As avaliações internas do NIT seguem preservadas. Sua visão mostra o andamento do processo sem expor o avaliador individual.'
        : 'MFA, bloqueio de sessão, rastreabilidade e avisos de dados sensíveis foram incorporados ao fluxo do protótipo.' }),
    ]),
    h('div', { class: 'banner-pills' }, [
      h('span', { class: 'banner-pill', text: `MFA ${state.mfaVerified ? 'ativo' : 'pendente'}` }),
      h('span', { class: 'banner-pill', text: isResearcher() ? 'Visão externa' : 'Visão interna' }),
      h('span', { class: 'banner-pill', text: 'IA assistiva, sem decisão automática' }),
    ]),
  ]);
}

function sessionGateView() {
  const user = currentUser();
  return h('div', { class: 'session-gate-shell' }, [
    h('section', { class: 'session-gate' }, [
      h('div', { class: 'brand gate-brand' }, [
        h('div', { class: 'brand-mark', text: 'NIT' }),
        h('div', {}, [
          h('strong', { text: 'Gerenciador NIT' }),
          h('span', { text: 'Acesso local protegido por MFA demonstrativo' }),
        ]),
      ]),
      h('div', { class: 'gate-copy' }, [
        h('p', { class: 'eyebrow', text: 'Segurança e acesso' }),
        h('h1', { text: 'Validação multifator antes de entrar' }),
        h('p', { text: 'Este protótipo não exige e-mail institucional, mas simula a governança de acesso com segundo fator, bloqueio de sessão e diretrizes de uso seguro para tramitação de dados processuais.' }),
      ]),
      h('label', { class: 'user-switch gate-switch' }, [
        h('span', { text: 'Perfil selecionado para a sessão' }),
        h('select', {
          value: state.currentUserId,
          onchange: (event) => switchUser(event.target.value),
        }, state.userList.map((candidate) => h('option', {
          value: candidate.id,
          selected: candidate.id === state.currentUserId,
          text: `${candidate.name} · ${roles[candidate.role]}`,
        }))),
      ]),
      h('div', { class: 'gate-card-row' }, [
        h('section', { class: 'gate-card' }, [
          h('p', { class: 'eyebrow', text: 'Identidade ativa' }),
          h('h2', { text: user.name }),
          h('p', { text: `${roles[user.role]} · ${user.notificationEmail || user.email}` }),
          h('div', { class: 'readonly-note security-note', text: state.lockReason || 'Gere um código MFA para entrar nesta sessão local.' }),
          h('div', { class: 'action-row' }, [
            h('button', { class: 'primary-action', type: 'button', onclick: issueMfaCode }, ['Gerar código MFA']),
          ]),
          state.pendingMfaCode ? h('div', { class: 'mfa-demo-box' }, [
            h('span', { text: 'Código de demonstração gerado' }),
            h('strong', { text: state.pendingMfaCode }),
            h('small', { text: `Emitido às ${state.mfaCodeIssuedAt}. Em produção, isso viraria app autenticador ou provedor homologado.` }),
          ]) : null,
          h('form', { class: 'compact-form', onsubmit: validateMfa }, [
            field('Código MFA', 'codigo', 'text', '000000', true),
            h('button', { class: 'secondary-action', type: 'submit' }, ['Validar acesso']),
          ]),
        ]),
        h('section', { class: 'gate-card' }, [
          h('p', { class: 'eyebrow', text: 'Boas práticas reforçadas' }),
          h('ul', { class: 'attention-list gate-notes' }, [
            h('li', {}, [h('strong', { text: 'Reporte primeiro' }), h('span', { text: 'Em caso de incidente, comunique liderança e TI antes de qualquer investigação autônoma.' })]),
            h('li', {}, [h('strong', { text: 'Nada de credenciais em mensagens' }), h('span', { text: 'O app alerta sobre senha, token, CPF e códigos MFA, mantendo o rascunho para edição consciente.' })]),
            h('li', {}, [h('strong', { text: 'Integrações só homologadas' }), h('span', { text: 'OpenAI, armazenamento e notificações reais devem ficar em backend institucional validado pela TI.' })]),
          ]),
        ]),
      ]),
    ]),
  ]);
}

function dashboardView() {
  const list = visibleProcesses();
  const metrics = metricData();

  return h('section', { class: 'stack' }, [
    h('div', { class: 'metrics-grid' }, [
      metricCard('Processos visíveis', list.length, 'Filtrados pelo perfil ativo e pela busca'),
      metricCard('Prazo crítico', metrics.late.length, 'Com fase atual vencida'),
      metricCard('Pendências abertas', metrics.openPendencies.length, 'Demandas aguardando resposta'),
      metricCard('Mensagens não lidas', unreadInboxCount(), 'Caixa de entrada do perfil ativo'),
      metricCard('Retrabalho documental', metrics.rework, 'Versões substituídas ou reenviadas'),
      metricCard('Tempo médio', `${metrics.averageCycleDays} dias`, 'Entre abertura e última atualização'),
    ]),
    h('div', { class: 'split' }, [
      panel(isResearcher() ? 'Meus processos' : 'Fila prioritária', processCards(list.slice(0, 6))),
      panel(isResearcher() ? 'Canal institucional' : 'Radar operacional', attentionFeed(metrics)),
    ]),
  ]);
}

function processCards(list) {
  if (!list.length) return [emptyState('Nenhum processo encontrado com este perfil ou termo de busca.')];
  return list.map((process) => h('button', {
    class: 'process-row',
    type: 'button',
    onclick: () => selectProcess(process.id),
  }, [
    h('div', {}, [
      h('strong', { text: process.ProcessoNIT_ID }),
      h('span', { text: process.Titulo_Projeto }),
      h('span', { text: `${process.Pesquisador_Nome} · ${process.Programa_Curso}` }),
    ]),
    h('div', { class: 'row-meta' }, [
      statusPill(process.Status_Atual),
      processPendencyCount(process.ProcessoNIT_ID) ? h('span', { class: 'alert-pill', text: `${processPendencyCount(process.ProcessoNIT_ID)} pendência(s)` }) : null,
      unreadMessageCount(process.ProcessoNIT_ID) ? h('span', { class: 'alert-pill', text: `${unreadMessageCount(process.ProcessoNIT_ID)} msg` }) : null,
    ]),
  ]));
}

function attentionFeed(metrics) {
  const items = [
    ...metrics.openPendencies.map((pendency) => h('li', {}, [
      h('strong', { text: 'Pendência aberta' }),
      h('span', { text: `${pendency.ProcessoNIT_ID} · prazo ${formatDate(pendency.Prazo_Resposta)}` }),
    ])),
    ...metrics.late.map((process) => h('li', {}, [
      h('strong', { text: 'Prazo vencido' }),
      h('span', { text: `${process.ProcessoNIT_ID} · ${process.Fase_Atual}` }),
    ])),
  ].slice(0, 5);
  return items.length ? [h('ul', { class: 'attention-list' }, items)] : [emptyState('Sem alertas críticos agora.')];
}

function processView() {
  const list = visibleProcesses();
  const process = selectedProcess();
  if (!process) return emptyState('Nenhum processo disponível para este perfil.');

  return h('section', { class: 'process-layout' }, [
    h('aside', { class: 'process-list' }, processCards(list)),
    h('article', { class: 'process-detail' }, [
      h('div', { class: 'detail-head' }, [
        h('div', {}, [
          h('p', { class: 'eyebrow', text: process.ProcessoNIT_ID }),
          h('h2', { text: process.Titulo_Projeto }),
          h('p', { class: 'muted', text: process.Resumo_Projeto }),
        ]),
        statusPill(process.Status_Atual),
      ]),
      h('div', { class: 'info-grid' }, [
        infoItem('Pesquisador', process.Pesquisador_Nome),
        infoItem('Orientador', process.Orientador_Nome),
        infoItem('Programa', process.Programa_Curso),
        infoItem('Produto técnico', process.Tipo_ProdutoTecnico),
        infoItem('Responsável atual', maskedResponsibleLabel(process)),
        infoItem('Prazo da fase', formatDate(deadlineForCurrentPhase(process))),
      ]),
      statusEditor(process),
      cycleStepper(process),
      !isResearcher() ? panel('Operações do Ciclo 1', cycleOneActions(process)) : panel('Canal institucional', [
        h('div', { class: 'readonly-note', text: 'O acompanhamento externo mostra andamento, pendências e comunicações oficiais sem expor o avaliador individual do NIT.' }),
      ]),
      !isResearcher() ? panel('Pré-avaliação AACIIm', aaciimPanel(process)) : panel('Situação da avaliação', [
        h('div', { class: 'readonly-note', text: `Situação atual: ${process.Status_Atual}. Quando houver devolutiva formal do NIT, ela aparecerá em Mensagens e Notificações.` }),
      ]),
      panel('Linha do tempo', timeline(process.ProcessoNIT_ID)),
    ]),
  ]);
}

function cycleOneActions(process) {
  const assigned = process.MembroNIT_Atribuido_ID ? userName(process.MembroNIT_Atribuido_ID) : 'Não atribuído';
  const nitMembers = state.userList.filter((user) => user.role === 'nit');
  const selectedMember = process.MembroNIT_Atribuido_ID || '';
  const capacityRows = nitCapacityStats();
  return [
    h('div', { class: 'workflow-box' }, [
      infoItem('Membro NIT atribuído', assigned),
      infoItem('Parecer inicial', process.ParecerInicial_Numero || 'Pendente'),
      infoItem('PDF do parecer', process.ParecerInicial_Numero ? 'Pronto para geração' : 'Será gerado ao emitir o parecer'),
    ]),
    canAssignNitMember()
      ? h('form', {
          class: 'status-editor reassignment-form',
          onsubmit: (event) => {
            event.preventDefault();
            const memberId = new FormData(event.currentTarget).get('nit_member');
            if (memberId) assignNitMember(process.id, memberId);
          },
        }, [
          h('div', { class: 'nit-capacity-board' }, capacityRows.map((item) => h('div', {
            class: `capacity-card ${item.id === selectedMember ? 'selected' : ''}`,
          }, [
            h('strong', { text: item.name }),
            h('span', { text: `Carga ativa: ${item.active}` }),
            h('span', { text: `Atrasadas: ${item.late}` }),
            h('span', { text: `Taxa de atraso: ${item.rate}%` }),
          ]))),
          h('label', {}, [
            h('span', { text: process.MembroNIT_Atribuido_ID ? 'Redirecionar demanda para outro membro do NIT' : 'Atribuir membro do NIT' }),
            h('select', { name: 'nit_member', required: true }, [
              h('option', { value: '', text: 'Selecione...' }),
              ...nitMembers.map((member) => {
                const load = activeNitTaskCount(member.id);
                const late = lateNitTaskCount(member.id);
                return h('option', {
                  value: member.id,
                  selected: member.id === selectedMember,
                  text: `${member.name} · carga ${load} · atrasadas ${late}`,
                });
              }),
            ]),
          ]),
          h('button', { class: 'primary-action', type: 'submit' }, [process.MembroNIT_Atribuido_ID ? 'Confirmar redirecionamento' : 'Confirmar atribuição']),
        ])
      : null,
    h('div', { class: 'action-row' }, [
      h('button', {
        class: 'primary-action',
        type: 'button',
        onclick: () => generateAiAnalysis(process.id),
        disabled: !canGenerateAi(process),
      }, [icon('ai'), 'Gerar pré-análise']),
      h('button', {
        class: 'secondary-action',
        type: 'button',
        onclick: () => issueInitialOpinion(process.id, 'Aprovado'),
        disabled: !canIssueInitialOpinion(process),
      }, [icon('pdf'), 'Emitir parecer favorável']),
      h('button', {
        class: 'secondary-action',
        type: 'button',
        onclick: () => issueInitialOpinion(process.id, 'Aprovado com ajustes'),
        disabled: !canIssueInitialOpinion(process),
      }, ['Parecer com ajustes']),
      h('button', {
        class: 'secondary-action',
        type: 'button',
        onclick: () => issueInitialOpinion(process.id, 'Devolvido para complementação'),
        disabled: !canIssueInitialOpinion(process),
      }, ['Devolver para complementação']),
    ]),
  ];
}

function statusEditor(process) {
  if (isResearcher()) {
    return h('div', { class: 'readonly-note', text: 'A visão externa do pesquisador acompanha fase e status sem expor operações internas do NIT.' });
  }
  if (!canEditGlobalStatus()) {
    return h('div', { class: 'readonly-note', text: 'Status global: edição restrita ao Coordenador NIT e Administrador.' });
  }
  return h('form', { class: 'status-editor' }, [
    h('label', {}, [
      h('span', { text: 'Fase' }),
      h('select', { onchange: (event) => updateProcess(process.id, { Fase_Atual: event.target.value }) }, phaseOptions.map((option) =>
        h('option', { value: option, selected: option === process.Fase_Atual, text: option })
      )),
    ]),
    h('label', {}, [
      h('span', { text: 'Status' }),
      h('select', { onchange: (event) => updateProcess(process.id, { Status_Atual: event.target.value }) }, statusOptions.map((option) =>
        h('option', { value: option, selected: option === process.Status_Atual, text: option })
      )),
    ]),
    h('button', { type: 'button', onclick: () => updateProcess(process.id, { Fase_Atual: 'Arquivado', Status_Atual: 'Encerrado' }) }, ['Arquivar']),
    h('button', { type: 'button', onclick: () => updateProcess(process.id, { Fase_Atual: 'Suspenso', Status_Atual: 'Aguardando ajustes' }) }, ['Suspender']),
  ]);
}

function cycleStepper(process) {
  const cycles = [
    ['Ciclo 1', 'AACIIm inicial', Boolean(process.ParecerInicial_Numero)],
    ['Ciclo 2', 'Jurídico', ['Ciclo 3 - Dissertação Final', 'Concluído'].includes(process.Fase_Atual)],
    ['Ciclo 3', 'Dissertação final', Boolean(process.CertificadoFinal_Numero)],
  ];
  return h('div', { class: 'cycle-stepper' }, cycles.map(([cycle, label, done]) =>
    h('div', { class: `cycle ${done ? 'done' : process.Fase_Atual.includes(cycle) ? 'current' : ''}` }, [
      h('span', { text: cycle }),
      h('strong', { text: label }),
    ])
  ));
}

function aaciimPanel(process) {
  const record = state.aaciimList.find((item) => item.ProcessoNIT_ID === process.ProcessoNIT_ID);
  if (!record) {
    return [
      emptyState('Pré-análise ainda não gerada.'),
      h('button', {
        class: 'primary-action',
        type: 'button',
        onclick: () => generateAiAnalysis(process.id),
        disabled: !canGenerateAi(process),
      }, [icon('ai'), 'Gerar pré-análise IA']),
    ];
  }
  const scores = [
    ['Aderência', record.GPT_Aderencia],
    ['Aplicabilidade', record.GPT_Aplicabilidade],
    ['Complexidade', record.GPT_Complexidade],
    ['Inovação', record.GPT_Inovacao],
    ['Impacto', record.GPT_Impacto],
  ];
  return [
    h('div', { class: 'score-grid' }, scores.map(([label, value]) => h('div', {}, [h('span', { text: label }), h('strong', { text: value.toFixed(1) })]))),
    h('p', { text: record.GPT_SinteseAnalitica }),
    h('div', { class: 'two-columns' }, [
      h('div', {}, [h('strong', { text: 'Pontos fortes' }), h('p', { text: record.GPT_PontosFortes })]),
      h('div', {}, [h('strong', { text: 'Fragilidades' }), h('p', { text: record.GPT_Fragilidades })]),
    ]),
    h('div', { class: 'decision-box' }, [
      h('span', { text: 'Recomendação IA' }),
      h('strong', { text: record.GPT_RecomendacaoPreliminar }),
      h('span', { text: 'Decisão humana' }),
      h('strong', { text: record.Humano_DecisaoFinal || 'Pendente' }),
    ]),
  ];
}

function timeline(processId) {
  const items = state.historyList.filter((item) => item.ProcessoNIT_ID === processId);
  if (!items.length) return [emptyState('Linha do tempo será formada conforme as ações do processo.')];
  return [h('ol', { class: 'timeline' }, items.map((item) =>
    h('li', {}, [
      h('time', { text: formatDate(item.date) }),
      h('strong', { text: item.label }),
      h('span', { text: sanitizeForResearcher(item.detail) }),
    ])
  ))];
}

function submissionView() {
  const user = currentUser();
  const researcherDisabled = user.role !== 'pesquisador';
  return h('section', { class: 'guided-form' }, [
    h('div', { class: 'form-intro' }, [
      h('p', { class: 'eyebrow', text: 'Ciclo 1 - AACIIm inicial' }),
      h('h2', { text: 'Cadastrar novo Processo NIT' }),
      h('p', { text: researcherDisabled ? 'Como este perfil não é pesquisador, o protótipo usará Ana Ribeiro como pesquisadora demonstrativa.' : 'A submissão inicial exige apenas o arquivo do projeto nesta fase.' }),
    ]),
    h('form', { onsubmit: addDemoProcess }, [
      field('Título do projeto', 'titulo', 'text', 'Produto técnico para gestão de inovação'),
      textArea('Resumo do projeto', 'resumo', 'Descreva objetivo, público-alvo, aplicabilidade e impacto esperado.'),
      field('Orientador', 'orientador', 'text', 'Dra. Helena Castro'),
      field('Programa/curso', 'programa', 'text', 'Mestrado Profissional'),
      selectField('Tipo de produto técnico', 'tipo', ['Aplicativo', 'Software', 'Manual', 'POP', 'Curso', 'Protocolo', 'Outro']),
      field('Arquivo do projeto', 'arquivo', 'file', '', true),
      h('button', { class: 'primary-action', type: 'submit' }, ['Criar processo e gerar ID automático']),
    ]),
  ]);
}

function documentsView() {
  const allowedIds = visibleProcesses().map((process) => process.ProcessoNIT_ID);
  const docs = state.documentList.filter((doc) => allowedIds.includes(doc.ProcessoNIT_ID) && matchesDocumentSearch(doc));
  const latestDocs = latestDocuments(docs);
  const uploadableProcesses = visibleProcesses().filter((process) => canUploadForProcess(process));
  ensureDocumentUploadDraft(uploadableProcesses);
  return h('section', { class: 'stack' }, [
    h('div', { class: 'split' }, [
      panel('Biblioteca documental', latestDocs.length ? latestDocs.map((doc) => {
        const versions = documentVersions(doc.ProcessoNIT_ID, doc.Tipo_Documento);
        const originMessage = doc.Origem_Mensagem_ID ? messageById(doc.Origem_Mensagem_ID) : null;
        return h('article', { class: 'document-card' }, [
          h('div', { class: 'message-head' }, [
            h('div', {}, [
              h('strong', { text: `${doc.ProcessoNIT_ID} · ${doc.Tipo_Documento}` }),
              h('span', { text: `${doc.Ciclo} · ${doc.Nome_Arquivo}` }),
            ]),
            h('div', { class: 'action-row' }, [
              doc.Origem === 'Mensagem' ? h('span', { class: 'origin-pill', text: 'Origem: mensagem' }) : null,
              statusPill(doc.Status_Documento),
            ]),
          ]),
          h('div', { class: 'doc-meta' }, [
            infoItem('Versão atual', `v${doc.Versao}`),
            infoItem('Enviado por', displayActorName(doc.EnviadoPor_ID)),
            infoItem('Upload', formatDate(doc.Data_Upload)),
            infoItem('Origem', doc.Origem || 'Upload direto'),
            infoItem('Mensagem de origem', originMessage?.Assunto || 'Não aplicável'),
            infoItem('Referência', doc.Origem_Mensagem_ID || 'Não aplicável'),
          ]),
          h('details', { class: 'version-history' }, [
            h('summary', { text: `Histórico de versões (${versions.length})` }),
            h('div', { class: 'version-list' }, versions.map((version) => h('div', { class: 'version-row' }, [
              h('strong', { text: `v${version.Versao}` }),
              h('span', { text: version.Nome_Arquivo }),
              h('span', { text: formatDate(version.Data_Upload) }),
              h('span', { text: `${version.Status_Documento}${version.Origem === 'Mensagem' ? ' · via mensagem' : ''}` }),
            ]))),
          ]),
        ]);
      }) : [emptyState('Nenhum documento disponível para este perfil.')]),
      panel('Enviar documento', uploadableProcesses.length ? [
        h('form', { class: 'compact-form', 'data-document-upload-form': 'true', onsubmit: uploadDocument }, [
          selectField('Processo', 'processo', uploadableProcesses.map((process) => `${process.ProcessoNIT_ID}|${process.Titulo_Projeto}`), (option) => {
            const [id, title] = option.split('|');
            return h('option', { value: id, selected: id === state.documentUploadDraft.processo, text: `${id} · ${title}` });
          }),
          selectField('Ciclo', 'ciclo', ['Ciclo 1', 'Ciclo 2', 'Ciclo 3'], null, state.documentUploadDraft.ciclo),
          selectField('Tipo de documento', 'tipo_documento', documentTypeOptions(), null, state.documentUploadDraft.tipo_documento),
          h('label', {}, [
            h('span', { text: 'Arquivo' }),
            h('input', {
              name: 'arquivo',
              type: 'file',
              required: true,
              onchange: (event) => {
                const file = event.target.files?.[0] || null;
                state.documentUploadDraft.file = file;
                state.documentUploadDraft.fileName = file?.name || '';
                state.documentUploadWarning = '';
                state.documentSensitiveOverrideReady = false;
              },
            }),
          ]),
          state.documentUploadDraft.fileName ? h('div', { class: 'readonly-note', text: `Arquivo selecionado: ${state.documentUploadDraft.fileName}` }) : null,
          state.documentUploadWarning ? inlineWarning(state.documentUploadWarning, state.documentSensitiveOverrideReady ? [
            h('button', { class: 'secondary-action warning-action', type: 'button', onclick: () => uploadDocument(null, true) }, ['Enviar mesmo assim']),
          ] : []) : null,
          h('button', { class: 'primary-action', type: 'submit' }, ['Enviar / criar nova versão']),
        ]),
        h('div', { class: 'readonly-note', text: 'Se já existir um documento do mesmo tipo para o mesmo processo, o sistema cria automaticamente uma nova versão e preserva a anterior.' }),
      ] : [emptyState('Este perfil não pode enviar documentos nos processos visíveis agora.')]),
    ]),
    table(['Processo', 'Tipo', 'Arquivo', 'Versão', 'Status', 'Envio'], docs.map((doc) => [
      doc.ProcessoNIT_ID,
      doc.Tipo_Documento,
      doc.Nome_Arquivo,
      `v${doc.Versao}`,
      doc.Status_Documento,
      formatDate(doc.Data_Upload),
    ])),
  ]);
}

function messagesView() {
  const allowedIds = visibleProcesses().map((process) => process.ProcessoNIT_ID);
  const rows = state.messageList.filter((message) => allowedIds.includes(message.ProcessoNIT_ID) && matchesMessageSearch(message));
  const visibleUsers = visibleRecipientsForCompose();
  ensureComposeDraft(allowedIds, visibleUsers);
  return h('section', { class: 'message-board' }, [
    panel('Comunicações oficiais', rows.length ? rows.map((message) => {
      ensureReplyDraft(message);
      const replyParent = message.Mensagem_Pai_ID ? messageById(message.Mensagem_Pai_ID) : null;
      const draft = state.replyDrafts[message.Mensagem_ID] || null;
      return h('article', { class: `message ${message.Lida ? '' : 'unread'}` }, [
        h('div', { class: 'message-head' }, [
          h('div', {}, [
            h('strong', { text: message.Assunto }),
            h('span', { text: `${message.ProcessoNIT_ID} · ${message.Ciclo} · ${formatDate(message.Data_Envio)}` }),
          ]),
          !message.Lida ? h('button', {
            class: 'ghost-action',
            type: 'button',
            onclick: () => markMessageAsRead(message.Mensagem_ID),
          }, ['Marcar como lida']) : null,
        ]),
        replyParent ? h('div', { class: 'reply-link' }, [
          h('strong', { text: 'Em resposta a' }),
          h('span', { text: `${replyParent.Assunto}` }),
        ]) : null,
        h('p', { text: sanitizeForResearcher(message.Corpo_Mensagem) }),
        h('small', { text: `${displayActorName(message.Remetente_ID)} → ${displayActorName(message.Destinatario_ID)}` }),
        message.Pendencia_ID ? h('small', { text: `Vinculada à pendência ${message.Pendencia_ID}` }) : null,
        message.Anexo?.name ? h('div', { class: 'message-attachment' }, [
          h('strong', { text: 'Anexo' }),
          h('span', { text: `${message.Anexo.name} · ${message.Anexo.type || 'arquivo'} · ${Math.max(1, Math.round((message.Anexo.size || 0) / 1024))} KB` }),
          message.Anexo.registeredInLibrary ? h('span', { text: `Registrado também na Biblioteca documental como ${message.Anexo.documentType}.` }) : null,
        ]) : null,
        h('div', { class: 'action-row' }, [
          h('button', {
            class: 'ghost-action',
            type: 'button',
            onclick: () => {
              state.replyToMessageId = state.replyToMessageId === message.Mensagem_ID ? '' : message.Mensagem_ID;
              state.replyWarning = '';
              state.replySensitiveOverrideReady = false;
              render();
            },
          }, [state.replyToMessageId === message.Mensagem_ID ? 'Fechar resposta' : 'Responder']),
        ]),
        state.replyToMessageId === message.Mensagem_ID && draft ? h('form', {
          class: 'compact-form reply-form',
          onsubmit: (event) => {
            event.preventDefault();
            addReplyMessage(message.Mensagem_ID);
          },
        }, [
          h('div', { class: 'reply-context readonly-note' }, [
            h('strong', { text: 'Resposta vinculada' }),
            h('span', { text: `A comunicação ficará ligada à mensagem ${message.Mensagem_ID}.` }),
          ]),
          field('Assunto', 'reply_assunto', 'text', '', true, draft.assunto),
          textArea('Resposta', 'reply_mensagem', 'Escreva a resposta oficial.', draft.mensagem),
          h('label', {}, [
            h('span', { text: 'Anexar documento' }),
            h('input', {
              type: 'file',
              name: 'reply_anexo',
              onchange: (event) => {
                const file = event.target.files?.[0] || null;
                draft.anexo = file;
                draft.anexoNome = file?.name || '';
                state.replyWarning = '';
                state.replySensitiveOverrideReady = false;
              },
            }),
          ]),
          draft.anexoNome ? h('div', { class: 'readonly-note', text: `Anexo selecionado: ${draft.anexoNome}` }) : null,
          h('label', { class: 'check-row' }, [
            h('input', {
              type: 'checkbox',
              checked: draft.registrar_biblioteca,
              onchange: (event) => {
                draft.registrar_biblioteca = event.target.checked;
              },
            }),
            h('span', { text: 'Registrar este anexo também na Biblioteca documental' }),
          ]),
          draft.registrar_biblioteca ? selectField('Tipo documental do anexo', 'reply_tipo_documento_anexo', documentTypeOptions(), null, draft.tipo_documento_anexo) : null,
          state.replyWarning && state.replyToMessageId === message.Mensagem_ID ? inlineWarning(state.replyWarning, state.replySensitiveOverrideReady ? [
            h('button', { class: 'secondary-action warning-action', type: 'button', onclick: () => addReplyMessage(message.Mensagem_ID, true) }, ['Enviar mesmo assim']),
          ] : []) : null,
          h('div', { class: 'action-row' }, [
            h('button', { class: 'primary-action', type: 'submit' }, ['Enviar resposta']),
          ]),
        ]) : null,
      ]);
    }) : [emptyState('Nenhuma mensagem disponível para este perfil.')]),
    panel('Nova mensagem', canCreateMessage() ? [
      h('form', { class: 'compact-form', onsubmit: addMessageFromForm }, [
        selectField('Processo', 'processo', allowedIds, null, state.composeDraft.processo),
        selectField('Ciclo', 'ciclo', ['Ciclo 1', 'Ciclo 2', 'Ciclo 3'], null, state.composeDraft.ciclo),
        !isResearcher() ? selectField('Destinatário', 'destinatario', visibleUsers.map((user) => `${user.id}|${displayActorName(user.id)}`), (option) => {
          const [id, name] = option.split('|');
          return h('option', { value: id, selected: id === state.composeDraft.destinatario, text: name });
        }) : h('div', { class: 'readonly-note', text: 'As mensagens do pesquisador são roteadas internamente para o canal responsável sem revelar o avaliador individual.' }),
        selectField('Tipo', 'tipo', ['Solicitação de ajuste', 'Resposta', 'Esclarecimento', 'Devolutiva técnica', 'Devolutiva jurídica', 'Registro de decisão'], null, state.composeDraft.tipo),
        field('Assunto', 'assunto', 'text', 'Atualização do processo', true, state.composeDraft.assunto),
        textArea('Mensagem', 'mensagem', 'Escreva a comunicação oficial vinculada ao processo.', state.composeDraft.mensagem),
        h('label', {}, [
          h('span', { text: 'Anexar documento' }),
          h('input', {
            type: 'file',
            name: 'anexo',
            onchange: (event) => {
              const file = event.target.files?.[0] || null;
              state.composeDraft.anexo = file;
              state.composeDraft.anexoNome = file?.name || '';
              state.composeMessageWarning = '';
              state.composeSensitiveOverrideReady = false;
            },
          }),
        ]),
        state.composeDraft.anexoNome ? h('div', { class: 'readonly-note', text: `Anexo selecionado: ${state.composeDraft.anexoNome}` }) : null,
        h('label', { class: 'check-row' }, [
          h('input', {
            type: 'checkbox',
            checked: state.composeDraft.registrar_biblioteca,
            onchange: (event) => {
              state.composeDraft.registrar_biblioteca = event.target.checked;
            },
          }),
          h('span', { text: 'Registrar este anexo também na Biblioteca documental' }),
        ]),
        state.composeDraft.registrar_biblioteca ? selectField('Tipo documental do anexo', 'tipo_documento_anexo', documentTypeOptions(), null, state.composeDraft.tipo_documento_anexo) : null,
        h('label', { class: 'check-row' }, [
          h('input', {
            type: 'checkbox',
            checked: state.composeDraft.gera_pendencia,
            onchange: (event) => {
              state.composeDraft.gera_pendencia = event.target.checked;
            },
          }),
          h('span', { text: 'Gerar pendência vinculada' }),
        ]),
        selectField('Tipo da pendência', 'tipo_pendencia', ['Documental', 'Técnica', 'Jurídica', 'Metodológica', 'Administrativa', 'Outra'], null, state.composeDraft.tipo_pendencia),
        field('Prazo da pendência', 'prazo', 'date', '', false, state.composeDraft.prazo),
        state.composeMessageWarning ? inlineWarning(state.composeMessageWarning, state.composeSensitiveOverrideReady ? [
          h('button', { class: 'secondary-action warning-action', type: 'button', onclick: () => addMessageFromForm(new Event('submit'), true) }, ['Enviar mesmo assim']),
        ] : []) : null,
        h('button', { class: 'primary-action', type: 'submit' }, ['Enviar mensagem']),
      ]),
    ] : [emptyState('Este perfil não pode criar mensagens nesta etapa.')]),
  ]);
}

function pendenciesView() {
  const allowedIds = visibleProcesses().map((process) => process.ProcessoNIT_ID);
  const rows = state.pendencyList.filter((pendency) => allowedIds.includes(pendency.ProcessoNIT_ID) && matchesPendencySearch(pendency));
  return h('section', { class: 'stack' }, [
    h('div', { class: 'split' }, [
      panel('Pendências processuais', rows.length ? rows.map((pendency) => h('article', { class: 'pendency-card' }, [
        h('div', { class: 'message-head' }, [
          h('div', {}, [
            h('strong', { text: `${pendency.ProcessoNIT_ID} · ${pendency.Tipo_Pendencia}` }),
            h('span', { text: `${pendency.Ciclo} · prazo ${formatDate(pendency.Prazo_Resposta)}` }),
          ]),
          statusPill(pendency.Status_Pendencia),
        ]),
        h('p', { text: pendency.Descricao_Pendencia }),
        h('small', { text: `Responsável: ${displayActorName(pendency.Responsavel_Resposta_ID)}` }),
        h('div', { class: 'action-row' }, [
          h('button', {
            class: 'ghost-action',
            type: 'button',
            onclick: () => updatePendencyStatus(pendency.Pendencia_ID, 'Respondida'),
            disabled: !canManagePendency(pendency),
          }, ['Responder']),
          h('button', {
            class: 'ghost-action',
            type: 'button',
            onclick: () => updatePendencyStatus(pendency.Pendencia_ID, 'Resolvida'),
            disabled: !canManagePendency(pendency),
          }, ['Resolver']),
          h('button', {
            class: 'ghost-action',
            type: 'button',
            onclick: () => updatePendencyStatus(pendency.Pendencia_ID, 'Reaberta'),
            disabled: !canManagePendency(pendency),
          }, ['Reabrir']),
        ]),
      ])) : [emptyState('Nenhuma pendência disponível para este perfil.')]),
      panel('Nova pendência', [
        h('form', { class: 'compact-form', onsubmit: addPendencyFromForm }, [
          selectField('Processo', 'processo', allowedIds),
          selectField('Ciclo', 'ciclo', ['Ciclo 1', 'Ciclo 2', 'Ciclo 3']),
          selectField('Tipo', 'tipo', ['Documental', 'Técnica', 'Jurídica', 'Metodológica', 'Administrativa', 'Outra']),
          textArea('Descrição', 'descricao', 'Descreva claramente o que precisa ser respondido ou corrigido.'),
          field('Prazo', 'prazo', 'date', '', true),
          selectField('Responsável', 'responsavel', state.userList.map((user) => `${user.id}|${user.name}`), (option) => {
            const [id, name] = option.split('|');
            return h('option', { value: id, text: name });
          }),
          h('label', { class: 'check-row' }, [
            h('input', { type: 'checkbox', name: 'critica' }),
            h('span', { text: 'Marcar como crítica' }),
          ]),
          h('button', { class: 'primary-action', type: 'submit' }, ['Abrir pendência']),
        ]),
      ]),
    ]),
  ]);
}

function reportsView() {
  const metrics = metricData();
  const nitRows = nitPerformanceRows();
  const bestNit = nitRows[0] || null;
  const attentionNit = [...nitRows].sort((a, b) => b.delayRate - a.delayRate)[0] || null;
  return h('section', { class: 'stack' }, [
    h('div', { class: 'section-head' }, [
      h('div', {}, [
        h('p', { class: 'eyebrow', text: 'Indicadores expansíveis' }),
        h('h2', { text: 'Relatórios operacionais' }),
      ]),
      canExportReports()
        ? h('button', { class: 'primary-action', onclick: () => alert('Exportação simulada. Depois ligaremos PDF, Excel ou Power BI.') }, ['Exportar relatório'])
        : h('span', { class: 'readonly-note', text: 'Exportação restrita à coordenação e administração.' }),
    ]),
    h('div', { class: 'metrics-grid' }, [
      metricCard('Tempo por ciclo', `${metrics.averageCycleDays} dias`, 'Média operacional inicial'),
      metricCard('Atrasos', metrics.late.length, 'Processos com prazo vencido'),
      metricCard('Pendências abertas', metrics.openPendencies.length, 'Aberta ou reaberta'),
      metricCard('Carga por membro', loadByMember(), 'Maior volume atribuído'),
      metricCard('Certificados emitidos', metrics.certificates.length, 'Ciclo final concluído'),
      metricCard('Retrabalho documental', metrics.rework, 'Versões substituídas ou reenviadas'),
    ]),
    h('div', { class: 'metrics-grid' }, [
      metricCard('Melhor índice NIT', bestNit ? `${bestNit.name}: ${bestNit.score}` : 'Sem dados', 'Leitura sintética de desempenho'),
      metricCard('Maior atenção NIT', attentionNit ? `${attentionNit.name}: ${attentionNit.delayRate}%` : 'Sem dados', 'Maior taxa de atraso ativa'),
      metricCard('Pareceres emitidos', nitRows.reduce((sum, row) => sum + row.opinions, 0), 'Produção acumulada do NIT'),
    ]),
    panel('Distribuição por fase', [
      h('div', { class: 'bar-list' }, phaseOptions.map((phase) => {
        const count = metrics.visible.filter((process) => process.Fase_Atual === phase).length;
        return h('div', {}, [
          h('span', { text: phase }),
          h('div', { class: 'bar' }, [h('i', { style: `width:${Math.max(6, count * 28)}%` })]),
          h('strong', { text: String(count) }),
        ]);
      })),
    ]),
    panel('Performance por membro do NIT', [
      table(
        ['Membro', 'Carga ativa', 'Em dia', 'Atrasadas', 'Taxa atraso', 'Pareceres', 'Concluídos', 'Índice', 'Sinal'],
        nitRows.map((row) => [
          row.name,
          row.active,
          row.onTrack,
          row.late,
          `${row.delayRate}%`,
          row.opinions,
          row.completed,
          row.score,
          row.performance,
        ])
      ),
      h('div', { class: 'performance-legend' }, nitRows.map((row) =>
        h('div', { class: 'performance-chip-row' }, [
          h('strong', { text: row.name }),
          h('span', { class: `status-pill ${performanceTone(row.performance)}`, text: row.performance }),
          h('span', { text: `Carga ${row.active} · atraso ${row.delayRate}% · índice ${row.score}` }),
        ])
      )),
      h('div', { class: 'readonly-note' }, [
        'A distribuição automática usa carga ativa. Já o acompanhamento gerencial destaca atraso, entregas e um índice sintético de performance para apoiar a diretoria.'
      ]),
    ]),
  ]);
}

function notificationsView() {
  const rows = visibleNotifications();
  return h('section', { class: 'stack' }, [
    h('div', { class: 'section-head' }, [
      h('div', {}, [
        h('p', { class: 'eyebrow', text: isResearcher() ? 'Acompanhamento do pesquisador' : 'Alertas operacionais' }),
        h('h2', { text: isResearcher() ? 'Atualizações do seu processo' : 'Central de notificações' }),
      ]),
      rows.some((item) => !item.read)
        ? h('button', { class: 'secondary-action', type: 'button', onclick: markAllNotificationsRead }, ['Marcar tudo como lido'])
        : null,
    ]),
    rows.length ? rows.map((item) =>
      h('article', { class: `message notification-card ${item.read ? '' : 'unread'}` }, [
        h('div', { class: 'message-head' }, [
          h('div', {}, [
            h('strong', { text: item.title }),
            h('span', { text: `${item.ProcessoNIT_ID || 'Geral'} · ${formatDate(item.date)} · ${item.time}` }),
          ]),
          !item.read ? h('button', {
            class: 'ghost-action',
            type: 'button',
            onclick: () => markNotificationRead(item.Notificacao_ID),
          }, ['Marcar como lida']) : null,
        ]),
        h('p', { text: sanitizeForResearcher(item.detail) }),
        h('div', { class: 'action-row' }, [
          item.ProcessoNIT_ID ? h('button', {
            class: 'secondary-action',
            type: 'button',
            onclick: () => {
              const process = state.processList.find((candidate) => candidate.ProcessoNIT_ID === item.ProcessoNIT_ID);
              if (process) selectProcess(process.id);
            },
          }, ['Abrir processo']) : null,
          item.route === 'mensagens' ? h('button', {
            class: 'secondary-action',
            type: 'button',
            onclick: () => setRoute('mensagens'),
          }, ['Ir para mensagens']) : null,
        ]),
      ])
    ) : [emptyState(isResearcher()
      ? 'Nenhuma atualização ainda. Quando houver movimentações relevantes no seu processo, elas aparecerão aqui.'
      : 'Nenhuma notificação operacional no momento.'
    )],
  ]);
}

function securityView() {
  const visibleProcessIds = visibleProcesses().map((process) => process.ProcessoNIT_ID);
  const incidentRows = state.incidentList.filter((incident) => !incident.ProcessoNIT_ID || visibleProcessIds.includes(incident.ProcessoNIT_ID));
  const auditRows = state.auditList.filter((entry) => !entry.ProcessoNIT_ID || visibleProcessIds.includes(entry.ProcessoNIT_ID));
  const timeLeft = Math.max(0, Math.floor((SESSION_TIMEOUT_MS - (Date.now() - state.lastActivityAt)) / 1000));

  return h('section', { class: 'stack' }, [
    h('div', { class: 'metrics-grid' }, [
      metricCard('MFA da sessão', state.mfaVerified ? 'Validado' : 'Pendente', 'Segundo fator exigido antes do acesso'),
      metricCard('Bloqueio de sessão', state.sessionLocked ? 'Ativo' : 'Pronto', 'Bloqueio manual ou por inatividade'),
      metricCard('Expiração estimada', `${timeLeft}s`, 'Contagem até bloqueio por inatividade'),
      metricCard('Incidentes reportados', incidentRows.length, 'Registros de segurança visíveis ao perfil'),
      metricCard('Ações auditadas', auditRows.length, 'Trilha de auditoria local do protótipo'),
      metricCard('Armazenamento atual', 'Local', 'Persistência de protótipo em navegador'),
      metricCard('Status de IA', 'Controlada', 'Apenas uso homologado deve ir para produção'),
    ]),
    h('div', { class: 'split' }, [
      panel('Reportar incidente', [
        h('div', { class: 'readonly-note security-note', text: 'Diretriz institucional: reporte primeiro. Investigue depois.' }),
        h('form', { class: 'compact-form', onsubmit: addIncidentFromForm }, [
          selectField('Categoria', 'categoria', ['Phishing', 'Credencial', 'Upload indevido', 'IA/integração externa', 'Dispositivo', 'Outro']),
          selectField('Processo relacionado', 'processo', [''].concat(visibleProcessIds), (option) => h('option', { value: option, text: option || 'Sem processo específico' })),
          textArea('Resumo do incidente', 'resumo', 'Descreva o ocorrido, mesmo se o clique ou envio foi acidental.'),
          textArea('Ação imediata', 'acao_imediata', 'Ex.: comuniquei a TI, bloqueei a sessão, troquei senha, suspendi uso do arquivo.'),
          h('button', { class: 'primary-action', type: 'submit' }, ['Registrar incidente']),
        ]),
      ]),
      panel('Controles recomendados', [
        h('ul', { class: 'attention-list' }, [
          h('li', {}, [h('strong', { text: 'MFA em todos os acessos' }), h('span', { text: 'Sem obrigar e-mail institucional, mas com segundo fator obrigatório.' })]),
          h('li', {}, [h('strong', { text: 'Somente ferramentas homologadas' }), h('span', { text: 'Integrações externas e IA devem passar pela TI antes de produção.' })]),
          h('li', {}, [h('strong', { text: 'Sessão bloqueável' }), h('span', { text: 'Tela bloqueada ao se ausentar ou por inatividade, reduzindo risco operacional.' })]),
          h('li', {}, [h('strong', { text: 'Dados mínimos no protótipo' }), h('span', { text: 'Enquanto for demo pública, usar apenas dados fictícios e sem anexos sensíveis reais.' })]),
        ]),
      ]),
    ]),
    table(['ID', 'Categoria', 'Processo', 'Reportado por', 'Data', 'Status', 'Ação imediata'], incidentRows.map((incident) => [
      incident.Incidente_ID,
      incident.Categoria,
      incident.ProcessoNIT_ID || 'Geral',
      userName(incident.ReportadoPor_ID),
      `${formatDate(incident.Data_Registro)} ${incident.Hora_Registro}`,
      incident.Status,
      incident.Acao_Imediata,
    ])),
    panel('Trilha de auditoria', auditRows.length ? [
      table(['Quando', 'Usuário', 'Ação', 'Processo', 'Detalhe'], auditRows.slice(0, 20).map((entry) => [
        entry.DataHora,
        entry.Usuario_Nome,
        entry.Acao,
        entry.ProcessoNIT_ID || 'Geral',
        entry.Detalhe,
      ])),
      h('div', { class: 'readonly-note', text: 'Esta trilha é local e demonstrativa. Em produção, a auditoria deve ir para backend institucional, com retenção e controle de integridade.' }),
    ] : [emptyState('Nenhuma ação auditada ainda nesta sessão de demonstração.')]),
  ]);
}

function accountView() {
  const user = currentUser();
  const settings = user.notifications || { email: true, inApp: true, dailyDigest: false };
  return h('section', { class: 'stack' }, [
    h('div', { class: 'guided-form account-layout' }, [
      h('div', { class: 'form-intro' }, [
        h('p', { class: 'eyebrow', text: 'Cadastro local do protótipo' }),
        h('h2', { text: 'Conta e notificações' }),
        h('p', { text: 'Aqui já conseguimos simular o vínculo de uma conta a um e-mail para avisos operacionais. No ambiente institucional, isso depois deve migrar para autenticação real e serviço de notificação homologado.' }),
        h('div', { class: 'readonly-note security-note', text: 'Neste MVP, o cadastro é local e serve para demonstrar preferências de aviso por perfil, inclusive para coordenador, administrador, jurídico e pesquisador.' }),
      ]),
      h('form', { class: 'compact-form', onsubmit: saveAccountSettings }, [
        field('Nome do usuário', 'name_display', 'text', '', false, user.name),
        field('Identificador', 'institutional_id', 'text', '', false, user.institutionalId || ''),
        field('E-mail para notificações', 'notification_email', 'email', 'nome@exemplo.com', true, user.notificationEmail || user.email || ''),
        h('label', { class: 'check-row' }, [
          h('input', { type: 'checkbox', name: 'notif_in_app', checked: settings.inApp }),
          h('span', { text: 'Receber notificações dentro do app' }),
        ]),
        h('label', { class: 'check-row' }, [
          h('input', { type: 'checkbox', name: 'notif_email', checked: settings.email }),
          h('span', { text: 'Receber notificações por e-mail' }),
        ]),
        h('label', { class: 'check-row' }, [
          h('input', { type: 'checkbox', name: 'notif_digest', checked: settings.dailyDigest }),
          h('span', { text: 'Receber resumo diário' }),
        ]),
        h('button', { class: 'primary-action', type: 'submit' }, ['Salvar preferências']),
      ]),
    ]),
    h('div', { class: 'metrics-grid' }, [
      metricCard('Mensagens não lidas', unreadInboxCount(user), 'Mostradas também no badge da barra lateral'),
      metricCard('Canal principal', settings.email ? 'E-mail' : 'In-app', 'Preferência atual de notificação'),
      metricCard('Conta ativa', roles[user.role], 'Perfil local selecionado no protótipo'),
    ]),
  ]);
}

function loadByMember() {
  const nitMembers = state.userList.filter((user) => user.role === 'nit');
  const counts = nitMembers.map((member) => [member.name, activeNitTaskCount(member.id)]);
  const [name, count] = counts.sort((a, b) => b[1] - a[1])[0] || ['Sem carga', 0];
  return `${name}: ${count}`;
}

function nitPerformanceRows() {
  const scopedProcesses = canExportReports() ? state.processList : visibleProcesses();
  return state.userList
    .filter((user) => user.role === 'nit')
    .map((member) => {
      const assigned = scopedProcesses.filter((process) => process.MembroNIT_Atribuido_ID === member.id);
      const active = assigned.filter((process) => !['Concluído', 'Arquivado'].includes(process.Fase_Atual)).length;
      const late = assigned.filter((process) => !['Concluído', 'Arquivado'].includes(process.Fase_Atual) && isLate(process)).length;
      const onTrack = Math.max(0, active - late);
      const opinions = assigned.filter((process) => Boolean(process.ParecerInicial_Numero)).length;
      const completed = assigned.filter((process) => process.Fase_Atual === 'Concluído' || process.CertificadoFinal_Numero).length;
      const delayRate = active ? Math.round((late / active) * 100) : 0;
      const score = Math.max(0, 100 - delayRate * 0.6 - Math.max(0, active - onTrack) * 2 + completed * 4);
      const performance =
        delayRate >= 60 ? 'Crítico' :
        delayRate >= 30 ? 'Atenção' :
        score >= 85 ? 'Bom' :
        'Estável';

      return {
        id: member.id,
        name: member.name,
        active,
        late,
        onTrack,
        opinions,
        completed,
        delayRate,
        score: Math.round(score),
        performance,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (left.delayRate !== right.delayRate) return left.delayRate - right.delayRate;
      return left.name.localeCompare(right.name, 'pt-BR');
    });
}

function performanceTone(label) {
  if (label === 'Crítico') return 'danger';
  if (label === 'Atenção') return 'warn';
  if (label === 'Bom') return 'ok';
  return 'info';
}

function panel(title, children) {
  return h('section', { class: 'panel' }, [
    h('h2', { text: title }),
    ...children,
  ]);
}

function statusPill(status) {
  const tone = status.includes('Aguardando') ? 'warn' : status.includes('Certificado') || status.includes('Apto') ? 'ok' : 'info';
  return h('span', { class: `status-pill ${tone}`, text: status });
}

function infoItem(label, value) {
  return h('div', { class: 'info-item' }, [
    h('span', { text: label }),
    h('strong', { text: value || 'Não informado' }),
  ]);
}

function field(label, name, type, placeholder, forceRequired = false, value = '') {
  return h('label', {}, [
    h('span', { text: label }),
    h('input', { name, type, placeholder, required: forceRequired || type !== 'file', value: type === 'file' ? null : value }),
  ]);
}

function textArea(label, name, placeholder, value = '') {
  return h('label', {}, [
    h('span', { text: label }),
    h('textarea', { name, placeholder, required: true }, [value]),
  ]);
}

function selectField(label, name, options, optionBuilder = null, selectedValue = '') {
  return h('label', {}, [
    h('span', { text: label }),
    h('select', { name, required: true }, options.map((option) => optionBuilder ? optionBuilder(option, selectedValue) : h('option', { value: option, selected: option === selectedValue, text: option }))),
  ]);
}

function table(headers, rows) {
  if (!rows.length) return emptyState('Nenhum registro disponível para este perfil.');
  return h('div', { class: 'table-wrap' }, [
    h('table', {}, [
      h('thead', {}, [h('tr', {}, headers.map((header) => h('th', { text: header })))]),
      h('tbody', {}, rows.map((row) => h('tr', {}, row.map((cell) => h('td', { text: String(cell) }))))),
    ]),
  ]);
}

function emptyState(text) {
  return h('div', { class: 'empty-state', text });
}

function inlineWarning(text, actions = []) {
  return h('div', { class: 'inline-warning' }, [
    h('span', { text }),
    actions.length ? h('div', { class: 'inline-warning-actions' }, actions) : null,
  ]);
}

function render() {
  if (!state.mfaVerified || state.sessionLocked) {
    app.replaceChildren(sessionGateView());
    return;
  }
  if (!availableRoutes().includes(state.route)) {
    state.route = 'dashboard';
  }
  const views = {
    dashboard: dashboardView,
    processo: processView,
    submissao: submissionView,
    documentos: documentsView,
    mensagens: messagesView,
    notificacoes: notificationsView,
    pendencias: pendenciesView,
    relatorios: reportsView,
    seguranca: securityView,
    conta: accountView,
  };
  app.replaceChildren(shell(views[state.route]()));
  restoreSearchFocus();
}

function restoreSearchFocus() {
  if (!state.activeSearchBox) return;
  const input = app.querySelector(`[data-search-box="${state.activeSearchBox}"]`);
  if (!input) return;
  input.focus();
  input.value = state.searchDraft;
  const position = input.value.length;
  if (typeof input.setSelectionRange === 'function') {
    input.setSelectionRange(position, position);
  }
}

hydrateState();
state.searchDraft = state.searchTerm;
beginFreshSession();
installSecurityWatchers();
render();