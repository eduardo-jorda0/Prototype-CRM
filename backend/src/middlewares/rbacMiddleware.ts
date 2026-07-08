import { Request, Response, NextFunction } from 'express';
import type { RoleType } from '../constants/roles';

export function authorize(roles: RoleType[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    if (!roles.includes(user.role as RoleType)) {
      return res.status(403).json({ error: 'Acesso não autorizado para esta função' });
    }

    return next();
  };
}
