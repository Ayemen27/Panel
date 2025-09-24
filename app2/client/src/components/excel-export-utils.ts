// Dynamic import for ExcelJS to improve bundle optimization

// Company Information
export const COMPANY_INFO = {
  name: 'شركة الإدارة الهندسية',
  address: 'المملكة العربية السعودية',
  phone: '+966 XX XXXX XXX',
  email: 'info@company.com',
  logo: null
};

// Excel Styles
export const EXCEL_STYLES = {
  header: {
    font: { bold: true, size: 14, color: { argb: 'FFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F46E5' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  },
  subHeader: {
    font: { bold: true, size: 12 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3F4F6' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  },
  cell: {
    font: { size: 10 },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  },
  currency: {
    font: { size: 10 },
    alignment: { horizontal: 'right', vertical: 'middle' },
    numFmt: '#,##0.00" ريال"',
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  }
};

// Add Report Header
export function addReportHeader(
  worksheet: any, // ExcelJS.Worksheet
  title: string,
  dateRange?: string
): void {
  // Merge cells for company header
  worksheet.mergeCells('A1:F1');
  const companyCell = worksheet.getCell('A1');
  companyCell.value = COMPANY_INFO.name;
  companyCell.font = { bold: true, size: 16 };
  companyCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Title
  worksheet.mergeCells('A2:F2');
  const titleCell = worksheet.getCell('A2');
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Date range if provided
  if (dateRange) {
    worksheet.mergeCells('A3:F3');
    const dateCell = worksheet.getCell('A3');
    dateCell.value = dateRange;
    dateCell.font = { size: 12 };
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  // Add empty row
  worksheet.addRow([]);
}

// Format Currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2
  }).format(amount || 0);
}

// Export to Excel generic function (now uses dynamic import)
export async function exportToExcel(
  data: any[],
  fileName: string,
  sheetName: string,
  columns: Array<{ key: string; header: string; width?: number }>
): Promise<void> {
  // Dynamic import for ExcelJS
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // Set column headers and widths
  worksheet.columns = columns.map(col => ({
    key: col.key,
    header: col.header,
    width: col.width || 15
  }));

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell: any) => {
    Object.assign(cell, EXCEL_STYLES.header);
  });

  // Add data
  data.forEach(item => {
    worksheet.addRow(item);
  });

  // Style data rows
  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    row.eachCell((cell: any) => {
      Object.assign(cell, EXCEL_STYLES.cell);
    });
  }

  // Generate buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  // Create download link
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.xlsx`;
  link.click();
  window.URL.revokeObjectURL(url);
}