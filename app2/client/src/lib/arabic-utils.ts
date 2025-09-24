export function formatArabicTime(date: Date): string {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const time = date.toLocaleTimeString('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Convert English numerals to Arabic numerals
  return time.replace(/\d/g, (digit) => arabicNumerals[parseInt(digit)]);
}

export function formatArabicDate(date: Date): string {
  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatArabicNumber(num: number): string {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num.toString().replace(/\d/g, (digit) => arabicNumerals[parseInt(digit)]);
}

export function formatEnglishNumber(num: number): string {
  if (isNaN(num) || !isFinite(num)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function getArabicErrorLevel(level: string): string {
  const translations = {
    'CRITICAL': 'حرج',
    'ERROR': 'خطأ',
    'WARNING': 'تحذير',
    'INFO': 'معلومات',
    'SUCCESS': 'نجاح',
    'DEBUG': 'تشخيص'
  };
  
  return translations[level as keyof typeof translations] || level;
}

export function getArabicServiceStatus(status: string): string {
  const translations = {
    'operational': 'يعمل بكفاءة',
    'degraded': 'أداء متدهور', 
    'down': 'غير متاح',
    'maintenance': 'تحت الصيانة',
    'unknown': 'غير معروف'
  };
  
  return translations[status as keyof typeof translations] || status;
}

export function getRelativeTimeInArabic(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) {
    return 'الآن';
  } else if (diffMinutes < 60) {
    return `منذ ${diffMinutes} دقيقة`;
  } else if (diffHours < 24) {
    return `منذ ${diffHours} ساعة`;
  } else {
    return `منذ ${diffDays} يوم`;
  }
}

export function truncateArabicText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
