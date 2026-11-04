import {NextResponse} from 'next/server';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {query} from '@/lib/db';
import {createSession,setSession,badRequest} from '@/lib/auth';
export const runtime='nodejs';
const input=z.object({name:z.string().trim().min(2).max(120),email:z.string().email().max(255).transform(s=>s.trim().toLowerCase()),password:z.string().min(8).max(128)});
export async function GET(){try{const rows=await query<{value:string}>("SELECT value FROM app_settings WHERE key='registration_mode'");return NextResponse.json({registrationMode:rows[0]?.value||'open'});}catch{return NextResponse.json({error:'Configuración no disponible'},{status:500});}}
export async function POST(req:Request){const parsed=input.safeParse(await req.json().catch(()=>null));if(!parsed.success)return badRequest('Datos inválidos: contraseña mínima de 8 caracteres');try{const rows=await query<{value:string}>("SELECT value FROM app_settings WHERE key='registration_mode'");const mode=rows[0]?.value||'open';if(mode==='closed')return badRequest('Registro cerrado',403);const {name,email,password}=parsed.data;const active=mode==='open';const created=await query<{id:number;name:string;email:string;role:'employee';active:boolean}>('INSERT INTO users(name,email,password_hash,role,active) VALUES($1,$2,$3,$4,$5) RETURNING id,name,email,role,active',[name,email,await bcrypt.hash(password,12),'employee',active]);if(!active)return NextResponse.json({pending:true},{status:201});return setSession(NextResponse.json({user:created[0]},{status:201}),await createSession(created[0]));}catch(e){if((e as {code?:string}).code==='23505')return badRequest('Correo ya registrado',409);return NextResponse.json({error:'No se pudo registrar'},{status:500});}}
