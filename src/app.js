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
  currentUserId: 'usr-paulo',
  route: 'dashboard',
  selectedProcessId: processes[0].id,
  searchTerm: '',
  searchDraft: '',
  activeSearchBox: '',
  processList: [],
  pendencyList: [],
  messageList: [],
  documentList: [],
  aaciimList: [],
  historyList: [],
};

const app = document.querySelector('#app');

const STORAGE_KEY = 'nit-prototype-state-v1';
const today = new Date('2026-04-24T12:00:00');
const todayStr = '2026-04-24';

function currentUser() {
  return users.find((user) => user.id === state.currentUserId);
}

function defaultState() {
  return {
    processList: structuredClone(processes),
    pendencyList: structuredClone(pendencies),
    messageList: structuredClone(messages),
    documentList: structuredClone(documents),
    aaciimList: structuredClone(aaciim),
    historyList: structuredClone(history),
  };
}

function hydrateState() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    const fallback = defaultState();
    Object.assign(state, fallback, saved || {});
  } catch {
    Object.assign(state, defaultState());
  }
}

function persistState() {
  const payload = {
    processList: state.processList,
    pendencyList: state.pendencyList,
    messageList: state.messageList,
    documentList: state.documentList,
    aaciimList: state.aaciimList,
    historyList: state.historyList,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function userName(id) {
  return users.find((user) => user.id === id)?.name || 'Não atribuído';
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
    userName(process.Responsavel_Atual_ID),
  ]);
}

function matchesDocumentSearch(doc) {
  const process = state.processList.find((item) => item.ProcessoNIT_ID === doc.ProcessoNIT_ID);
  return textMatches([
    doc.ProcessoNIT_ID,
    doc.Tipo_Documento,
    doc.Ciclo,
    doc.Nome_Arquivo,
    doc.Versao,
    doc.Status_Documento,
    userName(doc.EnviadoPor_ID),
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
    userName(message.Remetente_ID),
    userName(message.Destinatario_ID),
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
    userName(pendency.Responsavel_Resposta_ID),
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
    pendencies: '!',
    reports: '▥',
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
  state.processList = state.processList.map((process) =>
    process.id === id ? { ...process, ...patch, Data_Ultima_Atualizacao: todayStr } : process
  );
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

function createMessage({ ProcessoNIT_ID, Ciclo, Destinatario_ID, Tipo_Mensagem, Assunto, Corpo_Mensagem, Gera_Pendencia = false, Prazo_Resposta = '', Tipo_Pendencia = 'Técnica' }) {
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
    addHistoryItem(ProcessoNIT_ID, 'Pendência criada', `${Tipo_Pendencia} aberta para ${userName(Destinatario_ID)}.`);
  }

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
    },
    ...state.messageList,
  ];

  addHistoryItem(ProcessoNIT_ID, 'Mensagem enviada', `${Tipo_Mensagem}: ${Assunto}.`);
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

function uploadDocument(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const ProcessoNIT_ID = form.get('processo');
  const process = processByFunctionalId(ProcessoNIT_ID);
  if (!process || !canUploadForProcess(process)) return;
  const file = form.get('arquivo');
  if (!(file instanceof File) || !file.name) return;

  const Tipo_Documento = form.get('tipo_documento');
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
      Ciclo: form.get('ciclo'),
      Nome_Arquivo: file.name,
      Versao: nextVersion,
      Status_Documento: nextVersion > 1 ? 'Submetido' : 'Em análise',
      Data_Upload: todayStr,
      EnviadoPor_ID: currentUser().id,
      Tamanho_Arquivo: file.size,
      MimeType: file.type || 'application/octet-stream',
    },
    ...state.documentList,
  ];

  addHistoryItem(
    ProcessoNIT_ID,
    nextVersion > 1 ? 'Nova versão documental' : 'Documento enviado',
    `${Tipo_Documento} ${nextVersion > 1 ? `atualizado para v${nextVersion}` : 'enviado'} por ${currentUser().name}.`
  );
  persistState();
  event.currentTarget.reset();
  render();
}

