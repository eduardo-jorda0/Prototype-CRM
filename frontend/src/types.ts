export type LeadStatus = 'NOVO' | 'PROPOSTA' | 'NEGOCIACAO' | 'GANHO' | 'PERDIDO';

export type Lead = {
  id: string;
  title: string;
  status: LeadStatus;
  description?: string | null;
  value?: number;
  proximaAcao?: string | null;
  dataFollowUp?: string | null;
  clientId?: string | null;
  client?: { id: string; name: string; cpf?: string | null } | null;
  assignedToId?: string | null;
  assignedTo?: { id: string; name: string; email?: string; role?: string } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type DashboardMetrics = {
  receitaDoMes: number;
  taxaConversao: number;
  totalLeads: number;
  wonLeads: number;
};

export type Client = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  cpf?: string | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Transaction = {
  id: string;
  description: string;
  amount: number;
  type: string;
  status?: string;
  date?: string;
  clientId: string;
  client?: { id: string; name: string; cpf?: string | null } | null;
};

export type AuditLog = {
  id: string;
  entity: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  changes?: string | null;
  userId: string;
  user?: { id: string; name: string; email?: string; role?: string } | null;
  createdAt: string;
};

export type BackupFile = {
  name: string;
  size: number;
  createdAt: string;
};
