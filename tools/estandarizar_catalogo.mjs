import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const SOURCES = [
  {
    source: 'nuevo-home',
    categoryDefault: 'nuevo',
    url: 'https://script.google.com/macros/s/AKfycby8QkrU25mFNgiP3eq0hKoDFOnBSLvybmAnrjX_m4ibdBAqXekiQNbMs1bZbvdOGRWL/exec'
  },
  {
    source: 'nuevo-v2',
    categoryDefault: 'nuevo',
    url: 'https://script.google.com/macros/s/AKfycby50Z8qW5B7xo5Ngjdc2s5pqTtTJCLZ7zVKdgoR8uEP9iubd85qWVxY5fiqHicftxhL/exec'
  },
  {
    source: 'ropa-camisetas',
    categoryDefault: 'camisetas',
    url: 'https://script.google.com/macros/s/AKfycbzlEH33cVRdLmR3cI17bZi7k81OyucZnhqQ7WAPhJcigixl12fpYH03xMfvL77gGl9x/exec'
  },
  {
    source: 'ropa-faldas',
    categoryDefault: 'faldas',
    url: 'https://script.google.com/macros/s/AKfycbxi7qSdxN6ZQdzVYTzAHlfGwkjqmll0ldqGspbxFb8T4GstfDK0MasUNflQUymsbOri/exec'
  },
  {
    source: 'accesorios-aretes',
    categoryDefault: 'aretes',
    url: 'https://script.google.com/macros/s/AKfycbw4zEM2NKmejtMMuiBLDdBEMIyIgtwfr1yHoPXxNBz7_mypqhTTX6tu85DFLGD4Cn_b/exec'
  },
  {
    source: 'accesorios-otros',
    categoryDefault: 'otros',
    url: 'https://script.google.com/macros/s/AKfycbzDPhkp_9XcrAeg67eek7l5ijVEu7LiWuwgSXR8CEcp1OJwi_vCzqH9bVH0oFI7JLgW/exec'
  },
  {
    source: 'accesorios-collares',
    categoryDefault: 'collares',
    url: 'https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLhGPGNmmLa8riYe4CS2khOSoGTVL7DEQ74nVmLsR-UYhEIfckSl1OMf2zROgO7Pk9OrRZMdX2tTmIOzrAkE89PlJIWLHdg4LmF5ABC6Umj2AlQ2Vxyj1ARtSg8PyBFrtT2ZPR9mlc_MN9kA1JepzEkRbABtVxfaKe8FheiklWy8zknXpFF-RcAW2nhuoHkrZ_po5njURSs2EkOJFcXVdF4ZeMaSPNy4r5yMy7UcET3mSYwFlE2JAbVFFYZHtirYZqa3p4YzdBY21pf--RSGJuXOEDH_zg&lib=M-YxSEsKo8g88BRj95yNKp5OjAoyKQGY4'
  },
  {
    source: 'accesorios-manillas',
    categoryDefault: 'manillas',
    url: 'https://script.google.com/macros/s/AKfycbz4mKWXZ2NSQ_T2U6cFaLm9CvKLsHzvwJAd2-PSnvqIizSmjeiDgGC7A8vDCtXrfM0e/exec'
  },
  {
    source: 'accesorios-gargantillas',
    categoryDefault: 'gargantillas',
    url: 'https://script.google.com/macros/s/AKfycbzOjIQtpaVbU8ymtev2cioDvUz6N255uDpsvAyHLf5PFNpBnLBqd4b6HAPKwHYuY72V/exec'
  },
  {
    source: 'impresion-3d',
    categoryDefault: 'impresion3d',
    url: 'https://script.google.com/macros/s/AKfycbyLTeWyAHgR_0i2bE50o-ufvp0gK_FnNcVaMc_S80xpSW-6MHQgTLoxm-6eeYeWz6hE/exec'
  },
  {
    source: 'personalizar',
    categoryDefault: 'personalizar',
    url: 'https://script.google.com/macros/s/AKfycbztotFgcZHKbmTpEM0jEqtCOZqNtjH3DHaQgFf8up4KwtW9M08eprqP0wKYdKR8fRAO/exec'
  }
];

