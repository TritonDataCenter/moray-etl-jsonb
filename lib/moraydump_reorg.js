#!/usr/bin/env node

/*
 * Copyright (c) 2014, Joyent, Inc. All rights reserved.
 *
 * A node.js script to convert workflow Postgres 9.3 dumps from Moray
 * into refactored databases for 9.4 JSONB and utilizing a power schema
 * table design.
 *
 * Invoke with streaming input and specified transform JSON file
 * cat wf_jobs.json | ./moraydump_reorg.js -t ./wf_keys.json
 *
 */

var MDRversion = '0.0.1';

var stream = require('stream');
var util = require('util');
var dashdash = require('dashdash');
var fs = require('fs');
var crypto = require('crypto');
var uuid = require('node-uuid');


var psk = new Object();
// var psk = require('./wf_keys.js');


var postgres_no_str = '\\N';
var postgres_no_number = 'NaN';

var nlines = 0;



// STREAMS STUFF

function LineStream(opts) {
    stream.Transform.call(this, opts);
    this.buf = '';
}
util.inherits(LineStream, stream.Transform);


LineStream.prototype._transform = function _transform(chunk, encoding, cb) {
    if (Buffer.isBuffer(chunk))
        chunk = chunk.toString('utf8');

    var data = this.buf + chunk;
    var lines = data.split(/\r?\n|\r(?!\n)/);

    if (!data.match(/(\r?\n|\r(?!\n))$/)) {
                this.buf = lines.pop();
    } else {
        this.buf = '';
    }

    lines.forEach(this.push.bind(this));

    cb();
};


LineStream.prototype._flush = function _flush(cb) {
    if (this.buf)
        this.push(this.buf);
    cb();
};



// ARGS STUFF

var options = [
    {
       name: 'version',
       type: 'bool',
       help: 'Print version to console.'
    },
    {
       names: ['help', 'h'],
       type: 'bool',
       help: 'Print this help and exit.'
    },
    {
       names: ['revert', 'r'],
       type: 'bool',
       help: 'revert - Moray top-level entries not replaced by JSON _value.',
       default: false
    },
    {
        names: ['transform', 't'],
        type: 'string',
        help: 'JSON file for transform',
        helpArg: 'FILE'
    },
    {
        names: ['file', 'f'],
        type: 'string',
        help: 'Name of file piped as input for transform',
        helpArg: 'FILE'
    },
    {
        names: ['output', 'o'],
        type: 'string',
        help: 'Filename (as suffix) for output',
        helpArg: 'FILE'
    },
    {
        names: ['path', 'p'],
        type: 'string',
        help: 'Path (as prefix) for output',
        helpArg: 'FILE'
    }
];