function assignNitMember(processId, memberId) {
  const process = state.processList.find((item) => item.id === processId);
  if (!process || !canAssignNitMember()) return;
  updateProcess(processId, {
    MembroNIT_Atribuido_ID: memberId,
    Responsavel_Atual_ID: memberId,
    Status_Atual: 'Em triagem',
  });
  addHistoryItem(process.ProcessoNIT_ID, 'Atribuição NIT', `Processo atribuído a ${userName(memberId)} para avaliação inicial.`);
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
  addHistoryItem(process.ProcessoNIT_ID, 'Parecer inicial emitido', `${parecerNumero} emitido por ${currentUser().name}.`);
  persistState();
  render();
}

function markMessageAsRead(messageId) {
  state.messageList = state.messageList.map((message) =>
    message.Mensagem_ID === messageId ? { ...message, Lida: true, Data_Leitura: todayStr } : message
  );
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
  persistState();
  render();
}

function addMessageFromForm(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  createMessage({
    ProcessoNIT_ID: form.get('processo'),
    Ciclo: form.get('ciclo'),
    Destinatario_ID: form.get('destinatario'),
    Tipo_Mensagem: form.get('tipo'),
    Assunto: form.get('assunto'),
    Corpo_Mensagem: form.get('mensagem'),
    Gera_Pendencia: form.get('gera_pendencia') === 'on',
    Prazo_Resposta: form.get('prazo'),
    Tipo_Pendencia: form.get('tipo_pendencia') || 'Técnica',
  });
  event.currentTarget.reset();
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
  persistState();
  event.currentTarget.reset();
  render();
}

function addDemoProcess(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const user = currentUser().role === 'pesquisador' ? currentUser() : users.find((item) => item.role === 'pesquisador');
  const id = `proc-${state.processList.length + 1}`;
  const processoId = nextProcessNumber();
  const newProcess = {
    id,
    ProcessoNIT_ID: processoId,
    Titulo_Projeto: form.get('titulo'),
    Resumo_Projeto: form.get('resumo'),
    Pesquisador_ID: user.id,
    Pesquisador_Nome: user.name,
    Orientador_Nome: form.get('orientador'),
    Programa_Curso: form.get('programa'),
    Tipo_ProdutoTecnico: form.get('tipo'),
    Fase_Atual: 'Ciclo 1 - AACIIm Inicial',
    Status_Atual: 'Submetido',
    Responsavel_Atual_ID: 'usr-marina',
    Juridico_Atribuido_ID: '',
    MembroNIT_Atribuido_ID: 'usr-marina',
    Data_Abertura_Processo: todayStr,
    Data_Ultima_Atualizacao: todayStr,
    Data_Limite_Ciclo1: '2026-05-09',
    Data_Limite_Ciclo2: '2026-06-09',
    Data_Limite_Ciclo3: '2026-10-09',
    ParecerInicial_Numero: '',
    CertificadoFinal_Numero: '',
    Atrasado: false,
    Dias_Em_Atraso: 0,
  };
  state.processList = [newProcess, ...state.processList];
  state.documentList = [
    {
      Documento_ID: `doc-${state.documentList.length + 1}`,
      ProcessoNIT_ID: processoId,
      Tipo_Documento: 'Projeto inicial',
      Ciclo: 'Ciclo 1',
      Nome_Arquivo: form.get('arquivo')?.name || 'projeto-inicial.pdf',
      Versao: 1,
      Status_Documento: 'Submetido',
      Data_Upload: todayStr,
      EnviadoPor_ID: user.id,
    },
    ...state.documentList,
  ];
  state.messageList = [
    {
      Mensagem_ID: `msg-${state.messageList.length + 1}`,
      ProcessoNIT_ID: processoId,
      Ciclo: 'Ciclo 1',
      Remetente_ID: user.id,
      Destinatario_ID: 'usr-marina',
      Tipo_Mensagem: 'Registro de decisão',
      Assunto: 'Nova submissão inicial',
      Corpo_Mensagem: `Processo ${processoId} submetido e encaminhado para triagem inicial do NIT.`,
      Data_Envio: todayStr,
      Lida: false,
      Pendencia_ID: '',
    },
    ...state.messageList,
  ];
  addHistoryItem(processoId, 'Processo aberto', `Submissão inicial realizada por ${user.name}.`);
  persistState();
  state.selectedProcessId = id;
  state.route = 'processo';
  render();
}

