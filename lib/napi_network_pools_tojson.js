#!/usr/bin/env node

// napi_network_pools_tojson.js  //
// TARGET PostgreSQL tags and source Moray tag definitions //
// to json input

var fs = require('fs');
var outstream = fs.createWriteStream('napi_network_pools_keys.json', {flags : 'w' });


// Output filenames
var f_db_HCT = '_m.json';
var db_HCT = 'napi_network_pools_m';
var pk_HCT = '_id'; // The Primary Key of main table


// TARGET table - flat


var keys_HCT = [
         'uuid',
         'name',
         'networks'
    ];


//var keys_ALL = keys_RTT.concat(keys_LCT, keys_HCT);

var keys_ALL = keys_HCT;

// ORIGIN PostgresQL DUMP TABLES //

// MORAY STANDARD KEYS
// These are the standard keys/columns in a Moray dump
var keys_Moray = [
          '_id',
          '_key',
          '_etag',
          '_mtime'
    ];

// MORAY CUSTOMIZED KEYS
// These are all the custom keys added in code to the Moray dump
// Any of these keys that match keys in HCT, LCT, RTT sets above
// should be ignored as duplicates.
// This duplicate matching is not yet automated.
var keys_Moray_Custom = [
          '_txn_snap',
          '_vnode',
          'owner_uuids',
          'uuid'
    ];

// MORAY CUSTOM KEYS TO IGNORE
// MUST APPEAR ON THE ABOVE LIST
// These are all the custom keys added in code to the Moray dump
// that should not appear (nor their values) in the output.
var keys_Moray_Custom_Ignore = [
          '_txn_snap',
          '_vnode',     // These are never populated as at 27 Aug 2014
          'owner_uuids',
          'uuid'
    ];

// MORAY KEYS TO IGNORE
// These are keys that are duplicates with mismatched names or deprecated
// and not to be used in populating RTT/LCT/HCT
var keys_Ignore = [
    ];


var keys_HCT_top = [
    '_m_id'
    ];


function undupe(arr) {
    var i,
    len = arr.length,
          out = [],
          obj = {};

    for (i = 0; i < len; i++) {
        obj[arr[i]] = 0;
    }
    for (i in obj) {
        out.push(i);
    }
    return out;
}


// REMOVE keys_Moray_Custom_Ignore from keys_Moray_Custom


function subtract(arr1, arr2) {
    var i;
    var j;
    var len1 = arr1.length;
    var len2 = arr2.length;
    var out=[];
    var matched = false;

    for (i = 0; i < len1; i++) {
        matched = false;
        for (j = 0; j < len2; j++) {
           if (arr1[i] === arr2[j]) {
               matched = true;
           }
        }
        if (!matched) {
            out.push(arr1[i]);
        }
    }
    return out;
}


var keys_Moray_Custom_final = subtract(keys_Moray_Custom, keys_Moray_Custom_Ignore);
var table_HCT_ = keys_HCT_top.concat(keys_Moray, keys_Moray_Custom_final, keys_HCT);
var table_HCT = undupe(table_HCT_);


var keys = {
    'target' : {
          'hct' : keys_HCT,
          'all' : keys_ALL
    },
    'source' : {
          'moray' : keys_Moray,
          'custom' : keys_Moray_Custom,
          'custom_ignore' : keys_Moray_Custom_Ignore,
          'ignore' : keys_Ignore
    },
    'tables' : {
          'hct' : table_HCT
    },
    'files' : {
          'hct' : f_db_HCT
    },
    'names' : {
          'hct' : db_HCT
    },
    'pk' : {
          'hct' : pk_HCT
    }

};



outstream.open();
var napi_network_pools_json = JSON.stringify(keys);
outstream.write(napi_network_pools_json);
//exports.keys = keys;
