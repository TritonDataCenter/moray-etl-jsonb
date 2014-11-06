#!/usr/bin/env node

/*
 * Copyright (c) 2014, Joyent, Inc. All rights reserved.
 * CWVHogue
 * A node.js script to convert PostgreSQL dump streaming JSON format
 * into a tab-delimited one-line per JSON record format for loading back 
 * into PostgreSQL.
 *
 * Requires typestate JSON manifest from json2pgtypes.js output
 * so that it can properly format tab delimited entries by Postgres type
 *
 * Invoke with streaming input and specified type state JSON file
 * cat wf_hct.json | ./json_tsv.js -i ./wf_hct_typestate.json > wf_hct.tsv
 */

var VERSION = '1.0.0';

var stream = require('stream');
var util = require('util');
var dashdash = require('dashdash');
var fs = require('fs');
var bunyan = require('bunyan');
var moment = require('moment');
var validator = require('validator');
var log = bunyan.createLogger({name:'json_tsv'});

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
       names: ['debug', 'd'],
       type: 'bool',
       help: 'Bunyan debug information to stdout'
    },
    {
        names: ['typesIn', 'i'],
        type: 'string',
        help: 'JSON file of type state from json2pgtypes',
        helpArg: 'FILE'
    }
];



function dequotedJSON(entity) {
   var str = JSON.stringify(entity);
   /*  Strip off any Outer "" placed by JSON stringify */
   if ( str.substr(0,1) === '"' &&
        str.substr(str.length - 1,1) === '"') {
        str = str.substr(1,str.length - 2);
   }
   return str;
}

function isANull(str) {
   if (str === null) {
     return true;
   } else {
      return ( (str === 'null') ||
        (str.length  === 0) ||
        (str === '\\\\n') ||
        (str === '\\n') ||
        (str === '\\N') ||
        (str === '[""]') ||
        (str === '{}')   ||
        (str === '[]')   ||
        (str === '\\\\N') );
   }
}



function fromIntTime(str) {

   if (str === null) return str;
   if (validator.isInt(str)) {
      var t = parseInt(str);
      var string = moment.utc(t).toISOString();
      return string;
   } 
   return str;
}

function removeSqBrackets(string) {
   var str = string;
   /*  Strip off any Outer "" placed by JSON stringify */
   if ( str.substr(0,1) === '[' &&
        str.substr(str.length - 1,1) === ']') {
        str = str.substr(1,str.length - 2);
   }
   return str;
}

function removeDoubleQuotes(string) {
   var str = string;
   /*  Strip off any Outer "" placed by JSON stringify */
   if ( str.substr(0,1) === '"' &&
        str.substr(str.length - 1,1) === '"') {
        str = str.substr(1,str.length - 2);
   }
   return str;
}


function IPbigint2dotted(num) {
    var j = num%256;
    for (var i = 3; i > 0; i--)  { 
        num = Math.floor(num/256);
        j = num%256 + '.' + j;
    }
    return j;
}

function MACbigint2colons(num) {
   var a = new Array(6).join('00').match(/../g);
   var b = a.concat(num.toString(16).match(/.{1,2}/g)).reverse().slice(0,6).join(':');
   return b;
}



