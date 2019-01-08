const mongo = require('mongodb').MongoClient;
let MongoRead = require('./utils/read');
let URL = require('url');

let log4js = require('log4js');
const loggerName = process.env.HOSTNAME ? `[MongoUtil] [${process.env.HOSTNAME}]` : '[MongoUtil]';
let logger = log4js.getLogger(loggerName);
logger.level = process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info';

let MongoDB = null;
let defaults = {};

function connect(url, options) {
    url = URL.format(URL.parse(url));
    return new Promise((resolve, reject) => {
        defaults = options && options.defaults ? options.defaults : {};
        delete options.defaults;
        mongo.connect(url, options, (error, db) => {
            if (error) {
                logger.error('MongoUtil Connection failed');
                logger.error(error.message);
                return reject(error);
            }
            if (db) {
                MongoDB = db;
                MongoRead.init({
                    MongoDB: MongoDB,
                    logger: logger,
                    defaults: defaults
                });
                logger.info('MongoUtil Connected');
                return resolve(db);
            }
        });
    })
}

function disconnect() {
    return new Promise((resolve, reject) => {
        MongoDB.close((err) => {
            if (err) {
                return reject(err);
            }
            return resolve();
        })
    })

}

module.exports = {
    connect: connect,
    disconnect: disconnect,
    logger: logger,
    MongoRead: MongoRead
};
