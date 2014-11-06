#!/usr/bin/env node

// ufds_keys_tojson.js  //
// TARGET PostgreSQL tags and source Moray tag definitions//
// to json input 

var fs = require('fs');
var outstream = fs.createWriteStream("ufds_keys.json", {flags : 'w' });


// Output filenames
var f_db_RTT = "_s.json";
var f_db_LCT = "_r.json";
var f_db_HCT = "_m.json";
var db_RTT = "ufds_o_sdc_s";
var db_LCT = "ufds_o_sdc_r";
var db_HCT = "ufds_o_sdc_m";
var pk_HCT = "_etag"; // The Primary Key of main table



// Note that the RTT list here is not an inclusive list
// and some of these are being deprecated
// Any issing tags are picked up automatically
// and missing data not matching a tag - doesn't matter
// In principle one could leave keys_RTT blank 

var keys_RTT = [
    "action",
    "activated",
    "active",
    "agent",
    "base-1.7.2",
    "base",
    "base64",
    "billing_tags",
    "billingtag",
    "centos-5.7",
    "centos-5.7_64",
    "centos-5.7_x64",
    "centos-6",
    "centos6",
    "city",
    "config",
    "contact",
    "contacts",
    "cpu_burst_ratio",
    "cpu_cap",
    "cpu_type",
    "datacenter",
    "debian-6.03",
    "default",
    "disabled",
    "disk_driver",
    "enabled",
    "error",
    "expires_at",
    "firstinstance",
    "fromip",
    "fromsubnet",
    "fromwildcard",
    "fss",
    "generate_passwords",
    "group",
    "homepage",
    "image_name",
    "image_os",
    "image_size",
    "limit",
    "machine",
    "max_lwps",
    "mongodb",
    "mysql",
    "nic_driver",
    "nodejs",
    "o",
    "os",
    "ou",
    "overprovision_cpu",
    "overprovision_memory",
    "owner_uuid",
    "percona",
    "phoneverification",
    "portal_fingerprint",
    "portal_private_key",
    "ports",
    "postalcode",
    "protocol",
    "public",
    "pwdaccountlockedtime",
    "ram",
    "registered_developer",
    "requirements",
    "riak",
    "riakeds",
    "runinvmhost",
    "signupstep",
    "smartos",
    "smartos64",
    "smartosplus",
    "smartosplus64",
    "standard",
    "standard64",
    "state",
    "tag",
    "tags",
    "totag",
    "tovm",
    "towildcard",
    "traits",
    "type",
    "ubuntu-10.04",
    "ubuntu-12.04",
    "ubuntu-certified-12.04",
    "ubuntu-certified-13.10",
    "usemoresecurity",
    "user",
    "users",
    "v",
    "vcpus",
    "windows2008r2",
    "windows2008r2standard",
    "ws2008ent-r2-sp1",
    "ws2008std-r2-sp1",
    "zeus-simple-lb-200mbps",
    "zfs_io_priority",
    "fromtag",
    "fromvm",
    "toip",
    "tosubnet",
    "pwdattribute",
    "pwdinhistory",
    "pwdminlength",
    "pwdmaxfailure",
    "pwdlockoutduration",
    "pwdmaxage",
    "pwdcheckquality",
    "pwdpolicysubentry",
    "account",
    "memberpolicy",
    "memberrole",
    "rule",
    "tenant",
    "origin",
    "networks",
    "max_physical_memory",
    "max_swap"
    ];

var keys_LCT = [
    "_imported",
    "_replicated",
    "approved_for_provisioning",
    "objectclass"
    ];

var keys_HCT = [
    "uuid",
    "image_uuid",
    "billing_id",
    "owner",
//    "acl",  Deprecated in source data 27 Aug 2014 
    "_owner",
    "_parent",
    "_salt",
    "fingerprint",
    "email",
    "name",
    "givenname",
    "common_name",
    "address",
    "company",
    "country",
    "phone",
    "description",
    "login",
    "userpassword",
    "forgot_password_code",
    "openssh",
    "pkcs",
    "created_at",
    "updated_at",
//    "published_at",  Deprecated in source data 27 Aug 2014
    "pwdchangedtime",
    "pwdendtime",
    "pwdfailuretime",
    "pwdhistory",
    "blockingreason",
    "riskscore",
    "riskscoreexplanation",
    "version",
    "cn",
//    "files", Deprecated in source data 27 Aug 2014
    "quota",
    "ram_ratio",
    "sn",
    "urn",
    "accounthistory"
    ];


var keys_ALL = keys_RTT.concat(keys_LCT, keys_HCT);



// ORIGIN PostgresQL DUMP TABLES //

// MORAY STANDARD KEYS
// These are the standard keys/columns in a Moray dump
var keys_Moray = [
          "_id",
          "_txn_snap",
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
    "_vnode",
    "login",
    "uuid",
    "email",
    "fingerprint",
    "cn",
    "sn",
    "city",
    "state",
    "country",
    "postalcode",
    "agent",
    "owner",
    "fromtag",
    "totag",
    "fromvm",
    "tovm",
    "fromip",
    "toip",
    "fromsubnet",
    "tosubnet",
    "fromwildcard",
    "towildcard",
    "_owner",
    "_parent",
    "urn",
    "pwdattribute",
    "pwdinhistory",
    "pwdminlength",
    "pwdmaxfailure",
    "pwdlockoutduration",
    "pwdmaxage",
    "pwdcheckquality",
    "pwdchangedtime",
    "pwdpolicysubentry",
    "pwdendtime",
    "pwdaccountlockedtime",
    "_imported",
    "_replicated",
    "approved_for_provisioning",
    "created_at",
    "updated_at",
    "objectclass",
    "pwdhistory",
    "pwdfailuretime",
    "givenname",
    "name",
    "version",
    "expires_at",
    "company",
    "account",
    "memberpolicy",
    "memberrole",
    "rule",
    "tenant"
    ];


// MORAY KEYS TO IGNORE
// MUST APPEAR ON THE ABOVE LIST
// These are all the custom keys added in code to the Moray dump
// that should not appear (nor their values) in the output HCT or LCT
// Commented ones are not hit in sample processing.
// But they are probably RTT candidates.
var keys_Moray_Custom_Ignore = [
    "_vnode",     // Never populated as at 27 Aug 2014
    "login",
    "uuid",
    "email",
    "fingerprint",
    "cn",
    "sn",
    "city",
    "state",
    "country",
    "postalcode",
    "agent",
    "owner",
    "fromtag",
    "totag",
    "fromvm",
    "tovm",
    "fromip",
    "toip",
    "fromsubnet",
    "tosubnet",
    "fromwildcard",
    "towildcard",
    "_owner",
    "_parent",
    "urn",
    "pwdattribute",
    "pwdinhistory",
    "pwdminlength",
    "pwdmaxfailure",
    "pwdlockoutduration",
    "pwdmaxage",
    "pwdcheckquality",
    "pwdchangedtime",
    "pwdpolicysubentry",
    "pwdendtime",
    "pwdaccountlockedtime",
    "_imported",
    "_replicated",
    "approved_for_provisioning",
    "created_at",
    "updated_at",
    "objectclass",
    "pwdhistory",
    "pwdfailuretime",
    "givenname",
    "name",
    "version",
    "expires_at",
    "company",
    "account",
    "memberpolicy",
    "memberrole",
    "rule",
    "tenant"
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
var ufds_json = JSON.stringify(keys);
outstream.write(ufds_json);



//exports.keys = keys;