function shell(content) {
  const user = currentUser();
  return h('div', { class: 'layout' }, [
    h('aside', { class: 'sidebar' }, [
      h('div', { class: 'brand' }, [
        h('div', { class: 'brand-mark', text: 'NIT' }),
        h('div', {}, [
          h('strong', { text: 'Núcleo de Inovação' }),
          h('span', { text: 'Protótipo institucional' }),
        ]),
      ]),
      h('label', { class: 'user-switch' }, [
        h('span', { text: 'Perfil ativo' }),
        h('select', {
          onchange: (event) => {
            state.currentUserId = event.target.value;
            const first = visibleProcesses()[0];
            state.selectedProcessId = first?.id || state.selectedProcessId;
            render();
          },
        }, users.map((item) => h('option', { value: item.id, selected: item.id === user.id, text: `${item.name} · ${roles[item.role]}` }))),
      ]),
      searchBox('sidebar-search'),
      navButton('dashboard', 'Dashboard', 'dashboard'),
      navButton('processo', 'Processos', 'process'),
      navButton('submissao', 'Nova submissão', 'submit'),
      navButton('documentos', 'Documentos', 'docs'),
      navButton('mensagens', 'Mensagens', 'messages'),
      navButton('pendencias', 'Pendências', 'pendencies'),
      navButton('relatorios', 'Relatórios', 'reports'),
    ]),
    h('main', { class: 'main' }, [
      h('header', { class: 'topbar' }, [
        h('div', {}, [
          h('p', { class: 'eyebrow', text: roles[user.role] }),
          h('h1', { text: titleForRoute() }),
        ]),
        h('div', { class: 'user-card' }, [
          icon('user'),
          h('div', {}, [
            h('strong', { text: user.name }),
            h('span', { text: user.institutionalId }),
          ]),
        ]),
      ]),
      content,
    ]),
  ]);
}

function searchBox(extraClass = '') {
  return h('form', {
    class: `global-search ${extraClass}`,
    onsubmit: (event) => {
      event.preventDefault();
      applySearch(extraClass);
    },
  }, [
    h('span', { text: 'Busca' }),
    h('input', {
      type: 'search',
      value: state.searchDraft,
      'data-search-box': extraClass,
      placeholder: 'Buscar por processo, pesquisador, status, documento...',
      oninput: (event) => {
        state.searchDraft = event.target.value;
        state.activeSearchBox = extraClass;
        applySearch(extraClass);
      },
      onkeydown: (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          applySearch(extraClass);
        }
      },
    }),
    h('button', {
      type: 'submit',
      title: 'Buscar',
      class: 'search-trigger',
    }, ['⌕']),
    state.searchTerm
      ? h('button', {
          type: 'button',
          title: 'Limpar busca',
          class: 'search-clear',
          onclick: () => {
            state.searchTerm = '';
            state.searchDraft = '';
            render();
          },
        }, ['×'])
      : null,
  ]);
}

function navButton(route, label, iconName) {
  return h('button', {
    class: `nav-item ${state.route === route ? 'active' : ''}`,
    onclick: () => setRoute(route),
    title: label,
  }, [icon(iconName), h('span', { text: label })]);
}

function titleForRoute() {
  const titles = {
    dashboard: 'Dashboard por perfil',
    processo: 'Gestão do processo',
    submissao: 'Submissão inicial',
    documentos: 'Biblioteca documental',
    mensagens: 'Comunicação processual',
    pendencias: 'Pendências',
    relatorios: 'Indicadores',
  };
  return titles[state.route] || 'NIT';
}

function dashboardView() {
  const metrics = metricData();
  return h('section', { class: 'stack' }, [
    h('div', { class: 'metrics-grid' }, [
      metricCard('Processos visíveis', metrics.visible.length, 'Filtrados conforme o perfil ativo'),
      metricCard('Pendências abertas', metrics.openPendencies.length, 'Itens aguardando resposta'),
      metricCard('Processos em atraso', metrics.late.length, 'Com prazo vencido na fase atual'),
      metricCard('Tempo médio', `${metrics.averageCycleDays} dias`, 'Da abertura à última atualização'),
      metricCard('Certificados emitidos', metrics.certificates.length, 'Disponíveis para coordenação'),
      metricCard('Retrabalho documental', metrics.rework, 'Versões substituídas ou reenviadas'),
    ]),
    h('div', { class: 'split' }, [
      panel('Fila de trabalho', processCards(metrics.visible)),
      panel('Atenção imediata', attentionList(metrics)),
    ]),
  ]);
}

