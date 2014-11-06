#!/usr/bin/env node

// lastfm_flat_tojson.js  //
// TARGET PostgreSQL tags and source Moray tag definitions //
// to json input

var fs = require('fs');
var outstream = fs.createWriteStream('lastfm_flat.json', {flags : 'w' });


// Output filenames
var f_db_HCT = '_flat_m.json';
var db_HCT = 'lastfm_flat_m';
var pk_HCT = '_uuid'; // The Primary Key of main table


// TARGET table - flat


var keys_HCT = [
    'artist',
    'similars',
    'tags',
    'timestamp',
    'title',
    'track_id'
    ];


//var keys_ALL = keys_RTT.concat(keys_LCT, keys_HCT);

var keys_ALL = keys_HCT;

// ORIGIN PostgresQL DUMP TABLES //

// MORAY STANDARD KEYS
// These are the standard keys/columns in a Moray dump
var keys_Moray = [
          '_uuid',
    ];

// MORAY CUSTOMIZED KEYS
// These are all the custom keys added in code to the Moray dump
// Any of these keys that match keys in HCT, LCT, RTT sets above
// should be ignored as duplicates.
// This duplicate matching is not yet automated.
var keys_Moray_Custom = [
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


var table_HCT_ = keys_HCT_top.concat(keys_Moray, keys_Moray_Custom, keys_HCT);
var table_HCT = undupe(table_HCT_);


var keys = {
    'target' : {
          'hct' : keys_HCT,
          'all' : keys_ALL
    },
    'source' : {
          'moray' : keys_Moray,
          'custom' : keys_Moray_Custom,
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
var lastfm_json = JSON.stringify(keys);
outstream.write(lastfm_json);
//exports.keys = keys;
