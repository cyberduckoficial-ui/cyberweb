/* =========================
   CYBERDUCK — OPTIMIZATIONS
========================= */

// API Cache system para reducir llamadas repetidas
const apiCache = new Map();
const API_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
const ORDER_STORAGE_KEY = 'cyberduck:orders';
const INVENTORY_MOVEMENTS_KEY = 'cyberduck:inventoryMovements';
const PRODUCTION_LOGS_KEY = 'cyberduck:productionLogs';
const KPI_REPORTS_KEY = 'cyberduck:kpiReports';
const CHECKOUT_SUBMISSIONS_KEY = 'cyberduck:checkoutSubmissions';
const MATERIAL_STOCK_KEY = 'cyberduck:materialStock';
const MATERIAL_STOCK_POLICIES_KEY = 'cyberduck:materialStockPolicies';
const MATERIAL_STOCK_ALERTS_KEY = 'cyberduck:materialStockAlerts';
const ACCOUNTING_LEDGER_KEY = 'cyberduck:accountingLedger';
const ACCOUNTING_SYNC_QUEUE_KEY = 'cyberduck:accountingSyncQueue';
const ACCOUNTING_RECONCILIATIONS_KEY = 'cyberduck:accountingReconciliations';

const CATEGORY_SOLID_GRAMS = {
  camisetas: 220,
  faldas: 280,
  aretes: 18,
  collares: 24,
  manillas: 14,
  gargantillas: 20,
  otros: 30,
  impresion3d: 95,
  personalizar: 120,
  nuevo: 80,
  default: 60
};

const CATEGORY_CONSUMPTION_TOLERANCES = {
  camisetas: { lowerPct: -4, upperPct: 6 },
  faldas: { lowerPct: -5, upperPct: 7 },
  aretes: { lowerPct: -5, upperPct: 8 },
  collares: { lowerPct: -5, upperPct: 8 },
  manillas: { lowerPct: -5, upperPct: 8 },
  gargantillas: { lowerPct: -5, upperPct: 8 },
  otros: { lowerPct: -6, upperPct: 10 },
  impresion3d: { lowerPct: -8, upperPct: 10 },
  personalizar: { lowerPct: -10, upperPct: 12 },
  nuevo: { lowerPct: -6, upperPct: 10 },
  default: { lowerPct: -5, upperPct: 5 }
};

const CATEGORY_MATERIAL_PROFILE = {
  camisetas: { materialCode: 'MAT-TXT-ALGODON-EST', materialName: 'Textil algodón estampado', unit: 'g', unitCostCOP: 52 },
  faldas: { materialCode: 'MAT-TXT-POLY-BASIC', materialName: 'Textil base poliéster', unit: 'g', unitCostCOP: 57 },
  aretes: { materialCode: 'MAT-ACC-RESINA-METAL', materialName: 'Resina/acabado metálico', unit: 'g', unitCostCOP: 95 },
  collares: { materialCode: 'MAT-ACC-RESINA-COLLAR', materialName: 'Resina/acrílico para collar', unit: 'g', unitCostCOP: 92 },
  manillas: { materialCode: 'MAT-ACC-RESINA-MANILLA', materialName: 'Resina/acrílico para manilla', unit: 'g', unitCostCOP: 90 },
  gargantillas: { materialCode: 'MAT-ACC-RESINA-GARG', materialName: 'Resina/acrílico para gargantilla', unit: 'g', unitCostCOP: 98 },
  otros: { materialCode: 'MAT-ACC-MIX-OTROS', materialName: 'Material sólido mixto accesorios', unit: 'g', unitCostCOP: 68 },
  impresion3d: { materialCode: 'MAT-3DP-PLA-BASIC', materialName: 'Filamento PLA', unit: 'g', unitCostCOP: 38 },
  personalizar: { materialCode: 'MAT-3DP-PLA-CUSTOM', materialName: 'Filamento PLA personalizado', unit: 'g', unitCostCOP: 44 },
  nuevo: { materialCode: 'MAT-MIX-NUEVO', materialName: 'Material sólido mixto (línea nuevo)', unit: 'g', unitCostCOP: 72 },
  default: { materialCode: 'MAT-GEN-SOLIDO', materialName: 'Material sólido genérico', unit: 'g', unitCostCOP: 60 }
};

const CRITICAL_COST_THRESHOLD = {
  critical: 90,
  high: 70,
  medium: 45
};

function normalizeCurrencyValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (value === null || value === undefined) {
    return null;
  }

  const raw = String(value)
    .replaceAll(' ', '')
    .replaceAll('$', '')
    .replaceAll('COP', '')
    .replaceAll('cop', '')
    .replaceAll('.', '')
    .replaceAll(',', '.');

  if (!raw) {
    return null;
  }

  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickFirstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }

  return '';
}

function normalizeCartItem(item = {}, index = 0) {
  const quantity = Math.max(1, Number.parseInt(item.quantity, 10) || 1);
  const unitPrice = normalizeCurrencyValue(pickFirstDefined(item.unitPrice, item.price, item.salePrice, item.amount));
  const unitCost = normalizeCurrencyValue(pickFirstDefined(item.unitCost, item.cost, item.standardCost));
  const lineTotal = unitPrice === null ? null : unitPrice * quantity;

  return {
    id: pickFirstDefined(item.id, item.sku, item.code, `item-${index + 1}`),
    sku: pickFirstDefined(item.sku, item.code, item.id, ''),
    name: pickFirstDefined(item.name, item.title, item.productName, 'Producto'),
    category: pickFirstDefined(item.category, item.categoria, item.collection, ''),
    description: pickFirstDefined(item.desc, item.description, item.descripcion, ''),
    image: pickFirstDefined(item.image, ''),
    quantity,
    unitPrice,
    lineTotal,
    unitCost,
    source: pickFirstDefined(item.source, ''),
    inventoryStatus: pickFirstDefined(item.inventoryStatus, 'pending')
  };
}

function normalizeCartItems(items = []) {
  return Array.isArray(items) ? items.map((item, index) => normalizeCartItem(item, index)) : [];
}

function computeCartTotals(cart = []) {
  return normalizeCartItems(cart).reduce((acc, item) => {
    if (Number.isFinite(item.lineTotal)) {
      acc.subtotal += item.lineTotal;
    }

    if (Number.isFinite(item.unitCost)) {
      acc.estimatedCost += item.unitCost * item.quantity;
    }

    acc.quantity += item.quantity;
    return acc;
  }, { quantity: 0, subtotal: 0, estimatedCost: 0 });
}

function buildOrderPayload({ customer = {}, cart = [], paymentMethod = '', discountCode = '' } = {}) {
  const normalizedCart = normalizeCartItems(cart);
  const totals = computeCartTotals(normalizedCart);
  const estimatedMargin = totals.subtotal && Number.isFinite(totals.estimatedCost)
    ? totals.subtotal - totals.estimatedCost
    : null;
  const orderId = `CW-${Date.now().toString(36).toUpperCase()}`;

  return {
    orderId,
    createdAt: new Date().toISOString(),
    source: 'cyberweb-checkout',
    flowStatus: 'CREADA',
    currency: 'COP',
    customer: {
      fullName: pickFirstDefined(customer.fullName, customer.nombre, ''),
      email: pickFirstDefined(customer.email, customer.correo, ''),
      phone: pickFirstDefined(customer.phone, customer.celular, ''),
      discountCode: pickFirstDefined(discountCode, customer.discountCode, '')
    },
    paymentMethod: pickFirstDefined(paymentMethod, customer.paymentMethod, ''),
    summary: {
      quantity: totals.quantity,
      subtotal: totals.subtotal,
      estimatedCost: totals.estimatedCost || null,
      estimatedMargin
    },
    inventory: {
      status: 'pending',
      movementType: 'sale-reservation',
      lines: normalizedCart.map(item => ({
        sku: item.sku,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        reserved: true
      }))
    },
    production: {
      status: 'pending',
      lineCount: normalizedCart.length,
      needsBomReview: normalizedCart.some(item => !item.sku)
    },
    items: normalizedCart
  };
}

function hashString(input) {
  const text = String(input || '');
  let hash = 2166136261;

  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.codePointAt(i) || 0;
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return (hash >>> 0).toString(36).toUpperCase();
}

function createCheckoutFingerprint(orderPayload) {
  const itemsSignature = normalizeCartItems(orderPayload.items || []).map(item => [
    item.sku,
    item.name,
    item.quantity,
    item.unitPrice,
    item.unitCost
  ].join(':')).join('|');

  const customerSignature = [
    orderPayload.customer?.fullName || '',
    orderPayload.customer?.email || '',
    orderPayload.customer?.phone || '',
    orderPayload.paymentMethod || '',
    orderPayload.customer?.discountCode || ''
  ].join('|');

  const numericSignature = [
    orderPayload.summary?.subtotal || 0,
    orderPayload.summary?.quantity || 0,
    orderPayload.summary?.estimatedCost || 0,
    orderPayload.summary?.estimatedMargin || 0
  ].join('|');

  return `CHK-${hashString([customerSignature, itemsSignature, numericSignature].join('::'))}`;
}

function getCheckoutSubmissionRegistry() {
  return safeReadJsonStorage(CHECKOUT_SUBMISSIONS_KEY, []);
}

function upsertCheckoutSubmissionRegistry(entry) {
  const registry = getCheckoutSubmissionRegistry();
  const index = registry.findIndex(item => item.submissionFingerprint === entry.submissionFingerprint);

  if (index >= 0) {
    registry[index] = { ...registry[index], ...entry };
  } else {
    registry.push(entry);
  }

  safeWriteJsonStorage(CHECKOUT_SUBMISSIONS_KEY, registry);
  return entry;
}

function findCheckoutSubmissionByFingerprint(submissionFingerprint) {
  return getCheckoutSubmissionRegistry().find(item => item.submissionFingerprint === submissionFingerprint) || null;
}

function registerCheckoutSubmission(orderPayload, metadata = {}) {
  const submissionFingerprint = metadata.submissionFingerprint || orderPayload.checkoutFingerprint || createCheckoutFingerprint(orderPayload);
  const existing = findCheckoutSubmissionByFingerprint(submissionFingerprint);
  const now = new Date().toISOString();

  if (existing?.status === 'submitted') {
    return {
      ...existing,
      isDuplicate: true,
      orderPayload: null
    };
  }

  const registryEntry = {
    submissionFingerprint,
    orderId: orderPayload.orderId,
    status: 'pending',
    createdAt: existing?.createdAt || now,
    lastAttemptAt: now,
    submittedAt: existing?.submittedAt || null,
    customerEmail: orderPayload.customer?.email || '',
    total: orderPayload.summary?.subtotal || 0,
    paymentMethod: orderPayload.paymentMethod || '',
    itemCount: orderPayload.items?.length || 0
  };

  upsertCheckoutSubmissionRegistry(registryEntry);

  return {
    ...registryEntry,
    isDuplicate: false,
    orderPayload
  };
}

function markCheckoutSubmissionCompleted(submissionFingerprint, orderId, centralRecordId = '') {
  const current = findCheckoutSubmissionByFingerprint(submissionFingerprint);
  if (!current) {
    return null;
  }

  const completed = {
    ...current,
    orderId: orderId || current.orderId,
    centralRecordId,
    status: 'submitted',
    submittedAt: new Date().toISOString()
  };

  upsertCheckoutSubmissionRegistry(completed);
  return completed;
}