function metricCard(label, value, note) {
  return h('article', { class: 'metric' }, [
    h('span', { text: label }),
    h('strong', { text: String(value) }),
    h('small', { text: note }),
  ]);
}

function processCards(list) {
  if (!list.length) return [emptyState(state.searchTerm ? 'Nenhum processo encontrado para esta busca.' : 'Nenhum processo disponível para este perfil.')];
  return list.map((process) => processRow(process));
}

function processRow(process) {
  return h('button', { class: 'process-row', onclick: () => selectProcess(process.id) }, [
    h('div', {}, [
      h('strong', { text: process.Titulo_Projeto }),
      h('span', { text: `${process.ProcessoNIT_ID} · ${process.Pesquisador_Nome}` }),
    ]),
    h('div', { class: 'row-meta' }, [
      statusPill(process.Status_Atual),
      processPendencyCount(process.ProcessoNIT_ID) ? h('span', { class: 'alert-pill', text: `${processPendencyCount(process.ProcessoNIT_ID)} pend.` }) : null,
    ]),
  ]);
}

function attentionList(metrics) {
  const items = [
    ...metrics.openPendencies.map((pendency) => h('li', {}, [
      h('strong', { text: pendency.Tipo_Pendencia }),
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
        infoItem('Responsável atual', userName(process.Responsavel_Atual_ID)),
        infoItem('Prazo da fase', formatDate(deadlineForCurrentPhase(process))),
      ]),
      statusEditor(process),
      cycleStepper(process),
      panel('Operações do Ciclo 1', cycleOneActions(process)),
      panel('Pré-avaliação AACIIm', aaciimPanel(process)),
      panel('Linha do tempo', timeline(process.ProcessoNIT_ID)),
    ]),
  ]);
}

