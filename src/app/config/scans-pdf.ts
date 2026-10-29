import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { ScanRecord } from '../core/models';

const PAGE_MARGIN = 15;
const QR_SIZE = 22;
const ROW_PADDING = 3;
const HEADER_HEIGHT = 8;
const RED: [number, number, number] = [238, 0, 0];
const WINNER_FILL: [number, number, number] = [252, 232, 232];

/** Column x positions and widths in mm on an A4 portrait page. */
const COLUMNS = {
  number: { x: PAGE_MARGIN, w: 12 },
  qr: { x: PAGE_MARGIN + 12, w: QR_SIZE + 4 },
  code: { x: PAGE_MARGIN + 38, w: 70 },
  winner: { x: PAGE_MARGIN + 110, w: 16 },
  station: { x: PAGE_MARGIN + 126, w: 22 },
  time: { x: PAGE_MARGIN + 148, w: 32 },
};

const pad = (n: number) => String(n).padStart(2, '0');

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Builds a PDF with one row per scan, including its QR code, oldest scan first. */
export async function buildScansPdf(scans: ScanRecord[], source: string): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const winners = scans.filter((s) => s.winner).length;

  const qrImages = await Promise.all(
    scans.map((s) =>
      QRCode.toDataURL(s.code, {
        margin: 1,
        width: 256,
        color: { dark: '#151515', light: '#ffffff' },
      }),
    ),
  );

  let y = PAGE_MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Win a Fedora – scanned codes', PAGE_MARGIN, y + 6);
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.8);
  doc.line(PAGE_MARGIN, y + 9, pageWidth - PAGE_MARGIN, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    [
      `Exported: ${formatTime(new Date().toISOString())}`,
      `Source: ${source}`,
      `Scans: ${scans.length} · Winners: ${winners}`,
    ],
    PAGE_MARGIN,
    y + 15,
  );
  y += 30;

  const drawHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(21, 21, 21);
    const labels: [keyof typeof COLUMNS, string][] = [
      ['number', '#'],
      ['qr', 'QR'],
      ['code', 'Code'],
      ['winner', 'Winner'],
      ['station', 'Station'],
      ['time', 'Time'],
    ];
    for (const [key, label] of labels) doc.text(label, COLUMNS[key].x + 1, y + 5);
    doc.setDrawColor(21, 21, 21);
    doc.setLineWidth(0.3);
    doc.line(PAGE_MARGIN, y + HEADER_HEIGHT, pageWidth - PAGE_MARGIN, y + HEADER_HEIGHT);
    y += HEADER_HEIGHT;
    doc.setFont('helvetica', 'normal');
  };

  drawHeader();

  scans.forEach((scan, i) => {
    doc.setFontSize(9);
    doc.setFont('courier', 'normal');
    const codeLines: string[] = doc.splitTextToSize(scan.code, COLUMNS.code.w - 2);
    doc.setFont('helvetica', 'normal');
    const stationLines: string[] = doc.splitTextToSize(scan.station ?? '', COLUMNS.station.w - 2);
    const textHeight = Math.max(codeLines.length, stationLines.length) * 4;
    const rowHeight = Math.max(QR_SIZE, textHeight) + ROW_PADDING * 2;

    if (y + rowHeight > pageHeight - PAGE_MARGIN) {
      doc.addPage();
      y = PAGE_MARGIN;
      drawHeader();
    }

    if (scan.winner) {
      doc.setFillColor(...WINNER_FILL);
      doc.rect(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN * 2, rowHeight, 'F');
    }

    const textY = y + ROW_PADDING + 4;
    doc.text(String(scan.number), COLUMNS.number.x + 1, textY);
    doc.addImage(qrImages[i], 'PNG', COLUMNS.qr.x + 1, y + ROW_PADDING, QR_SIZE, QR_SIZE);
    doc.setFont('courier', 'normal');
    doc.text(codeLines, COLUMNS.code.x + 1, textY);
    doc.setFont('helvetica', scan.winner ? 'bold' : 'normal');
    if (scan.winner) doc.setTextColor(...RED);
    doc.text(scan.winner ? 'Yes' : 'No', COLUMNS.winner.x + 1, textY);
    doc.setTextColor(21, 21, 21);
    doc.setFont('helvetica', 'normal');
    doc.text(stationLines, COLUMNS.station.x + 1, textY);
    doc.text(formatTime(scan.timestamp), COLUMNS.time.x + 1, textY);

    y += rowHeight;
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.2);
    doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
  });

  const pages = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.text(`Page ${p} / ${pages}`, pageWidth - PAGE_MARGIN, pageHeight - 7, { align: 'right' });
  }

  return doc;
}