function buildCheckoutSubmissionEnvelope({ customer = {}, cart = [], paymentMethod = '', discountCode = '' } = {}) {
  const orderPayload = buildOrderPayload({ customer, cart, paymentMethod, discountCode });
  const submissionFingerprint = createCheckoutFingerprint(orderPayload);
  const existing = findCheckoutSubmissionByFingerprint(submissionFingerprint);

  if (existing?.status === 'submitted') {
    return {
      submissionFingerprint,
      orderPayload: null,
      inventoryPayload: null,
      salePayload: null,
      registryRecord: existing,
      isDuplicate: true
    };
  }

  if (existing?.status === 'pending' && existing.orderId) {
    orderPayload.orderId = existing.orderId;
    orderPayload.createdAt = existing.createdAt || orderPayload.createdAt;
  }

  const registryRecord = registerCheckoutSubmission(orderPayload, { submissionFingerprint });

  if (registryRecord.isDuplicate) {
    return {
      submissionFingerprint,
      orderPayload: null,
      inventoryPayload: null,
      salePayload: null,
      registryRecord,
      isDuplicate: true
    };
  }

  orderPayload.checkoutFingerprint = submissionFingerprint;
  orderPayload.checkoutSource = 'cyberweb-checkout';
  orderPayload.checkoutCentralState = 'PENDING';
  orderPayload.inventory = {
    ...orderPayload.inventory,
    reservationId: submissionFingerprint,
    deduplicationKey: submissionFingerprint,
    status: 'reserved',
    lines: orderPayload.inventory.lines.map(line => ({
      ...line,
      reserved: true,
      reservationId: submissionFingerprint
    }))
  };
  orderPayload.sale = {
    orderId: orderPayload.orderId,
    subtotal: orderPayload.summary.subtotal,
    total: orderPayload.summary.subtotal,
    quantity: orderPayload.summary.quantity,
    paymentMethod: orderPayload.paymentMethod,
    discountCode: orderPayload.customer.discountCode,
    currency: orderPayload.currency,
    estimatedCost: orderPayload.summary.estimatedCost,
    estimatedMargin: orderPayload.summary.estimatedMargin
  };
  orderPayload.checkout = {
    submissionFingerprint,
    idempotencyKey: submissionFingerprint,
    status: 'PENDING',
    submittedAt: registryRecord.createdAt,
    retryCount: registryRecord.status === 'pending' ? 1 : 0
  };

  const inventoryPayload = {
    orderId: orderPayload.orderId,
    reservationId: submissionFingerprint,
    status: 'reserved',
    movementType: 'sale-reservation',
    totalQuantity: orderPayload.summary.quantity,
    total: orderPayload.summary.subtotal,
    lines: orderPayload.inventory.lines,
    theoreticalConsumption: computeTheoreticalConsumption(orderPayload.items)
  };

  const salePayload = {
    orderId: orderPayload.orderId,
    customer: orderPayload.customer,
    paymentMethod: orderPayload.paymentMethod,
    total: orderPayload.summary.subtotal,
    quantity: orderPayload.summary.quantity,
    discountCode: orderPayload.customer.discountCode,
    currency: orderPayload.currency,
    estimatedCost: orderPayload.summary.estimatedCost,
    estimatedMargin: orderPayload.summary.estimatedMargin,
    itemCount: orderPayload.items.length
  };

  return {
    submissionFingerprint,
    orderPayload,
    inventoryPayload,
    salePayload,
    registryRecord,
    isDuplicate: false
  };
}

function safeReadJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn(`No se pudo leer ${key}:`, error);
    return fallback;
  }
}

function safeWriteJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`No se pudo escribir ${key}:`, error);
  }
}

function getAccountingLedgerEntries() {
  return safeReadJsonStorage(ACCOUNTING_LEDGER_KEY, []);
}

function getAccountingSyncQueue() {
  return safeReadJsonStorage(ACCOUNTING_SYNC_QUEUE_KEY, []);
}

function getOrderInventoryOutCost(order = {}) {
  const movements = safeReadJsonStorage(INVENTORY_MOVEMENTS_KEY, []);
  const orderId = String(order.orderId || '').trim();
  if (!orderId) {
    return 0;
  }

  const total = movements
    .filter(line => String(line.orderId || '').trim() === orderId)
    .reduce((acc, line) => {
      const explicit = Number(line.materialCostImpact);
      if (Number.isFinite(explicit)) {
        return acc + explicit;
      }

      const used = Number(line.actualSolidUsed) || 0;
      const unitCost = Number(line.estimatedUnitCostCOP) || 0;
      return acc + (used * unitCost);
    }, 0);

  return +total.toFixed(2);
}

function buildAccountingEntriesFromOrder(order = {}, options = {}) {
  const orderId = String(order.orderId || '').trim();
  if (!orderId) {
    return [];
  }

  const now = new Date().toISOString();
  const saleAmount = Number(order.summary?.subtotal) || 0;
  const quantity = Number(order.summary?.quantity) || 0;
  const kpis = options.kpis || order.closeSummary?.kpis || null;
  const cogsAmount = Number(kpis?.margin?.totalCost)
    || Number(order.closeSummary?.actualCost)
    || Number(order.summary?.estimatedCost)
    || getOrderInventoryOutCost(order);
  const inventoryOutCost = getOrderInventoryOutCost(order);

  return [
    {
      entryId: `ACC-${orderId}-SALE`,
      orderId,
      entryType: 'SALE',
      accountCode: '413000-VENTAS',
      description: `Venta orden ${orderId}`,
      amountCOP: +saleAmount.toFixed(2),
      quantity,
      currency: order.currency || 'COP',
      source: 'checkout',
      happenedAt: options.happenedAt || order.createdAt || now,
      createdAt: now
    },
    {
      entryId: `ACC-${orderId}-INVOUT`,
      orderId,
      entryType: 'INVENTORY_OUT',
      accountCode: '143500-INVENTARIO-SALIDA',
      description: `Salida inventario orden ${orderId}`,
      amountCOP: +inventoryOutCost.toFixed(2),
      quantity,
      currency: order.currency || 'COP',
      source: 'produccion',
      happenedAt: options.happenedAt || order.closeSummary?.closedAt || now,
      createdAt: now
    },
    {
      entryId: `ACC-${orderId}-COGS`,
      orderId,
      entryType: 'COGS',
      accountCode: '613500-COSTO-VENTAS',
      description: `Costo de ventas orden ${orderId}`,
      amountCOP: +Number(cogsAmount || 0).toFixed(2),
      quantity,
      currency: order.currency || 'COP',
      source: 'kpi-close',
      happenedAt: options.happenedAt || order.closeSummary?.closedAt || now,
      createdAt: now
    }
  ];
}

function upsertAccountingLedgerEntries(entries = []) {
  const ledger = getAccountingLedgerEntries();

  entries.forEach(entry => {
    const index = ledger.findIndex(item => item.entryId === entry.entryId);
    if (index >= 0) {
      ledger[index] = {
        ...ledger[index],
        ...entry,
        updatedAt: new Date().toISOString()
      };
    } else {
      ledger.push({
        ...entry,
        status: entry.status || 'PENDING_SYNC'
      });
    }
  });

  safeWriteJsonStorage(ACCOUNTING_LEDGER_KEY, ledger);
  return ledger;
}

