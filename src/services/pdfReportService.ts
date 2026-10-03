import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Socio } from '../main';

export interface ReportMetricsData {
  totalSocios: number;
  activos: number;
  porVencer: number;
  vencidos: number;
  totalIncome: number;
  businessName: string;
}

/**
 * Genera y descarga un informe ejecutivo en PDF estilizado profesionalmente
 */
export function generateMonthlyPDFReport(socios: Socio[], metrics: ReportMetricsData) {
  // Crear documento A4 vertical
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = new Date();
  const mesNombre = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const fechaGeneracion = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // 1. BANNER DE CABECERA (Fondo oscuro elegante estilo SaaS)
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Acento color esmeralda en la parte superior
  doc.setFillColor(16, 185, 129); // Emerald 500
  doc.rect(0, 0, pageWidth, 3, 'F');

  // Título de la Cabecera
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(metrics.businessName || 'TITAN FITNESS CENTER', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(52, 211, 153); // Emerald 400
  doc.text('FITADMIN SAAS • REPORTE MENSUAL EJECUTIVO (PESOS $ ARS)', 14, 25);

  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text(`Período: ${mesNombre.toUpperCase()} | Generado: ${fechaGeneracion}`, 14, 32);
  doc.text(`Responsable: Administración General | Moneda: Pesos Argentinos ($ ARS)`, 14, 37);

  // Badge en la cabecera derecha
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.roundedRect(pageWidth - 62, 14, 48, 18, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('ESTADO GENERAL', pageWidth - 58, 20);
  doc.setFontSize(11);
  doc.setTextColor(16, 185, 129);
  doc.text('CARTERA AL DÍA', pageWidth - 58, 27);

  // 2. RESUMEN DE INDICADORES CLAVE (KPIs en cajas)
  let yPos = 50;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Resumen de Ingresos y Cartera de Socios', 14, yPos);

  yPos += 6;
  const boxWidth = (pageWidth - 28 - 9) / 4; // 4 cajas con 3mm de espacio entre ellas
  const boxHeight = 22;

  const kpis = [
    { label: 'FACTURACIÓN MES', val: `$ ${metrics.totalIncome.toLocaleString('es-AR')}`, sub: 'Membresías cobradas', color: [16, 185, 129], bg: [236, 253, 245] },
    { label: 'SOCIOS ACTIVOS', val: `${metrics.activos}`, sub: `${Math.round((metrics.activos / (metrics.totalSocios || 1)) * 100)}% de la cartera`, color: [16, 185, 129], bg: [240, 253, 244] },
    { label: 'POR VENCER (7D)', val: `${metrics.porVencer}`, sub: 'Gestión preventiva', color: [245, 158, 11], bg: [254, 243, 199] },
    { label: 'SOCIOS VENCIDOS', val: `${metrics.vencidos}`, sub: 'Cartera a recuperar', color: [239, 68, 68], bg: [254, 242, 242] }
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (boxWidth + 3);
    // Fondo de la caja
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.setDrawColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, yPos, boxWidth, boxHeight, 2, 2, 'FD');

    // Textos de la caja
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 3.5, yPos + 6);

    doc.setFontSize(12);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, x + 3.5, yPos + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.sub, x + 3.5, yPos + 18.5);
  });

  // 3. DESGLOSE POR PLAN DE MEMBRESÍA
  yPos += boxHeight + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Distribución y Recaudación por Plan', 14, yPos);

  // Calcular agregados por plan
  const planMap = new Map<string, { count: number; total: number; price: number }>();
  socios.forEach(s => {
    const current = planMap.get(s.plan) || { count: 0, total: 0, price: s.precio };
    current.count += 1;
    if (s.estado === 'activo' || s.estado === 'por_vencer') {
      current.total += Number(s.precio) || 0;
    }
    planMap.set(s.plan, current);
  });

  const planRows: any[] = [];
  planMap.forEach((val, planName) => {
    const share = metrics.totalIncome > 0 ? Math.round((val.total / metrics.totalIncome) * 100) : 0;
    planRows.push([
      planName,
      val.count.toString(),
      `$ ${Number(val.price || 0).toLocaleString('es-AR')}`,
      `$ ${Number(val.total || 0).toLocaleString('es-AR')}`,
      `${share}%`
    ]);
  });

  yPos += 3;
  autoTable(doc, {
    startY: yPos,
    head: [['Plan de Entrenamiento', 'Socios Registrados', 'Valor Cuota ($ Pesos)', 'Recaudación Activa ($)', '% Participación']],
    body: planRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // Slate 800
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left'
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [51, 65, 85]
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] },
      4: { halign: 'center' }
    },
    margin: { left: 14, right: 14 }
  });

  // 4. DETALLE DE CARTERA DE SOCIOS
  // @ts-ignore
  let tableEndPos = (doc as any).lastAutoTable.finalY + 10;
  
  // Si queda poco espacio para la tabla detallada, saltamos de página
  if (tableEndPos > pageHeight - 60) {
    doc.addPage();
    tableEndPos = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('3. Detalle Individual de la Cartera de Socios', 14, tableEndPos);

  const socioRows = socios.map(s => {
    const estadoText = s.estado === 'activo' 
      ? 'ACTIVO' 
      : s.estado === 'por_vencer' 
        ? 'POR VENCER' 
        : 'VENCIDO';

    return [
      s.nombre,
      s.email,
      s.telefono,
      s.plan,
      `$ ${Number(s.precio || 0).toLocaleString('es-AR')}`,
      formatDate(s.fecha_fin),
      estadoText
    ];
  });

  autoTable(doc, {
    startY: tableEndPos + 4,
    head: [['Nombre del Socio', 'Correo Electrónico', 'Teléfono', 'Plan', 'Cuota ($ Pesos)', 'Vencimiento', 'Estado']],
    body: socioRows,
    theme: 'striped',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2
    },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [15, 23, 42] },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'center' },
      6: { halign: 'center', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      // Colorear el texto de la columna de estado
      if (data.section === 'body' && data.column.index === 6) {
        const val = data.cell.raw as string;
        if (val === 'ACTIVO') {
          data.cell.styles.textColor = [16, 185, 129]; // Verde
        } else if (val === 'POR VENCER') {
          data.cell.styles.textColor = [217, 119, 6]; // Ámbar
        } else {
          data.cell.styles.textColor = [225, 29, 72]; // Rojo
        }
      }
    },
    margin: { left: 14, right: 14 }
  });

  // 5. PIE DE PÁGINA EN TODAS LAS HOJAS
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('FitAdmin SaaS • Sistema de Gestión para Gimnasios • Documento Confidencial', 14, pageHeight - 9);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 32, pageHeight - 9);
  }

  // Descargar el archivo PDF en el navegador
  const fileName = `Reporte-Mensual-FitAdmin-${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}.pdf`;
  doc.save(fileName);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}
