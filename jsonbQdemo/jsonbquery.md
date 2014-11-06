# JSON Query from Moray workflow data with PostgreSQL 9.4 jsonb.


## tl;dr 


For those who already read the PostgreSQL 9.4 jsonb docs.

Given a database table `wf_flat_m` with a `jsonb` column called `image` 
with these nested JSON tag-value pairs contained inside one database row:
 
	   {
	       "published_at": "2014-03-20T19:21:33.489Z",
	       "files": [ { "size": 78145958 } ] 
	   }

This SQL searches for a timestamp `published_at` within a specified time range, 
and sorts by the nested integer value in `size`  :

```
SELECT
       CAST (image#>>'{files,0,size}' AS bigint) AS "image_size",
       image#>>'{published_at}' AS "published_at"
FROM wf_flat_m
WHERE
    CAST (image#>>'{published_at}' AS timestamptz)
        BETWEEN '2013-06-04T12:27:00Z'
        AND '2014-03-08T00:30:17.547Z'
ORDER BY image_size ASC;

```

```
 image_size  |       published_at       
-------------+--------------------------
    45976700 | 2014-02-20T00:21:25.202Z
...
    45976700 | 2014-02-20T00:21:25.202Z
    52593805 | 2014-02-19T03:58:08.136Z
...
    52593805 | 2014-02-19T03:58:08.136Z
    78145958 | 2014-03-08T00:30:17.547Z
...
    78145958 | 2014-03-08T00:30:17.547Z
   135506916 | 2013-11-25T17:44:54Z
   181255752 | 2014-02-20T23:57:57.297Z
   181255752 | 2014-02-20T23:57:57.297Z
   191851484 | 2014-02-20T23:07:05.224Z
...
   191851484 | 2014-02-20T23:07:05.224Z
 13357177011 | 2014-03-07T11:47:05.440Z
...
 13357177011 | 2014-03-07T11:47:05.440Z
(81 rows)
```

###Remember:

1. For SQL access to buried json values, use the `#>>` operator, 
which follows a `'{}'` enclosed path made up of comma separated json keys 
or array indices leading to the value you want.
e.g.
```
	'{published_at}'
	'{files,0,size}'
```

2. `CAST` is necessary to convert what the `#>>` operator returns 
to a database type like `bigint` or `timestamptz` for proper 
query and sorting. Otherwise the SQL engine treats all returned
values from jsonb operator `#>>` as text.

3. There are additional `jsonb` operators, as described in the PostgreSQL docs:

	http://www.postgresql.org/docs/9.4/static/functions-json.html



# Overview

This document provides tutorial examples for experimenting with 
PostgreSQL 9.4 and later JSONB syntax for query and reporting.


Database files required for this demo are populated in the

	jsonbQdemo/ 

directory by the `runtests.sh` script. You will need these files:

	wf_flat_m_types.sql
	wf_flat_m.tsv		

For the example, its SQL types in the above `.sql` file are inferred
by  `lib/json2pgtypes.js` and are specific to processing of sample 
SDC7 Moray dump data which is in this repo in the json file:

	test/wf_jobs.json 

For the SQL types note that type lengths are unpadded (e.g. `character varying(32)` 
arises from the largest string in the input dataset; `smallint` is big enough to
hold the largest integer in the input dataset). A larger datset will likely
produce larger types, and certain types may be enlarged (e.g. `_m_id` in
the file `wf_flat_m_types.sql` is  `smallint`, which could be stretched to 
`integer` or `bigint`) in a production setting.

For this document a flat single-table version of the json data is provided. For 
the Power Schema 3-table version of the same data, further examples are 
provided in:

        docs/powerschemaquery.md

Start with this document as the 3-table system requires knowledge of `jsonb`
operators to retrieve information from the sparse key-value store `_s` tables. 
The examples in this document are not confounded by the JOINS used in the 
3-table system, so that the jsonb query syntax can be understood separately.

You may construct 3-table queries to match the examples in this document
as an exercise after reading both documents.

The flat and 3-table example databases are the product of the processing 
of the same Moray input data using two different SQL layout manifests.

The single table output manifest for `lib/moraydump_reorg.js` is created by 
the javascript `wf_flat_tojson.js` which is run by the runtests.sh script to make
the runtime manifest `wf_flat.json`.  