function enqueueAccountingSyncMovements(movements = []) {
  const queue = getAccountingSyncQueue();

  movements.forEach(movement => {
    const dedupeKey = String(movement.dedupeKey || movement.syncId || movement.orderId || '').trim();
    const index = dedupeKey
      ? queue.findIndex(item => item.dedupeKey === dedupeKey)
      : -1;

    const enriched = {
      syncId: movement.syncId || `SYNC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      dedupeKey: dedupeKey || movement.syncId,
      movementType: movement.movementType || 'GENERIC',
      orderId: movement.orderId || '',
      payload: movement.payload || {},
      source: movement.source || 'cyberweb',
      status: movement.status || 'PENDING',
      createdAt: movement.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (index >= 0) {
      queue[index] = {
        ...queue[index],
        ...enriched,
        status: queue[index].status === 'SYNCED' ? queue[index].status : enriched.status
      };
    } else {
      queue.push(enriched);
    }
  });

  safeWriteJsonStorage(ACCOUNTING_SYNC_QUEUE_KEY, queue);
  return queue;
}

function markAccountingMovementSynced(syncId, metadata = {}) {
  if (!syncId) {
    return null;
  }

  const queue = getAccountingSyncQueue();
  const index = queue.findIndex(item => item.syncId === syncId);
  if (index < 0) {
    return null;
  }

  queue[index] = {
    ...queue[index],
    status: 'SYNCED',
    syncedAt: new Date().toISOString(),
    externalReference: metadata.externalReference || queue[index].externalReference || '',
    response: metadata.response || queue[index].response || null,
    updatedAt: new Date().toISOString()
  };

  safeWriteJsonStorage(ACCOUNTING_SYNC_QUEUE_KEY, queue);
  return queue[index];
}

function getPendingAccountingSyncMovements() {
  return getAccountingSyncQueue().filter(item => item.status !== 'SYNCED');
}

function formatRowsToCsv(rows = [], headers = []) {
  const toCell = (value) => {
    const text = value === undefined || value === null ? '' : String(value);
    if (/[,"\n\r]/.test(text)) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  };

  const lines = [headers.join(',')];
  rows.forEach(row => {
    lines.push(headers.map(header => toCell(row[header])).join(','));
  });

  return `${lines.join('\n')}\n`;
}

function exportAccountingData(options = {}) {
  const orders = safeReadJsonStorage(ORDER_STORAGE_KEY, []);
  const ledger = getAccountingLedgerEntries();
  const inventoryMovements = safeReadJsonStorage(INVENTORY_MOVEMENTS_KEY, []);
  const fromDate = options.fromDate ? new Date(options.fromDate) : null;
  const toDate = options.toDate ? new Date(options.toDate) : null;

  const inRange = (value) => {
    if (!value) {
      return true;
    }

    const time = new Date(value).getTime();
    if (Number.isNaN(time)) {
      return true;
    }

    const meetsFrom = fromDate ? time >= fromDate.getTime() : true;
    const meetsTo = toDate ? time <= toDate.getTime() : true;
    return meetsFrom && meetsTo;
  };

  const sales = orders
    .filter(order => inRange(order.createdAt))
    .map(order => ({
      orderId: order.orderId,
      fecha: order.createdAt,
      cliente: order.customer?.fullName || '',
      medioPago: order.paymentMethod || '',
      moneda: order.currency || 'COP',
      cantidad: Number(order.summary?.quantity) || 0,
      totalVentaCOP: +(Number(order.summary?.subtotal) || 0).toFixed(2)
    }));

  const inventoryOut = inventoryMovements
    .filter(line => inRange(line.producedAt || line.createdAt))
    .map(line => ({
      orderId: line.orderId || '',
      movementBatchId: line.movementBatchId || '',
      fecha: line.producedAt || line.createdAt || '',
      sku: line.productSku || '',
      materialCode: line.materialCode || '',
      cantidad: Number(line.actualSolidUsed) || 0,
      unidad: line.unit || 'g',
      costoSalidaCOP: Number.isFinite(line.materialCostImpact)
        ? +Number(line.materialCostImpact).toFixed(2)
        : +((Number(line.actualSolidUsed) || 0) * (Number(line.estimatedUnitCostCOP) || 0)).toFixed(2)
    }));

  const cogs = ledger
    .filter(entry => entry.entryType === 'COGS' && inRange(entry.happenedAt || entry.createdAt))
    .map(entry => ({
      orderId: entry.orderId,
      fecha: entry.happenedAt || entry.createdAt,
      cuentaContable: entry.accountCode,
      costoVentasCOP: +Number(entry.amountCOP || 0).toFixed(2),
      estadoSync: entry.status || 'PENDING_SYNC'
    }));

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      fromDate: options.fromDate || null,
      toDate: options.toDate || null
    },
    sales,
    inventoryOut,
    cogs,
    csv: {
      sales: formatRowsToCsv(sales, ['orderId', 'fecha', 'cliente', 'medioPago', 'moneda', 'cantidad', 'totalVentaCOP']),
      inventoryOut: formatRowsToCsv(inventoryOut, ['orderId', 'movementBatchId', 'fecha', 'sku', 'materialCode', 'cantidad', 'unidad', 'costoSalidaCOP']),
      cogs: formatRowsToCsv(cogs, ['orderId', 'fecha', 'cuentaContable', 'costoVentasCOP', 'estadoSync'])
    }
  };
}

function buildAccountingReconciliationSnapshot(options = {}) {
  const orders = safeReadJsonStorage(ORDER_STORAGE_KEY, []);
  const ledger = getAccountingLedgerEntries();
  const inventoryMovements = safeReadJsonStorage(INVENTORY_MOVEMENTS_KEY, []);

  const closedOrders = orders.filter(order => String(order.flowStatus || '').toUpperCase() === 'CERRADA');
  const totalSales = closedOrders.reduce((acc, order) => acc + (Number(order.summary?.subtotal) || 0), 0);
  const totalInventoryOut = inventoryMovements.reduce((acc, line) => {
    const explicit = Number(line.materialCostImpact);
    if (Number.isFinite(explicit)) {
      return acc + explicit;
    }

    return acc + ((Number(line.actualSolidUsed) || 0) * (Number(line.estimatedUnitCostCOP) || 0));
  }, 0);
  const totalCogs = closedOrders.reduce((acc, order) => {
    const kpiCost = Number(order.closeSummary?.kpis?.margin?.totalCost);
    if (Number.isFinite(kpiCost) && kpiCost > 0) {
      return acc + kpiCost;
    }

    return acc + (Number(order.summary?.estimatedCost) || 0);
  }, 0);

  const ledgerSales = ledger.filter(entry => entry.entryType === 'SALE').reduce((acc, entry) => acc + (Number(entry.amountCOP) || 0), 0);
  const ledgerInventoryOut = ledger.filter(entry => entry.entryType === 'INVENTORY_OUT').reduce((acc, entry) => acc + (Number(entry.amountCOP) || 0), 0);
  const ledgerCogs = ledger.filter(entry => entry.entryType === 'COGS').reduce((acc, entry) => acc + (Number(entry.amountCOP) || 0), 0);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    scope: options.scope || 'global',
    ordersClosed: closedOrders.length,
    totals: {
      salesOperationalCOP: +totalSales.toFixed(2),
      inventoryOutOperationalCOP: +totalInventoryOut.toFixed(2),
      cogsOperationalCOP: +totalCogs.toFixed(2),
      salesLedgerCOP: +ledgerSales.toFixed(2),
      inventoryOutLedgerCOP: +ledgerInventoryOut.toFixed(2),
      cogsLedgerCOP: +ledgerCogs.toFixed(2)
    },
    deltas: {
      salesVsLedgerCOP: +(totalSales - ledgerSales).toFixed(2),
      inventoryOutVsLedgerCOP: +(totalInventoryOut - ledgerInventoryOut).toFixed(2),
      cogsVsLedgerCOP: +(totalCogs - ledgerCogs).toFixed(2),
      inventoryVsCogsOperationalCOP: +(totalInventoryOut - totalCogs).toFixed(2)
    },
    queue: {
      pending: getPendingAccountingSyncMovements().length,
      synced: getAccountingSyncQueue().filter(item => item.status === 'SYNCED').length,
      total: getAccountingSyncQueue().length
    }
  };

  const snapshots = safeReadJsonStorage(ACCOUNTING_RECONCILIATIONS_KEY, []);
  snapshots.push(snapshot);
  safeWriteJsonStorage(ACCOUNTING_RECONCILIATIONS_KEY, snapshots);

  return snapshot;
}

function categorySolidPerUnit(category) {
  const key = String(category || '').trim().toLowerCase();
  return CATEGORY_SOLID_GRAMS[key] || CATEGORY_SOLID_GRAMS.default;
}

function computeTheoreticalConsumption(items = []) {
  return normalizeCartItems(items).map(item => {
    const solidPerUnit = categorySolidPerUnit(item.category);
    const theoreticalSolid = +(solidPerUnit * item.quantity).toFixed(2);

    return {
      sku: item.sku || item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      solidPerUnit,
      theoreticalSolid
    };
  });
}

function normalizeMaterialCode(value) {
  return String(value || '').trim().toUpperCase();
}

function resolveMaterialProfile(category = '') {
  const key = String(category || '').trim().toLowerCase();
  return CATEGORY_MATERIAL_PROFILE[key] || CATEGORY_MATERIAL_PROFILE.default;
}

function getHistoricalMaterialConsumption(materialCode, movements = []) {
  const target = normalizeMaterialCode(materialCode);
  const summary = movements
    .filter(line => normalizeMaterialCode(line.materialCode) === target)
    .reduce((acc, line) => {
      const consumed = Number(line.actualSolidUsed) || 0;
      const batchId = String(line.movementBatchId || 'SIN_LOTE');
      acc.totalConsumed += consumed;
      acc.batches.add(batchId);
      return acc;
    }, { totalConsumed: 0, batches: new Set() });

  return {
    totalConsumed: summary.totalConsumed,
    batchCount: summary.batches.size || 1,
    averagePerBatch: summary.totalConsumed > 0 ? summary.totalConsumed / (summary.batches.size || 1) : 0
  };
}

function deriveMaterialPolicy(materialCode, context = {}, movements = []) {
  const normalizedCode = normalizeMaterialCode(materialCode);
  const historical = getHistoricalMaterialConsumption(normalizedCode, movements);
  const unitCostCOP = Number(context.unitCostCOP) || resolveMaterialProfile(context.category).unitCostCOP;
  const averagePerBatch = historical.averagePerBatch || Number(context.consumedSolid) || 50;
  let criticalityMultiplier = 1.3;
  if (unitCostCOP >= CRITICAL_COST_THRESHOLD.critical) {
    criticalityMultiplier = 1.8;
  } else if (unitCostCOP >= CRITICAL_COST_THRESHOLD.high) {
    criticalityMultiplier = 1.5;
  }
  const safetyStock = Math.max(30, Math.round(averagePerBatch * criticalityMultiplier));
  const minStock = Math.max(safetyStock + 10, Math.round(averagePerBatch * (criticalityMultiplier + 0.8)));
  const maxStock = Math.max(minStock + 20, Math.round(minStock * 2.2));

  return {
    materialCode: normalizedCode,
    materialName: context.materialName || resolveMaterialProfile(context.category).materialName,
    unit: context.unit || resolveMaterialProfile(context.category).unit,
    unitCostCOP,
    safetyStock,
    minStock,
    maxStock,
    reorderPoint: minStock,
    updatedAt: new Date().toISOString()
  };
}

function getMaterialStockControlState() {
  return safeReadJsonStorage(MATERIAL_STOCK_KEY, {});
}

function getMaterialStockPolicies() {
  return safeReadJsonStorage(MATERIAL_STOCK_POLICIES_KEY, {});
}

function upsertMaterialStockAlert(alert) {
  const alerts = safeReadJsonStorage(MATERIAL_STOCK_ALERTS_KEY, []);
  alerts.push({ ...alert, createdAt: new Date().toISOString() });
  safeWriteJsonStorage(MATERIAL_STOCK_ALERTS_KEY, alerts);
  return alerts;
}

function setMaterialStockLevel(materialCode, onHand, metadata = {}) {
  const normalizedCode = normalizeMaterialCode(materialCode);
  if (!normalizedCode) {
    return null;
  }

  const state = getMaterialStockControlState();
  const current = state[normalizedCode] || {};
  state[normalizedCode] = {
    ...current,
    materialCode: normalizedCode,
    materialName: metadata.materialName || current.materialName || resolveMaterialProfile(metadata.category).materialName,
    unit: metadata.unit || current.unit || resolveMaterialProfile(metadata.category).unit,
    unitCostCOP: Number(metadata.unitCostCOP) || Number(current.unitCostCOP) || resolveMaterialProfile(metadata.category).unitCostCOP,
    onHand: Number(onHand) || 0,
    updatedAt: new Date().toISOString()
  };

  safeWriteJsonStorage(MATERIAL_STOCK_KEY, state);
  return state[normalizedCode];
}

function upsertMaterialStockPolicy(materialCode, policyInput = {}) {
  const normalizedCode = normalizeMaterialCode(materialCode);
  if (!normalizedCode) {
    return null;
  }

  const movements = safeReadJsonStorage(INVENTORY_MOVEMENTS_KEY, []);
  const policies = getMaterialStockPolicies();
  const derived = deriveMaterialPolicy(normalizedCode, policyInput, movements);
  policies[normalizedCode] = {
    ...derived,
    ...policyInput,
    materialCode: normalizedCode,
    safetyStock: Number(policyInput.safetyStock) || derived.safetyStock,
    minStock: Number(policyInput.minStock) || derived.minStock,
    maxStock: Number(policyInput.maxStock) || derived.maxStock,
    reorderPoint: Number(policyInput.reorderPoint) || Number(policyInput.minStock) || derived.reorderPoint,
    unitCostCOP: Number(policyInput.unitCostCOP) || derived.unitCostCOP,
    updatedAt: new Date().toISOString()
  };

  safeWriteJsonStorage(MATERIAL_STOCK_POLICIES_KEY, policies);
  return policies[normalizedCode];
}

function getStockStatus(onHand, policy) {
  if (onHand <= 0) {
    return 'QUIEBRE';
  }

  if (onHand <= policy.safetyStock) {
    return 'BAJO_SEGURIDAD';
  }

  if (onHand <= policy.minStock) {
    return 'BAJO_MINIMO';
  }

  if (onHand > policy.maxStock) {
    return 'SOBRESTOCK';
  }

  return 'OK';
}

function getStatusPenalty(status) {
  if (status === 'QUIEBRE') {
    return 6000;
  }

  if (status === 'BAJO_SEGURIDAD') {
    return 3500;
  }

  if (status === 'BAJO_MINIMO') {
    return 1800;
  }

  return 0;
}

function mapPriorityLabel(score) {
  if (score >= 9000) {
    return 'CRITICA';
  }
  if (score >= 5000) {
    return 'ALTA';
  }
  if (score >= 2500) {
    return 'MEDIA';
  }
  return 'BAJA';
}

function applyMaterialStockControl(movements = [], context = {}) {
  const state = getMaterialStockControlState();
  const policies = getMaterialStockPolicies();
  const alerts = [];
  const perMaterial = new Map();

  movements.forEach(line => {
    const materialCode = normalizeMaterialCode(line.materialCode);
    if (!materialCode) {
      return;
    }

    const category = String(line.category || '').trim().toLowerCase();
    const profile = resolveMaterialProfile(category);
    const existingPolicy = policies[materialCode];
    const policy = existingPolicy || deriveMaterialPolicy(materialCode, {
      category,
      unitCostCOP: line.estimatedUnitCostCOP || profile.unitCostCOP,
      materialName: line.materialName || profile.materialName,
      consumedSolid: line.actualSolidUsed,
      unit: line.unit || profile.unit
    }, safeReadJsonStorage(INVENTORY_MOVEMENTS_KEY, []));

    if (!existingPolicy) {
      policies[materialCode] = policy;
    }

    const current = state[materialCode] || {
      materialCode,
      materialName: line.materialName || profile.materialName,
      unit: line.unit || profile.unit,
      unitCostCOP: Number(line.estimatedUnitCostCOP) || policy.unitCostCOP,
      onHand: policy.maxStock,
      updatedAt: new Date().toISOString()
    };

    const consumed = Number(line.actualSolidUsed) || 0;
    const before = Number(current.onHand) || 0;
    const after = +(before - consumed).toFixed(2);
    const status = getStockStatus(after, policy);
    const reorderSuggestedQty = status === 'QUIEBRE' || status === 'BAJO_SEGURIDAD' || status === 'BAJO_MINIMO'
      ? +(Math.max(policy.maxStock - Math.max(after, 0), 0)).toFixed(2)
      : 0;
    const costImpact = Number.isFinite(line.materialCostImpact) ? line.materialCostImpact : +(consumed * (Number(current.unitCostCOP) || policy.unitCostCOP || 0)).toFixed(2);

    state[materialCode] = {
      ...current,
      materialName: line.materialName || current.materialName || profile.materialName,
      unit: line.unit || current.unit || profile.unit,
      unitCostCOP: Number(line.estimatedUnitCostCOP) || Number(current.unitCostCOP) || policy.unitCostCOP,
      onHand: after,
      status,
      reorderSuggestedQty,
      lastMovementBatchId: context.movementBatchId,
      updatedAt: new Date().toISOString()
    };

    const previousSummary = perMaterial.get(materialCode) || {
      materialCode,
      materialName: state[materialCode].materialName,
      unit: state[materialCode].unit,
      consumed: 0,
      costImpact: 0,
      status,
      onHand: after,
      reorderSuggestedQty,
      policy
    };
    previousSummary.consumed = +(previousSummary.consumed + consumed).toFixed(2);
    previousSummary.costImpact = +(previousSummary.costImpact + costImpact).toFixed(2);
    previousSummary.status = status;
    previousSummary.onHand = after;
    previousSummary.reorderSuggestedQty = reorderSuggestedQty;
    perMaterial.set(materialCode, previousSummary);

    if (status !== 'OK') {
      const stockAlert = {
        type: 'stock-threshold',
        severity: status === 'QUIEBRE' ? 'critical' : 'warning',
        scope: 'material',
        materialCode,
        materialName: state[materialCode].materialName,
        orderId: context.orderId,
        movementBatchId: context.movementBatchId,
        operator: context.operator,
        status,
        onHand: after,
        minStock: policy.minStock,
        maxStock: policy.maxStock,
        safetyStock: policy.safetyStock,
        reorderSuggestedQty,
        message: `Stock ${status.toLowerCase()} para ${materialCode}`
      };
      alerts.push(stockAlert);
      upsertMaterialStockAlert(stockAlert);
    }

    if (line.withinTolerance === false && Number(line.variancePct) > 0) {
      const overconsumptionAlert = {
        type: 'stock-overconsumption',
        severity: Number(line.variancePct) > 10 ? 'critical' : 'warning',
        scope: 'material',
        materialCode,
        materialName: state[materialCode].materialName,
        orderId: context.orderId,
        movementBatchId: context.movementBatchId,
        operator: context.operator,
        variancePct: Number(line.variancePct),
        varianceSolid: Number(line.varianceSolid) || 0,
        message: `Sobreconsumo de material ${materialCode}`
      };
      alerts.push(overconsumptionAlert);
      upsertMaterialStockAlert(overconsumptionAlert);
    }
  });

  const priorities = Array.from(perMaterial.values()).map(item => {
    const riskScore = getStatusPenalty(item.status);
    const score = +(item.costImpact + riskScore + item.reorderSuggestedQty * (item.policy.unitCostCOP || 0)).toFixed(2);
    return {
      materialCode: item.materialCode,
      materialName: item.materialName,
      unit: item.unit,
      consumed: item.consumed,
      costImpact: item.costImpact,
      status: item.status,
      onHand: item.onHand,
      reorderSuggestedQty: item.reorderSuggestedQty,
      priorityScore: score,
      priority: mapPriorityLabel(score)
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);

  safeWriteJsonStorage(MATERIAL_STOCK_KEY, state);
  safeWriteJsonStorage(MATERIAL_STOCK_POLICIES_KEY, policies);

  return {
    orderId: context.orderId,
    movementBatchId: context.movementBatchId,
    operator: context.operator,
    materials: Array.from(perMaterial.values()),
    alerts,
    priorities,
    generatedAt: new Date().toISOString()
  };
}

function getMaterialStockControlSnapshot() {
  const state = getMaterialStockControlState();
  const policies = getMaterialStockPolicies();
  const alerts = safeReadJsonStorage(MATERIAL_STOCK_ALERTS_KEY, []);

  const materials = Object.keys(state).map(materialCode => {
    const stock = state[materialCode];
    const policy = policies[materialCode] || {};
    return {
      materialCode,
      materialName: stock.materialName || policy.materialName || '',
      unit: stock.unit || policy.unit || 'g',
      onHand: Number(stock.onHand) || 0,
      status: stock.status || getStockStatus(Number(stock.onHand) || 0, {
        minStock: Number(policy.minStock) || 0,
        maxStock: Number(policy.maxStock) || Number(stock.onHand) || 0,
        safetyStock: Number(policy.safetyStock) || 0
      }),
      minStock: Number(policy.minStock) || 0,
      maxStock: Number(policy.maxStock) || 0,
      safetyStock: Number(policy.safetyStock) || 0,
      reorderSuggestedQty: Number(stock.reorderSuggestedQty) || 0,
      unitCostCOP: Number(stock.unitCostCOP) || Number(policy.unitCostCOP) || 0
    };
  });

  const priorities = materials
    .map(item => {
      const exposure = +(Math.max(item.minStock - item.onHand, 0) * item.unitCostCOP).toFixed(2);
      const statusPenalty = getStatusPenalty(item.status);
      const priorityScore = +(exposure + statusPenalty).toFixed(2);
      return {
        materialCode: item.materialCode,
        materialName: item.materialName,
        status: item.status,
        onHand: item.onHand,
        minStock: item.minStock,
        safetyStock: item.safetyStock,
        unitCostCOP: item.unitCostCOP,
        priorityScore,
        priority: mapPriorityLabel(priorityScore)
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    generatedAt: new Date().toISOString(),
    materials,
    priorities,
    alerts
  };
}

function getConsumptionTolerance(category) {
  const key = String(category || '').trim().toLowerCase();
  return CATEGORY_CONSUMPTION_TOLERANCES[key] || CATEGORY_CONSUMPTION_TOLERANCES.default;
}

function buildIndexBySku(items = []) {
  const index = new Map();

  for (const item of items) {
    const key = String(item.sku || item.productSku || item.id || '').trim();
    if (!key) {
      continue;
    }

    index.set(key, item);
  }

  return index;
}

function normalizeProductionConsumptionInput(actualConsumption = [], options = {}) {
  const source = Array.isArray(actualConsumption) ? { lines: actualConsumption } : {};
  const sourceObject = actualConsumption && typeof actualConsumption === 'object' && !Array.isArray(actualConsumption) ? actualConsumption : {};
  let sourceLines = [];

  if (Array.isArray(source.lines)) {
    sourceLines = source.lines;
  } else if (Array.isArray(source.items)) {
    sourceLines = source.items;
  } else if (Array.isArray(sourceObject.lines)) {
    sourceLines = sourceObject.lines;
  } else if (Array.isArray(sourceObject.items)) {
    sourceLines = sourceObject.items;
  }

  return {
    lines: sourceLines,
    lotId: pickFirstDefined(options.lotId, source.lotId, sourceObject.lotId, source.loteId, sourceObject.loteId, ''),
    lotCode: pickFirstDefined(options.lotCode, source.lotCode, sourceObject.lotCode, source.lote, sourceObject.lote, options.batchCode, ''),
    operator: pickFirstDefined(options.operator, source.operator, sourceObject.operator, source.operario, sourceObject.operario, 'sistema'),
    producedAt: pickFirstDefined(options.productionAt, source.productionAt, sourceObject.productionAt, source.producedAt, sourceObject.producedAt, new Date().toISOString()),
    notes: pickFirstDefined(options.notes, source.notes, sourceObject.notes, '')
  };
}

function normalizeProductionConsumptionLine(line = {}, context = {}, theoreticalLine = null, skuCount = 1, index = 0) {
  const actualSolidUsed = normalizeCurrencyValue(pickFirstDefined(
    line.actualSolidUsed,
    line.actualSolid,
    line.usedSolid,
    line.consumedSolid,
    line.materialUsed,
    line.consumoRealSolid
  )) || 0;
  const theoreticalSolid = theoreticalLine ? theoreticalLine.theoreticalSolid : null;
  const expectedSolidUsed = normalizeCurrencyValue(pickFirstDefined(line.expectedSolidUsed, line.expectedSolid));
  let finalExpectedSolidUsed = expectedSolidUsed;
  if (finalExpectedSolidUsed === null || finalExpectedSolidUsed === undefined) {
    if (theoreticalSolid !== null && theoreticalSolid !== undefined) {
      finalExpectedSolidUsed = +(theoreticalSolid / Math.max(1, skuCount)).toFixed(2);
    } else {
      finalExpectedSolidUsed = null;
    }
  }
  const varianceSolid = finalExpectedSolidUsed === null
    ? null
    : +(actualSolidUsed - finalExpectedSolidUsed).toFixed(2);
  const variancePct = finalExpectedSolidUsed ? +((varianceSolid / finalExpectedSolidUsed) * 100).toFixed(2) : null;
  const resolvedCategory = pickFirstDefined(line.category, theoreticalLine?.category, '');
  const materialProfile = resolveMaterialProfile(resolvedCategory);
  const tolerance = getConsumptionTolerance(resolvedCategory);
  const estimatedUnitCostCOP = normalizeCurrencyValue(pickFirstDefined(line.estimatedUnitCostCOP, line.materialUnitCostCOP, line.unitCostCOP));
  const effectiveUnitCostCOP = estimatedUnitCostCOP === null || estimatedUnitCostCOP === undefined
    ? materialProfile.unitCostCOP
    : estimatedUnitCostCOP;
  const materialCostImpact = +(actualSolidUsed * (effectiveUnitCostCOP || 0)).toFixed(2);
  const withinTolerance = variancePct === null
    ? true
    : variancePct >= tolerance.lowerPct && variancePct <= tolerance.upperPct;

  return {
    entryId: pickFirstDefined(line.entryId, `${context.movementBatchId}-${index + 1}`),
    orderId: context.orderId,
    movementBatchId: context.movementBatchId,
    lotId: pickFirstDefined(line.lotId, context.lotId, ''),
    lotCode: pickFirstDefined(line.lotCode, context.lotCode, context.movementBatchId),
    operator: pickFirstDefined(line.operator, context.operator, 'sistema'),
    producedAt: pickFirstDefined(line.producedAt, context.producedAt),
    productSku: pickFirstDefined(line.productSku, line.sku, line.code, theoreticalLine?.sku, ''),
    productName: pickFirstDefined(line.productName, line.name, theoreticalLine?.name, 'Producto'),
    category: resolvedCategory,
    materialCode: pickFirstDefined(line.materialCode, line.material_code, materialProfile.materialCode, ''),
    materialName: pickFirstDefined(line.materialName, line.material_name, materialProfile.materialName, ''),
    quantity: Math.max(1, Number.parseInt(pickFirstDefined(line.quantity, theoreticalLine?.quantity, 1), 10) || 1),
    expectedSolidUsed: finalExpectedSolidUsed,
    actualSolidUsed,
    estimatedUnitCostCOP: effectiveUnitCostCOP,
    materialCostImpact,
    varianceSolid,
    variancePct,
    toleranceLowerPct: tolerance.lowerPct,
    toleranceUpperPct: tolerance.upperPct,
    withinTolerance,
    unit: pickFirstDefined(line.unit, line.measureUnit, 'g'),
    notes: pickFirstDefined(line.notes, context.notes, '')
  };
}

function groupConsumptionEntries(keyGetter, entries = []) {
  const groups = new Map();

  for (const entry of entries) {
    const key = keyGetter(entry);
    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(entry);
  }

  return groups;
}

function summarizeConsumptionGroup(key, entries = [], fallbackExpected = null) {
  const totals = entries.reduce((acc, entry) => {
    acc.actualSolidUsed += Number(entry.actualSolidUsed) || 0;
    if (Number.isFinite(entry.expectedSolidUsed)) {
      acc.expectedSolidUsed += Number(entry.expectedSolidUsed);
    }
    acc.quantity += Number(entry.quantity) || 0;
    return acc;
  }, { expectedSolidUsed: 0, actualSolidUsed: 0, quantity: 0 });

  let expectedSolidUsed = null;
  if (totals.expectedSolidUsed > 0) {
    expectedSolidUsed = +totals.expectedSolidUsed.toFixed(2);
  } else if (Number.isFinite(fallbackExpected)) {
    expectedSolidUsed = +Number(fallbackExpected).toFixed(2);
  }
  const actualSolidUsed = +totals.actualSolidUsed.toFixed(2);
  const varianceSolid = expectedSolidUsed === null ? null : +(actualSolidUsed - expectedSolidUsed).toFixed(2);
  const variancePct = expectedSolidUsed ? +((varianceSolid / expectedSolidUsed) * 100).toFixed(2) : null;

  return {
    key,
    quantity: totals.quantity,
    expectedSolidUsed,
    actualSolidUsed,
    varianceSolid,
    variancePct,
    withinTolerance: entries.every(entry => entry.withinTolerance !== false),
    lines: entries
  };
}

function buildKpiAlerts({ order, report, marginPct, marginValue, actualConsumptionPct, orderKpis }) {
  const alerts = [];

  if (Number.isFinite(marginValue) && marginValue < 0) {
    alerts.push({
      type: 'margin-negative',
      severity: 'critical',
      scope: 'orden',
      message: `Margen negativo en la orden ${order.orderId}`,
      value: marginValue
    });
  }

  if (Number.isFinite(marginPct) && marginPct < 20) {
    alerts.push({
      type: 'margin-low',
      severity: 'warning',
      scope: 'orden',
      message: `Margen por debajo del umbral recomendado en la orden ${order.orderId}`,
      value: marginPct
    });
  }

  if (Number.isFinite(actualConsumptionPct) && actualConsumptionPct > 0) {
    alerts.push({
      type: 'consumption-over-plan',
      severity: actualConsumptionPct > 10 ? 'critical' : 'warning',
      scope: 'orden',
      message: `El consumo real supera el consumo planificado en ${actualConsumptionPct.toFixed(2)}%`,
      value: actualConsumptionPct
    });
  }

  if (report) {
    const breakdowns = [
      { scope: 'producto', entries: report.productBreakdown || [] },
      { scope: 'lote', entries: report.lotBreakdown || [] },
      { scope: 'operario', entries: report.operatorBreakdown || [] }
    ];

    breakdowns.forEach(({ scope, entries }) => {
      entries.filter(entry => entry?.withinTolerance === false).forEach(entry => {
        const variancePct = Number.isFinite(entry.variancePct) ? entry.variancePct.toFixed(2) : 'n/a';
        alerts.push({
          type: 'consumption-out-of-range',
          severity: Number.isFinite(entry.variancePct) && entry.variancePct > 0 ? 'critical' : 'warning',
          scope,
          key: entry.key,
          message: `Consumo fuera de rango en ${scope} ${entry.key}`,
          value: variancePct,
          expectedSolidUsed: entry.expectedSolidUsed,
          actualSolidUsed: entry.actualSolidUsed,
          varianceSolid: entry.varianceSolid,
          variancePct: entry.variancePct,
          productSku: scope === 'producto' ? entry.key : undefined,
          lotCode: scope === 'lote' ? entry.key : undefined,
          operator: scope === 'operario' ? entry.key : undefined
        });
      });
    });
  }

  if (orderKpis && Array.isArray(orderKpis.consumptionAlerts)) {
    orderKpis.consumptionAlerts.forEach(alert => {
      alerts.push({
        ...alert,
        source: 'kpi'
      });
    });
  }

  return alerts;
}

function persistKpiReport(kpiReport) {
  const reports = safeReadJsonStorage(KPI_REPORTS_KEY, []);
  const nextReport = {
    ...kpiReport,
    recordedAt: new Date().toISOString()
  };
  const index = reports.findIndex(report => report.orderId === nextReport.orderId);

  if (index >= 0) {
    reports[index] = nextReport;
  } else {
    reports.push(nextReport);
  }

  safeWriteJsonStorage(KPI_REPORTS_KEY, reports);
  return nextReport;
}

function resolveOrderActualCost(order, options, fallbackCost) {
  let actualCost = normalizeCurrencyValue(options.actualCost);

  if (actualCost !== null && actualCost !== undefined) {
    return actualCost;
  }

  const closeSummaryCost = normalizeCurrencyValue(order.closeSummary?.actualCost);
  if (closeSummaryCost !== null && closeSummaryCost !== undefined) {
    return closeSummaryCost;
  }

  const productionCost = normalizeCurrencyValue(order.production?.actualCost);
  if (productionCost !== null && productionCost !== undefined) {
    return productionCost;
  }

  return fallbackCost;
}

function buildConsumptionAlertsFromReport(consumptionReport) {
  const alerts = [];
  if (!consumptionReport) {
    return alerts;
  }

  const groups = [
    { scope: 'producto', entries: consumptionReport.productBreakdown || [] },
    { scope: 'lote', entries: consumptionReport.lotBreakdown || [] },
    { scope: 'operario', entries: consumptionReport.operatorBreakdown || [] }
  ];

  groups.forEach(({ scope, entries }) => {
    entries.filter(entry => entry?.withinTolerance === false).forEach(entry => {
      alerts.push({
        type: `${scope}-consumption-deviation`,
        severity: Number.isFinite(entry.variancePct) && entry.variancePct > 0 ? 'critical' : 'warning',
        scope,
        key: entry.key,
        variancePct: entry.variancePct,
        varianceSolid: entry.varianceSolid,
        expectedSolidUsed: entry.expectedSolidUsed,
        actualSolidUsed: entry.actualSolidUsed,
        message: `Consumo fuera de rango en ${scope} ${entry.key}`
      });
    });
  });

  return alerts;
}

function buildOrderConsumptionSummary(order, consumptionReport) {
  const plannedConsumption = consumptionReport
    ? Number(consumptionReport.expectedSolidUsed) || 0
    : (order.theoreticalConsumption || []).reduce((acc, line) => acc + (Number(line.theoreticalSolid) || 0), 0);
  const actualConsumptionSolid = consumptionReport ? Number(consumptionReport.actualSolidUsed) || 0 : plannedConsumption;
  const varianceSolid = +(actualConsumptionSolid - plannedConsumption).toFixed(2);
  const variancePct = plannedConsumption > 0 ? +((varianceSolid / plannedConsumption) * 100).toFixed(2) : null;
  const expectedRange = consumptionReport && Array.isArray(consumptionReport.entries) && consumptionReport.entries.length > 0
    ? {
        lowerPct: Math.min(...consumptionReport.entries.map(entry => Number(entry.toleranceLowerPct) || 0)),
        upperPct: Math.max(...consumptionReport.entries.map(entry => Number(entry.toleranceUpperPct) || 0))
      }
    : null;

  return {
    plannedConsumption: +plannedConsumption.toFixed(2),
    actualConsumptionSolid: +actualConsumptionSolid.toFixed(2),
    varianceSolid,
    variancePct,
    expectedRange
  };
}

function buildOrderMarginSummary(saleTotal, actualCost, quantity) {
  const apu = quantity > 0 ? +(actualCost / quantity).toFixed(2) : null;
  const marginValue = +(saleTotal - actualCost).toFixed(2);
  const marginPct = saleTotal > 0 ? +((marginValue / saleTotal) * 100).toFixed(2) : null;
  const unitSalePrice = quantity > 0 ? +(saleTotal / quantity).toFixed(2) : null;

  return {
    apu,
    marginValue,
    marginPct,
    unitSalePrice
  };
}

function buildOrderKpiSnapshot(order, consumptionReport, actualCost, quantity, saleTotal) {
  const marginSummary = buildOrderMarginSummary(saleTotal, actualCost, quantity);
  const consumptionSummary = buildOrderConsumptionSummary(order, consumptionReport);
  const consumptionAlerts = buildConsumptionAlertsFromReport(consumptionReport);

  return {
    orderId: order.orderId,
    flowStatus: order.flowStatus,
    apu: {
      totalCost: +actualCost.toFixed(2),
      unitCost: marginSummary.apu,
      unitSalePrice: marginSummary.unitSalePrice,
      quantity
    },
    margin: {
      totalSale: +saleTotal.toFixed(2),
      totalCost: +actualCost.toFixed(2),
      grossMargin: marginSummary.marginValue,
      grossMarginPct: marginSummary.marginPct
    },
    consumption: consumptionSummary,
    consumptionAlerts,
    alerts: buildKpiAlerts({
      order,
      report: consumptionReport,
      marginPct: marginSummary.marginPct,
      marginValue: marginSummary.marginValue,
      actualConsumptionPct: consumptionSummary.variancePct,
      orderKpis: { consumptionAlerts }
    }),
    report: consumptionReport
  };
}

function computeOrderKPIs(orderRef, options = {}) {
  const order = resolveOrderSnapshot(orderRef);
  if (!order) {
    return null;
  }

  const actualConsumption = Array.isArray(options.actualConsumption) ? options.actualConsumption : [];
  const consumptionReport = options.consumptionReport || order.closeSummary?.report || order.production?.report || (actualConsumption.length > 0 ? buildConsumptionDeviationReport(order, actualConsumption) : null);
  const summary = typeof order.summary === 'object' && order.summary ? order.summary : {};
  const saleTotal = Number(summary.subtotal) || 0;
  const quantity = Number(summary.quantity) || (order.items || []).reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
  const fallbackCost = Number(summary.estimatedCost) || 0;
  const actualCost = resolveOrderActualCost(order, options, fallbackCost);
  const kpis = buildOrderKpiSnapshot(order, consumptionReport, actualCost, quantity, saleTotal);

  return kpis;
}

function buildConsumptionDeviationReport(order, entries = []) {
  if (!order) {
    return null;
  }

  const theoreticalBySku = buildIndexBySku(order.theoreticalConsumption || []);
  const normalizedEntries = entries.map((entry, index) => {
    const theoreticalLine = theoreticalBySku.get(String(entry.productSku || entry.sku || '').trim()) || null;
    return normalizeProductionConsumptionLine(entry, entry, theoreticalLine, entries.filter(candidate => String(candidate.productSku || candidate.sku || '').trim() === String(entry.productSku || entry.sku || '').trim()).length || 1, index);
  });

  const productGroups = groupConsumptionEntries(entry => String(entry.productSku || entry.sku || entry.productName || 'SIN_SKU'), normalizedEntries);
  const lotGroups = groupConsumptionEntries(entry => String(entry.lotCode || entry.lotId || entry.movementBatchId || 'SIN_LOTE'), normalizedEntries);
  const operatorGroups = groupConsumptionEntries(entry => String(entry.operator || 'sin-operario'), normalizedEntries);

  const productBreakdown = Array.from(productGroups.entries()).map(([sku, groupEntries]) => {
    const theoreticalLine = theoreticalBySku.get(sku) || null;
    return summarizeConsumptionGroup(sku, groupEntries, theoreticalLine ? theoreticalLine.theoreticalSolid : null);
  });

  const lotBreakdown = Array.from(lotGroups.entries()).map(([lotKey, groupEntries]) => summarizeConsumptionGroup(lotKey, groupEntries));
  const operatorBreakdown = Array.from(operatorGroups.entries()).map(([operatorKey, groupEntries]) => summarizeConsumptionGroup(operatorKey, groupEntries));

  const orderTotals = normalizedEntries.reduce((acc, entry) => {
    acc.actualSolidUsed += Number(entry.actualSolidUsed) || 0;
    if (Number.isFinite(entry.expectedSolidUsed)) {
      acc.expectedSolidUsed += Number(entry.expectedSolidUsed);
    }
    return acc;
  }, { expectedSolidUsed: 0, actualSolidUsed: 0 });

  const theoreticalOrderTotals = (order.theoreticalConsumption || []).reduce((acc, line) => {
    acc.expectedSolidUsed += Number(line.theoreticalSolid) || 0;
    acc.quantity += Number(line.quantity) || 0;
    return acc;
  }, { expectedSolidUsed: 0, quantity: 0 });

  const expectedSolidUsed = theoreticalOrderTotals.expectedSolidUsed ? +theoreticalOrderTotals.expectedSolidUsed.toFixed(2) : null;
  const actualSolidUsed = +orderTotals.actualSolidUsed.toFixed(2);
  const varianceSolid = expectedSolidUsed === null ? null : +(actualSolidUsed - expectedSolidUsed).toFixed(2);
  const variancePct = expectedSolidUsed ? +((varianceSolid / expectedSolidUsed) * 100).toFixed(2) : null;

  return {
    orderId: order.orderId,
    flowStatus: order.flowStatus,
    expectedSolidUsed,
    actualSolidUsed,
    varianceSolid,
    variancePct,
    quantity: theoreticalOrderTotals.quantity,
    productBreakdown,
    lotBreakdown,
    operatorBreakdown,
    entries: normalizedEntries
  };
}

function gatherProductData(product) {
  const name = product.dataset.title || product.querySelector('.gallery__name')?.textContent || 'Producto';
  const price = product.dataset.price || product.querySelector('.gallery__price')?.textContent || '—';
  const desc = product.dataset.description || product.querySelector('.gallery__meta')?.textContent || '';
  let image = '';
  const imgElement = product.querySelector('.gallery__image img');

  if (imgElement) {
    image = imgElement.src;
  } else {
    const galleryImage = product.querySelector('.gallery__image');
    image = galleryImage ? galleryImage.dataset.bgImage || '' : '';
  }

  return { name, price, desc, image };
}

function formatPrice(value) {
  const numericValue = typeof value === 'number' ? value : Number(value) || 0;
  return numericValue.toLocaleString('es-CO');
}

function parseCurrencyLikeValue(value) {
  return Number.parseFloat(
    String(value || '')
      .replaceAll('$', '')
      .replaceAll('.', '')
      .replaceAll(',', '.')
  ) || 0;
}

function createCartRemoveHandler(index) {
  return function handleCartRemoveClick(event) {
    event.stopPropagation();
    const cart = safeReadJsonStorage('cyberduck:cart', []);
    cart.splice(index, 1);
    safeWriteJsonStorage('cyberduck:cart', cart);
    if (globalThis.cyberduck?.renderCart) {
      globalThis.cyberduck.renderCart();
    }

    const dd = document.getElementById('cartDropdown');
    if (dd) {
      dd.hidden = false;
    }

    try {
      globalThis.dispatchEvent(new Event('cyberduck:cart-updated'));
    } catch (error) {
      console.warn('No se pudo disparar el evento de carrito:', error);
    }
  };
}

function upsertOrderSnapshot(orderPayload, status = 'CREADA') {
  const orders = safeReadJsonStorage(ORDER_STORAGE_KEY, []);
  const theoretical = computeTheoreticalConsumption(orderPayload.items || []);
  const now = new Date().toISOString();

  const snapshot = {
    orderId: orderPayload.orderId,
    createdAt: orderPayload.createdAt || now,
    updatedAt: now,
    flowStatus: status,
    customer: orderPayload.customer || {},
    paymentMethod: orderPayload.paymentMethod || '',
    summary: orderPayload.summary || {},
    items: normalizeCartItems(orderPayload.items || []),
    theoreticalConsumption: theoretical,
    inventory: orderPayload.inventory || { status: 'pending', lines: [] },
    production: orderPayload.production || { status: 'pending', lineCount: theoretical.length },
    closeSummary: orderPayload.closeSummary || null
  };

  const index = orders.findIndex(order => order.orderId === snapshot.orderId);
  if (index >= 0) {
    orders[index] = { ...orders[index], ...snapshot };
  } else {
    orders.push(snapshot);
  }

  safeWriteJsonStorage(ORDER_STORAGE_KEY, orders);
  return snapshot;
}

function registerOrderFromCheckout(orderPayload) {
  return upsertOrderSnapshot(orderPayload, 'CREADA');
}

function resolveOrderSnapshot(orderRef) {
  if (!orderRef) {
    return null;
  }

  if (typeof orderRef === 'object' && orderRef.orderId) {
    return upsertOrderSnapshot(orderRef, orderRef.flowStatus || 'CREADA');
  }

  const orderId = String(orderRef);
  const orders = safeReadJsonStorage(ORDER_STORAGE_KEY, []);
  return orders.find(order => order.orderId === orderId) || null;
}

function registerProductionConsumption(orderRef, actualConsumption = [], options = {}) {
  const order = resolveOrderSnapshot(orderRef);
  if (!order) {
    return null;
  }

  const normalizedInput = normalizeProductionConsumptionInput(actualConsumption, options);
  const theoreticalBySku = buildIndexBySku(order.theoreticalConsumption || []);
  const skuCounts = normalizedInput.lines.reduce((acc, line) => {
    const key = String(line.productSku || line.sku || line.code || '').trim();
    if (!key) {
      return acc;
    }

    acc.set(key, (acc.get(key) || 0) + 1);
    return acc;
  }, new Map());
  const movementBatchId = `MOV-${Date.now().toString(36).toUpperCase()}`;
  const movements = normalizedInput.lines.length
    ? normalizedInput.lines.map((line, index) => {
        const key = String(line.productSku || line.sku || line.code || '').trim();
        const theoreticalLine = theoreticalBySku.get(key) || null;
        return normalizeProductionConsumptionLine(
          line,
          {
            ...normalizedInput,
            orderId: order.orderId,
            movementBatchId
          },
          theoreticalLine,
          skuCounts.get(key) || 1,
          index
        );
      })
    : (order.theoreticalConsumption || []).map((line, index) => normalizeProductionConsumptionLine(
        {
          productSku: line.sku,
          productName: line.name,
          category: line.category,
          quantity: line.quantity,
          expectedSolidUsed: line.theoreticalSolid,
          actualSolidUsed: line.theoreticalSolid,
          lotCode: normalizedInput.lotCode,
          operator: normalizedInput.operator,
          producedAt: normalizedInput.producedAt,
          notes: 'fallback-theoretical'
        },
        {
          ...normalizedInput,
          orderId: order.orderId,
          movementBatchId
        },
        line,
        1,
        index
      ));

  const report = buildConsumptionDeviationReport(order, movements);
  const stockControl = applyMaterialStockControl(movements, {
    orderId: order.orderId,
    movementBatchId,
    operator: normalizedInput.operator
  });

  const inventoryMovements = safeReadJsonStorage(INVENTORY_MOVEMENTS_KEY, []);
  inventoryMovements.push(...movements);
  safeWriteJsonStorage(INVENTORY_MOVEMENTS_KEY, inventoryMovements);

  const productionLogs = safeReadJsonStorage(PRODUCTION_LOGS_KEY, []);
  const totals = report ? {
    theoretical: report.expectedSolidUsed || 0,
    actual: report.actualSolidUsed,
    variance: report.varianceSolid || 0,
    variancePct: report.variancePct || 0
  } : {
    theoretical: 0,
    actual: 0,
    variance: 0,
    variancePct: 0
  };

  productionLogs.push({
    orderId: order.orderId,
    movementBatchId,
    productionAt: normalizedInput.producedAt,
    lotId: normalizedInput.lotId,
    lotCode: normalizedInput.lotCode,
    operator: normalizedInput.operator,
    totals,
    report,
    stockControl,
    lines: movements
  });
  safeWriteJsonStorage(PRODUCTION_LOGS_KEY, productionLogs);

  enqueueAccountingSyncMovements([{
    syncId: `SYNC-${movementBatchId}-INVOUT`,
    dedupeKey: `INVOUT-${movementBatchId}`,
    movementType: 'INVENTORY_OUT',
    orderId: order.orderId,
    source: 'registerProductionConsumption',
    payload: {
      orderId: order.orderId,
      movementBatchId,
      producedAt: normalizedInput.producedAt,
      operator: normalizedInput.operator,
      totalMaterialCostCOP: +movements.reduce((acc, line) => {
        if (Number.isFinite(line.materialCostImpact)) {
          return acc + Number(line.materialCostImpact);
        }

        return acc + ((Number(line.actualSolidUsed) || 0) * (Number(line.estimatedUnitCostCOP) || 0));
      }, 0).toFixed(2),
      lines: movements
    }
  }]);

  const inventoryBase = typeof order.inventory === 'object' && order.inventory ? order.inventory : {};
  const productionBase = typeof order.production === 'object' && order.production ? order.production : {};

  upsertOrderSnapshot({
    ...order,
    flowStatus: 'EN_PRODUCCION',
    inventory: {
      ...inventoryBase,
      status: 'consumed',
      movementType: 'PRODUCCION_CONSUMO',
      movementBatchId,
      lotId: normalizedInput.lotId,
      lotCode: normalizedInput.lotCode,
      operator: normalizedInput.operator
    },
    production: {
      ...productionBase,
      status: 'consumed',
      movementBatchId,
      lotId: normalizedInput.lotId,
      lotCode: normalizedInput.lotCode,
      operator: normalizedInput.operator,
      report,
      stockControl,
      totals
    }
  }, 'EN_PRODUCCION');

  return {
    orderId: order.orderId,
    movementBatchId,
    lotId: normalizedInput.lotId,
    lotCode: normalizedInput.lotCode,
    operator: normalizedInput.operator,
    totals,
    report,
    stockControl,
    lines: movements
  };
}

function closeOrderWithConsumption(orderRef, actualConsumption = [], options = {}) {
  const productionResult = registerProductionConsumption(orderRef, actualConsumption, options);
  if (!productionResult) {
    return null;
  }

  const closedAt = options.closedAt || new Date().toISOString();
  const order = resolveOrderSnapshot(productionResult.orderId);
  if (!order) {
    return null;
  }

  const closeSummary = {
    closedAt,
    theoreticalSolid: productionResult.totals.theoretical,
    actualSolid: productionResult.totals.actual,
    varianceSolid: productionResult.totals.variance,
    variancePct: productionResult.totals.variancePct,
    movementBatchId: productionResult.movementBatchId,
    lotId: productionResult.lotId || null,
    lotCode: productionResult.lotCode || null,
    operator: productionResult.operator || null,
    report: productionResult.report || null
  };

  const kpis = computeOrderKPIs(order, {
    actualConsumption,
    actualCost: options.actualCost,
    consumptionReport: productionResult.report || null
  });

  if (kpis) {
    closeSummary.kpis = kpis;
    closeSummary.alerts = kpis.alerts;
    closeSummary.apu = kpis.apu;
    closeSummary.margin = kpis.margin;
    closeSummary.consumption = kpis.consumption;
    persistKpiReport(kpis);
  }

  const closingProductionBase = typeof order.production === 'object' && order.production ? order.production : {};

  const closedOrder = upsertOrderSnapshot({
    ...order,
    flowStatus: 'CERRADA',
    closeSummary,
    production: {
      ...closingProductionBase,
      status: 'closed',
      closedAt,
      kpis
    }
  }, 'CERRADA');

  const accountingEntries = buildAccountingEntriesFromOrder(closedOrder, {
    kpis,
    happenedAt: closedAt
  });
  upsertAccountingLedgerEntries(accountingEntries);
  enqueueAccountingSyncMovements([
    {
      syncId: `SYNC-${closedOrder.orderId}-SALE`,
      dedupeKey: `SALE-${closedOrder.orderId}`,
      movementType: 'SALE',
      orderId: closedOrder.orderId,
      source: 'closeOrderWithConsumption',
      payload: accountingEntries.find(entry => entry.entryType === 'SALE') || null
    },
    {
      syncId: `SYNC-${closedOrder.orderId}-COGS`,
      dedupeKey: `COGS-${closedOrder.orderId}`,
      movementType: 'COGS',
      orderId: closedOrder.orderId,
      source: 'closeOrderWithConsumption',
      payload: accountingEntries.find(entry => entry.entryType === 'COGS') || null
    }
  ]);
  buildAccountingReconciliationSnapshot({ scope: 'order-close' });

  const pendingOrder = safeReadJsonStorage('cyberduck:pendingOrder', null);
  if (pendingOrder && pendingOrder.orderId === closedOrder.orderId) {
    try {
      localStorage.removeItem('cyberduck:pendingOrder');
    } catch (error) {
      console.warn('No se pudo limpiar pendingOrder:', error);
    }
  }

  return closedOrder;
}

function persistPendingOrder(payload) {
  safeWriteJsonStorage('cyberduck:pendingOrder', payload);
  registerOrderFromCheckout(payload);
}

function optimizeImageUrl(url, options = {}) {
  if (!url || typeof url !== 'string') return '';

  const trimmed = url.trim();
  const { width = 720, quality = 72 } = options;

  if (/^https:\/\/raw\.githubusercontent\.com\//i.test(trimmed)) {
    const encoded = encodeURIComponent(trimmed.replace(/^https?:\/\//i, ''));
    return `https://wsrv.nl/?url=${encoded}&w=${width}&q=${quality}&output=webp`;
  }

  return trimmed;
}

function cachedFetch(url) {
  const now = Date.now();
  const cached = apiCache.get(url);
  
  if (cached && (now - cached.timestamp) < API_CACHE_DURATION) {
    return Promise.resolve(cached.data);
  }
  
  return fetch(url, { cache: 'force-cache' })
    .then(response => response.json())
    .then(data => {
      apiCache.set(url, { data, timestamp: now });
      return data;
    });
}

// Lazy loading de imágenes con Intersection Observer
const imageObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const element = entry.target;
      const imageUrl = element.dataset.bgImage;

      if (imageUrl && imageUrl.trim() !== '') {
        const optimizedImageUrl = optimizeImageUrl(imageUrl, { width: 720, quality: 72 });
        // Precargar imagen
        const img = new Image();
        const timeout = setTimeout(() => {
          console.warn('Image load timeout for:', optimizedImageUrl);
          element.classList.add('is-error');
          observer.unobserve(element);
        }, 10000); // Timeout de 10 segundos para evitar carga infinita

        img.onload = () => {
          clearTimeout(timeout);
          element.style.backgroundImage = `url(${optimizedImageUrl})`;
          element.classList.add('is-loaded');
          observer.unobserve(element);
        };
        img.onerror = () => {
          clearTimeout(timeout);
          console.warn('Image load error for:', optimizedImageUrl);
          element.classList.add('is-error');
          observer.unobserve(element);
        };
        img.src = optimizedImageUrl;
      } else {
        // No image URL, set error state immediately
        element.classList.add('is-error');
        observer.unobserve(element);
      }
    }
  });
}, {
  rootMargin: '50px',
  threshold: 0.01
});

