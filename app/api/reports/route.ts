import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { getUser, unauthorized, forbidden, badRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { isoDate } from '@/lib/validation';

export const runtime = 'nodejs';
type ReportRow = { date:string; menu_title:string; user_name:string; option_name:string; option_id:number; user_id:number };
type Dish = { name:string; people:string[] };
type Day = { title:string; dishes:Map<number,Dish>; users:Set<number>; portions:number };
const moneylessDate=(value:string)=>new Date(value+'T12:00:00Z').toLocaleDateString('es-UY',{timeZone:'UTC',weekday:'long',day:'2-digit',month:'long',year:'numeric'});
const monthLabel=(value:string)=>new Date(value+'-01T12:00:00Z').toLocaleDateString('es-UY',{timeZone:'UTC',month:'long',year:'numeric'});

export async function GET(req:Request){
 const user=await getUser();
 if(!user)return unauthorized();
 if(user.role!=='admin')return forbidden();
 const url=new URL(req.url);
 const type=url.searchParams.get('type');
 const date=url.searchParams.get('date')||'';
 if(type!=='daily'&&type!=='monthly')return badRequest('Tipo inválido');
 if(type==='daily'&&!isoDate.safeParse(date).success)return badRequest('Fecha inválida');
 if(type==='monthly'&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(date))return badRequest('Mes inválido');
 const where=type==='daily'?'m.menu_date=$1::date':"m.menu_date >= $1::date AND m.menu_date < ($1::date + INTERVAL '1 month')";
 let rows:ReportRow[];
 try{
  rows=await query<ReportRow>(`SELECT m.menu_date::text AS date,m.title AS menu_title,u.id AS user_id,u.name AS user_name,mo.id AS option_id,mo.name AS option_name
   FROM orders o JOIN menus m ON m.id=o.menu_id JOIN users u ON u.id=o.user_id
   JOIN order_items oi ON oi.order_id=o.id JOIN menu_options mo ON mo.id=oi.option_id
   WHERE ${where} ORDER BY m.menu_date,mo.position,mo.id,u.name`,[type==='daily'?date:date+'-01']);
 }catch(e){console.error('Report query error',e);return NextResponse.json({error:'No se pudieron consultar los pedidos para el reporte'},{status:500})}
 try{
  const days=new Map<string,Day>();
  const totalDishes=new Map<string,number>();
  const uniqueOrders=new Set<string>();
  for(const row of rows){
   if(!days.has(row.date))days.set(row.date,{title:row.menu_title,dishes:new Map(),users:new Set(),portions:0});
   const day=days.get(row.date)!;
   day.users.add(row.user_id);day.portions++;
   uniqueOrders.add(row.date+':'+row.user_id);
   if(!day.dishes.has(row.option_id))day.dishes.set(row.option_id,{name:row.option_name,people:[]});
   day.dishes.get(row.option_id)!.people.push(row.user_name);
   totalDishes.set(row.option_name,(totalDishes.get(row.option_name)||0)+1);
  }
  const doc=new PDFDocument({size:'A4',margin:42,bufferPages:false});
  const buffers:Buffer[]=[];
  doc.on('data',(chunk:Buffer)=>buffers.push(chunk));
  const done=new Promise<Buffer>((resolve,reject)=>{doc.on('end',()=>resolve(Buffer.concat(buffers)));doc.on('error',reject)});
  const left=42,right=553,bottom=788,width=right-left;
  const navy='#173c56',green='#087253',muted='#617484',light='#f0f5f7';
  let page=1;
  function header(){
   doc.rect(0,0,595,9).fill(green);
   doc.font('Helvetica-Bold').fontSize(17).fillColor(navy).text('LANSEL  |  CONTROL DE COMIDAS',left,34);
   doc.font('Helvetica').fontSize(10).fillColor(muted).text(type==='monthly'?'REPORTE MENSUAL':'REPORTE DIARIO',left,58);
   doc.moveTo(left,78).lineTo(right,78).strokeColor('#d9e4e7').stroke();
   doc.y=96;
  }
  function footer(){
   doc.font('Helvetica').fontSize(8).fillColor(muted).text('LANSEL  •  Reporte generado automáticamente',left,810,{width:390,lineBreak:false});
   doc.text('Página '+page,480,810,{width:73,align:'right',lineBreak:false});
  }
  function newPage(){footer();doc.addPage();page++;header()}
  function ensure(h:number){if(doc.y+h>bottom)newPage()}
  function line(label:string,value:string,emphasis=false){
   doc.font(emphasis?'Helvetica-Bold':'Helvetica').fontSize(10);
   const h=Math.max(doc.heightOfString(label,{width:380}),doc.heightOfString(value,{width:80}))+13;
   ensure(h);
   const y=doc.y;
   if(emphasis)doc.rect(left,y,width,h).fill('#e5f2eb');
   doc.fillColor(navy).text(label,left+9,y+6,{width:375});
   doc.text(value,right-88,y+6,{width:78,align:'right'});
   doc.y=y+h;
   doc.moveTo(left,doc.y).lineTo(right,doc.y).strokeColor('#e4eaee').stroke();
  }
  header();
  const period=type==='monthly'?monthLabel(date):moneylessDate(date);
  doc.font('Helvetica-Bold').fontSize(20).fillColor(navy).text(period.charAt(0).toUpperCase()+period.slice(1));
  doc.moveDown(.4);
  doc.font('Helvetica').fontSize(10).fillColor(muted).text('Detalle organizado por fecha, plato y funcionario.');
  doc.moveDown(1.0);
  const metrics=[['DÍAS CON PEDIDOS',String(days.size)],['PEDIDOS',String(uniqueOrders.size)],['PORCIONES',String(rows.length)]];
  const metricW=(width-16)/3;
  const metricY=doc.y;
  metrics.forEach(([label,value],i)=>{
   const x=left+i*(metricW+8);
   doc.roundedRect(x,metricY,metricW,58,7).fill(light);
   doc.font('Helvetica-Bold').fontSize(18).fillColor(navy).text(value,x+9,metricY+9,{width:metricW-18});
   doc.font('Helvetica').fontSize(8).fillColor(muted).text(label,x+9,metricY+36,{width:metricW-18});
  });
  doc.y=metricY+78;
  if(!days.size){
   doc.font('Helvetica').fontSize(12).fillColor(muted).text('No hay pedidos registrados para el período seleccionado.');
  }else{
   let dayNumber=0;
   for(const [dayDate,day] of days){
    dayNumber++;
    ensure(108);
    const y=doc.y;
    doc.roundedRect(left,y,width,53,7).fill(navy);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#ffffff').text(`DÍA ${dayNumber}  ·  ${moneylessDate(dayDate).toUpperCase()}`,left+12,y+9,{width:width-24});
    doc.font('Helvetica').fontSize(9).fillColor('#d8e7ed').text(`${day.title}  |  ${day.users.size} pedidos  |  ${day.portions} porciones`,left+12,y+31,{width:width-24});
    doc.y=y+65;
    for(const dish of day.dishes.values()){
     ensure(50);
     const nameY=doc.y;
     doc.rect(left,nameY,width,27).fill('#eaf3ee');
     doc.font('Helvetica-Bold').fontSize(10).fillColor(green).text(dish.name,left+10,nameY+7,{width:width-92});
     doc.text(String(dish.people.length)+' porciones',right-90,nameY+7,{width:80,align:'right'});
     doc.y=nameY+32;
     for(const person of dish.people){
      doc.font('Helvetica').fontSize(9);
      const h=Math.max(21,doc.heightOfString(person,{width:width-38})+10);
      ensure(h);
      const py=doc.y;
      doc.fillColor(muted).text('•',left+11,py+4,{width:12});
      doc.fillColor(navy).text(person,left+27,py+4,{width:width-38});
      doc.y=py+h;
     }
     doc.y+=5;
    }
    ensure(33);
    line('SUBTOTAL DEL DÍA',day.portions+' porciones',true);
    doc.y+=24;
   }
   ensure(140);
   if(type==='monthly'&&doc.y>480)newPage();
   ensure(95);
   const sy=doc.y;
   doc.roundedRect(left,sy,width,48,7).fill(navy);
   doc.font('Helvetica-Bold').fontSize(14).fillColor('#ffffff').text('RESUMEN FINAL DEL PERÍODO',left+12,sy+14,{width:width-24});
   doc.y=sy+59;
   doc.font('Helvetica').fontSize(9).fillColor(muted).text('TOTAL DE PORCIONES POR PLATO');
   doc.y+=11;
   for(const [dish,count] of [...totalDishes].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])))line(dish,String(count));
   doc.y+=7;
   line('TOTAL GENERAL DE PORCIONES',String(rows.length),true);
   line('TOTAL DE PEDIDOS',String(uniqueOrders.size),true);
  }
  footer();doc.end();
  const buffer=await done;
  return new NextResponse(new Uint8Array(buffer),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="comidas-${type}-${date}.pdf"`,'Cache-Control':'no-store'}});
 }catch(e){console.error('PDF generation error',e);return NextResponse.json({error:'No se pudo generar el archivo PDF'},{status:500})}
}
