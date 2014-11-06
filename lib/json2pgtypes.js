#!/usr/bin/env node

/*
 * Copyright (c) 2014, Joyent, Inc. All rights reserved.
 * CWV Hogue
 *
 * A node.js script to analyze PostgreSQL dump streaming JSON format
 * and automate (with reasonable effort) a guess at an SQL table 
 * description that should not lose data when that gets fed back in
 * to PostgreSQL.
 *
 * i.e. convert from 
 *               JSON stream to PostgreSQL types.
 *
 * Streaming JSON format: https://github.com/yunong/sqlToJson
 *
 * Notes: 
 * - Not all PostgreSQL types are currently supported - see comments.
 * - Emits jsonb type requiring PostgreSQL 9.4 
 *   hand edit table types to json to fill < 9.4
 * - Parser guesses type for each field via  matchType(),
 *   default is VARCHAR. State machine updates type,
 *   maximum string size information, numerical precision information.
 * - validateType() avoids logic waterfall in matchType for speed
 * - JSON final state information is output.json
 *   together with output.sql containing CREATE TABLE statement.
 * - Debug mode -d shows state transitions, input line numbers, field,
 *   input string via Bunyan
 * - VARCHAR field lengths are NOT PADDED - set to the longest string.
 *   
 * Invoke with streaming JSON input 
 * cat test_json2pgtypes.json | ./json2pgtypes.js -o test_types 
 *
 */

var J2PGTversion = '1.0.0';

var stream = require('stream');
var util = require('util');
var dashdash = require('dashdash');
var validator = require('validator');
var moment = require('moment');
var fs = require('fs');
var bunyan = require('bunyan');
var outputpgtypes = require('./outputpgtypes');
var log = bunyan.createLogger({name:'json2pgtypes'});