const ACCOUNT_BY_CATEGORY = {
  camisetas: '413501-VENTA-CAMISETAS',
  faldas: '413502-VENTA-FALDAS',
  aretes: '413510-VENTA-ARETES',
  collares: '413511-VENTA-COLLARES',
  manillas: '413512-VENTA-MANILLAS',
  gargantillas: '413513-VENTA-GARGANTILLAS',
  otros: '413519-VENTA-ACCESORIOS-OTROS',
  impresion3d: '413520-VENTA-IMPRESION3D',
  personalizar: '413521-VENTA-PERSONALIZADOS',
  nuevo: '413599-VENTA-NUEVO'
};

const STANDARD_COST_FACTOR = {
  camisetas: 0.42,
  faldas: 0.45,
  aretes: 0.38,
  collares: 0.4,
  manillas: 0.4,
  gargantillas: 0.4,
  otros: 0.35,
  impresion3d: 0.55,
  personalizar: 0.6,
  nuevo: 0.45
};

const UOM_BY_CATEGORY = {
  default: 'UND',
  impresion3d: 'UND',
  personalizar: 'UND'
};

const slugify = (value) =>
  String(value || '')
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');

const pick = (row, keys) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
};

const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value === null || value === undefined) return null;

  const raw = String(value)
    .replaceAll(/\s+/g, '')
    .replaceAll('$', '')
    .replaceAll('COP', '')
    .replaceAll('cop', '');

  if (!raw) return null;

  let normalized = raw;
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replaceAll('.', '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const titleCase = (input) => {
  const clean = String(input || '').trim().replaceAll(/\s+/g, ' ');
  if (!clean) return '';
  return clean
    .split(' ')
    .map((w) => (w.length <= 2 ? w.toUpperCase() : `${w[0].toUpperCase()}${w.slice(1).toLowerCase()}`))
    .join(' ')
    .replaceAll(/\b3d\b/gi, '3D');
};

const categoryCode = (category) => {
  const map = {
    camisetas: 'CAM',
    faldas: 'FAL',
    aretes: 'ARE',
    collares: 'COL',
    manillas: 'MAN',
    gargantillas: 'GAR',
    otros: 'OTR',
    impresion3d: '3DP',
    personalizar: 'PER',
    nuevo: 'NVO'
  };

  return map[category] || 'GEN';
};

const csvEscape = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[,\n"]/g.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
};

const normalizeDataArray = (json) => {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.items)) return json.items;
  return [];
};

