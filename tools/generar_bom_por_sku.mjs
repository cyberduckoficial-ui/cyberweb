import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CATEGORY_BOM_DEFAULTS = {
  camisetas: {
    materialCode: 'MAT-TXT-ALGODON-EST',
    materialName: 'Textil algodón estampado',
    materialUnit: 'g',
    solidPerUnit: 220,
    fixedPerOrder: 18,
    wastePct: 6,
    toleranceLowerPct: -4,
    toleranceUpperPct: 6,
    notes: 'Incluye tela principal y transfer/insumo sólido de estampación.'
  },
  faldas: {
    materialCode: 'MAT-TXT-POLY-BASIC',
    materialName: 'Textil base poliéster',
    materialUnit: 'g',
    solidPerUnit: 280,
    fixedPerOrder: 20,
    wastePct: 7,
    toleranceLowerPct: -5,
    toleranceUpperPct: 7,
    notes: 'Incluye tela principal y consumibles sólidos de confección.'
  },
  aretes: {
    materialCode: 'MAT-ACC-RESINA-METAL',
    materialName: 'Resina/acabado metálico',
    materialUnit: 'g',
    solidPerUnit: 18,
    fixedPerOrder: 4,
    wastePct: 8,
    toleranceLowerPct: -5,
    toleranceUpperPct: 8,
    notes: 'Promedio de material sólido por par.'
  },
  collares: {
    materialCode: 'MAT-ACC-RESINA-COLLAR',
    materialName: 'Resina/acrílico para collar',
    materialUnit: 'g',
    solidPerUnit: 24,
    fixedPerOrder: 5,
    wastePct: 8,
    toleranceLowerPct: -5,
    toleranceUpperPct: 8,
    notes: 'Incluye dije principal y piezas sólidas auxiliares.'
  },
  manillas: {
    materialCode: 'MAT-ACC-RESINA-MANILLA',
    materialName: 'Resina/acrílico para manilla',
    materialUnit: 'g',
    solidPerUnit: 14,
    fixedPerOrder: 4,
    wastePct: 8,
    toleranceLowerPct: -5,
    toleranceUpperPct: 8,
    notes: 'Promedio por unidad terminada.'
  },
  gargantillas: {
    materialCode: 'MAT-ACC-RESINA-GARG',
    materialName: 'Resina/acrílico para gargantilla',
    materialUnit: 'g',
    solidPerUnit: 20,
    fixedPerOrder: 5,
    wastePct: 8,
    toleranceLowerPct: -5,
    toleranceUpperPct: 8,
    notes: 'Incluye pieza central y accesorios sólidos.'
  },
  otros: {
    materialCode: 'MAT-ACC-MIX-OTROS',
    materialName: 'Material sólido mixto accesorios',
    materialUnit: 'g',
    solidPerUnit: 30,
    fixedPerOrder: 6,
    wastePct: 9,
    toleranceLowerPct: -6,
    toleranceUpperPct: 10,
    notes: 'Categoría mixta con variación moderada.'
  },
  impresion3d: {
    materialCode: 'MAT-3DP-PLA-BASIC',
    materialName: 'Filamento PLA',
    materialUnit: 'g',
    solidPerUnit: 95,
    fixedPerOrder: 8,
    wastePct: 12,
    toleranceLowerPct: -8,
    toleranceUpperPct: 10,
    notes: 'Incluye soportes y purgas estándar de impresión.'
  },
  personalizar: {
    materialCode: 'MAT-3DP-PLA-CUSTOM',
    materialName: 'Filamento PLA personalizado',
    materialUnit: 'g',
    solidPerUnit: 120,
    fixedPerOrder: 12,
    wastePct: 15,
    toleranceLowerPct: -10,
    toleranceUpperPct: 12,
    notes: 'Personalizados con variación mayor por iteración.'
  },
  nuevo: {
    materialCode: 'MAT-MIX-NUEVO',
    materialName: 'Material sólido mixto (línea nuevo)',
    materialUnit: 'g',
    solidPerUnit: 80,
    fixedPerOrder: 8,
    wastePct: 10,
    toleranceLowerPct: -6,
    toleranceUpperPct: 10,
    notes: 'Línea de lanzamiento; validar contra consumo real.'
  },
  default: {
    materialCode: 'MAT-GEN-SOLIDO',
    materialName: 'Material sólido genérico',
    materialUnit: 'g',
    solidPerUnit: 60,
    fixedPerOrder: 6,
    wastePct: 10,
    toleranceLowerPct: -6,
    toleranceUpperPct: 10,
    notes: 'Usar temporalmente hasta definir receta específica.'
  }
};

const pushCurrentCell = (state) => {
  state.row.push(state.current);
  state.current = '';
};

const pushCurrentRowIfNotEmpty = (state) => {
  if (state.row.some((cell) => String(cell).trim() !== '')) {
    state.rows.push(state.row);
  }
  state.row = [];
};

const handleQuoteChar = (state, next) => {
  if (state.inQuotes && next === '"') {
    state.current += '"';
    return 1;
  }

  state.inQuotes = !state.inQuotes;
  return 0;
};

const handleLineBreak = (state, char, next) => {
  pushCurrentCell(state);
  pushCurrentRowIfNotEmpty(state);

  if (char === '\r' && next === '\n') {
    return 1;
  }

  return 0;
};

const csvRowsToObjects = (rows) => {
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((values) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] ?? '';
    });
    return obj;
  });
};