(function main() {
   // var lstream = new LineStream({encoding: 'utf8'});
    var lstream = new LineStream({encoding: 'utf8', objectMode: true });
    // Moray tags
    var value_index = 0;
    var keys_Moray_index = [];
    var keys_Moray_val = new Object();
    var keys_Moray_Custom_index = [];
    var keys_Moray_Custom_val = new Object();

    var parser = dashdash.createParser({options: options});
    try {
        var opts = parser.parse(process.argv);
    } catch (e) {
        console.error('pgdump_split: error: %s', e.message);
        process.exit(1);
    }

    //  console.log("# opts:", opts);
    //  console.log("# args:", opts._args);

    if (opts.help) {
        var help = parser.help({includeEnv: true}).trimRight();
        console.log('usage: moraydump_reorg.js [OPTIONS]\n'
               + 'options:\n'
               + help);
        process.exit(0);
    }

    if (opts.version) {
        console.log('moraydump_reorg.js V:', MDRversion, '\n');
    }


    if (opts.transform) {
        psk = require(opts.transform);
    } else {
        console.log('No transform JSON file specified', '\n');
        process.exit(0);
    }

    if (opts.output) {
        var tempname = "";
        if ('rtt' in psk.files) {
            tempname =  opts.output + psk.files.rtt;
            psk.files.rtt = tempname;
       }
       if ('lct' in psk.files) {
            tempname =  opts.output + psk.files.lct;
            psk.files.lct = tempname;
       }
       if ('hct' in psk.files) {
            tempname =  opts.output + psk.files.hct;
            psk.files.hct = tempname;
       }
    } 



    if (opts.file) {
      var input_file = opts.file;
      var input_file_split = input_file.split('.');
      var input_datacenter = input_file_split[0]; 
      var input_splitlen = input_file_split.length;
      var input_filename = input_file_split[1];
// The only part that matters is the table & date portion
//      for (var k = 1; k < input_splitlen; k++) {
//         input_filename += input_file_split[k];
//         if (k != (input_splitlen -1)) {
//           input_filename += '.';
//         }
//      }
    }


    if (opts.path) {
        var tempname = "";
        if ('rtt' in psk.files) {
            tempname =  opts.path + psk.files.rtt;
            psk.files.rtt = tempname;
        }
        if ('lct' in psk.files) {
            tempname =  opts.path + psk.files.lct;
            psk.files.lct = tempname;
       }
       if ('hct' in psk.files) {
            tempname = opts.path + psk.files.hct;
            psk.files.hct = tempname;
       }
    } 


    // Output STUFF


    if ('rtt' in psk.files) {
        var rttStream_ = fs.createWriteStream(psk.files.rtt, {flags : 'w' });
        var rttStream = fs.createWriteStream(psk.files.rtt, {flags : 'a' });
    }

    if ('lct' in psk.files) {
        var lctStream_ = fs.createWriteStream(psk.files.lct, {flags : 'w' });
        var lctStream = fs.createWriteStream(psk.files.lct, {flags : 'a' });
    }

    if ('hct' in psk.files) {
        var hctStream_ = fs.createWriteStream(psk.files.hct, {flags : 'w' });
        var hctStream = fs.createWriteStream(psk.files.hct, {flags : 'a' });
    }



    function outputDBJSON(key, line) {
        if (key in psk.files) {
            var json_line = JSON.stringify(line);
            if (json_line.length > 2) { // 2 is an empty JSON object {}
                switch (key) {
                case 'rtt' :
                   rttStream.write(json_line);
                   rttStream.write('\n');
                   break;
                case 'lct' :
                   lctStream.write(json_line);
                   lctStream.write('\n');
                   break;
                case 'hct' :
                   hctStream.write(json_line);
                   hctStream.write('\n');
                   break;
                default :
                   break;
                }
            }
        }
    }


    function openDBJSON(key) {
        if (key in psk.files) {
            switch (key) {
            case 'rtt' :
                rttStream.open();
                break;
            case 'lct' :
                lctStream.open();
                break;
            case 'hct' :
                hctStream.open();
                break;
            default :
                break;
            }
        }
    }


    function endDBJSON(key) {
        if (key in psk.files) {
            switch (key) {
            case 'rtt' :
               rttStream.end();
               break;
            case 'lct' :
               lctStream.end();
               break;
            case 'hct' :
               hctStream.end();
               break;
            default :
               break;
            }
        }
    }


    /* any accumulated values output here
     * lstream.on('end', function(){
     *  console.log("Fini");
     * });
     */


    lstream.on('data', function onLine(l) {
        var obj;
        var values;
        try {
            obj = JSON.parse(l);
        } catch (e) {
        // This error trips often on incomplete buffers with 1-4 characters
        // Seems to be an async problem, so at the moment, just retry.
        // TODO Should be a timeout?
        //            console.error('invalid JSON: %s:', e.toString());
        //            console.error('l is:', l);
            return;
        }
        var isHeader = false;
        for (var key in obj) {
            if (key == 'keys') {
                isHeader = true;
            }
        }


        // PostgreSQL dump JSON starts with a header line
        // with JSON of all the column tags
        // Grab the indices for processing subsequent entry lines

        if (isHeader) { // Process PostgeSQL dump file Header Line - JSON
            var i = 0;
            obj.keys.forEach(function (elem) {
                // JSON _value tag
                if (elem == '_value') {
                    value_index = i;
                }
                // Moray tags
                var j = 0;
                for (var motag in psk.source.moray) {
                    if (elem == psk.source.moray[motag]) {
                        keys_Moray_index[j] = i;
                    }
                    j++;
                }
                // Moray Customized tags
                j = 0;
                for (motag in psk.source.custom) {
                    if (elem == psk.source.custom[motag]) {
                        keys_Moray_Custom_index[j] = i;
                    }
                    j++;
                }
                i++;
            });

            // console.log("RTT table:\n", psk.tables.rtt);
            // console.log("LCT table:\n", psk.tables.lct);
            // console.log("HCT table:\n", psk.tables.hct);

            // Construct PostgreSQL dumpfile headers
            if (psk.tables.rtt != 'undefined') {
                var rtt_header = new Object();
                rtt_header['name'] = psk.names.rtt;
                rtt_header['keys'] = psk.tables.rtt;
                openDBJSON('rtt');
                outputDBJSON('rtt', rtt_header);
            }
            if (psk.tables.lct != 'undefined') {
                var lct_header = new Object();
                lct_header['name'] = psk.names.lct;
                lct_header['keys'] = psk.tables.lct;
                openDBJSON('lct');
                outputDBJSON('lct', lct_header);
            }
            if (psk.tables.hct.length != 0) {
                var hct_header = new Object();
                hct_header['name'] = psk.names.hct;
                var hct_keylist = [];
                for (i = 0; i < psk.tables.hct.length; i++) {
                    if (psk.tables.hct[i] != psk.pk.hct) {
                        // SKIP the duplicated primary key in the header set
                        hct_keylist.push(psk.tables.hct[i]);
                    }
                }
               if (opts.file) {
                  hct_keylist.push('origin_datacenter');
                  hct_keylist.push('origin_file');
               }
                hct_header['keys'] = hct_keylist;
                openDBJSON('hct');
                outputDBJSON('hct', hct_header);
            }

        } else {   // Process PostgreSQL dump file Entry Line - JSON
            try {
                values = JSON.parse(obj.entry[value_index]);
            } catch (e) {
                console.error('Invalid JSON in _value: %s', e.toString());
                return;
            }

            // Gather ordered values for all Moray tags
            var k = 0;
            var len = keys_Moray_index.length;
            for (k = 0; k < len; k++) {
                keys_Moray_val[k] = obj.entry[keys_Moray_index[k]];
            }
            len = keys_Moray_Custom_index.length;
            for (k = 0; k < len; k++) {
                keys_Moray_Custom_val[k] =
                    obj.entry[keys_Moray_Custom_index[k]];
            }


           // Top level declared PostgreSQL tags in
           // psk.source.moray & psk.source.custom
           // and streamed in values in keys_Moray_val & keys_Moray_Custom_val
           // Partition into LCT, RTT or HCT according to matches

           // Accumulate all top-level keys in JSON _values line
           var values_keys = new Array();
           for (var key_values in values) {
               values_keys[values_keys.length] = key_values;
           }

           // RTT: Construct the Rare Tag Table
           if (psk.tables.rtt != 'undefined') {
               var rtt = new Object();
               for (var match_tag in psk.target.rtt) {
                   values_keys.every(function (elem) {
                       if (elem == psk.target.rtt[match_tag]) {
                           rtt[elem] = values[elem];
                           return false;
                       }
                       return true;
                   });
               }
           }

           // LCT: Construct the Low Complexity Table
           if (psk.tables.lct != 'undefined') {
               var lct = new Object();
               for (match_tag in psk.target.lct) {
                   values_keys.every(function (elem) {
                       if (elem == psk.target.lct[match_tag]) {
                           lct[elem] = values[elem];
                           return false;
                       }
                       return true;
                   });
               }
           }



           // HCT: Construct the High Complexity Table
           // Moray tags first:
           //  keys_Moray  keys_Moray_val
           //  keys_Moray_Custom keys_Moray_Custom_val

           var hct = new Object();
           var m = 0;
           len = psk.source.moray.length;
           for (m = 0; m < len; m++) {
               hct[psk.source.moray[m]] = keys_Moray_val[m];
           }
           m = 0;
           len = psk.source.custom.length;
           for (m = 0; m < len; m++) {
               hct[psk.source.custom[m]] = keys_Moray_Custom_val[m];
           }
           for (match_tag in psk.target.hct) {
               values_keys.every(function (elem) {
                   if (elem == psk.target.hct[match_tag]) {
                       hct[elem] = values[elem];
                       return false;
                   }
                   return true;
               });
           }


           //  Custom field manipulations go here.
           //  TODO
           //  FOLD chain + chain_results
           //  FOLD onerror + onerror_results & add error flag


           if (opts.revert) {
              // Put back the Moray top level values that
              // may have been clobbered by _values JSON moving up a level
              len = psk.source.moray.length;
              for (m = 0; m < len; m++) {
                  hct[psk.source.moray[m]] = keys_Moray_val[m];
              }
              m = 0;
              len = psk.source.custom.length;
              for (m = 0; m < len; m++) {
                  hct[psk.source.custom[m]] = keys_Moray_Custom_val[m];
              }
           }


           //  FIND ANY NOVEL KEYS for RTT in _values JSON
           //  that are not in psk.source.ignore

           if (psk.tables.rtt != 'undefined') {
               var ignore = false;
               var novel = true;
               for (var value_tag in values_keys) {
                   novel = true;
                   for (match_tag in psk.target.all) {
                       if (values_keys[value_tag] ==
                           psk.target.all[match_tag]) {
                           novel = false;
                       }
                   }
                   if (novel === true) {
                       ignore = false;
                       for (var ignore_key in psk.source.ignore) {
                           if (values_keys[value_tag] ==
                                   psk.source.ignore[ignore_key]) {
                               ignore = true;
                           }
                       }
                       if (ignore === false) {
                           rtt[values_keys[value_tag]] =
                           values[values_keys[value_tag]];
                       }
                   }
               }
           }

           //       console.log("RTT:", rtt);
           //       console.log("LCT:", lct);
           //       console.log("HCT:", hct);

           // OUTPUT PostgreSQL specific dump file format
           // for lct, hct and one or more rtt for this entry


           // NOTE Apply
           // # cat x_lct.json | sort -r | uniq > x_lct_u.json
           // to unique this output file before loading to remove redundancies

           var tempstr = ' ';
           if (psk.tables.lct != 'undefined') {  // lct table must be defined
               tempstr = JSON.stringify(lct);
               if (tempstr.length > 2) {  // there must be some values in lct
                   var lct_entry = new Object();
                   var lct_entry_list = [];
                   var hash =
                       crypto.createHash('md5').update(tempstr).digest('hex');
                   lct_entry_list.push(hash);
                   // DEPENDS ON the x_lct_id being the first db key in lct
                   var n = 0;
                   for (n = 1; n < psk.tables.lct.length; n++) {
                       if (typeof (lct[psk.tables.lct[n]]) !=
                           'undefined') {
                           lct_entry_list.push(lct[psk.tables.lct[n]]);
                       } else {
                           lct_entry_list.push(postgres_no_str);
                       }
                   }
                   lct_entry['entry'] = lct_entry_list;
                   outputDBJSON('lct', lct_entry);
               }
           }

           if (psk.tables.hct.length != 0) {  // hct table must be defined
               tempstr = JSON.stringify(hct);
               if (tempstr.length > 2) {  // there must be some values in hct
                   var hct_entry = new Object();
                   var hct_entry_list = [];
                   // Fill IDs
                   // Assign the primary key to x_hct_id
                   hct_entry_list.push(hct[psk.pk.hct]);
                   if (typeof(hash) != 'undefined') {
                       hct_entry_list.push(hash); // The LCT id  x_lct_id
                   }
                   for (n = 2; n < psk.tables.hct.length; n++) {
                        if (typeof (hct[psk.tables.hct[n]]) !=
                            'undefined') {
                            if (psk.tables.hct[n] != psk.pk.hct) {
                               // SKIP the duplicated primary key
                               hct_entry_list.push(hct[psk.tables.hct[n]]);
                            }
                        } else {
                            hct_entry_list.push(postgres_no_str);
                        }
                   }
                   if (opts.file) {
                       hct_entry_list.push(input_datacenter);
                       hct_entry_list.push(input_filename);
                   }
                   hct_entry['entry'] = hct_entry_list;
                   outputDBJSON('hct', hct_entry);
               }
           }

           if (psk.tables.rtt != 'undefined') {  // rtt table must be defined
               tempstr = JSON.stringify(rtt);
               if (tempstr.length > 2) {  // there must be some values in rtt
                   var rtt_tags_all = Object.keys(rtt);
                   var q = 0;
                   for (q = 0; q < rtt_tags_all.length; q++) {
                        var rtt_entry_list = [];
                        //   "x_rtt_id" is a uuid
                        rtt_entry_list.push(uuid.v4());
                        //   "x_hct_id" is the primary key in parent hct
                        // Assign the primary key to x_hct_id
                        rtt_entry_list.push(hct[psk.pk.hct]);
                        //   "x_lct_id" is the hash key to find parent lct
                        if (typeof (hash) != 'undefined') {
                            rtt_entry_list.push(hash); // The LCT id  x_lct_id
                        } else {  // don't leave empty
                            rtt_entry_list.push(postgres_no_str);
                        }
                        // Assign tag
                        rtt_entry_list.push(rtt_tags_all[q]);
                        // Assign tag : value as json object
                        var rtt_obj = new Object;
                        function objectJSON(str) {
                            try { 
                                  val = JSON.parse(str); 
                                } catch (e) {
                                  return str;
                                } 
                            return val;
                        };
                        var enclosed = objectJSON(rtt[rtt_tags_all[q]]);
                        rtt_obj[rtt_tags_all[q]] = enclosed;
                        rtt_entry_list.push(JSON.stringify(rtt_obj)); 
                        // PostgreSQL entry line
                        var rtt_entry = new Object();
                        rtt_entry['entry'] = rtt_entry_list;
                        outputDBJSON('rtt', rtt_entry);
                   }
               }
           }
           nlines++;
//           console.log(nlines);

        }  // NON-HEADER LINES
    });  // end of lstream.on

    process.stdin.pipe(lstream);
    setImmediate(lstream.resume.bind(lstream));

})();