const fetchSource = async (source) => {
  const response = await fetch(source.url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const json = await response.json();
  return normalizeDataArray(json);
};

const collectRawRows = async () => {
  const rawRows = [];
  const fetchErrors = [];

  for (const source of SOURCES) {
    try {
      const rows = await fetchSource(source);
      for (const row of rows) {
        const normalized = {};
        Object.keys(row || {}).forEach((key) => {
          if (!key) return;
          normalized[key.trim().toLowerCase()] = row[key];
        });
        rawRows.push({ source, row: normalized });
      }
    } catch (error) {
      fetchErrors.push({ source: source.source, url: source.url, error: String(error.message || error) });
    }
  }

  return { rawRows, fetchErrors };
};

const normalizeProducts = (rawRows) => rawRows.map(({ source, row }, index) => {
  const rawName = pick(row, ['sku', 'name', 'nombre', 'producto', 'title', 'item']);
  const rawCategory = pick(row, ['category', 'categoria', 'type']) || source.categoryDefault;
  const category = slugify(rawCategory).replaceAll('-', '') || source.categoryDefault;
  const name = titleCase(rawName || `Producto ${index + 1}`);
  const reference = slugify(`${name}-${category}`);
  const price = toNumber(pick(row, ['price', 'precio', 'value', 'valor']));

  const factor = STANDARD_COST_FACTOR[category] ?? 0.45;
  const standardCost = price === null ? null : Math.round(price * factor);

  return {
    source: source.source,
    skuOriginal: pick(row, ['sku', 'code', 'id']),
    productNameRaw: rawName,
    productNameNormalized: name,
    referenceNormalized: reference,
    category,
    unitMeasure: UOM_BY_CATEGORY[category] || UOM_BY_CATEGORY.default,
    salePriceCOP: price,
    standardCostCOP: standardCost,
    accountCode: ACCOUNT_BY_CATEGORY[category] || '413500-VENTAS-GENERAL',
    imageUrl: pick(row, ['image', 'imagen', 'img', 'photo']),
    description: pick(row, ['desc', 'description', 'descripcion']),
    active: 'SI'
  };
});

const main = async () => {
  const { rawRows, fetchErrors } = await collectRawRows();
  const normalizedProducts = normalizeProducts(rawRows);

  const dedupeMap = new Map();
  const duplicateRows = [];
  const masterRows = [];

  for (const product of normalizedProducts) {
    const key = `${product.category}::${product.referenceNormalized}`;
    if (!dedupeMap.has(key)) {
      dedupeMap.set(key, { ...product, duplicateCount: 1 });
      continue;
    }

    const existing = dedupeMap.get(key);
    existing.duplicateCount += 1;
    if (!existing.imageUrl && product.imageUrl) existing.imageUrl = product.imageUrl;
    if ((!existing.salePriceCOP || existing.salePriceCOP === 0) && product.salePriceCOP) {
      existing.salePriceCOP = product.salePriceCOP;
      existing.standardCostCOP = product.standardCostCOP;
    }

    duplicateRows.push(product);
  }

  let skuCounter = 1;
  for (const row of dedupeMap.values()) {
    const skuAssigned = row.skuOriginal
      ? String(row.skuOriginal).trim().toUpperCase()
      : `CYB-${categoryCode(row.category)}-${String(skuCounter).padStart(4, '0')}`;

    skuCounter += 1;
    masterRows.push({
      sku: skuAssigned,
      nombre: row.productNameNormalized,
      referencia: row.referenceNormalized,
      categoria: row.category,
      unidad_medida: row.unitMeasure,
      precio_venta_cop: row.salePriceCOP ?? '',
      costo_estandar_cop: row.standardCostCOP ?? '',
      cuenta_contable: row.accountCode,
      descripcion: row.description || '',
      imagen: row.imageUrl || '',
      fuente: row.source,
      activo: row.active,
      ocurrencias_detectadas: row.duplicateCount
    });
  }

  masterRows.sort((a, b) => a.categoria.localeCompare(b.categoria, 'es') || a.nombre.localeCompare(b.nombre, 'es'));

  const headers = Object.keys(masterRows[0] || {
    sku: '', nombre: '', referencia: '', categoria: '', unidad_medida: '', precio_venta_cop: '',
    costo_estandar_cop: '', cuenta_contable: '', descripcion: '', imagen: '', fuente: '', activo: '', ocurrencias_detectadas: ''
  });

  const toCsv = (rows) => {
    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(headers.map((h) => csvEscape(row[h])).join(','));
    }
    return `${lines.join('\n')}\n`;
  };

  const duplicatesForCsv = duplicateRows.map((row) => ({
    sku: row.skuOriginal || '',
    nombre_normalizado: row.productNameNormalized,
    referencia_normalizada: row.referenceNormalized,
    categoria: row.category,
    precio_venta_cop: row.salePriceCOP ?? '',
    fuente: row.source,
    imagen: row.imageUrl || ''
  }));

  const duplicateHeaders = Object.keys(duplicatesForCsv[0] || {
    sku: '', nombre_normalizado: '', referencia_normalizada: '', categoria: '', precio_venta_cop: '', fuente: '', imagen: ''
  });

  const toDuplicatesCsv = (rows) => {
    const lines = [duplicateHeaders.join(',')];
    for (const row of rows) {
      lines.push(duplicateHeaders.map((h) => csvEscape(row[h])).join(','));
    }
    return `${lines.join('\n')}\n`;
  };

  const baseDir = process.cwd();
  await writeFile(path.join(baseDir, 'data', 'catalogo_maestro_estandarizado.csv'), toCsv(masterRows), 'utf8');
  await writeFile(path.join(baseDir, 'data', 'catalogo_duplicados_detectados.csv'), toDuplicatesCsv(duplicatesForCsv), 'utf8');
  await writeFile(path.join(baseDir, 'data', 'catalogo_fuentes_error.json'), JSON.stringify(fetchErrors, null, 2), 'utf8');

  const summary = {
    generatedAt: new Date().toISOString(),
    sourcesConfigured: SOURCES.length,
    sourceErrors: fetchErrors.length,
    rowsFetched: rawRows.length,
    uniqueProducts: masterRows.length,
    duplicateRows: duplicatesForCsv.length,
    outputFiles: [
      'data/catalogo_maestro_estandarizado.csv',
      'data/catalogo_duplicados_detectados.csv',
      'data/catalogo_fuentes_error.json'
    ]
  };

  console.log(JSON.stringify(summary, null, 2));
};

try {
  await main();
} catch (error) {
  console.error('Error al estandarizar catálogo:', error);
  process.exitCode = 1;
}