// Función para aplicar lazy loading a elementos de galería
function applyLazyLoading(selector = '.gallery__image') {
  const images = document.querySelectorAll(selector);
  images.forEach(img => {
    const imageUrl = img.dataset.bgImage;
    if (imageUrl && imageUrl.trim() !== '' && !img.classList.contains('is-loaded') && !img.classList.contains('is-error')) {
      const optimizedImageUrl = optimizeImageUrl(imageUrl, { width: 720, quality: 72 });
      // Cargar imagen inmediatamente para debugging
      const imgEl = new Image();
      imgEl.onload = () => {
        // Create an actual img element for better display
        const actualImg = document.createElement('img');
        actualImg.src = optimizedImageUrl;
        actualImg.style.width = '100%';
        actualImg.style.height = '100%';
        actualImg.style.objectFit = 'cover';
        actualImg.style.borderRadius = '16px';
        actualImg.alt = 'Producto';
        actualImg.loading = 'lazy';
        actualImg.decoding = 'async';
        img.innerHTML = '';
        img.appendChild(actualImg);
        img.classList.remove('gallery__image--loading');
        img.classList.add('is-loaded');
      };
      imgEl.onerror = () => {
        console.warn('Error loading image:', optimizedImageUrl);
        img.classList.remove('gallery__image--loading');
        img.classList.add('is-error');
      };
      imgEl.src = optimizedImageUrl;
    } else if (!imageUrl || imageUrl.trim() === '') {
      console.warn('Empty image URL for element:', img);
      img.classList.remove('gallery__image--loading');
      img.classList.add('is-error');
    }
  });
}

