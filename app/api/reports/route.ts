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
  if (type === 'monthly' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(date)) return badRequest('Mes inválido');

  const where = type === 'daily' ? 'm.menu_date=$1::date' : "m.menu_date >= $1::date AND m.menu_date < ($1::date + INTERVAL '1 month')";
  const queryDate = type === 'daily' ? date : `${date}-01`;
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
      [queryDate]
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

      const left = 42;
      const widths = [215, 245, 51];
      const x = [left, left + widths[0], left + widths[0] + widths[1]];
      const tableWidth = widths.reduce((sum, width) => sum + width, 0);
      const bottom = 785;
      const headerHeight = 27;
      const padding = 7;

      const tableHeader = () => {
        if (doc.y + headerHeight > bottom) doc.addPage();
        const y = doc.y;
        doc.rect(left, y, tableWidth, headerHeight).fill('#173c56');
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
        doc.text('PLATO SELECCIONADO', x[0] + padding, y + 8, { width: widths[0] - padding * 2, lineBreak: false });
        doc.text('FUNCIONARIO', x[1] + padding, y + 8, { width: widths[1] - padding * 2, lineBreak: false });
        doc.text('CANT.', x[2] + 3, y + 8, { width: widths[2] - 6, align: 'center', lineBreak: false });
        doc.y = y + headerHeight;
      };

      const fitRow = (height: number) => {
        if (doc.y + height > bottom) {
          doc.addPage();
          tableHeader();
        }
      };

      let stripe = 0;
      const drawRow = (dish: string, person: string, count: number, subtotal = false) => {
        doc.font(subtotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        const textWidth = (index: number) => widths[index] - padding * 2;
        const height = Math.max(
          doc.heightOfString(dish, { width: textWidth(0) }),
          doc.heightOfString(person, { width: textWidth(1) }),
          12
        ) + 13;
        fitRow(height);
        const y = doc.y;
        const fill = subtotal ? '#dcece7' : stripe++ % 2 === 0 ? '#f3f6f8' : '#ffffff';
        doc.rect(left, y, tableWidth, height).fill(fill);
        doc.font(subtotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#203345');
        doc.text(dish, x[0] + padding, y + 6, { width: textWidth(0) });
        doc.text(person, x[1] + padding, y + 6, { width: textWidth(1) });
        doc.text(String(count), x[2] + 3, y + 6, { width: widths[2] - 6, align: 'center' });
        doc.y = y + height;
      };

      const totalsByDish = new Map<string, number>();
      for (const [dayDate, day] of days) {
        if (doc.y + 90 > bottom) doc.addPage();
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#173c56')
          .text(`${dayDate}  |  ${day.title}`);
        doc.moveDown(0.45);
        tableHeader();

        for (const dish of day.dishes.values()) {
          for (const [index, person] of dish.people.entries()) {
            drawRow(index === 0 ? dish.name : '', person, 1);
          }
          totalsByDish.set(dish.name, (totalsByDish.get(dish.name) || 0) + dish.people.length);
        }
        doc.moveDown(1.2);
      }

      if (doc.y + 100 > bottom) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#173c56').text('RESUMEN FINAL DEL PERÍODO', 42, doc.y, { width: 511, lineBreak: false });
      doc.moveDown(0.5);
      tableHeader();
      for (const [dishName, count] of totalsByDish) {
        drawRow(dishName, 'Subtotal por plato', count, true);
      }
      drawRow('TOTAL GENERAL', 'Todas las porciones', rows.length, true);
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
