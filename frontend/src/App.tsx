import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BriefcaseBusiness, CalendarClock, CheckCircle2, ChevronDown, DatabaseBackup, Download, FileSpreadsheet, HardDrive, LayoutGrid, Lock, LogIn, LogOut, Mail, MessageSquareText, PanelsTopLeft, Pencil, Percent, Plus, Search, ShieldCheck, Sparkles, TrendingUp, UploadCloud, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { read, utils, writeFile } from 'xlsx';
import { api } from './api';
import { getApiMetadata } from './lib/openapi';
import type { AuditLog, BackupFile, Client, DashboardMetrics, Lead, Transaction } from './types';

type UserSummary = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt?: string;
};

const baseTabs = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'import', label: 'Importador', icon: FileSpreadsheet },
  { id: 'pipeline', label: 'Pipeline', icon: PanelsTopLeft },
  { id: 'timeline', label: 'Timeline', icon: MessageSquareText },
];

const adminTab = { id: 'admin', label: 'Sistema', icon: ShieldCheck };

const pipelineStages = ['NOVO', 'PROPOSTA', 'NEGOCIACAO', 'GANHO', 'PERDIDO'] as const;

const emptyLeadForm = {
  title: '',
  company: '',
  value: '',
  assignedToId: '',
};

const emptyFollowUpForm = {
  proximaAcao: '',
  dataFollowUp: '',
};

function toDateInputValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function getFollowUpUrgency(value?: string | null): 'overdue' | 'today' | null {
  if (!value) return null;
  const followDate = new Date(value);
  if (Number.isNaN(followDate.getTime())) return null;
  followDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (followDate.getTime() < today.getTime()) return 'overdue';
  if (followDate.getTime() === today.getTime()) return 'today';
  return null;
}

