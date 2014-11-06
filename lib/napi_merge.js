#!/usr/bin/env node

/*
 * Copyright (c) 2014, Joyent, Inc. All rights reserved.
 *
 * A node.js script to merge napi_ips entries, extract the uuid from 
 * the filename and embed it in the finised consolidated file.
 *
 * Invoke with streaming input and 
 * cat napi_ips_...XXXX  | ./napi_merge.js > napi_out.json
 *
 */


var dashdash = require('dashdash');
var uuid = require('node-uuid');
var stream = require('stream');
var util = require('util');
var Version = '1.0.0';

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
    }
];


(function main () {
    var lstream = new LineStream({encoding: 'utf8', objectMode: true });
    var value_index = 0;
    var nlines = 0;
    var networks_uuid = '';

    var parser = dashdash.createParser({options: options});
    try {
        var opts = parser.parse(process.argv);
    } catch (e) {
        console.error('napi_merge: error: %s', e.message);
        process.exit(1);
    }


    if (opts.help) {
        var help = parser.help({includeEnv: true}).trimRight();
        console.log('usage: napi_merge.js [OPTIONS]\n'
               + 'options:\n'
               + help);
        process.exit(0);
    }

    if (opts.version) {
        console.log('napi_merge.js V:', Version, '\n');
    }



    lstream.on('data', function onLine(l) {
        var obj;
        var values;
        try {
            obj = JSON.parse(l);
       } catch (e) {
//            console.error('invalid JSON: %s:', e.toString());
//            console.error('l is:', l);
//            process.exit(1);            
            return;
       }

        var isHeader = false;
        for (var key in obj) {
            if (key == 'keys') {
                isHeader = true;
            }
        }

       
       nlines++;
       if (isHeader == true) { 
           var dbname = obj.name;
           networks_uuid = dbname.replace(/^napi_ips_/,'').split('-')[0].replace(/_/g,'-');
           dbname = 'napi_ips';
           obj.name = dbname;
           obj.keys.push('networks_uuid');
           console.log(JSON.stringify(obj));
       } else {
           obj.entry.push(networks_uuid);
           console.log(JSON.stringify(obj));
       }
    });
    process.stdin.pipe(lstream);
    setImmediate(lstream.resume.bind(lstream));
})();
