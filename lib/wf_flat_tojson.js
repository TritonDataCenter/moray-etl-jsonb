#!/usr/bin/env node

// wf_flat_tojson.js  //
// TARGET PostgreSQL tags and source Moray tag definitions //
// to json input

var fs = require('fs');
var outstream = fs.createWriteStream('wf_flat.json', {flags : 'w' });


// Output filenames
var f_db_HCT = 'flat_m.json';
var db_HCT = 'wf_flat_m';
var pk_HCT = '_id'; // The Primary Key of main table


// TARGET table - flat


var keys_HCT = [
          'image_uuid',
          'creator_uuid',
          'origin',
          'task',
          'workflow_uuid',
          'vm_uuid',
          'taskId',
          'created_at',
          'exec_after',
          'started',
          'elapsed',
          'name',
          'endpoint',
          'target',
          'postBackState',
          'package',
          'nicTags',
          'timeout',
          'serverNicTags',
          'server_uuid',
          'execution',
          'version',
          'expects',
          'requestMethod',
          'markAsFailedOnError',
          'addedToUfds',
          'max_attempts',
          'num_attempts',
          'image',
          'params',
          'chain',
          'chain_results',
          'onerror',
          'onerror_results'
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
          'execution',
          'image_uuid',
          'creator_uuid',
          'origin',
          'task',
          'workflow_uuid',
          'vm_uuid',
          'server_uuid',
          'created_at',
          'exec_after',
          'runner_id',
          'target',
          'name'
    ];

// MORAY CUSTOM KEYS TO IGNORE
// MUST APPEAR ON THE ABOVE LIST
// These are all the custom keys added in code to the Moray dump
// that should not appear (nor their values) in the output.
var keys_Moray_Custom_Ignore = [
          "_txn_snap",
          "_vnode"     // These are never populated as at 27 Aug 2014
    ];

// MORAY KEYS TO IGNORE
// These are keys that are duplicates with mismatched names or deprecated
// and not to be used in populating RTT/LCT/HCT
var keys_Ignore = [
          'workflow',  //duplicate of workflow_uuid
          'servers',   // deprecated DAPI-213
          'serversByUuid', // deprecated DAPI-213
          'filteredServers',  // deprecated DAPI-213
          'serverSysinfo'  // deprecated DAPI-213
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
var wf_json = JSON.stringify(keys);
outstream.write(wf_json);
//exports.keys = keys;