// Exponer funciones globalmente
const cyberduckGlobal = typeof globalThis.cyberduck === 'object' && globalThis.cyberduck
  ? globalThis.cyberduck
  : {};

globalThis.cyberduck = {
  ...cyberduckGlobal,
  normalizeCurrencyValue,
  pickFirstDefined,
  normalizeCartItem,
  normalizeCartItems,
  computeCartTotals,
  buildOrderPayload,
  createCheckoutFingerprint,
  buildCheckoutSubmissionEnvelope,
  registerCheckoutSubmission,
  markCheckoutSubmissionCompleted,
  setMaterialStockLevel,
  upsertMaterialStockPolicy,
  getMaterialStockControlSnapshot,
  persistPendingOrder,
  registerOrderFromCheckout,
  registerProductionConsumption,
  closeOrderWithConsumption,
  computeOrderKPIs,
  computeTheoreticalConsumption,
  exportAccountingData,
  getAccountingLedgerEntries,
  getAccountingSyncQueue,
  getPendingAccountingSyncMovements,
  markAccountingMovementSynced,
  buildAccountingReconciliationSnapshot,
  cachedFetch,
  optimizeImageUrl,
  applyLazyLoading,
  imageObserver
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // no-op
    });
  });
}

/* =========================
   CYBERDUCK — slider simple
========================= */
document.addEventListener('DOMContentLoaded', () => {
  const slides = Array.from(document.querySelectorAll("[data-slide]"));
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const dotsWrap = document.getElementById("dots");

  if (!slides.length || !prevBtn || !nextBtn || !dotsWrap) return;

  let index = 0;

  const setActive = (i) => {
    index = (i + slides.length) % slides.length;
    slides.forEach((s, idx) => s.classList.toggle("is-active", idx === index));
    Array.from(dotsWrap.children).forEach((d, idx) => d.classList.toggle("is-active", idx === index));
  };

  // dots
  slides.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "dot" + (i === 0 ? " is-active" : "");
    dot.ariaLabel = `Ir al slide ${i + 1}`;
    dot.addEventListener("click", () => setActive(i));
    dotsWrap.appendChild(dot);
  });

  prevBtn.addEventListener("click", () => setActive(index - 1));
  nextBtn.addEventListener("click", () => setActive(index + 1));

  const prefersReduced = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!prefersReduced) {
    setInterval(() => setActive(index + 1), 6500);
  }
});