var unknown_min_size = 5;
var macaddress = /^([0-9a-fA-F][0-9a-fA-F]:){5}([0-9a-fA-F][0-9a-fA-F])$/;


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
       names: ['debug', 'd'],
       type: 'bool',
       help: 'Bunyan debug information to stdout'
    },
    {
        names: ['typesIn', 'i'],
        type: 'string',
        help: 'JSON file of previously saved type state',
        helpArg: 'FILE'
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



function isANull(str) {
/*
 * accomodate Null field values encountered from output of sqlToJson.js 
 */
   if (typeof(str) == 'undefined') return true;
   return ( (str === 'null') ||
        (str.length  === 0) ||
        (str === '\\\\n') ||
        (str === '\\\\N') );
}



function reduceType(typestate, string) {
     if (string == null) {
         return typestate;
     }
     var newts = typestate;
     newts.size =  biggerOf(typestate.size, Buffer.byteLength(string,'utf8'));
     switch (typestate.type) {
               case 'integer' :
               case 'smallint' :
               case 'bigint' :
                   if (!isANull(string)) {
                       newts.nMin = smallerOf(typestate.nMin, parseInt(string));
                       newts.nMax = biggerOf(typestate.nMax, parseInt(string));
                   }
                   break;
               case 'real' :
               case 'double precision' :
               case 'numeric' :
               case 'money' :
                   if (!isANull(string)) {
                       newts.nMin = smallerOf(typestate.nMin, parseFloat(string));
                       newts.nMax = biggerOf(typestate.nMax, parseFloat(string));
                       var digits = digitsFloat(string);
                       newts.MaxSigFigs = biggerOf(typestate.MaxSigFigs, digits.SigFigs);
                       newts.MaxDecimals = biggerOf(typestate.MaxDecimals, digits.PostDec);
                   }
                   break;
     }
     return newts;
}



function validateArrayType(string, typestate) {

/*
 * Unwraps arrays, then calls validateType with inner values
 *
 * returns a typestate object with additional .valid boolean
 */

    var matched = typestate;
    matched.valid = false;


   if (string == null)  {
       matched.valid = true;
       return matched;
   }
   
   if (isANull(string) == true) {
       matched.valid = true;
       return matched;
   }

// NAPI-198 bug ',UUID,UUID,' forms - convert to '["UUID","UUID"]' then let fall through...
   if  ( (string.substr(0,1) == ',') &&
         (string.substr(string.length -1,1) == ',') &&
         (typestate.type === 'uuid') )  {
          string = string.replace(/^,/,'["').replace(/,$/g,'"]').replace(/,/g,'","');
   }


   // Need to see square brackets to be valid 
   if  ((string.substr(0,1) != '[') &&
         (string.substr(string.length -1,1) != ']'))  {
         return matched;
   }
   



   // Anything inside?
   var strQ = removeSqBrackets(string);
   var str = removeDoubleQuotes(strQ);
   if (str.length == 0) {
     // i.e. [""] or [] is validated for any type 
          matched.valid = true;
          return matched;  
   }       

   // Is it array of type - split and check - accumulate min/max

   var oldcount = typestate.arraycount;


   var csplit = str.split(',');
   var qcqsplit = str.split('","');
   var qcq = qcqsplit.length - 1;
   if (qcq == 0) {
       // unquoted things like 1234,456,789 or just foo or 123
       var vaildated = false;
       var update = new Object();
       update = matched;
       update.arraycount = biggerOf(csplit.length, oldcount);
       for (var r = 0; r < csplit.length; r++) {
           validated = validateType(csplit[r], typestate.type);
           if (isANull(csplit[r])) {
              validated = true;
           }
           if (validated == false) {
              matched.valid = false;
              return matched;
           }
           update = reduceType(update, csplit[r]);
           update.valid = validated;
       }
       update.size = biggerOf(update.size, typestate.size);
       if ((csplit.length == 1) 
           && (typestate.type != 'varchar')) {
              // return the singletons of any type other than varchar
          return update;
       }
   }



   // these fall all through as update cases
   // '["abcde{fg}","hijklmn"]' varchar  csplit.length = 1 qcq = 1 
   // '["ab,cd","ef,gh"]' varchar csplit.length = 4 qcq = 1
   // '["foo"]  varchar csplit.length = 1 qcq = 0
   // '["this , that, thother"]'  varchar csplit.length = 3 qcq = 0
   // '[123,456]'  integer csplit.length = 1 qcq = 0

   if (qcq > 0) {
      var validated = false;
      var update = new Object();
      update = matched;
      update.arraycount = biggerOf(qcqsplit.length, oldcount);
      for (var s = 0; s < qcqsplit.length; s++) {
           validated = validateType(qcqsplit[s], typestate.type);
           if (isANull(qcqsplit[s])) {
              validated = true;
           }
           if (validated == false) {
              matched.valid = false;
              return matched;
           }
           update = reduceType(update, qcqsplit[s]);
           update.valid = validated;
      }
      update.size = biggerOf(update.size, typestate.size);
      return update;
   }

 
   // qcq always 0 here
   // '["foo"]  varchar csplit.length = 1 
   // '["this , that, thother"]'  varchar csplit.length = 3 
   // '[123,456]'  integer csplit.length = 2

   if (typeof(update) != 'undefined') {
       if ((update.type == 'varchar') &&
            (csplit.length > 1))  {
           update.size = biggerOf(update.size, Buffer.byteLength(string,'utf8'));
           update.arraycount = biggerOf(qcqsplit.length, oldcount);
           return update;
       } else {
           // '[123,456]' integer csplit.length = 2 
           return update; 
       }
    }       

   // update was not set for pass thru -fails
   return matched;  // valid = false
}



function validateType(string, type) {
 /* This is a fast true or false 
  *   - does the string fit the Postgres type proposed?
  */
  var nullstring = isANull(string);
  var defaultstring = ( string.toLowerCase() === 'default' );

  switch (type) {
    case 'boolean' :
        /* int value > 0 - will fail validation - not considered 
         * 'true' here.
         * First values in stream = (0 | 1) will set field to int
         * - not boolean. Use a char string matching below.
         */
        return ((string.toUpperCase() === 'TRUE')  || 
               (string.toUpperCase()  === 'FALSE') ||
               (string === 'F') || (string === 'f') ||
               (string === 'T') || (string === 't') || 
               (nullstring == true) ||
               (string === '0') || 
               (string === '1') ) ;
        break;
    case 'smallint' : // unused by matchType - set by outputPGTypes
    case 'integer' :
    case 'bigint' :  // unused by matchType - set by outputPGTypes
        return isInt(string);
    case 'numeric' :  // unused by matchType - set by outputPGTypes
        return  validator.isNumeric(string)
    case 'real' :
    case 'double precision' : // unused by matchType - set by outputPGTypes
    case 'money' :  // unused by matchType - set by outputPGTypes
        return validator.isFloat(string);
        break;
    case 'timestamptz' :
           /* 
            * isInt > 1262332800000 is js epoch > 2010-01-01 
            * ISO 8601 STYLE 2014-07-05T04:46:44.534Z 
            * isDate ONLY LOOKS AT THE DATE PORTION
            * accomodates mistaken Epoch int in the stream
            * but cannot set timestampz on an int column without
            * using epoch ranges from then to current moment.
            * On output bigint colums are tested with time
            * ranges to see if they are timestamps.
            */
           if (isInt(string)) {  
              var t = parseInt(string);
              return (t > 1262332800000)
           } else {
             return  (validator.isDate(string.split('T')[0])); 
           }
        break;
    case 'macaddr' :
        return macaddress.test(string);
        break;
    case 'cidr' :  // Unused 
    case 'inet' :
        /* ONLY LOOKS AT THE IP PORTION left of / 
         * Test accepts IPV4 or IPV6
         */ 
        return (validator.isIP(string.split('/')[0]));
        break;
    case 'uuid' :
        return ( validator.isUUID(string) || defaultstring );
    case 'json' :  // Unused by matchType
    case 'jsonb':
         return ((string.substr(0,1) === '{') &&
                 (string.substr(string.length -1,1) === '}')) ||
               ((string.substr(0,1) === '[') &&
                 (string.substr(string.length -1,1) === ']'));
    case 'varchar' :
          return true;
  /* Not dealt with ATM 
   *  case 'int4range' :
   *  case 'int8range' :
   *  case 'numrange' :
   *  case 'char' :
   *  case 'text' :
   *  case 'bytea' :
   *  case 'timestamp' :
   *  case 'tsrange' :
   *  case 'tstzrange' : 
   *  case 'date' :
   *  case 'daterange' :
   *  case 'time' :
   *  case 'time with time zone' :
   *  case 'interval' :
   *  case 'bit' :
   *  case 'bit varying' :
   *     break;
   */
    }
  return false;
}


function dequotedJSON(entity) {
   var str = JSON.stringify(entity);
   /*  Strip off any Outer "" placed by JSON stringify */
   if ( str.substr(0,1) === '"' && 
        str.substr(str.length - 1,1) === '"') { 
        str = str.substr(1,str.length - 2);
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

function removeRobsCommas(string) {
   var str = string;
   /*  Strip off any Outer ,, placed by NAPI-198 bug */
   if ( str.substr(0,1) === ',' && 
        str.substr(str.length - 1,1) === ',') { 
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


function digitsFloat(string) {
 /* Gets the number of significant digits, and
  * digits after decimal place for a floating point
  * number encoded as a string by JSON.stringify.
  * These are used to triage the size of floating
  * point type to use, and when 2 decimal places,
  * money type.
  */

 /*   Deals with the case of leading/trailing 0s 
  *   in the various character forms e.g.:
  *   > var i = 234343.23e-10
  *   > i
  *   > 0.000023434323
  *   > JSON.stringify(i);
  *   > '0.000023434323'
  *   > var j = 234343.23e-20
  *   > JSON.stringify(j);
  *   > '2.3434323e-15'
  *   > var k = 2.0e-2
  *   > k
  *   >  0.02
  *   > JSON.stringify(k);
  *   > '0.02'
  *   > l = 234343.23e10
  *   2343432300000000
  *   > JSON.stringify(l);
  *   '2343432300000000'
  *   > m = 234343.23e20
  *   2.3434323e+25
  *   2.3434323e+25
  *   > JSON.stringify(m);
  *  '2.3434323e+25'
  */

      var sigfigs = 0;
      var digits_postdecimal = 0;
      var digits_predecimal = 0;
      var split_float = string.split('.');

      if (typeof(split_float[1]) != 'undefined') {
          /* Portion after decimal "00001" or "00001e-2"
           * match any e or E 
           */
          var e_pos = split_float[1].search('[eE]');
          if (e_pos == -1) {
             digits_postdecimal = split_float[1].length;
          } else {
             digits_postdecimal = e_pos;
          }
      }
      digits_predecimal = split_float[0].length;
      if (split_float[0].search('-') != -1) {
        /* subtract 1 for minus sign */
        digits_predecimal--;
        split_float[0] = split_float[0].substr(1,split_float[0].length);
      }
      sigfigs = digits_predecimal + digits_postdecimal;
      /* 
       * ADJUST sigfigs for leading 0s.
       */ 
      if ( (split_float[0].search('0') == 0) && 
           (split_float[0].length == 1) ) {
          /* leading 0 on lhs of . is not sigfig */
          sigfigs--;
          /* Remove leading 0's on decimal portion. */
          if (typeof(split_float[1]) != 'undefined') {
              var i = 0; 
              while ( (split_float[1].substr(i,1) === '0') &&
                      (i < split_float[1].length) )  {
                  sigfigs--;
                  i++;
              }
          }
      }
      /*  ADJUST sigfig for trailing 0s. */
      if (typeof(split_float[1]) == 'undefined') {
          /* No decimal portion */
          var i = split_float[0].length - 1; 
          while ( (split_float[0].substr(i,1) === '0') &&
                      (i > 0) )  {
                  sigfigs--;
                  i--;
          }
      }
      result  = new Object();
      result['SigFigs'] = sigfigs;
      result['PreDec'] = digits_predecimal;
      result['PostDec'] = digits_postdecimal;
      return result;
}


function isDate(string) {

var dateregex = /(19|20)\d\d([- /.])(0[1-9]|1[012])\2(0[1-9]|[12][0-9]|3[01])/;

  return ( validator.isDate(string) && dateregex.test(string) );

}


function isInt(string) {

  // do not pass in null strings
  // validate.isInt sees leading 0s as a sign of Float!!
  // 
  var len = string.length;
  if (string === '0') {
    return true;
  }
  str = string;
  for (var i = 0; i < len - 1; i++) {
       if (str.substr(0,1) == '0') {
          str = str.substr(1,str.length);
       } else {
          break;
       }
  }
  return (validator.isInt(str));
}



function unDupe(arr) {
    var i,
    len = arr.length,
          out = [],
          obj = {};

    for (i = 0; i < len; i++) {
        obj[arr[i]] = 0;
    }
    for (i in obj) {
        out.push(i);
    }
    return out;
}


function typeThatWins (typearray) {
   if (typearray.length == 1) {
      // most probable path - uniform type arrays
      return typearray[0];
   }  else {
      // Anything with a varchar is a varchar 
      if (typearray.indexOf('varchar') != -1) {
          return  'varchar';
      }
      // matchType Numbers return only 2 possible values - choose float
      if ((typearray.indexOf('real') != -1) &&
          (typearray.indexOf('integer') != -1) &&
          (typearray.length == 2)) {
          return 'real';
      }
      // promote boolean to integer when only these 2
      if ((typearray.indexOf('boolean') != -1) &&
         (typearray.indexOf('integer') != -1) &&
         (typearray.length == 2)) {
         return  'integer';
      }
      // promote integer to timestamptz when only these 2
      if ((typearray.indexOf('timestamptz') != -1) &&
          (typearray.indexOf('integer') != -1) &&
          (typearray.length == 2)) {
         return 'timestamptz';
      }
      //  varchar for all other possible conflicts in the matrix!          
         return 'varchar';
   }
}      
    



function matchType(string, typestate) {
/* Note: string input is ALWAYS the product of JSON.stringify
 */

    var matched = new Object();
    matched.status = 'tmp';
    matched.arraycount = 0;

   /* 
    * Any string here? A null or bare terminator form?
    *  \n \N {} "" NULL \0  or (string.length == 0);
    * No updates to type as there is no information 
    * but string size is updated if bigger.
    *
    */
  
   if ( (string === 'null') ||
        (string.length === 0) ||
        (string === '\\\\n') ||
        (string === '\\\\N') ) {
     typestate.size = biggerOf(string.length, typestate.size);
     return typestate; 
   }

   if ( (string === 'NaN') || 
        (string.toLowerCase() === 'default') ) {
     /*
      *  No change propogated to type from a NaN or the string 'default'
      *  wherein input may use default to mean some default value of
      *  a non char type (e.g. 'default' found with uuid tag in OPS-37)
      */
      typestate.size = biggerOf(string.length, typestate.size);
      return typestate; 
      return;
   }

   if ((string.toUpperCase() === 'TRUE')  || 
      (string.toUpperCase()  === 'FALSE') ||
      (string === 'F') || (string === 'f') ||
      (string === 'T') || (string === 't')) {
      matched.type = 'boolean';
      matched.size = biggerOf(string.length, typestate.size);
      return matched;
   }

   if (isInt(string)) {
      if (typeof(typestate.nMin) == 'undefined') {
        typestate.nMin = Infinity;
      } 
      if (typeof(typestate.nMax) == 'undefined') {
        typestate.nMax = -Infinity;
      }
      matched.nMin = smallerOf(parseInt(string), typestate.nMin);
      matched.nMax = biggerOf(parseInt(string), typestate.nMax);
      matched.type = 'integer';
      matched.size = biggerOf(string.length, typestate.size);
      return matched;
   }

   if (validator.isFloat(string)) {
      if (typeof(typestate.nMin) == 'undefined') {
        typestate.nMin = Infinity;
      } 
      if (typeof(typestate.nMax) == 'undefined') {
        typestate.nMax = -Infinity;
      }
      matched.nMin = smallerOf(parseFloat(string), typestate.nMin);
      matched.nMax = biggerOf(parseFloat(string), typestate.nMax);
      /*
       * Figure out the numeric precision
       */
      digits = digitsFloat(string);
      if (typeof(typestate.MaxSigFigs) == 'undefined') {
         typestate.MaxSigFigs = 0;
      } 
      if (typeof(typestate.MaxDecimals) == 'undefined') {
         typestate.MaxDecimals = 0;
      } 
      matched['MaxSigFigs'] = biggerOf(typestate.MaxSigFigs, digits.SigFigs);
      matched['MaxDecimals'] = biggerOf(typestate.MaxDecimals, digits.PostDec);
      matched.type = 'real';
      matched.size = biggerOf(string.length, typestate.size);
      return matched;
   }

   /* NAPI-198 kludge to deal with uuid array values surrounded by commas */
   var uuidstring = removeRobsCommas(string);
   if (uuidstring.length == 0) {
       return typestate;
   }
   var robscommas = false;
   if (uuidstring.length < string.length) {
        robscommas = true;
   }
// split with comma and test the first string:
   var robsplit = uuidstring.split(',');
// flag as array of 1 if it is of the form ,UUID, 
   if (validator.isUUID(robsplit[0])) {
      matched.type = 'uuid';
      if (robscommas == true) {
         matched.arraycount = robsplit.length;
      }
      matched.size = biggerOf(uuidstring.length, typestate.size);
      return matched; 
   }
   
   if (macaddress.test(string)) {
      matched.type = 'macaddr';
      matched.size = biggerOf(string.length, typestate.size);
      return matched;
   } 
   
   if (validator.isIP(string.split('/')[0])) {
      matched.type = 'inet';
      matched.size = biggerOf(string.length, typestate.size);
      return matched;
   }

   /*
    * JSON structures surrounded by {} or [] 
    */
   if  ((string.substr(0,1) === '{') &&
         (string.substr(string.length -1,1) === '}')) {
       matched.type = 'jsonb';
       matched.size = biggerOf(Buffer.byteLength(string,'utf8'), typestate.size);
       return matched;     
   }

   if  ((string.substr(0,1) === '[') &&
         (string.substr(string.length -1,1) === ']'))  {
       /*  HERE BE ARRAYS
        *   What is the interior type, how many, etc?
        */ 

       var strQ = removeSqBrackets(string);
       if (strQ.length == 0) {
           return typestate;
       }
       var str = removeDoubleQuotes(strQ);
       if (str.length == 0) {
          return typestate;
       }       

       /* is it an array of JSON [{...},{...}] ? */
       if  ((strQ.substr(0,1) === '{') &&
           (strQ.substr(strQ.length - 1,1) === '}')) {
            matched.type = 'jsonb';
            matched.size = biggerOf(Buffer.byteLength(string,'utf8'), typestate.size);
            matched.arraycount = 0;
            return matched;     
       }

       // Is it array of something - split by delimiters
       // abcde{fg}","hijklmn 

       //  Is it array of json arrays ?  - look for inner '],['  
       var sqsplit = str.split('],[').length;
       if ( sqsplit > 1) {
            matched.type = 'jsonb';
            matched.size = biggerOf(Buffer.byteLength(string,'utf8'), typestate.size);
            matched.arraycount = 0; // don't keep array size for jsonb
            return matched;
       }

       var csplit = str.split(',');
       var qcqsplit = str.split('","');
       var qcq = qcqsplit.length - 1;
       
       // unquoted things like [1234,456,789] or just ["foo"] or [123]
       // or a sentence: '["this, that, theother"]'
       // split, match interior types, find best encompassing type
       // set size and array elements 

       if (qcq == 0) {
           var update = { "status" : "unk", "size" : 0, "type" : "unknown", "arraycount" : 0};
           var typearray = [];
           for (var r = 0; r < csplit.length; r++) {
               update = matchType(csplit[r], update);
               typearray.push(update.type);
               update = reduceType(update, csplit[r]);
           }
           update.arraycount = csplit.length;
           typearray = unDupe(typearray);
           update.type = typeThatWins(typearray);
           if ((update.arraycount == 1)
              && (update.type != 'varchar')) {
               // return the singletons of any type other than varchar
               return update;
           }
       }
       
       // these fall through as update 
       // '["abcde{fg}","hijklmn"]' 
       // '["this , that, thother"]' 
       // '[123,456]'

       //  "," delimiters exist like foo","bar","baz

       if (qcq > 0) {
           var update = { "status" : "unk", "size" : 0, "type" : "unknown", "arraycount" : 0};
           var typearray = [];
           for (var r = 0; r < qcqsplit.length; r++) {
               update = matchType(qcqsplit[r], update);
               typearray.push(update.type);
               update = reduceType(update, qcqsplit[r]);
           }
           update.arraycount = qcqsplit.length;
           typearray = unDupe(typearray);
           update.type = typeThatWins(typearray);
           update.size = biggerOf(update.size, typestate.size);
           return update;
       }


       if (typeof(update) != 'undefined') {
           if ((update.type == 'varchar')
              && (qcq == 0)) {
               // detect single varchar with commas in a sentence '["this, that, theother"]'
               // comma separated varchar sentence without '","'
               // reset size and arraycount to the entire string
              update.size = biggerOf(update.size, Buffer.byteLength(string,'utf8'));
              update.arraycount = 1;
              return update;
           } else {
               // return the numerical array '[123,456]'
              return update;
           }
       }


   }

   if (isDate(string.split('T')[0])) {
      /* TODO
       * There are many other date/time types that are not 
       * yet handled here
       */
      matched.type = 'timestamptz';
      matched.size = biggerOf(string.length, typestate.size);
      return matched;
   }

   matched.type = 'varchar'; 
   matched.size = biggerOf(Buffer.byteLength(string,'utf8'), typestate.size);
   return matched;

}




   /* TODO PostgreSQL types not yet handled
    *    switch (type) {
    *        case 'int4range' :
    *        case 'int8range' :
    *        case 'numrange' :
    *        case 'char' :
    *        case 'text' :
    *        case 'bytea' :
    *        case 'timestamp' :
    *        case 'tsrange' :
    *        case 'tstzrange' : 
    *        case 'date' :
    *        case 'daterange' :
    *        case 'time' :
    *        case 'time with time zone' :
    *        case 'interval' :
    *        case 'bit' :
    *        case 'bit varying' :
    *      }
    */


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
        console.log('usage: ./json_tagexpand.js [OPTIONS]\n'
               + 'options:\n'
               + help);
        process.exit(0);
    }

    if (opts.version) {
        console.log('json2pgtypes.js V:', J2PGTversion, '\n');
        process.exit(0);
    }


    if (opts.typesIn) {
        var input_tags = require(opts.typesIn);
    } else {
        header_tags = new Object();
    }


    if (opts.path) {
        var tempostr = opts.typesOut;
        opts.typesOut = opts.path + "/" + tempostr;
    }

    var nlines = 0;
    var lstream = new LineStream({encoding: 'utf8', objectMode: true });

    lstream.on('end', function(){
        outputpgtypes.outputPGTypes(header_tags, opts.typesOut, opts.money);
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

        var isHeader = false;
        for (var key in obj) {
            if (key == 'keys') {
                isHeader = true;
            }
        }
        if (isHeader) { 
            /* 
             * This reads the PostgreSQL dump format 
             * Grab the tags/columns from the header
             */
            header_tags = obj;
            log.debug('Line', nlines, {header: header_tags});
            if (typeof(input_tags) != 'undefined') {
             /* Use the loaded state from a previous run */
                header_tags['pgtypes'] = input_tags.pgtypes;
            } else { 
                pgtypes = [];
                header_tags['pgtypes'] = pgtypes;
            }
        } else {
           var i = 0;
           var string = '';
           header_tags.keys.forEach(function(elem) {
               string = dequotedJSON(obj.entry[i]);
               if (typeof(header_tags.pgtypes[i]) == 'undefined') {
     /* NOT YET CHECKED */
                   var typestate = { "status" : "unk", "size" : 0, "type" : "unknown", "arraycount" : 0};
                   typestate = matchType(string, typestate);
                   header_tags.pgtypes[i] = typestate;
                   log.debug('Line', nlines, elem, {StartState: typestate});
               } else {
     /* ALREADY CHECKED */
                   var typein = header_tags.pgtypes[i].type;
        /* ARRAY TYPE VALIDATION */
                   if ( (typein !== 'unknown') &&
                       (header_tags.pgtypes[i].arraycount > 0)) {
                       var newstate = validateArrayType(string, header_tags.pgtypes[i]);
                       if (newstate.valid == true) {
                           header_tags.pgtypes[i].size = biggerOf(header_tags.pgtypes[i].size, 
                                                                  newstate.size);
                           header_tags.pgtypes[i].arraycount = biggerOf(header_tags.pgtypes[i].arraycount, 
                                                                  newstate.arraycount);
                           switch (header_tags.pgtypes[i].type) {
                               case 'integer' :
                               case 'smallint' :
                               case 'bigint' :
                                 header_tags.pgtypes[i].nMin = 
                                      smallerOf(header_tags.pgtypes[i].nMin, newstate.nMin);
                                 header_tags.pgtypes[i].nMax = 
                                      biggerOf(header_tags.pgtypes[i].nMax, newstate.nMax);
                                 break;
                               case 'real' :
                               case 'double precision' :
                               case 'numeric' :
                               case 'money' :
                                 header_tags.pgtypes[i].nMin = 
                                       smallerOf(header_tags.pgtypes[i].nMin, newstate.nMin);
                                 header_tags.pgtypes[i].nMax = 
                                       biggerOf(header_tags.pgtypes[i].nMax, newstate.nMax);
                                 header_tags.pgtypes[i].MaxSigFigs = 
                                      biggerOf(header_tags.pgtypes[i].MaxSigFigs, newstate.MaxSigFigs);
                                 header_tags.pgtypes[i].MaxDecimals = 
                                      biggerOf(header_tags.pgtypes[i].MaxDecimals, newstate.MaxDecimals);
                                 break;
                               case 'json':
                               case 'jsonb':
                                 header_tags.pgtypes[i].size = 
                                      biggerOf(Buffer.byteLength(string,'utf8'), newstate.size);
                                 break;
                           }
                       } else {
                          /*  Validation failed - try to match again.
                           */ 
                          log.warn('Line', nlines, elem, 'Array Validation failed from -', 
                                    string, {FailedState: header_tags.pgtypes[i]}); 
                          var typestate = header_tags.pgtypes[i];
                          typestate = matchType(string, typestate);
                          typestate.size = biggerOf(typestate.size, header_tags.pgtypes[i].size);
                          header_tags.pgtypes[i] = typestate;
                          log.warn('Line', nlines, 'Changed', elem, 'type from -', 
                                    string,  {ChangedState: typestate});
                       }
                   }
         /* NON ARRAY TYPE VALIDATION */
                   if ((typein !== 'unknown') &&
                       (header_tags.pgtypes[i].arraycount == 0)) {
                       if (validateType(string, header_tags.pgtypes[i].type) == true) {
                           /*
                            * Update state info with the bigger size
                            */ 
                           header_tags.pgtypes[i].size = biggerOf(header_tags.pgtypes[i].size, 
                                                                  Buffer.byteLength(string,'utf8'));
                           if (!isANull(string)) {
                             header_tags.pgtypes[i] = reduceType(header_tags.pgtypes[i], string);
                           }
                       } else {
                          /*  Validation failed - try to match again.
                           *  Promotes db types, e.g. integer to real, integer to varchar
                           *  when data in the field's stream appears that breaks the
                           *  previously assigned db type
                           */ 
                          log.debug('Line', nlines, elem, 'Validation failed from -', 
                                    string, {FailedState: header_tags.pgtypes[i]}); 
                          var typestate = header_tags.pgtypes[i];
                          typestate = matchType(string, typestate);
                          typestate.size = biggerOf(typestate.size, header_tags.pgtypes[i].size);
                          header_tags.pgtypes[i] = typestate;
                          log.debug('Line', nlines, 'Changed', elem, 'type from -', 
                                    string,  {ChangedState: typestate});
                       }
                   }
         /* STILL UNKOWN TYPE - KEEP TRYING TO MATCH */
                   if (typein === 'unknown') {
                       log.debug('Line', nlines, elem, 'Unknown type or null from -', 
                                 string, {UnkState: header_tags.pgtypes[i]}); 
                       var typestate = header_tags.pgtypes[i];
                       typestate = matchType(string, typestate);
                       typestate.size = biggerOf(typestate.size, header_tags.pgtypes[i].size);
                       header_tags.pgtypes[i] = typestate;
                       log.debug('Line', nlines, elem, {State: typestate});
                   }
               }
               i++;
           });
        }  
    }); 

    process.stdin.pipe(lstream);
    setImmediate(lstream.resume.bind(lstream));

})();
