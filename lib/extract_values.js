#!/usr/bin/env node

/*
 * Copyright (c) 2014, Joyent, Inc. All rights reserved.
 *
 * A node.js script to extract _values JSON from Postgres 9.3 Moray dumps
 * as created by https://github.com/yunong/sqlToJson (Streaming JSON dump)
 *
 * Invoke with streaming input and specified transform JSON file
 * cat wf_jobs.json | ./extract_values.js
 *
 * Output is Bunyan style one line per json entry.
 */

var stream = require('stream');
var util = require('util');

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


(function main () {
    var lstream = new LineStream({encoding: 'utf8', objectMode: true });
    var value_index = 0;
    var nlines = 0;

    lstream.on('data', function onLine(l) {
        var obj;
        var values;
        try {
            obj = JSON.parse(l);
        } catch (e) {
//            console.error('invalid JSON: %s:', e.toString());
//            console.error('l is:', l);
            return;
        }
       
       var isHeader = false;
       for (var key in obj) {
           if (key == "keys") {
               isHeader = true;
           }
       }       
       if (isHeader) { 
           var i = 0
           obj.keys.forEach(function(elem) {
               if ( elem == "_value") {
                   value_index = i;
               }
               i++;
           });
       } else {
           try { 
               values = JSON.parse(obj.entry[value_index]);
           } catch (e) {
               console.error('Invalid JSON in _values: %s', e.toString());
               return;
           }
           console.log(JSON.stringify(values));
           nlines++;     
       }
    });
    process.stdin.pipe(lstream);
    setImmediate(lstream.resume.bind(lstream));
})();