The 3-table manifest generator is `wf_keys_tojson.js` to make the runtime
manifest `wf_keys.json` input by `lib/moraydum_reorg.js`.


## Flat 1-table workflow database example


	                 Table "public.wf_flat_m"
	       Column        |           Type           | Modifiers 
	---------------------+--------------------------+-----------
	 _m_id               | smallint                 | 
	 _key                | uuid                     | 
	 _etag               | character varying(8)     | 
	 _mtime              | timestamp with time zone | 
	 execution           | character varying(9)     | 
	 image_uuid          | character varying(3)     | 
	 creator_uuid        | character varying(3)     | 
	 origin              | character varying(3)     | 
	 task                | character varying(3)     | 
	 workflow_uuid       | uuid                     | 
	 vm_uuid             | uuid                     | 
	 server_uuid         | uuid                     | 
	 created_at          | timestamp with time zone | 
	 exec_after          | timestamp with time zone | 
	 runner_id           | uuid                     | 
	 target              | character varying(51)    | 
	 name                | character varying(25)    | 
	 taskid              | character varying(8)     | 
	 started             | timestamp with time zone | 
	 elapsed             | double precision         | 
	 endpoint            | character varying(129)   | 
	 postbackstate       | character varying(6)     | 
	 package             | jsonb                    | 
	 nictags             | character varying(34)    | 
	 timeout             | smallint                 | 
	 servernictags       | character varying(47)    | 
	 version             | character varying(5)     | 
	 expects             | character varying(9)     | 
	 requestmethod       | character varying(4)     | 
	 markasfailedonerror | boolean                  | 
	 addedtoufds         | boolean                  | 
	 max_attempts        | smallint                 | 
	 num_attempts        | real                     | 
	 image               | jsonb                    | 
	 params              | jsonb                    | 
	 chain               | jsonb                    | 
	 chain_results       | jsonb                    | 
	 onerror             | jsonb                    | 
	 onerror_results     | jsonb                    | 


## Data Files and Loading into PostgreSQL 9.4 

From Postgres 9.4 command line:

	\i ~/jsonbQdemo/wf_flat_m_types.sql
	COPY wf_flat_m from '~/jsonbQdemo/wf_flat_m.tsv';

Note that you will have to manually expand ~ to your full path from 
the root filesystem in the above examples.


# JSONB Examples from the 1-table `wf_flat_` database.

=====
### 1. Simple SELECT statement with no query, no jsonb.

Just a warm-up exercise.

```
SELECT _m_id,
       name, 
       started, 
       elapsed 
FROM wf_flat_m;
```

```
    _m_id  |           name            |          started           | elapsed  
-----------+---------------------------+----------------------------+----------
       664 | provision-7.0.29          | 2014-03-21 18:48:52.608+00 |   16.239
       218 | destroy-7.0.3             | 2014-03-17 23:20:50.005+00 |   19.764
        29 | add-nics-7.0.3            | 2014-03-12 00:34:34.991+00 |    1.441
         5 | server-update-nics-1.0.0  | 2014-03-11 20:34:44.906+00 |    5.611
         1 | server-sysinfo-1.1.0      | 2014-03-11 19:46:14.926+00 |    3.344
        36 | destroy-7.0.3             | 2014-03-12 23:58:57.55+00  |    13.11
        46 | destroy-7.0.3             | 2014-03-13 21:05:56.306+00 |   17.228
...
      1025 | provision-7.0.30          | 2014-04-11 22:35:18.123+00 |   19.449
      1026 | provision-7.0.30          | 2014-04-11 22:35:48.152+00 |   18.497
      1044 | provision-7.0.30          | 2014-04-11 22:44:48.149+00 |   18.442
      1045 | add-nics-7.0.4            |                            |         
(1045 rows)
```

=====
### 2. `SELECT` showing jsonb `->` and `->>` indirection constructs 
Specify 1 level nested `jsonb` `integer`, `string`, `boolean` values to report.

Note that `->` does cast numeric and boolean types, but works only for
1 level nested JSON values. More deeply nested values cannot use the `->`
operator and require `CAST` as shown in later examples. 

```
# JSON fragment from jsonb params column
{
  "delegate_dataset": true,
  "ram": 512,
  "brand": "joyent-minimal"
}
```