/* Product modal behavior: open modal when clicking a product, populate fields, allow close */
(function(){
  document.addEventListener('DOMContentLoaded', function(){
    function goToProductPage(product){
      const data = gatherProductData(product);
      try {
        localStorage.setItem('cyberduck:selectedProduct', JSON.stringify(data));
      } catch (error) {
        console.warn('No se pudo guardar el producto seleccionado:', error);
      }
      globalThis.location.href = './product.html';
    }

    // Ensure floating cart UI exists (inject into body) so it works on all pages
    function ensureCartUI(){
      if(document.getElementById('cartButton')) return;
      const container = document.createElement('div');
      container.className = 'cart cart-floating';
      container.innerHTML = `
        <button id="cartButton" class="iconbtn cart-btn" type="button" aria-label="Carrito">🛒<span id="cartCount" class="cart-badge" aria-hidden="true">0</span></button>
        <div id="cartDropdown" class="cart-dropdown" hidden>
          <div class="cart-dropdown__head">
            <strong>Carrito</strong>
            <button id="cartClear" class="btn">Vaciar</button>
          </div>
          <div id="cartItems" class="cart-items"></div>
          <div class="cart-dropdown__foot">
            <div id="cartTotal" class="cart-total">Total: —</div>
            <a id="cartCheckout" class="btn btn--primary" href="#">Pagar →</a>
          </div>
        </div>
      `;
      document.body.appendChild(container);
    }

    ensureCartUI();
    // make checkout link go to checkout page
    const cartCheckoutLink = document.getElementById('cartCheckout');
    if(cartCheckoutLink){ cartCheckoutLink.setAttribute('href', './checkout.html'); }

    // Attach direct listeners to known product elements for reliability
    const items = Array.from(document.querySelectorAll('.gallery__item, .card'));
    items.forEach(item => item.addEventListener('click', function(e){
      e.preventDefault();
      goToProductPage(item);
    }));

    // Fallback: delegated listener for any other trigger
    document.addEventListener('click', function(e){
      const trigger = e.target.closest('[data-product-trigger]');
      if(trigger){
        e.preventDefault();
        goToProductPage(trigger);
      }
    });
  
    /* Cart: simple cart UI and localStorage-backed data */
    const CART_KEY = 'cyberduck:cart';
    function readCart(){
      try {
        const raw = localStorage.getItem(CART_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (error) {
        console.warn('No se pudo leer el carrito:', error);
        return [];
      }
    }
    function writeCart(cart){
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
      } catch (error) {
        console.warn('No se pudo guardar el carrito:', error);
      }
    }

    function renderCart(){
      const btn = document.getElementById('cartButton');
      const countEl = document.getElementById('cartCount');
      const dropdown = document.getElementById('cartDropdown');
      const itemsWrap = document.getElementById('cartItems');
      const totalEl = document.getElementById('cartTotal');
      if(!btn || !countEl || !dropdown || !itemsWrap || !totalEl) return;

      const cart = readCart();
      countEl.textContent = String(cart.length || 0);

      // Enable/disable checkout link depending on cart contents (do this before early return)
      const checkoutLink = document.getElementById('cartCheckout');
      if(checkoutLink){
        if (cart.length === 0) {
          checkoutLink.classList.add('is-disabled');
          checkoutLink.setAttribute('aria-disabled', 'true');
          checkoutLink.setAttribute('href', '#');
        } else {
          checkoutLink.classList.remove('is-disabled');
          checkoutLink.removeAttribute('aria-disabled');
          checkoutLink.setAttribute('href', './checkout.html');
        }
      }

      itemsWrap.innerHTML = '';
      if(!cart.length){
        itemsWrap.innerHTML = '<div class="cart-empty">No hay productos en el carrito</div>';
        totalEl.textContent = 'Total: —';
        return;
      }

      let total = 0;
      cart.forEach((it, idx) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item';

        const thumb = document.createElement('div');
        thumb.className = 'cart-item__thumb';
        if(it.image){ thumb.style.backgroundImage = it.image.indexOf('url(') === 0 ? it.image : `url(${it.image})`; }

        const meta = document.createElement('div'); meta.className = 'cart-item__meta';
        const name = document.createElement('div'); name.className = 'cart-item__name'; name.textContent = it.name || 'Producto';
        const parsedPrice = parseCurrencyLikeValue(it.price);
        const price = document.createElement('div'); price.className = 'cart-item__price'; price.textContent = Number.isNaN(parsedPrice) ? '—' : parsedPrice.toLocaleString('es-CO');

        meta.appendChild(name); meta.appendChild(price);

        const rm = document.createElement('button'); rm.className = 'cart-item__remove'; rm.type = 'button'; rm.innerHTML = '✕';
        rm.addEventListener('click', createCartRemoveHandler(idx));

        itemEl.appendChild(thumb); itemEl.appendChild(meta); itemEl.appendChild(rm);
        itemsWrap.appendChild(itemEl);

        // Try to parse numeric price for total (best-effort) - handle Spanish format
        const val = parseCurrencyLikeValue(it.price);
        total += val;
      });

      totalEl.textContent = 'Total: $' + (total ? formatPrice(total) : '0');


    }

    // Expose renderCart globally
    globalThis.cyberduck.renderCart = renderCart;

    // Listen for explicit cart-updated events (fired after cart change in-page)
    globalThis.addEventListener('cyberduck:cart-updated', function(){
      renderCart();
      // pulse animation for visual feedback
      const btn = document.getElementById('cartButton');
      if(btn){
        btn.classList.add('is-pulse');
        setTimeout(() => btn.classList.remove('is-pulse'), 480);
      }
    });

    document.addEventListener('click', function(e){
      const cartBtn = e.target.closest('#cartButton');
      if(cartBtn){
        const dd = document.getElementById('cartDropdown');
        if(dd){ dd.hidden = !dd.hidden; if(!dd.hidden) renderCart(); }
      } else {
        // click outside closes cart
        const dd = document.getElementById('cartDropdown');
        if(dd && !e.target.closest('.cart')) dd.hidden = true;
      }
    });

    // Clear cart
    const clearBtn = document.getElementById('cartClear');
    if(clearBtn){ clearBtn.addEventListener('click', function(){ writeCart([]); renderCart(); }); }

    // Initial render
    renderCart();
  });
})();

