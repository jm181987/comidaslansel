import { query } from '@/lib/db';

export type OrderMode = 'today' | 'today_and_future';
export async function getOrderMode(): Promise<OrderMode> {
  const rows = await query<{ value: string }>("SELECT value FROM app_settings WHERE key='order_mode'");
  return rows[0]?.value === 'today_and_future' ? 'today_and_future' : 'today';
}
export function montevideoToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Montevideo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get = (type: string) => parts.find(p=>p.type===type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function dateAllowed(date: string, mode: OrderMode): boolean {
  const today = montevideoToday();
  return mode === 'today' ? date === today : date >= today;
}

export const ORDER_CUTOFF_MESSAGE='Pedidos aceptados hasta la hora 11:30';
export function isTodayCutoffPassed(now=new Date()):boolean {
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Montevideo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const hour=Number(parts.find(p=>p.type==='hour')?.value);
 const minute=Number(parts.find(p=>p.type==='minute')?.value);
 return hour*60+minute>=11*60+30;
}
export function isOrderCutoff(date:string,now=new Date()):boolean {
 return date===montevideoToday()&&isTodayCutoffPassed(now);
}
