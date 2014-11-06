#!/usr/bin/env node

// napi_networks_tojson.js  //
// TARGET PostgreSQL tags and source Moray tag definitions//
// to json input 

var fs = require('fs');
var outstream = fs.createWriteStream("napi_networks_keys.json", {flags : 'w' });


// Output filenames
var f_db_RTT = "_s.json";
var f_db_LCT = "_r.json";
var f_db_HCT = "_m.json";
var db_RTT = "napi_networks_s";
var db_LCT = "napi_networks_r";
var db_HCT = "napi_networks_m";
var pk_HCT = "_etag"; // The Primary Key of main table


var keys_RTT = [
         "routes"
    ];

var keys_LCT = [
         "nic_tag"
    ];

var keys_HCT = [
// UIDs
          "uuid",
          "owner_uuids",
// Data
          "name",
          "description",
          "gateway",
          "resolvers",
          "vlan_id",
          "subnet_start_ip",
          "subnet_bits",
          "provision_end_ip",
          "provision_start_ip"
    ];


var keys_ALL = keys_RTT.concat(keys_LCT, keys_HCT);


// ORIGIN PostgresQL DUMP TABLES //

// MORAY STANDARD KEYS
// These are the standard keys/columns in a Moray dump
var keys_Moray = [
          "_id",
          "_key",
          "_etag",
          "_mtime"
    ];

// MORAY CUSTOMIZED KEYS
// These are all the custom keys added in code to the Moray dump
// Any of these keys that match keys in HCT, LCT, RTT sets above
// should be ignored as duplicates.
// This duplicate matching is not yet automated.
var keys_Moray_Custom = [
          "_txn_snap",
          "_vnode",
          "name",
          "nic_tag",
          "owner_uuids",
          "uuid",
          "vlan_id"
    ];

// MORAY KEYS TO IGNORE
// MUST APPEAR ON THE ABOVE LIST
// These are all the custom keys added in code to the Moray dump
// that should not appear (nor their values) in the output HCT.
var keys_Moray_Custom_Ignore = [
          "_txn_snap",
          "_vnode",     // These are never populated as at 27 Aug 2014
          "name",
          "nic_tag",
          "owner_uuids",
          "uuid",
          "vlan_id"
    ];


// JSON KEYS TO IGNORE
// These are keys that are duplicates with mismatched names or deprecated 
// and not to be used in populating RTT/LCT/HCT
var keys_Ignore = [
    ];


var keys_LCT_top = [
    "_r_id"
    ];

var keys_RTT_top = [
    "_s_id",
    "_m_id",
    "_r_id",
    "tag",
    "value"
    ];

var keys_HCT_top = [
    "_m_id",
    "_r_id"
    ];

var table_RTT = keys_RTT_top;

var table_LCT = keys_LCT_top.concat(keys_LCT);

function undupe(arr) {
  var i,
      len=arr.length,
      out=[],
      obj={};
 
  for (i=0;i<len;i++) {
    obj[arr[i]]=0;
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
          'rtt' : keys_RTT,
          'lct' : keys_LCT,
          'hct' : keys_HCT,
          'all' : keys_ALL
    },
    'source' : {
          'moray' : keys_Moray,
          'custom' : keys_Moray_Custom,
          'custom-ignore' : keys_Moray_Custom_Ignore,
          'ignore' : keys_Ignore
    },
    'tables' : {
          'rtt' : table_RTT,
          'lct' : table_LCT,
          'hct' : table_HCT
    },
    'files' : {
          'rtt' : f_db_RTT,
          'lct' : f_db_LCT,
          'hct' : f_db_HCT
    },
    'names' : {
          'rtt' : db_RTT,
          'lct' : db_LCT,
          'hct' : db_HCT
    },
    'pk' : {
          'hct' : pk_HCT
    }

};



outstream.open();
var napi_networks_json = JSON.stringify(keys);
outstream.write(napi_networks_json);



//exports.keys = keys;