function cycleOneActions(process) {
  const assigned = process.MembroNIT_Atribuido_ID ? userName(process.MembroNIT_Atribuido_ID) : 'Não atribuído';
  const nitMembers = users.filter((user) => user.role === 'nit');
  return [
    h('div', { class: 'workflow-box' }, [
      infoItem('Membro NIT atribuído', assigned),
      infoItem('Parecer inicial', process.ParecerInicial_Numero || 'Pendente'),
      infoItem('PDF do parecer', process.ParecerInicial_Numero ? 'Pronto para geração' : 'Será gerado ao emitir o parecer'),
    ]),
    canAssignNitMember()
      ? h('label', { class: 'inline-field' }, [
          h('span', { text: 'Atribuir membro do NIT' }),
          h('select', {
            onchange: (event) => {
              if (event.target.value) assignNitMember(process.id, event.target.value);
            },
          }, [
            h('option', { value: '', text: 'Selecione...' }),
            ...nitMembers.map((member) => h('option', {
              value: member.id,
              selected: member.id === process.MembroNIT_Atribuido_ID,
              text: member.name,
            })),
          ]),
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
      h('strong', { text: record.Humano_DecisaoFinal }),
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
      h('span', { text: item.detail }),
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
  return h('section', { class: 'stack' }, [
    h('div', { class: 'split' }, [
      panel('Biblioteca documental', latestDocs.length ? latestDocs.map((doc) => {
        const versions = documentVersions(doc.ProcessoNIT_ID, doc.Tipo_Documento);
        return h('article', { class: 'document-card' }, [
          h('div', { class: 'message-head' }, [
            h('div', {}, [
              h('strong', { text: `${doc.ProcessoNIT_ID} · ${doc.Tipo_Documento}` }),
              h('span', { text: `${doc.Ciclo} · ${doc.Nome_Arquivo}` }),
            ]),
            statusPill(doc.Status_Documento),
          ]),
          h('div', { class: 'doc-meta' }, [
            infoItem('Versão atual', `v${doc.Versao}`),
            infoItem('Enviado por', userName(doc.EnviadoPor_ID)),
            infoItem('Upload', formatDate(doc.Data_Upload)),
          ]),
          h('details', { class: 'version-history' }, [
            h('summary', { text: `Histórico de versões (${versions.length})` }),
            h('div', { class: 'version-list' }, versions.map((version) => h('div', { class: 'version-row' }, [
              h('strong', { text: `v${version.Versao}` }),
              h('span', { text: version.Nome_Arquivo }),
              h('span', { text: formatDate(version.Data_Upload) }),
              h('span', { text: version.Status_Documento }),
            ]))),
          ]),
        ]);
      }) : [emptyState('Nenhum documento disponível para este perfil.')]),
      panel('Enviar documento', uploadableProcesses.length ? [
        h('form', { class: 'compact-form', onsubmit: uploadDocument }, [
          selectField('Processo', 'processo', uploadableProcesses.map((process) => `${process.ProcessoNIT_ID}|${process.Titulo_Projeto}`), (option) => {
            const [id, title] = option.split('|');
            return h('option', { value: id, text: `${id} · ${title}` });
          }),
          selectField('Ciclo', 'ciclo', ['Ciclo 1', 'Ciclo 2', 'Ciclo 3']),
          selectField('Tipo de documento', 'tipo_documento', documentTypeOptions()),
          field('Arquivo', 'arquivo', 'file', '', true),
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
  const visibleUsers = users.filter((user) => user.id !== currentUser().id);
  return h('section', { class: 'message-board' }, [
    panel('Comunicações oficiais', rows.length ? rows.map((message) => h('article', { class: `message ${message.Lida ? '' : 'unread'}` }, [
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
      h('p', { text: message.Corpo_Mensagem }),
      h('small', { text: `${userName(message.Remetente_ID)} → ${userName(message.Destinatario_ID)}` }),
      message.Pendencia_ID ? h('small', { text: `Vinculada à pendência ${message.Pendencia_ID}` }) : null,
    ])) : [emptyState('Nenhuma mensagem disponível para este perfil.')]),
    panel('Nova mensagem', [
      h('form', { class: 'compact-form', onsubmit: addMessageFromForm }, [
        selectField('Processo', 'processo', allowedIds),
        selectField('Ciclo', 'ciclo', ['Ciclo 1', 'Ciclo 2', 'Ciclo 3']),
        selectField('Destinatário', 'destinatario', visibleUsers.map((user) => `${user.id}|${user.name}`), (option) => {
          const [id, name] = option.split('|');
          return h('option', { value: id, text: name });
        }),
        selectField('Tipo', 'tipo', ['Solicitação de ajuste', 'Resposta', 'Esclarecimento', 'Devolutiva técnica', 'Devolutiva jurídica', 'Registro de decisão']),
        field('Assunto', 'assunto', 'text', 'Atualização do processo'),
        textArea('Mensagem', 'mensagem', 'Escreva a comunicação oficial vinculada ao processo.'),
        h('label', { class: 'check-row' }, [
          h('input', { type: 'checkbox', name: 'gera_pendencia' }),
          h('span', { text: 'Gerar pendência vinculada' }),
        ]),
        selectField('Tipo da pendência', 'tipo_pendencia', ['Documental', 'Técnica', 'Jurídica', 'Metodológica', 'Administrativa', 'Outra']),
        field('Prazo da pendência', 'prazo', 'date', ''),
        h('button', { class: 'primary-action', type: 'submit' }, ['Enviar mensagem']),
      ]),
    ]),
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
        h('small', { text: `Responsável: ${userName(pendency.Responsavel_Resposta_ID)}` }),
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
          selectField('Responsável', 'responsavel', users.map((user) => `${user.id}|${user.name}`), (option) => {
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
  ]);
}

function loadByMember() {
  const counts = {};
  visibleProcesses().forEach((process) => {
    const name = userName(process.Responsavel_Atual_ID);
    counts[name] = (counts[name] || 0) + 1;
  });
  const [name, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || ['Sem carga', 0];
  return `${name}: ${count}`;
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

function field(label, name, type, placeholder, forceRequired = false) {
  return h('label', {}, [
    h('span', { text: label }),
    h('input', { name, type, placeholder, required: forceRequired || type !== 'file' }),
  ]);
}

function textArea(label, name, placeholder) {
  return h('label', {}, [
    h('span', { text: label }),
    h('textarea', { name, placeholder, required: true }),
  ]);
}

function selectField(label, name, options, optionBuilder = null) {
  return h('label', {}, [
    h('span', { text: label }),
    h('select', { name, required: true }, options.map((option) => optionBuilder ? optionBuilder(option) : h('option', { value: option, text: option }))),
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

function render() {
  const views = {
    dashboard: dashboardView,
    processo: processView,
    submissao: submissionView,
    documentos: documentsView,
    mensagens: messagesView,
    pendencias: pendenciesView,
    relatorios: reportsView,
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
render();
