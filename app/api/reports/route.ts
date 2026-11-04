import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { getUser, unauthorized, forbidden, badRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { isoDate } from '@/lib/validation';

export const runtime = 'nodejs';

type ReportRow = { date: string; menu_title: string; user_name: string; option_name: string; option_id: number; user_id: number };

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return unauthorized();
  if (user.role !== 'admin') return forbidden();

  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const date = url.searchParams.get('date') || '';
  if (type !== 'daily' && type !== 'monthly') return badRequest('Tipo inválido');
  if (type === 'daily' && !isoDate.safeParse(date).success) return badRequest('Fecha inválida');
  if (type === 'monthly' && !/^\\d{4}-(0[1-9]|1[0-2])$/.test(date)) return badRequest('Mes inválido');

  const where = type === 'daily' ? 'm.menu_date=$1' : "to_char(m.menu_date,'YYYY-MM')=$1";
  let rows: ReportRow[];
  try {
    rows = await query<ReportRow>(
      `SELECT m.menu_date::text AS date, m.title AS menu_title,
              u.id AS user_id, u.name AS user_name,
              mo.id AS option_id, mo.name AS option_name
       FROM orders o
       JOIN menus m ON m.id=o.menu_id
       JOIN users u ON u.id=o.user_id
       JOIN order_items oi ON oi.order_id=o.id
       JOIN menu_options mo ON mo.id=oi.option_id
       WHERE ${where}
       ORDER BY m.menu_date, mo.position, mo.id, u.name`,
      [date]
    );
  } catch (e) {
    console.error('Error consultando datos para PDF:', e);
    return NextResponse.json({ error: 'No se pudieron consultar los pedidos para el reporte' }, { status: 500 });
  }

  try {
    const doc = new PDFDocument({ size: 'A4', margin: 42 });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);
    });

    const ensureSpace = (height: number) => {
      if (doc.y + height > doc.page.height - 55) doc.addPage();
    };

    doc.font('Helvetica-Bold').fontSize(18).fillColor('#172b4d').text('LANSEL | Reporte de comidas');
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(11).fillColor('#566273')
      .text(`${type === 'daily' ? 'Reporte diario' : 'Reporte mensual'}: ${date}`);
    doc.moveDown(0.8);

    const uniqueUsers = new Set(rows.map(r => `${r.date}:${r.user_id}`)).size;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#172b4d')
      .text(`Funcionarios con pedido: ${uniqueUsers}  |  Porciones seleccionadas: ${rows.length}`);
    doc.moveDown(1);

    if (!rows.length) {
      doc.font('Helvetica').fontSize(11).text('Sin pedidos registrados para este período.');
    } else {
      const days = new Map<string, { title: string; dishes: Map<number, { name: string; people: string[] }> }>();
      for (const row of rows) {
        if (!days.has(row.date)) days.set(row.date, { title: row.menu_title, dishes: new Map() });
        const day = days.get(row.date)!;
        if (!day.dishes.has(row.option_id)) day.dishes.set(row.option_id, { name: row.option_name, people: [] });
        day.dishes.get(row.option_id)!.people.push(row.user_name);
      }

      for (const [dayDate, day] of days) {
        ensureSpace(65);
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#172b4d')
          .text(`${dayDate}  |  ${day.title}`);
        doc.moveDown(0.5);

        for (const dish of day.dishes.values()) {
          ensureSpace(48);
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#176344')
            .text(`${dish.name} — ${dish.people.length} ${dish.people.length === 1 ? 'porción' : 'porciones'}`);
          doc.moveDown(0.2);
          for (const name of dish.people) {
            ensureSpace(18);
            doc.font('Helvetica').fontSize(10).fillColor('#172b4d')
              .text(`• ${name}`, { indent: 12 });
          }
          doc.moveDown(0.6);
        }
        doc.moveDown(0.4);
      }
    }

    doc.end();
    const buffer = await done;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="comidas-${type}-${date}.pdf"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    console.error('Error generando PDF:', e);
    return NextResponse.json({ error: 'No se pudo generar el archivo PDF' }, { status: 500 });
  }
}