```
SELECT _m_id,
       params->'ram' AS "integer",
       params->'delegate_dataset' as "boolean",
       params->'brand' AS "quoted string",
       params->>'brand' AS "unquoted string"
FROM wf_flat_m
WHERE name LIKE 'provision%';
```

```
    _m_id  | integer | boolean |  quoted string   | unquoted string 
-----------+---------+---------+------------------+-----------------
       664 | 512     | true    | "joyent-minimal" | joyent-minimal
        21 | 512     | true    | "joyent-minimal" | joyent-minimal
        53 | 2048    | true    | "joyent-minimal" | joyent-minimal
        59 | 256     | true    | "joyent-minimal" | joyent-minimal
        76 | 2048    | true    | "joyent-minimal" | joyent-minimal
        82 | 256     | true    | "joyent-minimal" | joyent-minimal
        43 | 1024    |         | "joyent-minimal" | joyent-minimal
         3 | 1024    |         | "joyent-minimal" | joyent-minimal
        55 | 2048    | true    | "joyent-minimal" | joyent-minimal
...
      1033 | 512     | true    | "joyent-minimal" | joyent-minimal
      1025 | 768     | true    | "joyent-minimal" | joyent-minimal
      1026 | 768     | true    | "joyent-minimal" | joyent-minimal
      1044 | 256     | false   | "joyent-minimal" | joyent-minimal
(456 rows)
```

=====
### 3. `WHERE` using the `@>` json containment construct
Query 1 level nested JSON tag `ram` with exact value `8192` expressed
as a fragment in json `{"ram": 8192}`.


```
# JSON fragment from jsonb params column
{
  "ram": 512,
}
```


```
SELECT _m_id,
       name, 
       params->'ram' AS "ram" 
FROM wf_flat_m 
WHERE params@> '{"ram": 8192}';
```

```
    _m_id  |       name       | ram  
-----------+------------------+------
       705 | provision-7.0.29 | 8192
       690 | provision-7.0.29 | 8192
       691 | provision-7.0.29 | 8192
       696 | provision-7.0.29 | 8192
       698 | provision-7.0.29 | 8192
       703 | provision-7.0.29 | 8192
       694 | provision-7.0.29 | 8192
       695 | provision-7.0.29 | 8192
       699 | provision-7.0.29 | 8192
       763 | provision-7.0.29 | 8192
(10 rows)
```

=====
### 4. `SELECT` nested JSON using the `#>>` path to value construct and `AS` colunm naming

```
# JSON fragment from jsonb params column
{
  "customer_metadata": {
    "SAPI_URL": "http://sapi.emy-10.joyent.us",
  }
}
```

```
SELECT _m_id,
       name, 
       params#>>'{customer_metadata, SAPI_URL}' AS "SAPI_URL" 
FROM wf_flat_m 
WHERE params@>'{"ram": 1024}';
```

```
   _m_id  |       name       |           SAPI_URL           
-----------+------------------+------------------------------
        43 | provision-7.0.29 | 
         3 | provision-7.0.29 | 
       451 | provision-7.0.29 | http://sapi.emy-10.joyent.us
        38 | provision-7.0.29 | 
       254 | provision-7.0.29 | http://sapi.emy-10.joyent.us
       253 | provision-7.0.29 | http://sapi.emy-10.joyent.us
       316 | provision-7.0.29 | http://sapi.emy-10.joyent.us
...
       870 | provision-7.0.30 | 
       761 | provision-7.0.29 | 
       901 | provision-7.0.30 | http://sapi.emy-10.joyent.us
       874 | provision-7.0.30 | 
       902 | provision-7.0.30 | http://sapi.emy-10.joyent.us
      1023 | provision-7.0.30 | http://sapi.emy-10.joyent.us
      1024 | provision-7.0.30 | http://sapi.emy-10.joyent.us
(28 rows)
```


=====
### 5. `WHERE` using the `@>` containment construct, with `::jsonb` cast 
Query 2 level nested JSON tag `manta_role` with string "loadbalancer" embedded
in a fragment of JSON, using the ::jsonb casting syntax (which is optional).

```
# JSON fragment from jsonb params column
{
  "tags": {
    "manta_role": "loadbalancer"
}
```


