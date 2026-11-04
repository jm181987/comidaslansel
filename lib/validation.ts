import {z} from 'zod';
export const isoDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v,'Fecha inválida');
export const menuSchema=z.object({date:isoDate,title:z.string().trim().min(2).max(120),options:z.array(z.string().trim().min(2).max(200)).min(1).max(30)});
export const userSchema=z.object({name:z.string().trim().min(2).max(120),email:z.email().toLowerCase(),password:z.string().min(8).max(128).optional(),role:z.enum(['admin','employee']),active:z.boolean().default(true)});
export const orderSchema=z.object({date:isoDate,optionIds:z.array(z.number().int().positive()).min(1).max(30)});
export const jsonError=(e:unknown)=>e instanceof z.ZodError?e.issues[0]?.message||'Datos inválidos':e instanceof Error?e.message:'Error inesperado';