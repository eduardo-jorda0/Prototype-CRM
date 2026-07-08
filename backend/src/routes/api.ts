import { Router } from 'express';
import { register, login, me } from '../controllers/authController';
import {
  createClient,
  listClients,
  getClientById,
  updateClient,
  deleteClient,
} from '../controllers/clientController';
import { createLead, getLeadById, listLeads, updateLead, updateLeadStage, deleteLead, importLeads, getDashboardMetrics } from '../controllers/leadController';
import { createTransaction, getTransactionById, listTransactions, updateTransaction, deleteTransaction } from '../controllers/transactionController';
import { validateImport, executeImport } from '../controllers/importController';
import { addClientInteraction } from '../controllers/interactionController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/uploadMiddleware';
import { validateBody, createClientSchema, createTransactionSchema, updateTransactionSchema, createLeadSchema, updateLeadSchema, updateClientSchema, updateLeadStageSchema, addInteractionSchema, validateQuery, listQuerySchema, importExecuteSchema } from '../middlewares/validate';
import { authorize } from '../middlewares/rbacMiddleware';
import { Role } from '../constants/roles';
import { listUploads, deleteUpload, cleanupUploads } from '../controllers/uploadController';
import { listAuditLogs } from '../controllers/auditController';
import { runBackupNow, listBackups } from '../controllers/backupController';

const router = Router();

// Autenticação
router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', authMiddleware, me);

// Clientes
router.post('/clients', authMiddleware, validateBody(createClientSchema), createClient);
router.get('/clients', authMiddleware, validateQuery(listQuerySchema), listClients);
router.get('/clients/:id', authMiddleware, getClientById);
router.put('/clients/:id', authMiddleware, authorize([Role.ADMIN, Role.ASSESSOR]), validateBody(updateClientSchema), updateClient);
router.delete('/clients/:id', authMiddleware, authorize([Role.ADMIN]), deleteClient);

// Leads
router.post('/leads', authMiddleware, authorize([Role.ADMIN, Role.CLOSER, Role.ASSESSOR]), validateBody(createLeadSchema), createLead);
router.post('/leads/import', authMiddleware, authorize([Role.ADMIN, Role.CLOSER, Role.ASSESSOR]), importLeads);
router.get('/leads', authMiddleware, validateQuery(listQuerySchema), listLeads);
router.get('/leads/:id', authMiddleware, getLeadById);
router.put('/leads/:id', authMiddleware, authorize([Role.ADMIN, Role.CLOSER, Role.ASSESSOR]), validateBody(updateLeadSchema), updateLead);
router.delete('/leads/:id', authMiddleware, authorize([Role.ADMIN]), deleteLead);
router.put('/leads/:id/stage', authMiddleware, authorize([Role.ADMIN, Role.CLOSER, Role.ASSESSOR]), validateBody(updateLeadStageSchema), updateLeadStage);

// Dashboard
router.get('/dashboard/metrics', authMiddleware, getDashboardMetrics);

// Transações
router.post('/transactions', authMiddleware, authorize([Role.ADMIN, Role.CLOSER, Role.ASSESSOR]), validateBody(createTransactionSchema), createTransaction);
router.get('/transactions', authMiddleware, validateQuery(listQuerySchema), listTransactions);
router.get('/transactions/:id', authMiddleware, getTransactionById);
router.put('/transactions/:id', authMiddleware, authorize([Role.ADMIN, Role.CLOSER, Role.ASSESSOR]), validateBody(updateTransactionSchema), updateTransaction);
router.delete('/transactions/:id', authMiddleware, authorize([Role.ADMIN, Role.CLOSER]), deleteTransaction);

// Interações / Timeline
router.post('/clients/:id/interactions', authMiddleware, validateBody(addInteractionSchema), addClientInteraction);

// Upload management
router.get('/uploads', authMiddleware, authorize([Role.ADMIN, Role.ASSESSOR]), listUploads);
router.delete('/uploads/:filename', authMiddleware, authorize([Role.ADMIN]), deleteUpload);
router.post('/uploads/cleanup', authMiddleware, authorize([Role.ADMIN]), (req, res) => {
  const removed = cleanupUploads(Number(req.query.hours) || 24);
  res.json({ removed });
});

// Importação
router.post('/import/validate', authMiddleware, upload.single('file'), validateImport);
router.post('/import/execute', authMiddleware, validateBody(importExecuteSchema), executeImport);

// Auditoria
router.get('/audit-logs', authMiddleware, authorize([Role.ADMIN]), listAuditLogs);

// Backup
router.get('/system/backups', authMiddleware, authorize([Role.ADMIN]), listBackups);
router.post('/system/backups', authMiddleware, authorize([Role.ADMIN]), runBackupNow);

export default router;