```
SELECT _m_id,
       name, 
       params#>>'{tags, manta_role}' AS "manta_role" 
FROM wf_flat_m 
WHERE params@>'{"tags": {"manta_role": "loadbalancer"}}'::jsonb;
```

```
    _m_id  |       name       |  manta_role  
-----------+------------------+--------------
       664 | provision-7.0.29 | loadbalancer
       194 | provision-7.0.29 | loadbalancer
       195 | provision-7.0.29 | loadbalancer
       665 | provision-7.0.29 | loadbalancer
       258 | provision-7.0.29 | loadbalancer
...
       808 | provision-7.0.30 | loadbalancer
       809 | provision-7.0.30 | loadbalancer
       905 | provision-7.0.30 | loadbalancer
      1028 | provision-7.0.30 | loadbalancer
      1027 | provision-7.0.30 | loadbalancer
(18 rows)
```

=====
### 6. `SELECT` using the jsonb - `#>>` path to value constructs
Specify 3 level nested JSON tag, 2nd level is an array index

```
# JSON fragment from jsonb image column
{
  "files": [
    {
      "size": 62169456,
      "compression": "gzip"
    }
  ]
}
```

```
SELECT _m_id, 
         name, 
         image#>>'{files,0,size}' AS "image  size", 
         image#>>'{files,0,compression}' AS "compression", 
         execution 
FROM wf_flat_m
WHERE name LIKE 'provision%' 
AND execution = 'failed';
```

```
    _m_id  |       name       | image  size | compression | execution 
-----------+------------------+-------------+-------------+-----------
       690 | provision-7.0.29 | 191851484   | gzip        | failed
       694 | provision-7.0.29 | 191851484   | gzip        | failed
       695 | provision-7.0.29 | 191851484   | gzip        | failed
(3 rows)
```


=====
### 7. `WHERE` - using the jsonb `#>>` path to value constructs
Query by path to boolean tag

```
# JSON fragment from jsonb params column
{
  "wantResolvers": true,
  "add_nics": [
    {
      "mac": "90:b8:d0:15:07:95",
      "ip": "172.26.10.10"
    }
  ]
}
```


```
SELECT _m_id, 
         name, 
         params#>>'{add_nics,0,mac}' AS "mac",
         params#>>'{add_nics,0,ip}' AS "ip",
         execution 
FROM wf_flat_m
WHERE params#>>'{wantResolvers}' = 'true';
```

```
    _m_id  |      name      |        mac        |      ip      | execution 
-----------+----------------+-------------------+--------------+-----------
        29 | add-nics-7.0.3 |                   |              | failed
        24 | add-nics-7.0.3 | 90:b8:d0:15:07:95 | 172.26.10.10 | succeeded
        42 | add-nics-7.0.3 | 90:b8:d0:c3:08:f5 | 172.26.10.16 | succeeded
         2 | add-nics-7.0.3 | 90:b8:d0:78:7b:37 | 172.26.10.8  | succeeded
         4 | add-nics-7.0.3 | 90:b8:d0:9d:c4:eb | 172.26.10.9  | succeeded
       640 | add-nics-7.0.3 | 90:b8:d0:02:2d:b4 | 172.26.10.36 | succeeded
        30 | add-nics-7.0.3 |                   |              | failed
        25 | add-nics-7.0.3 | 90:b8:d0:ea:5d:68 | 172.26.10.11 | succeeded
...
       872 | add-nics-7.0.4 | 90:b8:d0:89:ba:43 | 172.26.10.54 | succeeded
       760 | add-nics-7.0.3 | 90:b8:d0:a1:7c:96 | 172.26.10.46 | succeeded
       873 | add-nics-7.0.4 | 90:b8:d0:32:81:f4 | 172.26.10.55 | succeeded
       762 | add-nics-7.0.3 | 90:b8:d0:3d:14:69 | 172.26.10.47 | succeeded
       875 | add-nics-7.0.4 | 90:b8:d0:6e:ca:62 | 172.26.10.56 | succeeded
      1045 | add-nics-7.0.4 |                   |              | running
(41 rows)
```


=====
### 8. `WHERE` using the `@>` json containment constructs 
Query 3 level nested JSON tag, 2nd level is an array index, query 3rd
level tag size with exact numerical value 191851484 inside a JSON
fragment. 

