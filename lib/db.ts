import { Pool,QueryResultRow } from 'pg';
declare global {var __comidasPool:Pool|undefined;}
export function pool(){if(!global.__comidasPool){if(!process.env.DATABASE_URL)throw Error('Falta DATABASE_URL');global.__comidasPool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:process.env.DATABASE_SSL_REJECT_UNAUTHORIZED!=='false'}:undefined,max:10});}return global.__comidasPool;}
export async function query<T extends QueryResultRow=QueryResultRow>(sql:string,args:unknown[]=[]){return (await pool().query<T>(sql,args)).rows;}