function normalizeText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatDate(value?: string | null) {
  if (!value) return 'Sem data';
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatCurrency(value?: number | null) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getLeadValue(lead: Lead) {
  return Number(lead.value || 0);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const auditActionLabel: Record<string, string> = {
  CREATE: 'Criação',
  UPDATE: 'Atualização',
  DELETE: 'Exclusão',
};

const auditEntityLabel: Record<string, string> = {
  Client: 'Cliente',
  Lead: 'Lead',
  Transaction: 'Transação',
};

function App() {
  const metadata = useMemo(() => getApiMetadata(), []);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [leadSearch, setLeadSearch] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importStatus, setImportStatus] = useState('Nenhum arquivo carregado');
  const [importSaving, setImportSaving] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);
  const [followUpForm, setFollowUpForm] = useState(emptyFollowUpForm);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [token, setToken] = useState(() => api.auth.getStoredToken() ?? '');
  const [user, setUser] = useState<UserSummary | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [leadForm, setLeadForm] = useState(emptyLeadForm);
  const [leadFormError, setLeadFormError] = useState<string | null>(null);
  const [creatingLead, setCreatingLead] = useState(false);

  // States for login form
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const loadData = async (providedToken?: string) => {
    setLoading(true);
    setError(null);

    try {
      const currentToken = providedToken || token || api.auth.getStoredToken() || '';

      if (!currentToken) {
        setUser(null);
        setToken('');
        api.auth.clearToken();
        setLoading(false);
        return;
      }

      // Verify the token by calling /me
      let meResponse;
      try {
        meResponse = await api.auth.me(currentToken);
      } catch (err) {
        // Verification failed, clear stored credentials
        setUser(null);
        setToken('');
        api.auth.clearToken();
        setLoading(false);
        return;
      }

      api.auth.setToken(currentToken);
      setToken(currentToken);

      const [clientsResponse, leadsResponse, transactionsResponse, metricsResponse] = await Promise.all([
        api.clients.list(currentToken),
        api.leads.list(currentToken),
        api.transactions.list(currentToken),
        api.dashboard.metrics(currentToken),
      ]);

      const nextUser = (meResponse as { user?: UserSummary }).user ?? null;
      setUser(nextUser);
      setClients(((clientsResponse as { data?: Client[] }).data ?? []) as Client[]);
      setLeads(((leadsResponse as { data?: Lead[] }).data ?? []) as Lead[]);
      setTransactions(((transactionsResponse as { data?: Transaction[] }).data ?? []) as Transaction[]);
      setDashboardMetrics(metricsResponse as DashboardMetrics);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar os dados';
      if (message === 'Unauthorized' || err.message?.includes('Unauthorized') || err.message?.includes('401')) {
        setUser(null);
        setToken('');
        api.auth.clearToken();
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      const response = await api.auth.login({ email: emailInput, password: passwordInput });
      const newToken = (response as { token?: string }).token;
      if (newToken) {
        await loadData(newToken);
      } else {
        setLoginError('Token não recebido do servidor.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Falha ao autenticar. Verifique suas credenciais.');
    } finally {
      setLoggingIn(false);
    }
  };

  const triggerQuickAccess = async (email: string) => {
    setEmailInput(email);
    setPasswordInput('123456');
    setLoginError(null);
    setLoggingIn(true);
    try {
      const response = await api.auth.login({ email, password: '123456' });
      const newToken = (response as { token?: string }).token;
      if (newToken) {
        await loadData(newToken);
      } else {
        setLoginError('Token não recebido do servidor.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Falha ao autenticar.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleDragEnd = async (leadId: string, newStage: string) => {
    const previousLeads = [...leads];
    // Optimistic UI update
    setLeads(current => current.map(lead => lead.id === leadId ? { ...lead, status: newStage as any } : lead));

    try {
      await api.leads.updateStage(token, leadId, { status: newStage });
    } catch (err: any) {
      console.error('Failed to update lead stage:', err);
      setLeads(previousLeads);
      alert('Falha ao atualizar o estágio do lead: ' + (err.message || String(err)));
    }
  };

  const handleCreateLead = async (event: React.FormEvent) => {
    event.preventDefault();
    setLeadFormError(null);

    if (!leadForm.title.trim() || !leadForm.company.trim() || !leadForm.assignedToId) {
      setLeadFormError('Preencha nome, empresa e vendedor responsavel.');
      return;
    }

    setCreatingLead(true);

    try {
      const clientResponse = await api.clients.create(token, {
        name: leadForm.company.trim(),
        status: 'ATIVO',
      });
      const newClient = clientResponse as Client;

      const leadResponse = await api.leads.create(token, {
        title: leadForm.title.trim(),
        clientId: newClient.id,
        assignedToId: leadForm.assignedToId,
        value: Number(leadForm.value) || 0,
        status: 'NOVO',
      });
      const newLead = leadResponse as Lead;

      setClients(current => [newClient, ...current]);
      setLeads(current => [newLead, ...current]);
      setLeadForm(emptyLeadForm);
      setIsLeadModalOpen(false);
    } catch (err: any) {
      setLeadFormError(err.message || 'Nao foi possivel criar o lead.');
    } finally {
      setCreatingLead(false);
    }
  };

  const filteredLeads = useMemo(() => {
    if (!user) return [];
    if (user.role === 'ADMIN') return leads;
    return leads.filter(lead => lead.assignedTo?.id === user.id);
  }, [leads, user]);

  // Mirror the same isolation for clients (backend already filters, but keep UI count consistent)
  const filteredClients = useMemo(() => {
    if (!user) return [];
    if (user.role === 'ADMIN') return clients;
    // For non-admin: count only clients that appear in their own leads
    const myClientIds = new Set(filteredLeads.map(l => l.client?.id).filter(Boolean));
    return clients.filter(c => myClientIds.has(c.id));
  }, [clients, filteredLeads, user]);

  const sellerOptions = useMemo(() => {
    const sellers = new Map<string, { id: string; name: string; role?: string }>();

    leads.forEach((lead) => {
      if (lead.assignedTo?.id && lead.assignedTo.name) {
        sellers.set(lead.assignedTo.id, lead.assignedTo);
      }
    });

    if (user && user.role !== 'ADMIN') {
      sellers.set(user.id, { id: user.id, name: user.name, role: user.role });
    }

    return Array.from(sellers.values())
      .filter((seller) => {
        if (user?.role !== 'ADMIN') return Boolean(user && seller.id === user.id);
        const normalizedName = normalizeText(seller.name);
        return normalizedName.includes('joao') || normalizedName.includes('maria');
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [leads, user]);

  const exportSellerOptions = useMemo(() => {
    const sellers = new Map<string, { id: string; name: string }>();
    leads.forEach((lead) => {
      if (lead.assignedTo?.id && lead.assignedTo.name) {
        sellers.set(lead.assignedTo.id, { id: lead.assignedTo.id, name: lead.assignedTo.name });
      }
    });
    return Array.from(sellers.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [leads]);

  const sellerPerformanceData = useMemo(() => {
    const targets = [
      { key: 'joao', name: 'Joao' },
      { key: 'maria', name: 'Maria' },
    ];

    return targets.map((target) => {
      const sellerLeads = leads.filter((lead) => normalizeText(lead.assignedTo?.name).includes(target.key));
      const sellerClientIds = new Set(
        sellerLeads
          .map((lead) => lead.client?.id || lead.clientId)
          .filter((clientId): clientId is string => Boolean(clientId)),
      );
      const sellerTransactions = transactions.filter((transaction) => sellerClientIds.has(transaction.clientId));

      return {
        name: target.name,
        leads: sellerLeads.length,
        transacoes: sellerTransactions.length,
        valorLeads: sellerLeads.reduce((sum, lead) => sum + getLeadValue(lead), 0),
        valorTransacoes: sellerTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0),
      };
    });
  }, [leads, transactions]);

  const followUpAlerts = useMemo(() => {
    let overdue = 0;
    let today = 0;
    filteredLeads.forEach((lead) => {
      const urgency = getFollowUpUrgency(lead.dataFollowUp);
      if (urgency === 'overdue') overdue += 1;
      if (urgency === 'today') today += 1;
    });
    return { overdue, today };
  }, [filteredLeads]);

  const searchedLeads = useMemo(() => {
    if (!leadSearch.trim()) return filteredLeads;
    const query = normalizeText(leadSearch);
    return filteredLeads.filter((lead) =>
      normalizeText(lead.title).includes(query) || normalizeText(lead.client?.name).includes(query),
    );
  }, [filteredLeads, leadSearch]);

  const pipelineStageSummary = useMemo(() => {
    return pipelineStages.reduce((summary, stage) => {
      const stageLeads = searchedLeads.filter((lead) => lead.status === stage);
      summary[stage] = {
        count: stageLeads.length,
        total: stageLeads.reduce((sum, lead) => sum + getLeadValue(lead), 0),
      };
      return summary;
    }, {} as Record<(typeof pipelineStages)[number], { count: number; total: number }>);
  }, [searchedLeads]);

  const tabs = useMemo(() => (user?.role === 'ADMIN' ? [...baseTabs, adminTab] : baseTabs), [user]);

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'admin' && user?.role === 'ADMIN' && token) {
      void loadAuditData();
      void loadBackups();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user, token]);

  useEffect(() => {
    if (isLeadModalOpen && !leadForm.assignedToId && sellerOptions[0]) {
      setLeadForm(current => ({ ...current, assignedToId: sellerOptions[0].id }));
    }
  }, [isLeadModalOpen, leadForm.assignedToId, sellerOptions]);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccess(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = utils.sheet_to_json(sheet, { defval: '' }) as Record<string, string>[];

      if (rows.length === 0) {
        setImportRows([]);
        setImportStatus('A planilha não contém linhas de dados.');
        return;
      }

      setImportRows(rows);
      setImportStatus(`Arquivo lido: ${file.name} (${rows.length} linha${rows.length === 1 ? '' : 's'})`);
    } catch (error) {
      setImportRows([]);
      setImportStatus('Não foi possível ler o arquivo.');
      console.error(error);
    }
  };

  const handleConfirmImport = async () => {
    if (importRows.length === 0) return;

    setImportSaving(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const response = await api.leads.import(token, importRows) as { data?: Lead[]; meta?: { imported: number } };
      const importedLeads = response.data ?? [];
      const importedClients = importedLeads
        .map((lead) => lead.client)
        .filter((client): client is Client => Boolean(client));

      setLeads((current) => [...importedLeads, ...current]);
      setClients((current) => {
        const existingIds = new Set(current.map((client) => client.id));
        const newClients = importedClients.filter((client) => !existingIds.has(client.id));
        return [...newClients, ...current];
      });

      setImportSuccess(`${response.meta?.imported ?? importedLeads.length} lead(s) importado(s) com sucesso.`);
      setImportRows([]);
      setImportStatus('Nenhum arquivo carregado');

      const metricsResponse = await api.dashboard.metrics(token);
      setDashboardMetrics(metricsResponse as DashboardMetrics);
    } catch (err: any) {
      setImportError(err.message || 'Não foi possível importar os leads.');
    } finally {
      setImportSaving(false);
    }
  };

  const handleSaveFollowUp = async (leadId: string) => {
    setSavingFollowUp(true);

    try {
      const payload = {
        proximaAcao: followUpForm.proximaAcao.trim() || null,
        dataFollowUp: followUpForm.dataFollowUp || null,
      };
      const updated = await api.leads.update(token, leadId, payload) as Lead;
      setLeads((current) => current.map((lead) => (lead.id === leadId ? { ...lead, ...updated } : lead)));
      setEditingFollowUpId(null);
      setFollowUpForm(emptyFollowUpForm);
    } catch (err: any) {
      alert('Falha ao salvar próxima ação: ' + (err.message || String(err)));
    } finally {
      setSavingFollowUp(false);
    }
  };

  const loadAuditData = async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const res = await api.audit.list(token) as { data?: AuditLog[] };
      setAuditLogs(res.data ?? []);
    } catch (err: any) {
      setAuditError(err.message || 'Não foi possível carregar os logs de auditoria.');
    } finally {
      setAuditLoading(false);
    }
  };

  const loadBackups = async () => {
    setBackupsLoading(true);
    setBackupError(null);
    try {
      const res = await api.backups.list(token) as { data?: BackupFile[] };
      setBackups(res.data ?? []);
    } catch (err: any) {
      setBackupError(err.message || 'Não foi possível carregar os backups.');
    } finally {
      setBackupsLoading(false);
    }
  };

  const handleRunBackup = async () => {
    setRunningBackup(true);
    setBackupError(null);
    try {
      await api.backups.create(token);
      await loadBackups();
    } catch (err: any) {
      setBackupError(err.message || 'Falha ao criar backup.');
    } finally {
      setRunningBackup(false);
    }
  };

  const handleExportLeads = (scope: 'ALL' | string) => {
    const isAdmin = user?.role === 'ADMIN';
    // Non-admins can only ever export their own leads — `leads` is already
    // RBAC-scoped server-side for them, so filteredLeads is the safe set.
    const rows = isAdmin
      ? (scope === 'ALL' ? leads : leads.filter((lead) => lead.assignedTo?.id === scope))
      : filteredLeads;

    const exportData = rows.map((lead) => ({
      Lead: lead.title,
      Empresa: lead.client?.name || '',
      Vendedor: lead.assignedTo?.name || '',
      Status: lead.status,
      Valor: getLeadValue(lead),
      'Próxima Ação': lead.proximaAcao || '',
      'Data Follow-up': lead.dataFollowUp ? toDateInputValue(lead.dataFollowUp) : '',
      'Criado em': formatDate(lead.createdAt),
      'Atualizado em': formatDate(lead.updatedAt),
    }));

    const sheet = utils.json_to_sheet(exportData);
    sheet['!cols'] = [{ wch: 28 }, { wch: 24 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, sheet, 'Leads');

    const scopeLabel = isAdmin
      ? (scope === 'ALL' ? 'todos' : normalizeText(exportSellerOptions.find((seller) => seller.id === scope)?.name || 'vendedor').replace(/\s+/g, '-'))
      : normalizeText(user?.name || 'meus-leads').replace(/\s+/g, '-');
    const dateLabel = new Date().toISOString().slice(0, 10);

    writeFile(workbook, `leads-${scopeLabel}-${dateLabel}.xlsx`);
    setExportMenuOpen(false);
  };

  const stats = [
    { label: 'Clientes', value: filteredClients.length },
    { label: 'Leads', value: filteredLeads.length },
    { label: 'Transações', value: transactions.length },
  ];

  const timelineItems = useMemo(() => {
    const items = [] as Array<{ id: string; title: string; detail: string; when: string }>;

    if (user) {
      items.push({
        id: `user-${user.id}`,
        title: 'Sessão autenticada',
        detail: `${user.name} (${user.role}) está conectado ao CRM.`,
        when: formatDate(user.createdAt),
      });
    }

    clients.slice(0, 3).forEach((client) => {
      items.push({
        id: `client-${client.id}`,
        title: 'Cliente sincronizado',
        detail: `${client.name}${client.status ? ` • ${client.status}` : ''}`,
        when: formatDate(client.updatedAt),
      });
    });

    leads.slice(0, 3).forEach((lead) => {
      items.push({
        id: `lead-${lead.id}`,
        title: 'Lead atualizado',
        detail: `${lead.title}${lead.status ? ` • ${lead.status}` : ''}`,
        when: formatDate(lead.updatedAt),
      });
    });

    transactions.slice(0, 3).forEach((transaction) => {
      items.push({
        id: `transaction-${transaction.id}`,
        title: 'Transação registrada',
        detail: `${transaction.description} • ${formatCurrency(transaction.amount)}`,
        when: formatDate(transaction.date),
      });
    });

    return items.slice(0, 8);
  }, [clients, leads, transactions, user]);

  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl shadow-black/50">
          <div className="text-center mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">prototype CRM</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Acesse sua Conta</h2>
            <p className="mt-1 text-sm text-slate-400">Entre com as credenciais do seed local.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">E-mail</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="admin@prototype.com"
                  className="block w-full pl-10 pr-3 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Senha</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••"
                  className="block w-full pl-10 pr-3 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 text-sm"
                />
              </div>
            </div>

            {loginError && (
              <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-white font-medium py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              {loggingIn ? 'Autenticando...' : (
                <>
                  <LogIn className="h-4 w-4" />
                  Entrar no Painel
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800/60">
            <p className="text-xs text-slate-500 text-center mb-3">Acesso Rápido de Demonstração:</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={loggingIn}
                onClick={() => void triggerQuickAccess('admin@prototype.com')}
                className="w-full text-xs py-2.5 px-3 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-950 text-slate-300 hover:text-white transition text-left flex justify-between items-center"
              >
                <span className="font-semibold text-slate-200">Acesso Admin</span>
                <span className="text-slate-500 font-mono text-[10px]">admin@prototype.com</span>
              </button>
              <button
                type="button"
                disabled={loggingIn}
                onClick={() => void triggerQuickAccess('joao@prototype.com')}
                className="w-full text-xs py-2.5 px-3 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-950 text-slate-300 hover:text-white transition text-left flex justify-between items-center"
              >
                <span className="font-semibold text-slate-200">Acesso João (Vendedor 1)</span>
                <span className="text-slate-500 font-mono text-[10px]">joao@prototype.com</span>
              </button>
              <button
                type="button"
                disabled={loggingIn}
                onClick={() => void triggerQuickAccess('maria@prototype.com')}
                className="w-full text-xs py-2.5 px-3 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-950 text-slate-300 hover:text-white transition text-left flex justify-between items-center"
              >
                <span className="font-semibold text-slate-200">Acesso Maria (Vendedor 2)</span>
                <span className="text-slate-500 font-mono text-[10px]">maria@prototype.com</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:px-8">
          <header className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">prototype CRM</p>
                <h1 className="mt-2 text-3xl font-semibold">Painel comercial</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">Pipeline, follow-ups e desempenho de vendas em um só lugar.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300">
                  <span className="font-medium">API</span> {metadata.title} · v{metadata.version}
                </div>
                <button
                  type="button"
                  onClick={() => void loadData(token)}
                  className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 transition"
                >
                  Atualizar dados
                </button>
                <button
                  type="button"
                  onClick={() => {
                    api.auth.clearToken();
                    setToken('');
                    setUser(null);
                  }}
                  className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 hover:bg-rose-500/20 transition flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            </div>
          </header>

          <nav className="flex flex-wrap gap-2">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${activeTab === id ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300' : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'}`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </nav>

          <section className="grid gap-4 lg:grid-cols-3">
            {stats.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <p className="text-sm text-slate-400">{item.label}</p>
                {loading ? (
                  <div className="mt-4 h-8 w-20 animate-pulse rounded-lg bg-slate-800" />
                ) : (
                  <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
                )}
              </div>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
              <div className="flex items-center gap-2 text-cyan-300">
                <BriefcaseBusiness className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Visão rápida</h2>
              </div>
              <div className="mt-4 space-y-3">
                {loading && activeTab === 'dashboard' && (
                  <div className="space-y-4 opacity-80">
                    <p className="text-sm text-slate-400">Carregando dados...</p>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <div className="h-4 w-36 animate-pulse rounded bg-slate-800" />
                      <div className="mt-4 space-y-2">
                        {[0, 1, 2, 3].map((item) => (
                          <div key={item} className="h-10 animate-pulse rounded-lg border border-slate-800 bg-slate-900/70" />
                        ))}
                      </div>
                    </div>
                    {user?.role === 'ADMIN' && (
                      <div className="h-72 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                        <div className="h-full animate-pulse rounded-xl bg-slate-900/70" />
                      </div>
                    )}
                  </div>
                )}
                {error && <p className="text-sm text-rose-400">{error}</p>}
                {!loading && !error && activeTab === 'dashboard' && (
                  <>
                    <p className="text-sm text-slate-400">
                      {user?.role === 'ADMIN' ? 'Visão consolidada de todo o funil de vendas.' : 'Resumo dos seus leads e follow-ups pendentes.'}
                    </p>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <p className="text-sm font-medium text-white">Resumo rápido</p>
                      <ul className="mt-3 space-y-2 text-sm text-slate-400">
                        <li className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
                          <span>Leads no funil</span>
                          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-200">{filteredLeads.length}</span>
                        </li>
                        <li className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
                          <span>Clientes ativos</span>
                          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-200">{filteredClients.length}</span>
                        </li>
                        <li className={`flex items-center justify-between rounded-lg border px-3 py-2 ${followUpAlerts.overdue > 0 ? 'border-rose-500/40 bg-rose-500/5' : 'border-slate-800'}`}>
                          <span>Follow-ups atrasados</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${followUpAlerts.overdue > 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-200'}`}>{followUpAlerts.overdue}</span>
                        </li>
                        <li className={`flex items-center justify-between rounded-lg border px-3 py-2 ${followUpAlerts.today > 0 ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-800'}`}>
                          <span>Follow-ups para hoje</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${followUpAlerts.today > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-200'}`}>{followUpAlerts.today}</span>
                        </li>
                      </ul>
                    </div>
                    {user?.role === 'ADMIN' && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-medium text-white">Desempenho por Vendedor</p>
                            <p className="text-xs text-slate-500">Volume financeiro de leads e transacoes vinculadas a cada vendedor.</p>
                          </div>
                        </div>
                        <div className="mt-4 h-72 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={sellerPerformanceData} margin={{ top: 8, right: 8, left: 24, bottom: 0 }}>
                              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
                              <YAxis
                                stroke="#94a3b8"
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => formatCurrency(Number(value)).replace(/\u00a0/g, ' ')}
                              />
                              <Tooltip
                                cursor={{ fill: 'rgba(14, 165, 233, 0.08)' }}
                                formatter={(value) => formatCurrency(Number(value))}
                                contentStyle={{
                                  backgroundColor: '#020617',
                                  border: '1px solid #1e293b',
                                  borderRadius: 12,
                                  color: '#e2e8f0',
                                }}
                              />
                              <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: 12 }} />
                              <Bar dataKey="valorLeads" name="Leads" fill="#22d3ee" radius={[6, 6, 0, 0]} />
                              <Bar dataKey="valorTransacoes" name="Transacoes" fill="#34d399" radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {activeTab === 'import' && (
                  <div className="space-y-4">
                    <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-cyan-500/40 bg-slate-950/70 px-4 py-8 text-sm text-slate-300">
                      <UploadCloud className="h-5 w-5 text-cyan-300" />
                      <span>Escolher planilha XLSX/CSV</span>
                      <input type="file" className="hidden" accept=".xlsx,.csv,.xls" onChange={handleFile} />
                    </label>
                    <p className="text-xs text-slate-500">
                      Colunas esperadas: <span className="text-slate-300">nome_lead</span>, <span className="text-slate-300">empresa</span>, <span className="text-slate-300">vendedor_email</span>, valor_estimado, status, descricao.
                    </p>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
                      <p className="font-medium text-white">Status</p>
                      <p className="mt-2">{importStatus}</p>
                      {importRows.length > 0 && (
                        <div className="mt-4 overflow-auto rounded-xl border border-slate-800">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-900/80">
                                {Object.keys(importRows[0]).map((header) => (
                                  <th key={header} className="px-3 py-2 text-left font-medium text-slate-300">{header}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {importRows.slice(0, 8).map((row, idx) => (
                                <tr key={idx} className="border-t border-slate-800/60">
                                  {Object.keys(importRows[0]).map((header) => (
                                    <td key={header} className="px-3 py-2 text-slate-400">{String(row[header] ?? '')}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {importRows.length > 8 && (
                            <p className="px-3 py-2 text-[11px] text-slate-500">+ {importRows.length - 8} linha(s) adicional(is) não exibidas.</p>
                          )}
                        </div>
                      )}
                    </div>

                    {importError && (
                      <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{importError}</div>
                    )}
                    {importSuccess && (
                      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" /> {importSuccess}
                      </div>
                    )}

                    {importRows.length > 0 && (
                      <button
                        type="button"
                        disabled={importSaving}
                        onClick={() => void handleConfirmImport()}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-cyan-900"
                      >
                        <UploadCloud className="h-4 w-4" />
                        {importSaving ? 'Salvando...' : 'Confirmar e Importar Leads'}
                      </button>
                    )}
                  </div>
                )}
                {activeTab === 'pipeline' && !error && (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Pipeline comercial</p>
                        <p className="text-xs text-slate-500">{loading ? 'Carregando dados...' : 'Novos leads entram automaticamente na coluna Novo.'}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                          <button
                            type="button"
                            disabled={loading || (user?.role === 'ADMIN' ? leads.length === 0 : filteredLeads.length === 0)}
                            onClick={() => {
                              if (user?.role === 'ADMIN') {
                                setExportMenuOpen((open) => !open);
                              } else {
                                handleExportLeads('ALL');
                              }
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500/60 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Download className="h-4 w-4" />
                            Exportar Excel
                            {user?.role === 'ADMIN' && <ChevronDown className="h-3.5 w-3.5" />}
                          </button>

                          {exportMenuOpen && user?.role === 'ADMIN' && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setExportMenuOpen(false)} />
                              <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40">
                                <button
                                  type="button"
                                  onClick={() => handleExportLeads('ALL')}
                                  className="block w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800"
                                >
                                  Todos os leads
                                </button>
                                <div className="border-t border-slate-800" />
                                {exportSellerOptions.length === 0 ? (
                                  <p className="px-4 py-2.5 text-xs text-slate-500">Nenhum vendedor com leads ainda.</p>
                                ) : (
                                  exportSellerOptions.map((seller) => (
                                    <button
                                      key={seller.id}
                                      type="button"
                                      onClick={() => handleExportLeads(seller.id)}
                                      className="block w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800"
                                    >
                                      {seller.name}
                                    </button>
                                  ))
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => {
                            setLeadFormError(null);
                            setLeadForm(current => ({
                              ...current,
                              assignedToId: current.assignedToId || sellerOptions[0]?.id || '',
                            }));
                            setIsLeadModalOpen(true);
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/15 px-4 py-2.5 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/25 focus:outline-none focus:ring-2 focus:ring-cyan-500/60 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                          Novo Lead
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={leadSearch}
                        onChange={(e) => setLeadSearch(e.target.value)}
                        placeholder="Buscar por lead ou empresa..."
                        className="w-full rounded-xl border border-slate-800 bg-slate-950/70 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>

                    <div className="grid gap-4 overflow-x-auto pb-4 md:grid-cols-3 xl:grid-cols-5">
                      {pipelineStages.map((stage) => (
                        <div
                          key={stage}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            const leadId = e.dataTransfer.getData('text/plain');
                            if (leadId) {
                              void handleDragEnd(leadId, stage);
                            }
                          }}
                          className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 min-w-[180px] flex flex-col"
                        >
                          <div className="mb-3 border-b border-slate-800/60 pb-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{stage}</p>
                              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                                {loading ? '...' : pipelineStageSummary[stage]?.count ?? 0}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] font-semibold text-emerald-300">
                              {loading ? 'Calculando...' : formatCurrency(pipelineStageSummary[stage]?.total ?? 0)}
                            </p>
                          </div>
                          <div className="mt-1 space-y-2 flex-1 min-h-[250px]">
                            {loading ? (
                              [0, 1, 2].map((item) => (
                                <div key={item} className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
                                  <div className="h-4 w-4/5 animate-pulse rounded bg-slate-800" />
                                  <div className="mt-2 h-3 w-3/5 animate-pulse rounded bg-slate-800/80" />
                                  <div className="mt-4 h-3 w-1/2 animate-pulse rounded bg-slate-800/80" />
                                </div>
                              ))
                            ) : (
                              searchedLeads.filter((lead) => lead.status === stage).map((lead) => {
                                const urgency = getFollowUpUrgency(lead.dataFollowUp);
                                const isEditing = editingFollowUpId === lead.id;
                                return (
                                  <div
                                    key={lead.id}
                                    draggable={!isEditing}
                                    onDragStart={(e) => e.dataTransfer.setData('text/plain', lead.id)}
                                    onClick={() => { if (!isEditing) setSelectedLead(lead); }}
                                    className={`rounded-xl border p-3 text-sm text-slate-300 cursor-pointer bg-slate-900/60 hover:border-cyan-500/40 hover:bg-slate-900/90 transition-all select-none shadow-sm shadow-black/10 ${
                                      urgency === 'overdue'
                                        ? 'border-rose-500/70'
                                        : urgency === 'today'
                                        ? 'border-amber-500/70'
                                        : 'border-slate-800/80'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="font-medium text-slate-100 leading-snug">{lead.title}</p>
                                      <button
                                        type="button"
                                        title="Editar próxima ação"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingFollowUpId(lead.id);
                                          setFollowUpForm({
                                            proximaAcao: lead.proximaAcao || '',
                                            dataFollowUp: toDateInputValue(lead.dataFollowUp),
                                          });
                                        }}
                                        className="flex-shrink-0 rounded-lg border border-slate-800 bg-slate-950/60 p-1 text-slate-400 hover:text-cyan-300"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </button>
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">{lead.client?.name || 'Sem cliente'}</p>
                                    <p className="mt-2 text-xs font-medium text-cyan-400">{formatCurrency(lead.value)}</p>

                                    {isEditing ? (
                                      <div className="mt-3 space-y-2 rounded-lg border border-slate-800 bg-slate-950/70 p-2" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="text"
                                          value={followUpForm.proximaAcao}
                                          onChange={(e) => setFollowUpForm((current) => ({ ...current, proximaAcao: e.target.value }))}
                                          placeholder="Próxima ação (ex: Ligar para alinhar preço)"
                                          className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 placeholder-slate-600 outline-none focus:border-cyan-500"
                                        />
                                        <input
                                          type="date"
                                          value={followUpForm.dataFollowUp}
                                          onChange={(e) => setFollowUpForm((current) => ({ ...current, dataFollowUp: e.target.value }))}
                                          className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500"
                                        />
                                        <div className="flex justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={() => { setEditingFollowUpId(null); setFollowUpForm(emptyFollowUpForm); }}
                                            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
                                          >
                                            Cancelar
                                          </button>
                                          <button
                                            type="button"
                                            disabled={savingFollowUp}
                                            onClick={() => void handleSaveFollowUp(lead.id)}
                                            className="rounded-md bg-cyan-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-cyan-500 disabled:bg-cyan-900"
                                          >
                                            {savingFollowUp ? 'Salvando...' : 'Salvar'}
                                          </button>
                                        </div>
                                      </div>
                                    ) : lead.proximaAcao || lead.dataFollowUp ? (
                                      <div className={`mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] ${
                                        urgency ? 'bg-rose-500/10 text-rose-300' : 'bg-slate-800/60 text-slate-400'
                                      }`}>
                                        {urgency ? <AlertTriangle className="h-3 w-3 flex-shrink-0" /> : <CalendarClock className="h-3 w-3 flex-shrink-0" />}
                                        <span className="truncate">
                                          {lead.proximaAcao || 'Follow-up agendado'}
                                          {lead.dataFollowUp ? ` · ${toDateInputValue(lead.dataFollowUp).split('-').reverse().join('/')}` : ''}
                                          {urgency === 'overdue' ? ' (Atrasado)' : urgency === 'today' ? ' (Hoje)' : ''}
                                        </span>
                                      </div>
                                    ) : (
                                      <p className="mt-1 text-[10px] text-slate-600">Clique para ver detalhes</p>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {activeTab === 'timeline' && !loading && !error && (
                  <div className="space-y-3">
                    {user && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                        <p className="text-sm font-medium text-white">Perfil ativo</p>
                        <p className="mt-2 text-sm text-slate-400">{user.name}</p>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{user.role}</p>
                      </div>
                    )}
                    {timelineItems.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                        <div className="flex items-center gap-2 text-cyan-300">
                          <Sparkles className="h-4 w-4" />
                          <p className="text-sm font-medium text-white">{item.title}</p>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">{item.detail}</p>
                        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">{item.when}</p>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === 'admin' && user?.role === 'ADMIN' && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">Backup do banco de dados</p>
                          <p className="text-xs text-slate-500">Backups automáticos rodam a cada 24h. Últimos 14 são mantidos.</p>
                        </div>
                        <button
                          type="button"
                          disabled={runningBackup}
                          onClick={() => void handleRunBackup()}
                          className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/15 px-4 py-2.5 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <DatabaseBackup className="h-4 w-4" />
                          {runningBackup ? 'Gerando...' : 'Fazer backup agora'}
                        </button>
                      </div>

                      {backupError && (
                        <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{backupError}</div>
                      )}

                      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-800">
                        {backupsLoading ? (
                          <div className="p-4 text-sm text-slate-500">Carregando backups...</div>
                        ) : backups.length === 0 ? (
                          <div className="p-4 text-sm text-slate-500">Nenhum backup encontrado ainda.</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[420px] text-sm">
                              <thead>
                                <tr className="bg-slate-900/80 text-left text-xs uppercase tracking-wider text-slate-400">
                                  <th className="px-4 py-2">Arquivo</th>
                                  <th className="px-4 py-2">Tamanho</th>
                                  <th className="px-4 py-2">Criado em</th>
                                </tr>
                              </thead>
                              <tbody>
                                {backups.map((backup) => (
                                  <tr key={backup.name} className="border-t border-slate-800/60 text-slate-300">
                                    <td className="flex items-center gap-2 px-4 py-2 font-mono text-xs">
                                      <HardDrive className="h-3.5 w-3.5 text-slate-500" />
                                      {backup.name}
                                    </td>
                                    <td className="px-4 py-2 text-xs">{formatBytes(backup.size)}</td>
                                    <td className="px-4 py-2 text-xs">{formatDate(backup.createdAt)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-white">Log de auditoria</p>
                      <p className="text-xs text-slate-500">Últimas 20 alterações em clientes, leads e transações.</p>

                      {auditError && (
                        <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{auditError}</div>
                      )}

                      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-800">
                        {auditLoading ? (
                          <div className="p-4 text-sm text-slate-500">Carregando log de auditoria...</div>
                        ) : auditLogs.length === 0 ? (
                          <div className="p-4 text-sm text-slate-500">Nenhuma alteração registrada ainda.</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[480px] text-sm">
                              <thead>
                                <tr className="bg-slate-900/80 text-left text-xs uppercase tracking-wider text-slate-400">
                                  <th className="px-4 py-2">Ação</th>
                                  <th className="px-4 py-2">Entidade</th>
                                  <th className="px-4 py-2">Usuário</th>
                                  <th className="px-4 py-2">Quando</th>
                                </tr>
                              </thead>
                              <tbody>
                                {auditLogs.map((log) => (
                                  <tr key={log.id} className="border-t border-slate-800/60 text-slate-300">
                                    <td className="px-4 py-2">
                                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                        log.action === 'DELETE'
                                          ? 'bg-rose-500/15 text-rose-300'
                                          : log.action === 'CREATE'
                                          ? 'bg-emerald-500/15 text-emerald-300'
                                          : 'bg-cyan-500/15 text-cyan-300'
                                      }`}>
                                        {auditActionLabel[log.action] ?? log.action}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-xs">{auditEntityLabel[log.entity] ?? log.entity}</td>
                                    <td className="px-4 py-2 text-xs">{log.user?.name ?? '—'}</td>
                                    <td className="px-4 py-2 text-xs">{formatDate(log.createdAt)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
              <div className="flex items-center gap-2 text-cyan-300">
                <TrendingUp className="h-5 w-5" />
                <h2 className="text-lg font-semibold text-white">Dashboard de Métricas</h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {user?.role === 'ADMIN' ? 'Visão consolidada de todo o funil.' : 'Visão restrita aos seus leads.'}
              </p>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <BriefcaseBusiness className="h-4 w-4" />
                    <p className="text-xs uppercase tracking-wider text-slate-400">Receita do Mês</p>
                  </div>
                  {loading || !dashboardMetrics ? (
                    <div className="mt-3 h-8 w-32 animate-pulse rounded-lg bg-slate-800" />
                  ) : (
                    <p className="mt-2 text-2xl font-semibold text-emerald-300">{formatCurrency(dashboardMetrics.receitaDoMes)}</p>
                  )}
                  <p className="mt-1 text-[11px] text-slate-500">Soma de leads Ganho atualizados no mês corrente.</p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex items-center gap-2 text-cyan-300">
                    <Percent className="h-4 w-4" />
                    <p className="text-xs uppercase tracking-wider text-slate-400">Taxa de Conversão</p>
                  </div>
                  {loading || !dashboardMetrics ? (
                    <div className="mt-3 h-8 w-24 animate-pulse rounded-lg bg-slate-800" />
                  ) : (
                    <p className="mt-2 text-2xl font-semibold text-cyan-300">{dashboardMetrics.taxaConversao.toFixed(1)}%</p>
                  )}
                  <p className="mt-1 text-[11px] text-slate-500">
                    {dashboardMetrics ? `${dashboardMetrics.wonLeads} ganho(s) de ${dashboardMetrics.totalLeads} lead(s) no funil.` : 'Leads Ganho / Total de leads.'}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ── Lead Detail Modal ── */}
      {isLeadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsLeadModalOpen(false); }}
        >
          <div className="w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-400">Pipeline</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Novo Lead</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsLeadModalOpen(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 transition hover:bg-slate-700"
                aria-label="Fechar modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-5 px-6 py-5">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">Nome do Lead</label>
                <input
                  type="text"
                  value={leadForm.title}
                  onChange={(e) => setLeadForm(current => ({ ...current, title: e.target.value }))}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  placeholder="Contrato Enterprise"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">Empresa</label>
                <input
                  type="text"
                  value={leadForm.company}
                  onChange={(e) => setLeadForm(current => ({ ...current, company: e.target.value }))}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  placeholder="Nome da empresa"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">Valor Estimado</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={leadForm.value}
                    onChange={(e) => setLeadForm(current => ({ ...current, value: e.target.value }))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">Vendedor Responsavel</label>
                  <select
                    value={leadForm.assignedToId}
                    onChange={(e) => setLeadForm(current => ({ ...current, assignedToId: e.target.value }))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    required
                  >
                    <option value="" disabled>Selecione</option>
                    {sellerOptions.map((seller) => (
                      <option key={seller.id} value={seller.id}>{seller.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {leadFormError && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                  {leadFormError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsLeadModalOpen(false)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingLead || sellerOptions.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:bg-cyan-900 disabled:text-cyan-200"
                >
                  <Plus className="h-4 w-4" />
                  {creatingLead ? 'Salvando...' : 'Criar Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedLead(null); }}
        >
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60">
            {/* Header */}
            <div className="sticky top-0 flex items-start justify-between gap-4 rounded-t-3xl border-b border-slate-800 bg-slate-900 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-400 mb-1">Detalhes do Lead</p>
                <h2 className="text-xl font-semibold text-white leading-snug">{selectedLead.title}</h2>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="flex-shrink-0 mt-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition"
              >
                ✕ Fechar
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Stage badge */}
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                  {selectedLead.status}
                </span>
                {selectedLead.assignedTo && (
                  <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300">
                    Responsável: {selectedLead.assignedTo.name}
                  </span>
                )}
              </div>

              {/* Description */}
              {selectedLead.description && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Descrição</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{selectedLead.description}</p>
                </div>
              )}

              {/* Contract / Negotiation table */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                <p className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">Dados do Contrato</p>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-slate-800/60">
                      <td className="px-4 py-3 text-slate-500 w-1/3">Valor da negociação</td>
                      <td className="px-4 py-3 text-emerald-400 font-semibold">
                        {formatCurrency(selectedLead.value)}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-800/60">
                      <td className="px-4 py-3 text-slate-500">Estágio</td>
                      <td className="px-4 py-3 text-white">{selectedLead.status}</td>
                    </tr>
                    <tr className="border-b border-slate-800/60">
                      <td className="px-4 py-3 text-slate-500">Cliente</td>
                      <td className="px-4 py-3 text-white">{selectedLead.client?.name ?? '—'}</td>
                    </tr>
                    <tr className="border-b border-slate-800/60">
                      <td className="px-4 py-3 text-slate-500">CPF / CNPJ</td>
                      <td className="px-4 py-3 text-white font-mono text-xs">{selectedLead.client?.cpf ?? '—'}</td>
                    </tr>
                    <tr className="border-b border-slate-800/60">
                      <td className="px-4 py-3 text-slate-500">Atualizado em</td>
                      <td className="px-4 py-3 text-white">{formatDate(selectedLead.updatedAt)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-slate-500">Criado em</td>
                      <td className="px-4 py-3 text-white">{formatDate(selectedLead.createdAt)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Interactions / History — shown only if loaded */}
              {Array.isArray((selectedLead as any).interactions) && (selectedLead as any).interactions.length > 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                  <p className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">Histórico da Negociação</p>
                  <ul className="divide-y divide-slate-800/60">
                    {(selectedLead as any).interactions.map((interaction: any) => (
                      <li key={interaction.id} className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] uppercase font-semibold text-slate-300">{interaction.type}</span>
                          <span className="text-[10px] text-slate-500">{formatDate(interaction.date)}</span>
                          {interaction.user && <span className="text-[10px] text-slate-600">por {interaction.user.name}</span>}
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed">{interaction.content}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
