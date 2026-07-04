// scripts/orm-migrate.ts — Schema sync: crea tablas faltantes desde los modelos registrados.
// Copia minimizada de arckode-framework/kernel/db/orm-migrate (el framework no exporta ese subpath).
// Solo CREATE TABLE IF NOT EXISTS + indices (idempotente, no destructivo).
import type { DbAdapter, ModelDefinition } from 'arckode-framework'

function assertSafeIdentifier(value: string, context: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value))
    throw new Error(`Invalid SQL identifier in ${context}: "${value}"`)
}
function fieldTypeToSQL(type: string): string {
  return ({ string: 'TEXT', text: 'TEXT', number: 'REAL', boolean: 'BOOLEAN', json: 'TEXT', date: 'TEXT' } as Record<string, string>)[type] || 'TEXT'
}

export async function ormMigrate(db: DbAdapter, models: Map<string, ModelDefinition>): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = []
  const skipped: string[] = []
  for (const [modelName, def] of models) {
    assertSafeIdentifier(def.table, `modelo ${modelName}`)
    for (const fieldName of Object.keys(def.fields)) assertSafeIdentifier(fieldName, `campo ${modelName}.${fieldName}`)

    const hasExplicitId = Object.keys(def.fields).includes('id')
    const columns = Object.entries(def.fields).map(([name, field]) => {
      const f = field as { type: string; required?: boolean; unique?: boolean; default?: unknown }
      const parts = [name, fieldTypeToSQL(f.type)]
      if (name === 'id') parts.push('PRIMARY KEY')
      if (f.required) parts.push('NOT NULL')
      if (f.unique) parts.push('UNIQUE')
      if (f.default !== undefined) {
        // Serializar default por tipo: strings entre comillas, json (array/objeto) como string JSON,
        // number/boolean literales. Evita generar SQL invalido como `DEFAULT []` o `DEFAULT [object]`.
        let defVal: string
        if (typeof f.default === 'string') defVal = `'${f.default.replace(/'/g, "''")}'`
        else if (typeof f.default === 'object') defVal = `'${JSON.stringify(f.default).replace(/'/g, "''")}'`
        else defVal = String(f.default)
        parts.push(`DEFAULT ${defVal}`)
      }
      return parts.join(' ')
    })
    if (!hasExplicitId) columns.unshift('id TEXT PRIMARY KEY')
    if (def.timestamps) { columns.push('createdAt TEXT'); columns.push('updatedAt TEXT') }
    if ((def as { softDelete?: boolean }).softDelete) columns.push('deletedAt TEXT')

    try {
      await db.run(`CREATE TABLE IF NOT EXISTS ${def.table} (${columns.join(', ')})`)
      created.push(def.table)
    } catch (e) {
      skipped.push(`${def.table}: ${String(e).slice(0, 90)}`)
    }

    for (const [fieldName, field] of Object.entries(def.fields)) {
      const f = field as { indexed?: boolean; unique?: boolean }
      if (f.indexed && !f.unique) {
        try { await db.run(`CREATE INDEX IF NOT EXISTS idx_${def.table}_${fieldName} ON ${def.table}(${fieldName})`) } catch { /* index exists */ }
      }
    }
  }
  return { created, skipped }
}
