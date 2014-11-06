#!/usr/bin/env node

/*
 * Copyright (c) 2014, Joyent, Inc. All rights reserved.
 * CWV Hogue
 *
 * A node.js script to reduce multiple json outputs from 
 * json2pgtypes.js delivered as a stream in a Manta job.
 *
 * Test with a stream 
 * cat test_pgtypes.json | ./pgtypes_reduce.js -o /test_types 
 *
 */

var version = '1.0.0';

var stream = require('stream');
var util = require('util');
var dashdash = require('dashdash');
var moment = require('moment');
var fs = require('fs');
var bunyan = require('bunyan');
var outputpgtypes = require('./outputpgtypes');
var log = bunyan.createLogger({name:'pgtypes_reduce'});


/* 
 * STREAMS STUFF
 */

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



/*
 * ARGS STUFF
 */

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
        names: ['money', 'm'],
        type: 'bool',
        help: 'Floating point with 2 decimal places emits SQL type money instead of real',
    },
    {
        names: ['typesOut', 'o'],
        type: 'string',
        help: 'Output name prefix for .json / .sql saved files',
        helpArg: 'FILE'
    },
    {
        names: ['path', 'p'],
        type: 'string',
        help: 'Path (as prefix) for output, no trailing slash',
        helpArg: 'FILE'
    }
];



function smallerOf(obj1, obj2) {
  if (obj1 < obj2) {
     return obj1;
  }
  return obj2;
}

function biggerOf(obj1, obj2) {
  if (obj1 > obj2) {
      return obj1;
  } 
  return obj2;
}



