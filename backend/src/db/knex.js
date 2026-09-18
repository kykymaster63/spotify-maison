import Knex from 'knex'
import { config } from '../config.js'

export const db = Knex({
  client: 'pg',
  connection: config.db.url,
  pool: { min: 2, max: 10 }
})
