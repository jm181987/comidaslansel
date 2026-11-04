import { NextResponse } from 'next/server';
import { getUser, unauthorized, forbidden, badRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { getOrderMode } from '@/lib/order-policy';
export const runtime = 'nodejs';
export async function GET() {
  const user = await getUser();
  if (!user) return unauthorized();
  try { const rows=await query<{value:string}>("SELECT value FROM app_settings WHERE key='registration_mode'");return NextResponse.json({orderMode:await getOrderMode(),registrationMode:rows[0]?.value||'open'}); }
  catch(e) { console.error('Settings GET:',e); return NextResponse.json({error:'No se pudo leer la configuración. Ejecute la migración SQL.'},{status:500}); }
}
export async function PUT(req: Request) {
  const user = await getUser();
  if (!user) return unauthorized();
  if (user.role !== 'admin') return forbidden();
  const data = await req.json().catch(()=>null);
  if(['open','approval','closed'].includes(data?.registrationMode)){await query("INSERT INTO app_settings(key,value) VALUES('registration_mode',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",[data.registrationMode]);return NextResponse.json({registrationMode:data.registrationMode})}if (data?.orderMode !== 'today' && data?.orderMode !== 'today_and_future') return badRequest('Modo de pedidos inválido');
  try {
    await query("INSERT INTO app_settings(key,value) VALUES('order_mode',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",[data.orderMode]);
    return NextResponse.json({orderMode:data.orderMode});
  } catch(e) {console.error('Settings PUT:',e);return NextResponse.json({error:'No se pudo guardar la configuración. Ejecute la migración SQL.'},{status:500});}
}