(function main() {
    var parser = dashdash.createParser({options: options});
    try {
        var opts = parser.parse(process.argv);
    } catch (e) {
        console.error('pgdump_split: error: %s', e.message);
        process.exit(1);
    }

    if (opts.debug) {
       log.level("debug");
       log.debug({opts: opts});
    }

    if (opts.help) {
        var help = parser.help({includeEnv: true}).trimRight();
        console.log('usage: ./pgtypes_reduce.js [OPTIONS]\n'
               + 'options:\n'
               + help);
        process.exit(0);
    }

    if (opts.version) {
        console.log('pgtypes_reduce V:', version, '\n');
        process.exit(0);
    }


    if (opts.path) {
        var tempostr = opts.typesOut;
        opts.typesOut = opts.path + "/" + tempostr;
    }

    var nlines = 0;

    var lstream = new LineStream({encoding: 'utf8', objectMode: true });
 
    var last_tst;
    var tst;

    lstream.on('end', function(){
       outputpgtypes.outputPGTypes(tst, opts.typesOut, opts.money);
       process.exit(0);
    });

    lstream.on('data', function onLine(l) {
        var obj;
        nlines++;
        try {
            obj = JSON.parse(l);
        } catch (e) {
                    log.debug('JSON.parse error: %s:', e.toString());
                    log.debug('Line', nlines, 'is - ', l);
            return;
        }
        if (nlines == 1) {
            tst = obj;
        } else {
            last_tst = tst;
            tst = obj; 
            var i = 0;
            last_tst.keys.forEach(function(elem) {
                if (tst.pgtypes[i].type != last_tst.pgtypes[i].type) {
                    log.debug('Inferred Type - first glance mismatches:', nlines, tst.pgtypes[i].type, 
                        tst.pgtypes[i].size, last_tst.pgtypes[i].type, last_tst.pgtypes[i].size);
                }

                tst.pgtypes[i].size = biggerOf(last_tst.pgtypes[i].size, tst.pgtypes[i].size);
                if ((typeof(tst.pgtypes[i].arraycount) != 'undefined') && 
                   (typeof(last_tst.pgtypes[i].arraycount) != 'undefined')) { 
                     tst.pgtypes[i].arraycount = biggerOf(last_tst.pgtypes[i].arraycount,
                                                     tst.pgtypes[i].arraycount);
                }
                // When one of the two is 'unk', 'tmp' one takes precedence and 
                // types and status are set to the 'tmp' value for both
                if ((tst.pgtypes[i].status == 'unk') && (last_tst.pgtypes[i].status == 'tmp')) {
                   // type from last_test takes precedence over unassigned type in tst
                   tst.pgtypes[i].status = last_tst.pgtypes[i].status;
                   tst.pgtypes[i].type = last_tst.pgtypes[i].type;
                } else {
                    if ((tst.pgtypes[i].status == 'tmp') && (last_tst.pgtypes[i].status == 'unk')) {
                        // for the next line of comparision, update last_tst
                        last_tst.pgtypes[i].status = tst.pgtypes[i].status;
                        last_tst.pgtypes[i].type = tst.pgtypes[i].type;
                    }
                }
                // now status is 'tmp' for both OR 'unk' for both 

                // when 'tmp' last varchar setting explicitally beats any new type as catch-all,
                // esp for jsonb / json
                if (  (tst.pgtypes[i].status == 'tmp') &&
                          (last_tst.pgtypes[i].type == 'varchar') ) {
                           // carry forward the previous varchar assignment
                          tst.pgtypes[i].type = last_tst.pgtypes[i].type;
                } 

                // other cases where type conflicts are resolved at the end of processing
                // and only dependent on the nMin/nMax/MaxSigFigs/MaxDecimals parameters
                switch (tst.pgtypes[i].type) {
                               case 'integer' :
                               case 'smallint' :
                               case 'bigint' :
                                 // when 'tmp' last float setting explicitally beats any int type as catch-all,
                                 if (  (tst.pgtypes[i].status == 'tmp') &&
                                       ( (last_tst.pgtypes[i].type == 'numeric') ||
                                       (last_tst.pgtypes[i].type == 'real') ||
                                       (last_tst.pgtypes[i].type == 'double precision') ||
                                       (last_tst.pgtypes[i].type == 'money') ) ) {
                                          tst.pgtypes[i].type = last_tst.pgtypes[i].type;
                                          tst.pgtypes[i].MaxSigFigs = last_tst.pgtypes[i].MaxSigFigs;
                                          tst.pgtypes[i].MaxDecimals = last_tst.pgtypes[i].MaxDecimals;
                                 } 
                                 tst.pgtypes[i].nMin = 
                                      smallerOf(last_tst.pgtypes[i].nMin, tst.pgtypes[i].nMin);
                                 tst.pgtypes[i].nMax = 
                                      biggerOf(last_tst.pgtypes[i].nMax, tst.pgtypes[i].nMax);
                                 break;
                               case 'timestamptz' :   
                                 if (last_tst.pgtypes[i].type == 'bigint')  {
                                     // use the new timestamptz assignment
                                     // set last_tst to avoid triggering error below
                                     last_tst.pgtypes[i].type = tst.pgtypes[i].type;
                                 }
                                 // when integer timestamps are in use these should have values:
                                 if ( (typeof(tst.pgtypes[i].nMin) != 'undefined') &&
                                     (typeof(last_tst.pgtypes[i].nMin) != 'undefined') ) {
                                     tst.pgtypes[i].nMin = 
                                          smallerOf(last_tst.pgtypes[i].nMin, tst.pgtypes[i].nMin);
                                 }
                                 if ( (typeof(tst.pgtypes[i].nMax) != 'undefined') &&
                                     (typeof(last_tst.pgtypes[i].nMax) != 'undefined') ) {
                                     tst.pgtypes[i].nMax = 
                                          biggerOf(last_tst.pgtypes[i].nMax, tst.pgtypes[i].nMax);
                                 }
                                 break;
                               case 'numeric' :
                               case 'real' :
                               case 'double precision' :
                               case 'money' :
                                 tst.pgtypes[i].nMin = 
                                      smallerOf(last_tst.pgtypes[i].nMin, tst.pgtypes[i].nMin);
                                 tst.pgtypes[i].nMax = 
                                      biggerOf(last_tst.pgtypes[i].nMax, tst.pgtypes[i].nMax);
                                 tst.pgtypes[i].MaxSigFigs = 
                                      biggerOf(last_tst.pgtypes[i].MaxSigFigs, tst.pgtypes[i].MaxSigFigs);
                                 tst.pgtypes[i].MaxDecimals = 
                                      biggerOf(last_tst.pgtypes[i].MaxDecimals, tst.pgtypes[i].MaxDecimals);
                                 break;
                               default :
                                 break;
                }
                //  SO do we still have conflicting type assignments?
                //  throw an error up and fix it. 
                if (tst.pgtypes[i].type != last_tst.pgtypes[i].type) {
                    log.error('Inferred Type mismatches:', nlines, 'New:', tst.pgtypes[i].type,
                    tst.pgtypes[i].size, 'Previous:', last_tst.pgtypes[i].type, last_tst.pgtypes[i].size);
                }
                i++;
            });
        }
    });
    process.stdin.pipe(lstream);
    setImmediate(lstream.resume.bind(lstream));
})();

