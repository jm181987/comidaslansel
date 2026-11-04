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
