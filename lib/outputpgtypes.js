/*
 * Copyright (c) 2014, Joyent, Inc. All rights reserved.
 * CWV Hogue
 *
 * outputpgtypes.js
 */

var moment = require('moment');
var fs = require('fs');
var unknown_min_size = 5;

function outputPGTypes(tags, filename, money) {
/*
 * Guess for specific numerical type is called using
 * accumulated precision and min/max size information
 *
 */


    if (typeof(tags.pgtypes) == 'undefined') {
       process.exit(0);
    }
    if (typeof(tags.pgtypes[1]) == 'undefined') {
       process.exit(0);
    }
    var str = 'CREATE TABLE ' + tags.name + ' (\n';
    var i = 0;
    var ratio = /ratio/;
    var ipregexp = /_ip$/;
    len = tags.keys.length;
    var bytesregexp = /bytes/;
    var ratiokey = false;
    var byteskey = false;
    var ipkey = false;
    var mackey = false;
    var arraycount = 0;
    var now = moment().utc().valueOf(); /* current Epoch time */
    tags.keys.forEach(function(elem) {
        str = str + '    ' + tags.keys[i] + ' ';
        var teststr = tags.keys[i].toLowerCase();
        ratiokey = ratio.test(teststr);
        byteskey = bytesregexp.test(teststr);
        ipkey = false;
        if ((teststr === 'ip') ||
            (teststr === 'resolvers') ||
            (teststr === 'gateway') ||
            (ipregexp.test(teststr))) {
          ipkey = true;
        }
        mackey = false;
        if (teststr === 'mac') {
          mackey = true;
        }
        arraycount = tags.pgtypes[i].arraycount;
        switch (tags.pgtypes[i].type) {
            case 'smallint' :
            case 'integer' : 
            case 'bigint' :
                if ((ratiokey == false) && (mackey == false)  && (ipkey == false)) {
                /* 
                 * Check tag does not have substring 'ratio' which implies real
                 * even though the inputs are all integer (e.g. 1)
                 */
                    /* 
                     * Check range for appropriate db size type 
                     */ 
                    if (byteskey) {
                        /* if the tag has bytes in it - assume bigint */
                        str = str + 'bigint';
                        if (arraycount > 1) {
                            str = str + ' ARRAY';
                        } 
                        tags.pgtypes[i].type = 'bigint';
                        break;
                    }
                    if ((tags.pgtypes[i].nMin >= -32768) && 
                       (tags.pgtypes[i].nMax <= 32767) ) {
                          str = str + 'smallint';
                          if (arraycount > 1) {
                              str = str + ' ARRAY';
                          } 
                          tags.pgtypes[i].type = 'smallint';
                          break;
                    }
                    if ((tags.pgtypes[i].nMin >= -2147483648) && 
                       (tags.pgtypes[i].nMax <= 2147483647) ) {
                          str = str + 'integer';
                          if (arraycount > 1) {
                              str = str + ' ARRAY';
                          } 
                          tags.pgtypes[i].type = 'integer';
                          break;
                    }
                    /* Epoch time as a bigint, assuming no future timestamps    */
                    /* and all timestamps are after 2010-01-01                  */
                    /* these get written back as ISO8601 Strings by json_tsv.js */

                    if (((tags.pgtypes[i].nMin > 1262332800000) ||
                       (tags.pgtypes[i].nMin == 0) ) &&
                       ((tags.pgtypes[i].nMax < now) ||
                        (tags.pgtypes[i].nMax >  253406000000000000))) {
                          // latter number is passwdendtime (neverending?) value in udfs
                          str = str + 'timestamptz';
                          if (arraycount > 1) {
                              str = str + ' ARRAY';
                          } 
                          tags.pgtypes[i].type = 'timestamptz';
                          break;
                    }                
                    if ((tags.pgtypes[i].nMin >= -9223372036854775808) && 
                       (tags.pgtypes[i].nMax <= 9223372036854775807) ) {
                          str = str + 'bigint';
                          if (arraycount > 1) {
                              str = str + ' ARRAY';
                          } 
                          tags.pgtypes[i].type = 'bigint';
                          break;
                    }
                } else { /* tag labelled ratio or ip or mac  came in with only integers - set as flagged  */
                    if (ratiokey == true) {
                        str = str + 'real';
                        if (arraycount > 1) {
                            str = str + ' ARRAY';
                        } 
                        tags.pgtypes[i].type = 'real';
                        tags.pgtypes[i].MaxSigFigs = 5; /* set some appropriate values */
                        tags.pgtypes[i].MaxDecimals = 3;
                        break;
                    }
                    if (mackey == true) {  // integer mac addresses
                        str = str + 'macaddr';
                        if (arraycount > 1) {
                            str = str + ' ARRAY';
                        } 
                        tags.pgtypes[i].type = 'macaddr';
                        break;
                    }
                    if (ipkey == true) {  // integer ip addresses
                        str = str + 'inet';
                        if (arraycount > 1) {
                            str = str + ' ARRAY';
                        } 
                        tags.pgtypes[i].type = 'inet';
                        break;
                    }
                }
            case 'numeric' :
            case 'double precision' :
            case 'money' :
            case 'real' :     
                /* 
                 * Check range for appropriate db size type 
                 */ 
                if ((money) && (tags.pgtypes[i].MaxDecimals == 2)) { 
                      str = str + 'money';
                      if (arraycount > 1) {
                              str = str + ' ARRAY';
                      } 
                      tags.pgtypes[i].type = 'money';
                      break;
                }
                if (tags.pgtypes[i].MaxSigFigs > 17) {
                      // Set numeric with the identified precision
                      str = str + 'numeric' + '(' + tags.pgtypes[i].MaxSigFigs + ',' +
                             tags.pgtypes[i].MaxDecimals + ')';
                      if (arraycount > 1) {
                          str = str + ' ARRAY';
                      } 
                      tags.pgtypes[i].type = 'numeric';
                      break;
                }
                if (tags.pgtypes[i].MaxSigFigs > 6) {
                      str = str + 'double precision';
                      if (arraycount > 1) {
                          str = str + ' ARRAY';
                      } 
                      tags.pgtypes[i].type = 'double precision';
                      break;
                } 
                str = str + 'real';
                if (arraycount > 1) {
                     str = str + ' ARRAY';   
                } 
                tags.pgtypes[i].type = 'real';
                break;
            case 'uuid' :
                if ((tags.pgtypes[i].size > 36)  && (arraycount == 0)) {
                     // too long for a uuid, revert to varchar
                      // fixes a bug where uuid detection fails to see trailing chars
                     str = str + 'varchar' + '(' + tags.pgtypes[i].size + ')';
                     tags.pgtypes[i].type = 'varchar';
                     break;
                }
                str = str + 'uuid';
                if (arraycount > 1) {
                    str = str + ' ARRAY';
                } 
                break;
            case 'cidr' :  // Unused
                str = str + 'cidr';
                if (arraycount > 1) {
                    str = str + ' ARRAY';
                } 
                break;
            case 'macaddr' :
                str = str + 'macaddr';
                if (arraycount > 1) {
                    str = str + ' ARRAY';
                } 
                break;
            case 'inet' :
                str = str + 'inet';
                if (arraycount > 1) {
                    str = str + ' ARRAY';
                } 
                break;
            case 'boolean' :
                str = str + 'boolean';
                if (arraycount > 1) {
                    str = str + ' ARRAY';
                } 
                break;
            case 'json' :   // Unused
                str = str + 'json';
                break;
            case 'jsonb':
                str = str + 'jsonb';
                // an array of jsonb is jsonb!
                break;
            case 'timestamptz' :
                str = str + 'timestamptz';
                if (arraycount > 1) {
                    str = str + ' ARRAY';
                } 
                break;
            case 'unknown' :  // From a null field - give it some space.
                if (tags.pgtypes[i].size == 0) {
                    tags.pgtypes[i].size = tags.pgtypes[i].size + unknown_min_size;
                } 
            default :
            case 'varchar' :
                str = str + 'varchar' + '(' + tags.pgtypes[i].size + ')';
                if (arraycount > 1) {
                    str = str + ' ARRAY';
                } 
                tags.pgtypes[i].type = 'varchar';
                break;
        }
        i++;
        if (i < len) {
            str = str + ',';
        }
        str = str + '\n';
    });
    str = str + ');';
    if (filename) {
      jsonName = filename + '.json';
      var stateFile = fs.openSync(jsonName,'w');
      var tmp = JSON.stringify(tags);
      fs.writeSync(stateFile, tmp);
      fs.writeSync(stateFile, '\n');
      fs.closeSync(stateFile);
      sqlName = filename + '.sql';
      stateFile = fs.openSync(sqlName,'w');
      fs.writeSync(stateFile, str);
      fs.closeSync(stateFile);
    } else {
      console.log(JSON.stringify(tags));
      console.log(str);
    }
    return;

}


///----- EXPORTS

module.exports = {
    outputPGTypes: outputPGTypes
};
