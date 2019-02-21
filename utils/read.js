var _ = require('lodash');
let e = {};
let index = null;
let logger = null;
var defaultFilter = {};

function checkOptions(options, MongoDB) {
    if (!options || typeof options != 'object') {
        options = {}
    }
    options = Object.assign({}, index.defaults, options);
    defaultFilter = index.defaults.filter ? index.defaults.filter : {};
    const reqKeys = ['db', 'collectionName'];
    let missingKeys = _.difference(reqKeys, Object.keys(options));
    if (missingKeys.length > 0) {
        throw new Error(missingKeys + ' keys are not present in options');
    }
    if (!MongoDB || (MongoDB.serverConfig).isConnected() === false) {
        throw new Error('Mongo not connected');
    }
    return options;
}

function modifyDateFilter(filter, dateFields, dateFlag) {
    if(filter instanceof RegExp) return filter;
    if (Array.isArray(filter)) return filter.map(_f => modifyDateFilter(_f, dateFields, dateFlag));
    if (typeof filter === 'object') {
        let newFilter = {};
        Object.keys(filter).forEach(_k => {
            if (dateFields.indexOf(_k) > -1) {
                newFilter[_k] = modifyDateFilter(filter[_k], dateFields, true);
            } else {
                newFilter[_k] = modifyDateFilter(filter[_k], dateFields, dateFlag);
            }
        });
        return newFilter;
    }
    return dateFlag ? new Date(filter) : filter;
}

e.init = function (options) {
    index = options;
    logger = options.logger;
}

e.index = function (options) {
    let MongoDB = index.MongoDB;
    let dbo = MongoDB.db(options.db);
    options = checkOptions(options, dbo);
    var colName = options.collectionName;
    var reqParams = options;
    var filter = reqParams['filter'] ? reqParams.filter : {};
    var sort = reqParams['sort'] ? {} : {
        '_metadata.lastUpdated': -1
    };
    reqParams['sort'] ? reqParams.sort.split(',').map(el => el.split('-').length > 1 ? sort[el.split('-')[1]] = -1 : sort[el.split('-')[0]] = 1) : null;
    var select = reqParams['select'] ? reqParams.select.split(',') : [];
    var page = reqParams['page'] ? reqParams.page : 1;
    var count = reqParams['count'] ? reqParams.count : 10;
    var search = reqParams['search'] ? reqParams.search : null;
    var skip = count * (page - 1);
    var query = null;
    if (typeof filter === 'string') {
        try {
            filter = JSON.parse(filter);
            filter = FilterParse(filter);
        } catch (err) {
            logger.error('Failed to parse filter :' + err);
            filter = {};
        }
    }
    filter = _.assign({}, defaultFilter, filter);
    if (filter.omit) {
        filter = _.omit(filter, this.omit);
    }
    if (search) {
        filter['$text'] = { '$search': search };
    }
    if (options.dateFields && Array.isArray(options.dateFields)) {
        filter = modifyDateFilter(filter, options.dateFields, false);
    }
    let selectObject = {};
    if (select.length) {
        for (let i = 0; i < select.length; i++) {
            selectObject[select[i]] = 1;
        }
    }
    if (count == -1) {
        query = dbo.collection(colName).find(filter).project(selectObject).sort(sort).toArray();
    }
    else {
        query = dbo.collection(colName).find(filter).project(selectObject).skip(skip).limit(count).sort(sort).toArray();
    }
    return query;
};

e.count = function (options) {
    const MongoDB = index.MongoDB;
    let dbo = MongoDB.db(options.db);
    options = checkOptions(options, dbo);
    var colName = options.collectionName;
    var reqParams = options;
    var filter = reqParams['filter'] ? reqParams.filter : {};

    if (typeof filter === 'string') {
        try {
            filter = JSON.parse(filter);
            filter = FilterParse(filter);
        } catch (err) {
            logger.error('Failed to parse filter :' + err);
            filter = {};
        }
    }
    filter = _.assign({}, defaultFilter, filter);
    if (filter.omit) {
        filter = _.omit(filter, this.omit);
    }
    if (options.dateFields && Array.isArray(options.dateFields)) {
        filter = modifyDateFilter(filter, options.dateFields, false);
    }
    let query = dbo.collection(colName).find(filter).count();

    return query;
};

e.show = function (options) {
    const MongoDB = index.MongoDB;
    let dbo = MongoDB.db(options.db);
    options = checkOptions(options, dbo);
    var colName = options.collectionName;
    var reqParams = options;
    var select = reqParams['select'] ? reqParams.select.split(',') : [];
    let selectObject = {};
    if (select.length) {
        for (let i = 0; i < select.length; i++) {
            selectObject[select[i]] = 1;
        }
    }
    let filter = Object.assign({}, defaultFilter, { _id: reqParams['id'] });
    return dbo.collection(colName)
        .find(filter)
        .project(selectObject).toArray()
        .then(_data => _data[0])
};

function FilterParse(filterParsed) {
    for (var key in filterParsed) {
        if (IsString(filterParsed[key])) {
            filterParsed[key] = CreateRegexp(filterParsed[key]);
        } else if (IsArray(filterParsed[key])) {
            filterParsed[key] = ResolveArray(filterParsed[key]);
        } else if (IsObject(filterParsed[key])) {
            filterParsed[key] = FilterParse(filterParsed[key]);
        }
    }
    return filterParsed;
}
function IsString(val) {
    return val && val.constructor.name === 'String';
}
function CreateRegexp(str) {
    if (str.charAt(0) === '/' &&
        str.charAt(str.length - 1) === '/') {
        var text = str.substr(1, str.length - 2).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        return new RegExp(text, 'i');
    } else {
        return str;
    }
}
function IsArray(arg) {
    return arg && arg.constructor.name === 'Array';
}
function IsObject(arg) {
    return arg && arg.constructor.name === 'Object';
}
function ResolveArray(arr) {
    for (var x = 0; x < arr.length; x++) {
        if (IsObject(arr[x])) {
            arr[x] = FilterParse(arr[x]);
        } else if (IsArray(arr[x])) {
            arr[x] = ResolveArray(arr[x]);
        } else if (IsString(arr[x])) {
            arr[x] = CreateRegexp(arr[x]);
        }
    }
    return arr;
}
module.exports = e;

