#!/usr/bin/env node

/*
 * Copyright (c) 2014, Joyent, Inc. All rights reserved.
 *
 * A node.js script to extract moray bucket keys _etag, _mtime 
 * from moray backups to get the state of primary keys in update
 *
 * Invoke with streaming input and 
 * cat vmapi_vms_XXXX  | ./backup_state.js > state_out.json
 *
 */


var dashdash = require('dashdash');
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
    },
    {
        names: ['file', 'f'],
        type: 'string',
        help: 'Name of file piped as input for transform',
        helpArg: 'FILE'
    }
];



(function main () {
    var lstream = new LineStream({encoding: 'utf8', objectMode: true });
    var etag_index = 0;
    var etag = '';
    var nlines = 0;
    var outline = '';

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

    if (opts.file) {
      var input_file = opts.file;
      var input_file_split = input_file.split('.');
      var input_datacenter = input_file_split[0];
      var input_splitlen = input_file_split.length;
      var input_filename = input_file_split[1];
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
           var i = 0;
           obj.keys.forEach(function (elem) {
                // JSON _etag
                if (elem == '_etag') {
                    etag_index = i;
                }
                i++;
           });
       } else {
           etag = obj.entry[etag_index];
           outline = etag;
           if (opts.file) {
               outline = outline +  '\t' + input_datacenter + '\t' + input_filename;
           }
           console.log(outline);
           nlines++;
       }
    });
    process.stdin.pipe(lstream);
    setImmediate(lstream.resume.bind(lstream));
})();