const parseCsv = (content) => {
  const state = {
    rows: [],
    row: [],
    current: '',
    inQuotes: false
  };

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      i += handleQuoteChar(state, next);
      continue;
    }

    if (!state.inQuotes && char === ',') {
      pushCurrentCell(state);
      continue;
    }

    if (!state.inQuotes && (char === '\n' || char === '\r')) {
      i += handleLineBreak(state, char, next);
      continue;
    }

    state.current += char;
  }

  if (state.current.length > 0 || state.row.length > 0) {
    pushCurrentCell(state);
    pushCurrentRowIfNotEmpty(state);
  }

  return csvRowsToObjects(state.rows);
};

const csvEscape = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[,\n"]/g.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
};

const toCsv = (rows, headers) => {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','));
  }
  return `${lines.join('\n')}\n`;
};

const number = (value) => {
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(String(value || '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const categoryDefaults = (category) => CATEGORY_BOM_DEFAULTS[category] || CATEGORY_BOM_DEFAULTS.default;

const buildBomRows = (catalogRows) =>
  catalogRows.map((product, index) => {
    const category = String(product.categoria || '').trim() || 'default';
    const defaults = categoryDefaults(category);

    const solidPerUnit = defaults.solidPerUnit;
    const fixedPerOrder = defaults.fixedPerOrder;
    const wastePct = defaults.wastePct;

    const solidPerUnitWithWaste = +(solidPerUnit * (1 + wastePct / 100)).toFixed(2);
    const orderSolidBaseQty1 = +(solidPerUnitWithWaste + fixedPerOrder).toFixed(2);

    return {
      recipe_id: `BOM-${String(index + 1).padStart(5, '0')}`,
      sku: product.sku,
      producto: product.nombre,
      categoria: category,
      material_codigo: defaults.materialCode,
      material_nombre: defaults.materialName,
      unidad_material: defaults.materialUnit,
      consumo_solido_por_unidad: solidPerUnit,
      consumo_fijo_por_orden: fixedPerOrder,
      merma_estimada_pct: wastePct,
      tolerancia_inferior_pct: defaults.toleranceLowerPct,
      tolerancia_superior_pct: defaults.toleranceUpperPct,
      consumo_teorico_por_unidad_con_merma: solidPerUnitWithWaste,
      consumo_teorico_orden_qty1: orderSolidBaseQty1,
      formula_consumo_orden: '((consumo_solido_por_unidad * cantidad) * (1 + merma_estimada_pct/100)) + consumo_fijo_por_orden',
      version_receta: 'v1-piloto',
      estado_receta: 'ACTIVA',
      notas: defaults.notes
    };
  });

const buildMaterialsMaster = (bomRows) => {
  const seen = new Map();

  for (const row of bomRows) {
    if (seen.has(row.material_codigo)) continue;

    seen.set(row.material_codigo, {
      material_codigo: row.material_codigo,
      material_nombre: row.material_nombre,
      unidad_material: row.unidad_material,
      tipo_material: 'SOLIDO',
      estado: 'ACTIVO'
    });
  }

  return Array.from(seen.values());
};

const main = async () => {
  const baseDir = process.cwd();
  const catalogPath = path.join(baseDir, 'data', 'catalogo_maestro_estandarizado.csv');

  const catalogCsv = await readFile(catalogPath, 'utf8');
  const catalogRows = parseCsv(catalogCsv).filter((row) => String(row.sku || '').trim() !== '');

  const bomRows = buildBomRows(catalogRows);
  const materialsRows = buildMaterialsMaster(bomRows);

  const bomHeaders = [
    'recipe_id',
    'sku',
    'producto',
    'categoria',
    'material_codigo',
    'material_nombre',
    'unidad_material',
    'consumo_solido_por_unidad',
    'consumo_fijo_por_orden',
    'merma_estimada_pct',
    'tolerancia_inferior_pct',
    'tolerancia_superior_pct',
    'consumo_teorico_por_unidad_con_merma',
    'consumo_teorico_orden_qty1',
    'formula_consumo_orden',
    'version_receta',
    'estado_receta',
    'notas'
  ];

  const materialsHeaders = [
    'material_codigo',
    'material_nombre',
    'unidad_material',
    'tipo_material',
    'estado'
  ];

  await writeFile(path.join(baseDir, 'data', 'bom_recetas_por_sku.csv'), toCsv(bomRows, bomHeaders), 'utf8');
  await writeFile(path.join(baseDir, 'data', 'bom_materiales_maestros.csv'), toCsv(materialsRows, materialsHeaders), 'utf8');

  const summary = {
    generatedAt: new Date().toISOString(),
    productsRead: catalogRows.length,
    recipesGenerated: bomRows.length,
    materialsGenerated: materialsRows.length,
    checks: {
      allRecipesLinkedToSku: bomRows.every((row) => String(row.sku || '').trim() !== ''),
      hasWasteAndTolerance: bomRows.every((row) =>
        Number.isFinite(number(row.merma_estimada_pct))
        && Number.isFinite(number(row.tolerancia_inferior_pct))
        && Number.isFinite(number(row.tolerancia_superior_pct))
      )
    },
    outputFiles: [
      'data/bom_recetas_por_sku.csv',
      'data/bom_materiales_maestros.csv'
    ]
  };

  console.log(JSON.stringify(summary, null, 2));
};

try {
  await main();
} catch (error) {
  console.error('Error al generar BOM por SKU:', error);
  process.exitCode = 1;
}
