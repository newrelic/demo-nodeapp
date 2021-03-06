'use strict'

const knex = require('knex')
const logger = require('./logger')
const fileUtil = require('./fileUtil')

let instance = null

class MySQLRepository {
  constructor(databaseConfiguration, invLoader = () => fileUtil.readJsonFile('data/inventory.json')) {
    this._connection = undefined
    this._invLoader = invLoader

    const { host,
            port,
            user,
            password,
            name } = databaseConfiguration

    this._configuration = {
      host,
      port,
      user,
      password,
      database: name,
      charset: 'utf8'
    }
  }

  static getInstance(databaseConfiguration, invLoader) {
    if (!databaseConfiguration) {
      return null
    }

    if (instance === null) {
      instance = new MySQLRepository(databaseConfiguration, invLoader)
    }

    return instance
  }

  async isConnected() {
    if (!this._connection) {
      await this.initialize()
    }

    try {
      await this._connection.select('1')
      return true
    }
    catch (err) {
      return false
    }
  }

  async initialize() {
    logger.info('Initializing MySQL database')
    const tableName = 'inventory'
    await this.createDatabase()

    const connection = knex({
      client: 'mysql',
      connection: this._configuration
    })

    await connection.schema.dropTableIfExists(tableName)

    logger.info('Creating table with name: inventory')
    await connection.schema.createTable('inventory', table => {
      table.string('id')
      table.string('item')
      table.string('price')
      table.string('sku')
      table.string('description')
    })

    const inventoryData = this._invLoader()
    const inserts = inventoryData.map((item) => connection(tableName).insert(item))
    await Promise.all(inserts)

    this._connection = connection
  }

  async createDatabase() {
    const config = this._configuration

    const rawConnection = knex({
      client: 'mysql',
      connection: {
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password
      }
    })

    logger.info(`Creating database with name: ${config.database}`)
    await rawConnection.raw(`CREATE DATABASE IF NOT EXISTS ${config.database}`)
    rawConnection.destroy()
  }

  async findAll() {
    if (!this._connection) {
      await this.initialize()
    }

    return this._connection.select().from('inventory')
  }

  async findOrNull(id) {
    if (!this._connection) {
      await this.initialize()
    }

    const results = await this._connection.select().from('inventory').where({ id })
    if (results.length > 0) {
      return results[0]
    }

    return null
  }

  async queryInvalidTable() {
    if (!this._connection) {
      await this.initialize()
    }
    return this._connection.select().from('inventry')
  }
}

module.exports = MySQLRepository