```
# JSON fragment from jsonb image column
{
  "files": [
    {
      "size": 62169456,
      "compression": "gzip"
    }
  ]
}
```


```
SELECT _m_id,
       name, 
       image#>>'{files,0,size}' AS "image  size", 
       image#>>'{files,0,compression}' AS "image compression", 
       execution 
FROM wf_flat_m
WHERE name LIKE 'provision%' 
AND execution = 'succeeded' 
AND image @> '{"files": [{"size":191851484}] }';
```

```
    _m_id  |       name       | image  size | image compression | execution 
-----------+------------------+-------------+-------------------+-----------
       691 | provision-7.0.29 | 191851484   | gzip              | succeeded
(1 row)
```

=====
### 9. `WHERE` numerical comparision `<=` and `CAST` for numeric JSON values. 

```
# JSON fragment from jsonb image column
{
  "files": [
    {
      "size": 62169456,
      "compression": "gzip"
    }
  ]
}
```

Use `#>>` path to value with CAST for numerical comparision, 
3 level nested value, 2nd level is an array index, query 3rd

```
SELECT _m_id,
       name,
       image#>>'{files,0,size}' AS "image  size",
       image#>>'{files,0,compression}' AS "image compression",
       execution
FROM wf_flat_m
WHERE name LIKE 'provision%'
AND execution = 'succeeded'
AND CAST (image#>>'{files,0,size}' AS bigint) <= 37175977;
```

```
    _m_id  |       name       | image  size | image compression | execution 
-----------+------------------+-------------+-------------------+-----------
        43 | provision-7.0.29 | 37175977    | gzip              | succeeded
         3 | provision-7.0.29 | 37175977    | gzip              | succeeded
        38 | provision-7.0.29 | 37175977    | gzip              | succeeded
       474 | provision-7.0.29 | 37175977    | gzip              | succeeded
(4 rows)
```

=====
### 10. `WHERE` Date range query `CAST`ing and `ORDER BY` sorting for nested numeric JSON values.

This example shows the use of `jsonb` operator result `CAST`ing in `SELECT` 
statements for sorting, and an example of using a `jsonb` operator result `CAST` 
to a `timestamptz` type to execute a proper date range `BETWEEEN` search.

In this example the upper `CAST` statement to `bigint` is critical.
Sorting on a field extracted by a `jsonb` operator is by string here, 
regardless of the JSON representation within.  The loaded JSON data 
is of the unquoted numerical form:

	{"files": [ { "size": 78145958 } ] }

but a `CAST` is required for sorting as the jsonb path to value
operators look like they always return `char` stringy types. 


```
# JSON fragment from jsonb image column
{
  "files": [
    {
      "size": 62169456,
      "compression": "gzip"
    }
  ]
}

# JSON fragment from jsonb params column
{
  "payload": {
    "image": {
      "published_at": "2014-03-20T19:21:33.489Z"
    }
  }
}

```


```
SELECT _m_id,
       name,
       CAST (image#>>'{files,0,size}' AS bigint) AS "image_size",
       params#>>'{payload,image,published_at}' AS "published_at",
       execution
FROM wf_flat_m
WHERE name LIKE 'provision%'
AND execution = 'succeeded' 
AND CAST (params#>>'{payload,image,published_at}' AS timestamptz) 
    BETWEEN '2013-05-04T12:27:00Z'
    AND '2014-03-08T00:30:17.547Z'
ORDER BY image_size ASC;
```

```
   _m_id  |       name       | image_size  |       published_at       | execution 
-----------+------------------+-------------+--------------------------+-----------
       460 | provision-7.0.29 |    45976700 | 2014-02-20T00:21:25.202Z | succeeded
       459 | provision-7.0.29 |    45976700 | 2014-02-20T00:21:25.202Z | succeeded
...
        76 | provision-7.0.29 |    78145958 | 2014-03-08T00:30:17.547Z | succeeded
...
        58 | provision-7.0.29 |    78145958 | 2014-03-08T00:30:17.547Z | succeeded
       705 | provision-7.0.29 |   135506916 | 2013-11-25T17:44:54Z     | succeeded
       101 | provision-7.0.29 |   181255752 | 2014-02-20T23:57:57.297Z | succeeded
       103 | provision-7.0.29 |   181255752 | 2014-02-20T23:57:57.297Z | succeeded
       691 | provision-7.0.29 |   191851484 | 2014-02-20T23:07:05.224Z | succeeded
       818 | provision-7.0.30 | 13357177011 | 2014-03-07T11:47:05.440Z | succeeded
       919 | provision-7.0.30 | 13357177011 | 2014-03-07T11:47:05.440Z | succeeded
...
      1037 | provision-7.0.30 | 13357177011 | 2014-03-07T11:47:05.440Z | succeeded
(78 rows)
```