/* Loading indicator for nuevo section */
(function(){
  const loadingIndicator = document.getElementById('loading-indicator');
  const gallery = document.querySelector('.gallery');

  if (loadingIndicator && gallery) {
    // Show loading indicator initially
    loadingIndicator.style.display = 'flex';
    gallery.style.display = 'none';

    // Simulate loading delay
    setTimeout(() => {
      loadingIndicator.style.display = 'none';
      gallery.style.display = 'grid';
    }, 2000); // 2 seconds delay
  }
})();

/* Search functionality */
document.addEventListener('DOMContentLoaded', function(){
  const searchBtn = document.querySelector('.iconbtn[aria-label="Buscar"]');
  let searchInput = null;
  let searchModal = null;

  if (searchBtn) {
    searchBtn.addEventListener('click', function() {
      if (!searchModal) {
        createSearchModal();
      }
      searchModal.hidden = false;
      if (searchInput) {
        searchInput.focus();
      }
    });
  }

  function createSearchModal() {
    searchModal = document.createElement('div');
    searchModal.className = 'modal';
    searchModal.innerHTML = `
      <div class="modal__backdrop"></div>
      <div class="modal__content" style="max-width: 600px;">
        <div class="modal__head">
          <h3 class="modal__title">Buscar productos</h3>
          <button class="modal__close" type="button" aria-label="Cerrar">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <input type="text" id="searchInput" placeholder="Buscar productos..." class="input" style="width: 100%;">
          </div>
          <div id="searchResults" style="max-height: 400px; overflow-y: auto; margin-top: 16px;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(searchModal);

    searchInput = document.getElementById('searchInput');
    const closeBtn = searchModal.querySelector('.modal__close');
    const backdrop = searchModal.querySelector('.modal__backdrop');

    // Close modal functions
    function closeModal() {
      searchModal.hidden = true;
      if (searchInput) {
        searchInput.value = '';
      }
      const resultsDiv = document.getElementById('searchResults');
      if (resultsDiv) {
        resultsDiv.innerHTML = '';
      }
    }

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && !searchModal.hidden) {
        closeModal();
      }
    });

    // Search functionality
    let searchTimeout = null;
    searchInput.addEventListener('input', function() {
      const query = this.value.trim().toLowerCase();

      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      if (query.length >= 3) {
        searchTimeout = setTimeout(() => {
          performSearch(query);
        }, 300);
      } else {
        const resultsDiv = document.getElementById('searchResults');
        if (resultsDiv) {
          resultsDiv.innerHTML = query.length > 0 ? '<p style="color: var(--muted);">Ingresa al menos 3 letras para buscar...</p>' : '';
        }
      }
    });
  }

  async function performSearch(query) {
    const resultsDiv = document.getElementById('searchResults');
    if (!resultsDiv) return;

    resultsDiv.innerHTML = '<p style="color: var(--muted);">Buscando...</p>';

    try {
      // Search across all product categories
      const searchPromises = [
        globalThis.cyberduck.cachedFetch('https://script.google.com/macros/s/AKfycby8QkrU25mFNgiP3eq0hKoDFOnBSLvybmAnrjX_m4ibdBAqXekiQNbMs1bZbvdOGRWL/exec'), // Nuevo
        globalThis.cyberduck.cachedFetch('https://script.google.com/macros/s/AKfycbzlEH33cVRdLmR3cI17bZi7k81OyucZnhqQ7WAPhJcigixl12fpYH03xMfvL77gGl9x/exec'), // Camisetas
        globalThis.cyberduck.cachedFetch('https://script.google.com/macros/s/AKfycbxi7qSdxN6ZQdzVYTzAHlfGwkjqmll0ldqGspbxFb8T4GstfDK0MasUNflQUymsbOri/exec'), // Faldas
        globalThis.cyberduck.cachedFetch('https://script.google.com/macros/s/AKfycbw4zEM2NKmejtMMuiBLDdBEMIyIgtwfr1yHoPXxNBz7_mypqhTTX6tu85DFLGD4Cn_b/exec'), // Aretes
        globalThis.cyberduck.cachedFetch('https://script.google.com/macros/s/AKfycbzDPhkp_9XcrAeg67eek7l5ijVEu7LiWuwgSXR8CEcp1OJwi_vCzqH9bVH0oFI7JLgW/exec'), // Otros
        globalThis.cyberduck.cachedFetch('https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLhGPGNmmLa8riYe4CS2khOSoGTVL7DEQ74nVmLsR-UYhEIfckSl1OMf2zROgO7Pk9OrRZMdX2tTmIOzrAkE89PlJIWLHdg4LmF5ABC6Umj2AlQ2Vxyj1ARtSg8PyBFrtT2ZPR9mlc_MN9kA1JepzEkRbABtVxfaKe8FheiklWy8zknXpFF-RcAW2nhuoHkrZ_po5njURSs2EkOJFcXVdF4ZeMaSPNy4r5yMy7UcET3mSYwFlE2JAbVFFYZHtirYZqa3p4YzdBY21pf--RSGJuXOEDH_zg&lib=M-YxSEsKo8g88BRj95yNKp5OjAoyKQGY4'), // Collares
        globalThis.cyberduck.cachedFetch('https://script.google.com/macros/s/AKfycbz4mKWXZ2NSQ_T2U6cFaLm9CvKLsHzvwJAd2-PSnvqIizSmjeiDgGC7A8vDCtXrfM0e/exec'), // Manillas
        globalThis.cyberduck.cachedFetch('https://script.google.com/macros/s/AKfycbyLTeWyAHgR_0i2bE50o-ufvp0gK_FnNcVaMc_S80xpSW-6MHQgTLoxm-6eeYeWz6hE/exec'), // Impresiones
        globalThis.cyberduck.cachedFetch('https://script.google.com/macros/s/AKfycbzOjIQtpaVbU8ymtev2cioDvUz6N255uDpsvAyHLf5PFNpBnLBqd4b6HAPKwHYuY72V/exec') // Gargantillas
      ];

      const results = await Promise.all(searchPromises);
      const allProducts = [];

      results.forEach(result => {
        if (result?.data && Array.isArray(result.data)) {
          allProducts.push(...result.data);
        }
      });

      // Filter products that match the search query
      const matches = allProducts.filter(product => {
        const name = (product.NAME || product.name || product.nombre || '').toLowerCase();
        const desc = (product.DESC || product.desc || product.descripcion || '').toLowerCase();
        return name.includes(query) || desc.includes(query);
      });

      if (matches.length > 0) {
        resultsDiv.innerHTML = matches.slice(0, 10).map(product => {
          const name = product.NAME || product.name || product.nombre || 'Producto';
          const price = product.PRICE || product.price || product.precio || '';
          const image = product.IMAGE || product.image || product.imagen || '';
          const optimizedThumb = optimizeImageUrl(image, { width: 120, quality: 64 });
          const formattedPrice = price ? `$${Number.parseFloat(price).toLocaleString('es-CO')} COP` : '';

          return `
            <div class="search-result-item" style="display: flex; gap: 12px; padding: 12px; border-bottom: 1px solid var(--line); cursor: pointer;" onclick="window.location.href='./product.html'; localStorage.setItem('cyberduck:selectedProduct', JSON.stringify({name:'${name}',price:'${price}',image:'${image}',desc:'${product.DESC || product.desc || product.descripcion || ''}'}))">
              <div style="width: 60px; height: 60px; background: var(--panel); border-radius: 8px; overflow: hidden; flex-shrink: 0;">
                ${image ? `<img src="${optimizedThumb}" alt="${name}" loading="lazy" decoding="async" style="width: 100%; height: 100%; object-fit: cover;">` : ''}
              </div>
              <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 4px;">${name}</div>
                <div style="color: var(--muted); font-size: 14px;">${formattedPrice}</div>
              </div>
            </div>
          `;
        }).join('');
      } else {
        resultsDiv.innerHTML = '<p style="color: var(--muted);">No se encontraron productos que coincidan con tu búsqueda.</p>';
      }

    } catch (error) {
      console.error('Search error:', error);
      resultsDiv.innerHTML = '<p style="color: var(--muted);">Error al buscar productos. Inténtalo de nuevo.</p>';
    }
  }
});

/* Gift card modal */
document.addEventListener('DOMContentLoaded', function(){
  const modal = document.getElementById('giftModal');
  const openBtn = document.getElementById('giftBuyBtn');
  const closeBtn = document.getElementById('giftModalClose');
  const cancelBtn = document.getElementById('giftModalCancel');
  const acceptBtn = document.getElementById('giftModalAccept');
  const valueInput = document.getElementById('giftValue');

  if (!modal || !openBtn || !closeBtn || !cancelBtn || !acceptBtn || !valueInput) return;

  function openModal() {
    modal.hidden = false;
    valueInput.focus();
  }

  function closeModal() {
    modal.hidden = true;
    valueInput.value = '';
  }

  function addToCart() {
    const value = Number.parseInt(valueInput.value, 10);
    if (!value || value < 10000) {
      alert('Por favor ingresa un valor válido (mínimo $10.000 COP)');
      return;
    }

    const giftItem = {
      name: `Tarjeta de Regalo - $${value.toLocaleString('es-CO')} COP`,
      price: value.toLocaleString('es-CO'),
      image: 'url(./imgs/gift.png)',
      desc: 'Tarjeta de regalo con pequeño regalo sorpresa incluido.'
    };

    // Add to cart
    const CART_KEY = 'cyberduck:cart';
    const cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    cart.push(giftItem);
    localStorage.setItem(CART_KEY, JSON.stringify(cart));

    // Update cart UI
    globalThis.dispatchEvent(new Event('cyberduck:cart-updated'));

    closeModal();
    alert('Tarjeta de regalo añadida al carrito!');
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  acceptBtn.addEventListener('click', addToCart);

  // Close on backdrop click
  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeModal();
  });

  // Close on escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });
});

