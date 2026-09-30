import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

// API para executar queries PostgreSQL (substitui Supabase client)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      operation, 
      tableName, 
      selectColumns = '*',
      whereConditions = [],
      orderBy,
      limit,
      insertData,
      updateData 
    } = body

    let sql = ''
    let params: any[] = []

    switch (operation) {
      case 'select':
        sql = `SELECT ${selectColumns} FROM ${tableName}`
        
        if (whereConditions.length > 0) {
          const whereClause = whereConditions.map((condition: any, index: number) => {
            params.push(condition.value)
            if (condition.operator === 'IN') {
              const placeholders = condition.value.map((_: any, i: number) => `$${params.length - condition.value.length + i + 1}`).join(', ')
              return `${condition.column} IN (${placeholders})`
            }
            return `${condition.column} ${condition.operator} $${index + 1}`
          }).join(' AND ')
          sql += ` WHERE ${whereClause}`
        }
        
        if (orderBy) {
          sql += ` ORDER BY ${orderBy}`
        }
        
        if (limit) {
          sql += ` LIMIT ${limit}`
        }
        break

      case 'insert':
        if (Array.isArray(insertData)) {
          // Inserção múltipla
          const keys = Object.keys(insertData[0])
          const values = insertData.map((item: any) => keys.map(key => item[key]))
          const placeholders = values.map((_, rowIndex) => 
            `(${keys.map((_, colIndex) => `$${rowIndex * keys.length + colIndex + 1}`).join(', ')})`
          ).join(', ')
          
          sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES ${placeholders} RETURNING *`
          params = values.flat()
        } else {
          // Inserção única
          const keys = Object.keys(insertData)
          const values = Object.values(insertData)
          const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ')
          
          sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`
          params = values
        }
        break

      case 'update':
        const updateKeys = Object.keys(updateData)
        const updateValues = Object.values(updateData)
        const setClause = updateKeys.map((key, index) => `${key} = $${index + 1}`).join(', ')
        
        sql = `UPDATE ${tableName} SET ${setClause}`
        params = [...updateValues]
        
        if (whereConditions.length > 0) {
          const whereClause = whereConditions.map((condition: any, index: number) => {
            params.push(condition.value)
            return `${condition.column} ${condition.operator} $${params.length}`
          }).join(' AND ')
          sql += ` WHERE ${whereClause}`
        }
        
        sql += ' RETURNING *'
        break

      case 'delete':
        sql = `DELETE FROM ${tableName}`
        
        if (whereConditions.length > 0) {
          const whereClause = whereConditions.map((condition: any, index: number) => {
            params.push(condition.value)
            return `${condition.column} ${condition.operator} $${index + 1}`
          }).join(' AND ')
          sql += ` WHERE ${whereClause}`
        }
        
        sql += ' RETURNING *'
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Operação não suportada' },
          { status: 400 }
        )
    }

    const result = await query(sql, params)
    
    return NextResponse.json({
      success: true,
      data: result.rows,
      error: null
    })

  } catch (error) {
    console.error('Database API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro interno do servidor' 
      },
      { status: 500 }
    )
  }
}