(function main() {
    var parser = dashdash.createParser({options: options});
    var nlines = 0;
    try {
        var opts = parser.parse(process.argv);
    } catch (e) {
        console.error('json_tsv Arguments error: %s', e.message);
        process.exit(1);
    }

    if (opts.debug) {
       log.level("debug");
       log.debug({opts: opts});
    }


    //  console.log("# opts:", opts);
    //  console.log("# args:", opts._args);

    if (opts.help) {
        var help = parser.help({includeEnv: true}).trimRight();
        console.log('usage: ./json_tsv.js [OPTIONS]\n'
               + 'options:\n'
               + help);
        process.exit(0);
    }

    if (opts.version) {
        console.log('json_tsv.js V:', VERSION, '\n');
        process.exit(0);
    }

    if (opts.typesIn) {
        var input_tags = require(opts.typesIn);
    } else {
        console.log('Missing JSON types file from json_tsv.js;\n Specify with -i option.'); 
        process.exit(1);
    }


    var lstream = new LineStream({encoding: 'utf8', objectMode: true });

//    lstream.on('end', function(){
//        console.log('Processed',nlines,'lines.');
//    });



    var header_tags = new Object();
    lstream.on('data', function onLine(l) {
        var obj;
        nlines++;
        try {
            obj = JSON.parse(l);
        } catch (e) {
                   log.debug('JSON.parse error: %s:', e.toString());
                   log.debug('Line', nlines, 'is -', l);
            return;
        }

        var isHeader = false;
        for (var key in obj) {
            if (key == 'keys') {
                isHeader = true;
            }
        }

        // PostgreSQL dump JSON starts with a header line
        if (isHeader) {
             /*
             * This reads the PostgreSQL dump format
             * Grab the tags/columns from the header
             */
            header_tags = obj;
            log.debug('Line', nlines, {header: header_tags});
            if (typeof(input_tags.pgtypes) != 'undefined') {
             /* Use the loaded state from a previous run */
                header_tags['pgtypes'] = input_tags.pgtypes;
            } else {
                log.error('No type information found in',opts.typesIn); 
                process.exit(1);
            }
        } else {
           var i = 0
           var tsline = '';
           var timestr = '';
           var nullvalue = false;
           header_tags.keys.forEach(function(elem) {
             arraycount = 0;
             nullvalue = false;
             if (typeof(header_tags.pgtypes[i].arraycount) != 'undefined') {
                arraycount = header_tags.pgtypes[i].arraycount;
             }
             if (obj.entry[i] == null) {
                  nullvalue = true;
             }
             if (isANull(obj.entry[i])) {
                  nullvalue = true;
             }
             if (nullvalue == true) {
                 switch(header_tags.pgtypes[i].type) {
                   case 'json' :
                   case 'jsonb' :
                      tsline += '{}'
                      break; 
                   default :
                      tsline += '\\N';
                 }
             } else {
                 switch (header_tags.pgtypes[i].type) {
                   case 'timestamptz' :
                       if (obj.entry[i] === 'default') {
                           tsline += '\\N';
                           break;
                       } 
                       if (arraycount == 0) {
                            timestr = fromIntTime(dequotedJSON(obj.entry[i]));
                            if (timestr == 'Invalid date') {
                              tsline += '\\N';
                              break;
                            }
                            tsline += timestr;  // output NOT doublequoted
                            break;
                       }
                       var tsarray = '[';
                       for (var j=0; j<obj.entry[i].length; j++) {
                           timestr = fromIntTime(dequotedJSON(obj.entry[i][j]));
                           if (timestr == 'Invalid date') {
                              timestr = null;
                           }
                           if (timestr != null) {
                               if (isANull(timestr.toLowerCase())) {
                                  tsarray += 'null';
                               } else {
                                  tsarray += '"' + timestr + '"';
                               }
                           } else {
                              tsarray += 'null';
                           }
                           if (j < (obj.entry[i].length - 1)) {
                              tsarray += ','
                           } else {
                              tsarray += ']';
                           }
                       }
                       if (arraycount == 1) {
                            var str = removeSqBrackets(tsarray);
                            str = removeDoubleQuotes(str);
                            if (str === 'null') {
                               str = '\\N';
                            }
                            tsline += str;
                            break;
                       } else {  // PostgreSQL arrays use { } 
                             tsline += tsarray.replace(/^\[/,"{").replace(/\]$/,"}");
                             break;
                       }
                   case 'json' :
                   case 'jsonb' :
                     /* 
                      *  JSON.stringify for json/jsonb types needs
                      *  to be unquoted.
                      *  NULL entries - normalize for expected
                      *  PostgreSQL type.
                      */
                       if (arraycount == 1) {
                            var str = dequotedJSON(obj.entry[i]);
                            str = removeSqBrackets(str);
                            str = removeDoubleQuotes(str);
                            if (str === 'null') {
                               str = '\\N';
                            }
                            tsline += str;
                            break;
                       } else { 
                            tsline += dequotedJSON(obj.entry[i]);
                            break;
                       }
                   case 'boolean':
                   case 'smallint':
                   case 'integer':
                   case 'bigint':
                   case 'numeric':
                   case 'real':
                   case 'double precision':
                   case 'money':
                     if (arraycount == 0) {
                          tsline += obj.entry[i];
                          break;
                     } else {
                          if (arraycount == 1) {
                              var str = JSON.stringify(obj.entry[i]);
                              str = removeSqBrackets(str);
                              str = removeDoubleQuotes(str);
                              // dequote, dearray 
                              tsline += str;
                              break;
                          } else {
                              tsline += '{' + obj.entry[i] + '}';
                              break;
                          }
                     }
                   break;
                   case 'uuid' :
                       if (arraycount == 0) {
                          if (obj.entry[i].toLowerCase() === 'default') {
                              tsline += '\\N';
                              break;
                          } else {
                              tsline += obj.entry[i];
                              break;
                          }
                       } else {
            // NAPI-198 bug ',UUID,UUID,' forms - convert to '["UUID","UUID"]'..
                           var ustring = JSON.stringify(obj.entry[i]);
                           ustring = removeDoubleQuotes(ustring);
                           if  ( (ustring.substr(0,1) == ',') &&
                               (ustring.substr(ustring.length -1,1) == ',')) {
                               var str = ustring.replace(/^,/,'["').replace(/,$/g,'"]').replace(/,/g,'","');
                           } else {
                               var str = ustring;
                           }
                           // str = JSON.stringify(obj.entry[i]);
            // NAPI-198 kludge end
                           if (arraycount == 1) {
                              str = removeSqBrackets(str);
                              str = removeDoubleQuotes(str);
                              // dequote, dearray 
                              tsline += str;
                              break;
                          }
                          else { /* array of uuid */
                              if (str.length == 0) {
                                 tsline += '{}';
                                 break;
                              }
                            // sometimes singletons are in the column with no []
                              str = removeDoubleQuotes(str);
                              if (str.length == 0) {
                                 tsline += '{}';
                                 break;
                              }
                              if ((str[0] == '[') && (str[str.length -1] == ']')) {
                                  tsline += str.replace(
                                      /^\[/,"{").replace(/\]$/,"}").replace(/,\"\",/g,',null,');
                                  break;
                              } else {  // array wrap the singletons
                                  tsline += '{' + str + '}';
                                  break;
                              }
                          }
                       }
                   case 'macaddr' :
                   // Integers converted to colon delimited macaddr   
                       if (arraycount == 0) {
                            var mstr = JSON.stringify(obj.entry[i]);
                            mstr = removeSqBrackets(mstr);
                            mstr = removeDoubleQuotes(mstr);
                            if (validator.isInt(mstr)) {
                                var macstr = MACbigint2colons(parseInt(mstr));
                            } else {
                                var macstr = mstr;
                            }
                            if (macstr != null) {
                                if (isANull(macstr.toLowerCase())) {
                                  tsline += '\\N';
                                } else {
                                  tsline += macstr;
                                }
                            }
                            else {
                               tsline += '\\N';
                            } 
                            break;
                       }
                       var macarray = '[';
                       for (var j=0; j<obj.entry[i].length; j++) {
                           var mstr = JSON.stringify(obj.entry[i][j]);
                           mstr = removeSqBrackets(mstr);
                           mstr = removeDoubleQuotes(mstr);
                           if (validator.isInt(mstr)) {
                                var macstr = MACbigint2colons(parseInt(mstr));
                           } else {
                                var macstr = mstr;
                           }
                           if (macstr != null) {
                               if (isANull(macstr.toLowerCase())) {
                                  macarray += 'null';
                               } else {
                                  macarray += '"' + macstr + '"';
                               }
                           } else {
                              macarray += 'null';
                           }
                           if (j < (obj.entry[i].length - 1)) {
                              macarray += ','
                           } else {
                              macarray += ']';
                           }
                       }
                       if (arraycount == 1) {
                            var str = removeSqBrackets(macarray);
                            str = removeDoubleQuotes(str);
                            if (str === 'null') {
                               str = '\\N';
                            }
                            tsline += str;
                            break;
                       } else {  // PostgreSQL arrays use { } 
                             tsline += macarray.replace(/^\[/,"{").replace(/\]$/,"}");
                             break;
                       }
                   case 'inet' :
                   // Integers converted to dot delimited ip addresses
                       if (arraycount == 0) {
                            var istr = JSON.stringify(obj.entry[i]);
                            istr = removeSqBrackets(istr);
                            istr = removeDoubleQuotes(istr);
                            if (validator.isInt(istr)) {
                                var ipstr = IPbigint2dotted(parseInt(istr));
                            } else {
                                var ipstr = istr;
                            }
                            if (ipstr != null) {
                                if (isANull(ipstr.toLowerCase())) {
                                  tsline += '\\N';
                                } else {
                                  tsline += ipstr;
                                }
                            }
                            else {
                               tsline += '\\N';
                            } 
                            break;
                       }
                       var iparray = '[';
                       for (var j=0; j<obj.entry[i].length; j++) {
                           var istr = JSON.stringify(obj.entry[i][j]);
                           istr = removeSqBrackets(istr);
                           istr = removeDoubleQuotes(istr);
                           if (validator.isInt(istr)) {
                                var ipstr = IPbigint2dotted(parseInt(istr));
                           } else {
                                var ipstr = istr;
                           }
                           if (ipstr != null) {
                               if (isANull(ipstr.toLowerCase())) {
                                  iparray += 'null';
                               } else {
                                  iparray += '"' + ipstr + '"';
                               }
                           } else {
                              iparray += 'null';
                           }
                           if (j < (obj.entry[i].length - 1)) {
                              iparray += ','
                           } else {
                              iparray += ']';
                           }
                       }
                       if (arraycount == 1) {
                            var str = removeSqBrackets(iparray);
                            str = removeDoubleQuotes(str);
                            if (str === 'null') {
                               str = '\\N';
                            }
                            tsline += str;
                            break;
                       } else {  // PostgreSQL arrays use { } 
                             tsline += iparray.replace(/^\[/,"{").replace(/\]$/,"}");
                             break;
                       }
                   default : 
                   // varchars must not have embedded \n or \t - escape them.
                      if (arraycount == 0) {
                          var str = JSON.stringify(obj.entry[i]);
                          str = removeSqBrackets(str);
                          str = removeDoubleQuotes(str);
                          // dequote, dearray
                          if (str.length == 0) {
                             tsline += '\\N';
                          } else {
                             tsline += str;
                          }
       //                   var str = obj.entry[i];
       //                   tsline += str.replace(/\n/gi,'\\n').replace(/\t/gi, '\\t');
                      }  else {
                          if (arraycount == 1) {
                              var str = JSON.stringify(obj.entry[i]);
                              str = removeSqBrackets(str);
                              str = removeDoubleQuotes(str);
                              // dequote, dearray 
                              if (str.length == 0) {
                                 tsline += '\\N';
                              } else {
                                 tsline += str;
                              }
                          } else { // Array string encoding 
                              var str  = JSON.stringify(obj.entry[i]);
                              str = str.replace(/^\[/,"{").replace(/\]$/,"}");
                              str = str.replace(/,\"\",/g,',null,');
                              str = str.replace( /\\"/g,'\\\\"'); 
                              tsline += str;
                          }
                      }
                 }
             }
             i++;
             if (i < header_tags.keys.length) {
                tsline += '\t';
             }
           });
           console.log(tsline);
        }  
    });  // end of lstream.on

    process.stdin.pipe(lstream);
    setImmediate(lstream.resume.bind(lstream));

})();