Switch from 

       CAST (image#>>'{files,0,size}' AS bigint) AS "image_size",

to

       image#>>'{files,0,size}' AS "image_size",

to see this incorrectly sort numbers in string order.



=====
### 11. `SELECT` JSON array with `#>>` path to value constructs

```
# JSON fragment from jsonb params column
{
  "oldResolvers": ["172.25.10.11", "8.8.8.8", "8.8.4.4"],
  "wantResolvers": true
}

```

```
SELECT _m_id,
       name, 
       params#>>'{oldResolvers}' as "oldResolvers" 
FROM wf_flat_m 
WHERE params#>>'{wantResolvers}' = 'true'
AND execution = 'succeeded';
```

```
    _m_id  |      name      |              oldResolvers              
-----------+----------------+----------------------------------------
        24 | add-nics-7.0.3 | ["8.8.8.8", "8.8.4.4"]
        42 | add-nics-7.0.3 | ["172.25.10.11", "8.8.8.8", "8.8.4.4"]
         2 | add-nics-7.0.3 | ["172.25.10.11", "8.8.8.8", "8.8.4.4"]
         4 | add-nics-7.0.3 | ["172.25.10.11", "8.8.8.8", "8.8.4.4"]
       640 | add-nics-7.0.3 | ["172.25.10.11", "8.8.8.8", "8.8.4.4"]
        25 | add-nics-7.0.3 | ["8.8.8.8", "8.8.4.4"]
        37 | add-nics-7.0.3 | ["172.25.10.11", "8.8.8.8", "8.8.4.4"]
...
       760 | add-nics-7.0.3 | ["172.25.10.11", "8.8.8.8", "8.8.4.4"]
       873 | add-nics-7.0.4 | ["172.25.10.11", "8.8.8.8", "8.8.4.4"]
       762 | add-nics-7.0.3 | ["172.25.10.11", "8.8.8.8", "8.8.4.4"]
       875 | add-nics-7.0.4 | ["172.25.10.11", "8.8.8.8", "8.8.4.4"]
(34 rows)
```

=====
### 12. `SELECT` JSON array value by integer index - `#>>` path to value constructs

```
# JSON fragment from jsonb params column
{
  "oldResolvers": ["172.25.10.11", "8.8.8.8", "8.8.4.4"],
  "wantResolvers": true
}

```

```
SELECT _m_id,
       name,
       params#>>'{oldResolvers,0}' as "oldResolvers[0]",
       params#>>'{oldResolvers,1}' as "oldResolvers[1]",
       params#>>'{oldResolvers,2}' as "oldResolvers[2]"
FROM wf_flat_m
WHERE params#>>'{wantResolvers}' = 'true' 
AND execution = 'succeeded'; 
```

```
    _m_id  |      name      | oldResolvers[0] | oldResolvers[1] | oldResolvers[2] 
-----------+----------------+-----------------+-----------------+-----------------
        24 | add-nics-7.0.3 | 8.8.8.8         | 8.8.4.4         | 
        42 | add-nics-7.0.3 | 172.25.10.11    | 8.8.8.8         | 8.8.4.4
         2 | add-nics-7.0.3 | 172.25.10.11    | 8.8.8.8         | 8.8.4.4
         4 | add-nics-7.0.3 | 172.25.10.11    | 8.8.8.8         | 8.8.4.4
...
       760 | add-nics-7.0.3 | 172.25.10.11    | 8.8.8.8         | 8.8.4.4
       873 | add-nics-7.0.4 | 172.25.10.11    | 8.8.8.8         | 8.8.4.4
       762 | add-nics-7.0.3 | 172.25.10.11    | 8.8.8.8         | 8.8.4.4
       875 | add-nics-7.0.4 | 172.25.10.11    | 8.8.8.8         | 8.8.4.4
(34 rows)
```


