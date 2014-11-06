#!/usr/bin/env node

/*
 * Copyright (c) 2014, Joyent, Inc. All rights reserved.
 *
 * A node.js script to wrap JSON lines into a _values structure and assign 
 * a primary key uuid for each line. This is a utility used for transforming
 * non-moray one-line json input into a moray-streaming json format for 
 * moraydump_reorg.js input. 
 *
 * Invoke with streaming input and 
 * cat lastfm_subset.json | ./wrap_values.js > lastfm_wrap.json
 *
 */


// var dashdash = require('dashdash');
var uuid = require('node-uuid');
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
//            process.exit(1);            
            return;
       }
       nlines++;
       if (nlines == 1) { 
           // Write Header
           var header = new Object();
           header.name = 'wrapped_json';
           var keys = [];
           keys.push("_uuid");
           keys.push("_value");
           header.keys = keys;
           console.log(JSON.stringify(header));
       } else {
           var entry = [];
           entry.push(uuid.v4());
           entry.push(JSON.stringify(obj));
           var entryline = new Object();
           entryline.entry = entry;
           console.log(JSON.stringify(entryline));
       }
    });
    process.stdin.pipe(lstream);
    setImmediate(lstream.resume.bind(lstream));
})();
