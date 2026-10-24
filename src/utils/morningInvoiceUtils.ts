/**
 * =========================================================================
 * Morning (Green Invoice) Official Catalog Items & Line Formatter - הריזורט לכלב
 * Enforces Rule 36: Strict 2-Row Layout on all Tax Invoices / Receipts (320)
 * =========================================================================
 */

export const MORNING_CATALOG_ITEMS = {
  RESORT_DEFAULT: {
    id: '5a0cd740-9c57-4f41-9ff7-059f9ca89f6a',
    name: 'הריזורט לכלב',
    price: 0
  },
  BOARDING: {
    id: 'be8dca87-e26e-45fb-b746-128d93e9317b',
    name: 'שירותי פנסיון',
    price: 0
  },
  TRAINING: {
    id: 'd9d15fab-bd75-4eb2-832f-72cf76c5b16d',
    name: 'אילוף כלבים',
    price: 0
  },
  DAYCARE: {
    id: 'c0086288-d22c-4f1a-a8fd-bd57accab375',
    name: 'שהות יומית',
    price: 0
  },
  PASS: {
    id: 'd2ca2291-8ec0-4131-9c8d-edbccfce55d5',
    name: 'כרטיסיית ימי שהייה',
    price: 0
  },
  EXTRA: {
    id: '26823baf-73ac-4986-92e7-1a356d66c383',
    name: 'שירותי אקסטרה',
    price: 0
  }
} as const;

/**
 * Format date to DD.MM.YY (2-digit year) as strictly mandated by Hagai
 * Examples: '2026-10-24' -> '24.10.26', '24.10.2026' -> '24.10.26'
 */
export function formatDateYY(raw?: string): string {
  if (!raw) return '';
  const str = String(raw).trim();
  
  if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2].length === 4 ? parts[2].slice(2) : parts[2];
      return `${day}.${month}.${year}`;
    }
  }

  const dateOnly = str.split('T')[0];
  const parts = dateOnly.split('-');
  if (parts.length === 3) {
    const day = parts[2].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[0].length === 4 ? parts[0].slice(2) : parts[0];
    return `${day}.${month}.${year}`;
  }

  return str;
}

export interface BuildInvoiceLineParams {
  serviceType?: string;
  dogName?: string;
  startDate?: string;
  endDate?: string;
  extraDescription?: string;
  passType?: 'days' | 'nights';
  passCount?: number | string;
  amount?: number;
}

/**
 * Builds the exact 2nd row description string as mandated by Hagai:
 * - פנסיון: עבור שירותי פנסיון ל "שם הכלב" לתאריכים DD.MM.YY עד DD.MM.YY
 * - אילוף: בעבור אילוף ל "שם הכלב"
 * - יומיות: בעבור יומיות ל "שם הכלב" לתאריך DD.MM.YY (או לתאריכים...)
 * - כרטיסיה: בעבור כרטיסיה ל XX ימי שהיה / בעבור כרטיסיה ל XXX יממות שהיה
 * - אקסטרה: בעבור + [הטקסט שכתוב באקסטרה]
 */
export function buildMorningServiceDescription(params: BuildInvoiceLineParams): {
  serviceDescription: string;
  catalogItem: typeof MORNING_CATALOG_ITEMS[keyof typeof MORNING_CATALOG_ITEMS];
} {
  const cleanDog = (params.dogName || '').trim();
  const sType = String(params.serviceType || '').toLowerCase();
  const extra = (params.extraDescription || '').trim();

  // 1. Extra charge (אקסטרה)
  if (extra) {
    let cleanExtra = extra;
    if (cleanExtra.startsWith('בעבור ')) {
      cleanExtra = cleanExtra.slice(6).trim();
    } else if (cleanExtra.startsWith('עבור ')) {
      cleanExtra = cleanExtra.slice(5).trim();
    }
    return {
      serviceDescription: `בעבור ${cleanExtra}`,
      catalogItem: MORNING_CATALOG_ITEMS.EXTRA
    };
  }

  // 2. Training (אילוף)
  if (sType.includes('training') || sType.includes('אילוף')) {
    return {
      serviceDescription: cleanDog ? `בעבור אילוף ל "${cleanDog}"` : `בעבור אילוף`,
      catalogItem: MORNING_CATALOG_ITEMS.TRAINING
    };
  }

  // 3. Daycare (יומיות)
  if (sType.includes('daycare') || sType.includes('יומית') || sType.includes('יומיות')) {
    const startStr = formatDateYY(params.startDate);
    const endStr = formatDateYY(params.endDate);
    const datesStr = (endStr && endStr !== startStr) 
      ? `לתאריכים ${startStr} עד ${endStr}` 
      : (startStr ? `לתאריך ${startStr}` : '');

    return {
      serviceDescription: cleanDog
        ? `בעבור יומיות ל "${cleanDog}"${datesStr ? ` ${datesStr}` : ''}`
        : `בעבור יומיות${datesStr ? ` ${datesStr}` : ''}`,
      catalogItem: MORNING_CATALOG_ITEMS.DAYCARE
    };
  }

  // 4. Pass / Bank of days (כרטיסיה)
  if (sType.includes('pass') || sType.includes('כרטיסיה') || sType.includes('כרטיסייה')) {
    const count = params.passCount || 10;
    const unitWord = params.passType === 'nights' ? 'יממות שהיה' : 'ימי שהיה';
    return {
      serviceDescription: `בעבור כרטיסיה ל ${count} ${unitWord}`,
      catalogItem: MORNING_CATALOG_ITEMS.PASS
    };
  }

  // 5. Boarding (פנסיון ואירוח) - Default
  const startStr = formatDateYY(params.startDate);
  const endStr = formatDateYY(params.endDate);
  const datesStr = (endStr && endStr !== startStr) 
    ? `לתאריכים ${startStr} עד ${endStr}` 
    : (startStr ? `לתאריך ${startStr}` : '');

  return {
    serviceDescription: cleanDog
      ? `עבור שירותי פנסיון ל "${cleanDog}"${datesStr ? ` ${datesStr}` : ''}`
      : `עבור שירותי פנסיון${datesStr ? ` ${datesStr}` : ''}`,
    catalogItem: MORNING_CATALOG_ITEMS.BOARDING
  };
}

/**
 * Builds the exact two-row income array for Morning tax invoices / receipts (type 320):
 * Row 1: "הריזורט לכלב" | price: 0 (חיוב 0 שקלים)
 * Row 2: Service line | price: totalAmount
 */
export function buildMorningIncomeLines(params: BuildInvoiceLineParams) {
  const { serviceDescription, catalogItem } = buildMorningServiceDescription(params);
  const numAmount = Math.round(Number(params.amount) || 0);

  return [
    {
      itemId: MORNING_CATALOG_ITEMS.RESORT_DEFAULT.id,
      description: 'הריזורט לכלב',
      quantity: 1,
      price: 0,
      vatType: 1
    },
    {
      itemId: catalogItem.id,
      description: serviceDescription,
      quantity: 1,
      price: numAmount,
      vatType: 1
    }
  ];
}
