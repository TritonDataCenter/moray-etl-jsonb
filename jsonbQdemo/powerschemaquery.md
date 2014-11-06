# Power-Schema Query Examples with JSONB and JOIN 

## Overview

This document provides an outline and some tutorial examples for experimenting
with a small but varied 3-table Power Schema. It provides demos of 
specific syntax for templating JOIN statements the 3-table system so that 
they can be used as 'boilerplate'. It also provides specific examples for 
new syntax and SQL operators for querying arbitrary JSONB fields in the Sparse 
`_s` Table which is a key-value store itself. 

This system is facilitated by PostgreSQL 9.4 and later.
 
More JSONB examples are found in the companion document and tutorial `jsonbquery.md`.

The `moray-etl-jsonb` repo reorganizes json datasets into an SQL table 
structure called a Power Schema.  This is a 3-table set that provides
querable SQL tables and support for the two main edge cases of JSON to SQL 
schema generation.

First - Sparse JSON tag-values are aggregated into a Sparse Table `_s` 
to avoid the generation of sparse SQL columns with mostly `null` entries.
The Sparse Table `_s` design of the Power Schema is itself a key-value store.

The example `wf_s` holds the json element name in the `tag` column, and the 
json itself (including the element name) in the `value` column, which is 
a PostgreSQL `jsonb` type, allowing us full access to query the json contents.
The `_s` table handles inbound novel JSON tags unknown to the schema, preventing
regressions when upstream JSON generating code adds new tag-value pairs.

Second - Repetitive (or Redundant) JSON tag-values are made unique in a 
Repetitive Table `_r`.

To understand the `_r` table, consider that some tag-value pairs repeat the same
value many times. A corresponding SQL column would look like the same value, 
repeated many times. In the example database, the tag `timeout` has a value 
of `10` in nearly all entries.

Repetitive data arises from source code generating the upstream JSON with
little or no variance in code path or output. Query hits to the repetitive 
values in the `_r` table offer very little information for selecting unique data, 
as they return large fractions of the database, however hits to minor values 
can be quite useful.

The `_r` table primary key, in the examples here `_r_id`, is a hash of a string
composed of all the values in a database row. When the `_r` table 
is generated in by moraydump_reorg.js, it originally has the same number of 
rows as the `_m`, but the data is sorted and uniqued in a Unix pipeline 
to remove the redundant rows before creating the `.tsv` file and loading into 
PostgreSQL. The hash allows us to pipe the json form of the _m table to 
`sort -r | uniq` to remove the redundant rows.

Third - Everything not in one of the above edge cases is in the Main
Table `_m`.

JSON tag-value pairs that do not fall into these edge cases go into the
main SQL table `_m` which offers the greatest variation in information for query. 
Typically the `_m` table aggregates UUIDs, timestamps, and free text information.

The example used here is from Joyent a SDC7 workflow data example for a staging
datacenter. The 3-table Power Schema manifest that partitions as above is based 
on a much larger set of data. However the SQL Types inferred above are only 
based on the small data set `test/wf_jobs.json` shipped in this repo, which is 
cleared of customer data. The SQL types and sizes are determined automatically by 
`json2pgtypes.js`. Some of the values are null resulting in a varchar(3) type.


## Power-Schema Table Structure for `wf_s`, `wf_m`, `wf_r`

	       Sparse Table "wf_s"
	+-----------+-----------------------+ 
	|  Column   |         Type          |     
	+-----------+-----------------------+
	| _s_id     | uuid                  | PK  \
	| _m_id     | character varying(8)  | FK  ---\-------------------+
	| _r_id     | character varying(32) | FK  /  --------------------------+
	| tag       | character varying(13) |        /                   |     |
	| value     | jsonb                 |                            |     |
	+-----------+-----------------------+                            |     |
	                                                                 |     |
	             Main Table "wf_m"                                   |     |
	+-----------------+--------------------------+                   |     |
	|     Column      |           Type           |                   |     |
	|-----------------+--------------------------+                   |     |
	| _m_id           | character varying(8)     | PK \   --||-------+     |
	| _r_id           | character varying(32)    | FK ---------+           |
	| _id             | smallint                 |    /        |           |
	| _key            | uuid                     |             |           |
	| _mtime          | timestamp with time zone |             |           |
	| image_uuid      | character varying(3)     |             |           |
	| creator_uuid    | character varying(3)     |             |           |
	| origin          | character varying(3)     |             |           |
	| task            | character varying(3)     |             |           |
	| workflow_uuid   | uuid                     |             |           |
	| vm_uuid         | uuid                     |             |           |
	| created_at      | timestamp with time zone |             |           |
	| exec_after      | timestamp with time zone |             |           |
	| runner_id       | uuid                     |             |           |
	| target          | character varying(51)    |             |           |
	| name            | character varying(25)    |             |           |
	| taskid          | character varying(8)     |             |           |
	| started         | timestamp with time zone |             |           |
	| elapsed         | double precision         |             |           |
	| endpoint        | character varying(129)   |             |           |
	| serveruuids     | character varying(3)     |             |           |
	| package         | jsonb                    |             |           |
	| image           | jsonb                    |             |           |
	| params          | jsonb                    |             |           |
	| chain           | jsonb                    |             |           |
	| chain_results   | jsonb                    |             |           |
	| onerror         | jsonb                    |             |           |
	| onerror_results | jsonb                    |             |           |
	+-----------------+--------------------------+             |           |
	                                                           |           |
	         Repetitive Table "wf_r"                           |           |
	+---------------------+-----------------------+            |           |
	|       Column        |         Type          |            |           |
	+---------------------+-----------------------+            |           |
	| _r_id               | character varying(32) | PK -||-----+-----------+ 
	| nictags             | jsonb                 | 
	| timeout             | smallint              | 
	| servernictags       | jsonb                 | 
	| server_uuid         | uuid                  | 
	| execution           | character varying(9)  |
	| version             | character varying(5)  | 
	| expects             | character varying(9)  | 
	| requestmethod       | character varying(4)  | 
	| markasfailedonerror | boolean               | 
	| addedtoufds         | boolean               | 
	| max_attempts        | smallint              | 
	| num_attempts        | real                  | 
	| cleanupontimeout    | character varying(3)  |
	+---------------------+-----------------------+



None of the SQL values in the tables above are rationally padded, rather 
they fit snugly to the maximum element size in the test data set. 
E.g. `character varying(32)` means that was the largest string in the input 
dataset, and `smallint` is big enough to hold the largest integer in the input 
dataset. A larger datset will produce larger types, and certain types may be 
enlarged (e.g. `_m_id` from `smallint` to `integer` or `bigint`) in a production setting.

For comparision, a flat single-table version of the same data is provided and
more complex JSONB SQL query examples are provided in 
 
	docs/jsonbquery.md

Example databases are the product of the processing of the same Moray input data. 
The single table output  manifest for `lib/moraydump_reorg.js` is found in 
`wf_flat_tojson.js` and the manifest `wf_flat.json`. The power schema 3-table 
is defined in `wf_keys_tojson.js` and its output manifest `wf_keys.json`.



## Data Files and Loading into PostgreSQL 9.4 

The files created by `runtests.sh` are found in the `jsonbQdemo/` directory:

        wf_m.tsv
        wf_r.tsv
        wf_s.tsv
        wf_m_types.sql
        wf_r_types.sql
        wf_s_types.sql

These statements from psql will load the SQL table descriptions and data.
Note you must change `~` to the full path of your working directory.


	\i ~/jsonbQdemo/wf_s_types.sql
	COPY wf_s from '~/jsonbQdemo/wf_s.tsv';
	\i ~/jsonbQdemo/wf_m_types.sql
	COPY wf_m from '~/jsonbQdemo/wf_m.tsv';
	\i ~/jsonbQdemo/wf_r_types.sql
	COPY wf_r from '~/jsonbQdemo/wf_r.tsv';


## Differences between the 3-table and 1-table databases


An analysis of the flat (1-table) version of the data used here 
and the 3-table version was carried out with an earlier version of the
SQL manifest to ensure they contain the exact same data.  

There are 6 more columns in the 3-table sytem accounted for by additional primary
and foreign key requirements. The number of rows in the `wf_r` and `wf_s` tables 
are 2.2% and 1.5% of the original number of rows. The size of the 3-table database is 
slightly smaller than the 1-table system, by 0.8%. These difference values apply 
only to this previous implementation and change with data scale and alternate content.

The additional columns in the 3-table system for foreign keys seem to cancel out 
the smaller number of rows in the edge case tables `wf_s` and `wf_r`, making them 
roughly equal in size. Gained functionality lies in the 3-table system accepting novel 
unforseen upstream JSON tags in the `wf_s`.

The cost of this functionality is that queries for the 3-table system are necessarily 
more involved than a 1-table system, hence this document elaborates with examples 
of most of the typical JOIN constructs needed to query the Power Schema.
                            
	                    1-table            3-table    Difference           
	Total Columns:       41                  47          +6
	Rows    wf_m       1045                1045
	        wf_r        n/a                  23    
	        wf_s        n/a                  16
	Database size: 19788244            19661316       -126928 (-0.6%)
	DB Overhead     7287252             7287252
	Data size:     12500992            12374064       -126928 (-1.0%)

	Methodology for Size
	- drop all tables
	- load tables
	- Size command for Database size: # select pg_database_size('jsontest');
	- Drop tables, repeat size command for DB Overhead;

Note that with this small database converted from 1045 rows of JSON data, there
is a decrease in size of the 3-table system even with the added identifier columns. 
As the database scales up, this size difference will, in almost every example, 
increase, justifying the construction of the 3-table Power Schema.

## Power Schema Query Behavior

Partitioning of the columns into 3 tables gives insight on expected query behavior.
Specifically, `wf_s` and `wf_r` columns are query edge cases. Query hits to columns 
in the `wf_s` are rare, so expect these to always return very few records when joined 
back to the `wf_m` (See query examples 2-9).  

Query hits to the repeated values in `wf_r` columns will always return large numbers of 
records when joined to the `wf_m` information (See query example 13). Queries to the 
`wf_r` that join to the `wf_m` are most useful when hits are to the uncommon data values 
in the column (See query example 14 below).

In formulating SQL queries, it is easy to make them complex and the steps are left up to the 
database's optimizer. In this 3-table system we know exactly where the edge cases are and
can select the query that is most specific to try first (i.e. in the order `wf_s`, `wf_m`, 
`wf_r`).

For advanced JSONB queries and CAST examples refer to the accompanying document `jsonbquery.md`.

=========
# Sparse Table `_s` QUERIES

The `wf_s` does not have columns labeled by JSON element names, it rather holds the element
name in the `tag` column. The `value` column is a `jsonb` field and the `wf_s` may have 
heterogeneous examples of JSON in this column.  

So the first set of examples show how to access the heterogeneous 
`wf_s` contents with jsonb syntax.

=========
### 1. Show all json tags in Sparse Table `wf_s` `tag` column

These can be considered the additional database columns that would
otherwise be in a flat representation. Query examples 2-9 show
specifically how to use the wf_s table. 

```
SELECT DISTINCT tag FROM wf_s;
```

```
      tag      
---------------
 runner_id
 postBackState
(2 rows)
```

=========
### 2. Show the `tag` and `value` columns in `wf_s`.

```
SELECT _s_id, 
       tag,
       value
FROM wf_s;
```

```
                _s_id                 |      tag      |                         value       
--------------------------------------+---------------+-------------------------------------------------------
 109270c6-942a-4ac5-a3ac-fcab98b37cc2 | postBackState | {"postBackState": "failed"}
 2e86f536-93c7-4e1a-9b9d-6a161b5eda8c | postBackState | {"postBackState": "failed"}
 6c8337f0-8853-40d3-92e7-0860560aa846 | postBackState | {"postBackState": "failed"}
 060b8c47-7133-4431-b643-70cd7fd78649 | runner_id     | {"runner_id": "03b799b8-5985-4377-8c25-8cb7d01d9a15"}
(4 rows)
```

=========
### 3. Query `wf_s` by `tag` name, report jsonb `value` with `#>` path operator.

```
SELECT _s_id, 
       tag, 
       value#>'{postBackState}' AS "postBackState" 
FROM wf_s 
WHERE tag = 'postBackState';
```

```
                _s_id                 |      tag      | postBackState 
--------------------------------------+---------------+---------------
 109270c6-942a-4ac5-a3ac-fcab98b37cc2 | postBackState | "failed"
 2e86f536-93c7-4e1a-9b9d-6a161b5eda8c | postBackState | "failed"
 6c8337f0-8853-40d3-92e7-0860560aa846 | postBackState | "failed"
(3 rows)
```

=========
### 4. Query `wf_s` by `tag` name, report jsonb `value` with `#>>` path operator.

```
SELECT _s_id, 
       tag, 
       value#>>'{postBackState}' AS "postBackState" 
FROM wf_s 
WHERE tag = 'postBackState';
```


```
                _s_id                 |      tag      | postBackState 
--------------------------------------+---------------+---------------
 109270c6-942a-4ac5-a3ac-fcab98b37cc2 | postBackState | failed
 2e86f536-93c7-4e1a-9b9d-6a161b5eda8c | postBackState | failed
 6c8337f0-8853-40d3-92e7-0860560aa846 | postBackState | failed
(3 rows)
```


=========
### 5. Query `value` column with WHERE construct `#>>` jsonb path to value operator and tag.

```
SELECT _s_id,
       tag,
       value->>'postBackState' AS "postBackState"
FROM wf_s
WHERE value#>>'{postBackState}' = 'failed';
```

This form supportes queries into nested json!

```
                _s_id                 |      tag      | postBackState 
--------------------------------------+---------------+---------------
 109270c6-942a-4ac5-a3ac-fcab98b37cc2 | postBackState | failed
 2e86f536-93c7-4e1a-9b9d-6a161b5eda8c | postBackState | failed
 6c8337f0-8853-40d3-92e7-0860560aa846 | postBackState | failed
(3 rows)
```

=========
### 6. Query `value` column with WHERE construct `->>` one level jsonb indirection operator and tag.

```
SELECT _s_id,
       tag,
       value->>'postBackState' AS "postBackState"
FROM wf_s
WHERE value->>'postBackState' = 'failed';
```

This `->>` jsonb operator does not support nested json.

```
                _s_id                 |      tag      | postBackState 
--------------------------------------+---------------+---------------
 109270c6-942a-4ac5-a3ac-fcab98b37cc2 | postBackState | failed
 2e86f536-93c7-4e1a-9b9d-6a161b5eda8c | postBackState | failed
 6c8337f0-8853-40d3-92e7-0860560aa846 | postBackState | failed
(3 rows)
```


=========
# POWER SCHEMA JOINS


The following examples cover a matrix of anticipated JOINS interconnecting
queries from the `wf_s`, `wf_m` and `wf_r` tables. These examples can be used
as boilerplate for constructing the necessary JOINS for any `_s`, `_r`,
and `_m` Power Schema table set.


### 7. Query `wf_s`, report rows joined to `wf_m`


As anticipated, hits to `wf_s` retrive small numbers of `wf_m` records.

```
SELECT wf_m._m_id,
       wf_m.name,
       wf_s._s_id, 
       wf_s.value->>'postBackState' AS "postBackState"  
FROM wf_s 
     LEFT JOIN wf_m ON wf_s._m_id = wf_m._m_id
WHERE wf_s.tag = 'postBackState';
```

```
  _m_id   |       name       |                _s_id                 | postBackState 
----------+------------------+--------------------------------------+---------------
 54CF80C5 | provision-7.0.29 | 109270c6-942a-4ac5-a3ac-fcab98b37cc2 | failed
 ECFDCE2C | provision-7.0.29 | 2e86f536-93c7-4e1a-9b9d-6a161b5eda8c | failed
 5BB54556 | provision-7.0.29 | 6c8337f0-8853-40d3-92e7-0860560aa846 | failed
(3 rows)
```

=========
### 8. Query `wf_s`, report rows joined to `wf_m` and `wf_r`


```
SELECT wf_m.name,
       wf_r.timeout,
       wf_r.server_uuid,
       wf_s.value->>'postBackState' AS "postBackState"  
FROM wf_s 
     LEFT JOIN wf_m ON wf_s._m_id = wf_m._m_id
     LEFT JOIN wf_r ON wf_m._r_id = wf_r._r_id 
WHERE wf_s.tag = 'postBackState';
```

```
       name       | timeout |             server_uuid              | postBackState 
------------------+---------+--------------------------------------+---------------
 provision-7.0.29 |    3810 | 1d5c4459-7550-4d17-c195-acb23deac36d | failed
 provision-7.0.29 |    3810 |                                      | failed
 provision-7.0.29 |    3810 | 1d5c4459-7550-4d17-c195-acb23deac36d | failed
(3 rows)
```

=========
### 9. Query `wf_s`, report rows joined to `wf_r`, (no `wf_m`)

Note in the Power-Schema Table Structure figure there is
a direct link between the `wf_r` and `wf_s`, which is used here.

```
SELECT wf_r.timeout,
       wf_r.server_uuid,
       wf_s.value->>'postBackState' AS "postBackState"
FROM wf_s
     LEFT JOIN wf_r on wf_s._r_id = wf_r._r_id
WHERE wf_s.tag = 'postBackState';
```

```
 timeout |             server_uuid              | postBackState 
---------+--------------------------------------+---------------
    3810 | 1d5c4459-7550-4d17-c195-acb23deac36d | failed
    3810 |                                      | failed
    3810 | 1d5c4459-7550-4d17-c195-acb23deac36d | failed
(3 rows)
```

=========
### 10. Query `wf_m` jsonb column, report rows joined to `wf_s`

```
SELECT wf_m._m_id, 
       wf_m.name, 
       wf_m.params->>'wantResolvers' AS "wantResolvers", 
       wf_s.tag
FROM wf_m 
     LEFT JOIN wf_s on wf_m._m_id = wf_s._m_id 
WHERE wf_m.params->>'wantResolvers' = 'true';
```

```
  _m_id   |      name      | wantResolvers |   tag 
----------+----------------+---------------+-----------
 728CDB82 | add-nics-7.0.4 | true          | runner_id
 E2C62C04 | add-nics-7.0.4 | true          | 
 8ECB75ED | add-nics-7.0.3 | true          | 
 79A66507 | add-nics-7.0.3 | true          | 
...
 FF75FC10 | add-nics-7.0.3 | true          | 
(41 rows)
```

=========
### 11. Query `wf_m` jsonb column, report rows joined to repetitive values in `wf_r`


```
SELECT wf_m._m_id,
       wf_m.name,
       wf_m.params->>'wantResolvers' AS "wantResolvers", 
       wf_r._r_id,
       wf_r.execution
FROM wf_m
     LEFT JOIN wf_r on wf_m._r_id = wf_r._r_id 
WHERE wf_m.params->>'wantResolvers' = 'true';
```

```
  _m_id   |      name      | wantResolvers |              _r_id               | execution 
----------+----------------+---------------+----------------------------------+-----------
 37BD5642 | add-nics-7.0.3 | true          | 54e2c852a00c79ee0da2f866570c36df | failed
 EB707B28 | add-nics-7.0.3 | true          | 747652c7ad9756e85d560ebe9edba86a | succeeded
 1F7B0B8F | add-nics-7.0.3 | true          | 747652c7ad9756e85d560ebe9edba86a | succeeded
 BA7D563B | add-nics-7.0.3 | true          | ec86e78234c8befac68494c6fe765cea | succeeded
 52C0626D | add-nics-7.0.3 | true          | ec86e78234c8befac68494c6fe765cea | succeeded
 79A66507 | add-nics-7.0.3 | true          | 747652c7ad9756e85d560ebe9edba86a | succeeded
 A75E6F8F | add-nics-7.0.3 | true          | 54e2c852a00c79ee0da2f866570c36df | failed
 1904D80C | add-nics-7.0.3 | true          | 747652c7ad9756e85d560ebe9edba86a | succeeded
...
 7E07B682 | add-nics-7.0.3 | true          | 54e2c852a00c79ee0da2f866570c36df | failed
 4C4FBB60 | add-nics-7.0.3 | true          | 747652c7ad9756e85d560ebe9edba86a | succeeded
 2E70C81A | add-nics-7.0.3 | true          | 747652c7ad9756e85d560ebe9edba86a | succeeded
...
 696D8870 | add-nics-7.0.3 | true          | 747652c7ad9756e85d560ebe9edba86a | succeeded
 12CCE58E | add-nics-7.0.4 | true          | 628ca06a62424f4176daa69235986033 | succeeded
 728CDB82 | add-nics-7.0.4 | true          | 3e1813f08595d6f7ed8d4b4ab4f79efb | running
(41 rows)
```

=========
### 12. Query `wf_m`, report rows joined to `wf_r`, `wf_s`, order by timestamp.

```
SELECT wf_m._mtime,
       wf_m.name,
       wf_m.params->>'wantResolvers' AS "wantResolvers", 
       wf_s.tag, 
       wf_r.execution
FROM wf_m
     LEFT JOIN wf_s on wf_m._m_id = wf_s._m_id 
     LEFT JOIN wf_r on wf_m._r_id = wf_r._r_id 
WHERE wf_m.params->>'wantResolvers' = 'true'
ORDER BY wf_m._mtime ASC;
```

```
           _mtime           |      name      | wantResolvers |    tag    | execution 
----------------------------+----------------+---------------+-----------+-----------
 2014-03-11 20:16:16.355+00 | add-nics-7.0.3 | true          |           | succeeded
 2014-03-11 20:17:18.265+00 | add-nics-7.0.3 | true          |           | succeeded
 2014-03-11 21:09:19.294+00 | add-nics-7.0.3 | true          |           | succeeded
...
 2014-03-12 00:43:36.441+00 | add-nics-7.0.3 | true          |           | failed
 2014-03-12 00:44:26.472+00 | add-nics-7.0.3 | true          |           | failed
 2014-03-12 00:46:46.426+00 | add-nics-7.0.3 | true          |           | failed
 2014-03-13 00:04:21.011+00 | add-nics-7.0.3 | true          |           | succeeded
 2014-03-13 00:05:20.969+00 | add-nics-7.0.3 | true          |           | succeeded
 2014-03-13 00:11:01.909+00 | add-nics-7.0.3 | true          |           | succeeded
...
 2014-04-09 18:00:17.344+00 | add-nics-7.0.4 | true          |           | succeeded
 2014-04-09 18:27:01.422+00 | add-nics-7.0.4 | true          |           | succeeded
 2014-04-09 18:28:52.049+00 | add-nics-7.0.4 | true          |           | succeeded
 2014-04-09 18:29:50.012+00 | add-nics-7.0.4 | true          |           | succeeded
 2014-04-22 21:05:28.61+00  | add-nics-7.0.4 | true          | runner_id | running
(41 rows)
```

=========
### 13. Query `wf_r`, report rows joined to `wf_m`, order by timestamp

As anticipated, query hits to `wf_r` return large fractions of the 
database (when matching the column value in the majority).

```
SELECT wf_m._mtime,
       wf_m.name,
       wf_m.params->>'wantResolvers' AS "wantResolvers",
       wf_r.execution
FROM wf_r
     LEFT JOIN wf_m on wf_r._r_id = wf_m._r_id
WHERE wf_r.execution = 'succeeded'
ORDER BY wf_m._mtime ASC;
```

```
           _mtime           |           name            | wantResolvers | execution 
----------------------------+---------------------------+---------------+-----------
 2014-03-11 19:46:18.28+00  | server-sysinfo-1.1.0      |               | succeeded
 2014-03-11 20:16:16.355+00 | add-nics-7.0.3            | true          | succeeded
 2014-03-11 20:16:54.028+00 | provision-7.0.29          |               | succeeded
 2014-03-11 20:17:18.265+00 | add-nics-7.0.3            | true          | succeeded
 2014-03-11 20:34:50.527+00 | server-update-nics-1.0.0  |               | succeeded
...
 2014-03-11 21:40:29.319+00 | add-nics-7.0.3            | true          | succeeded
 2014-03-11 21:41:35.637+00 | import-remote-image-7.0.1 |               | succeeded
 2014-03-11 21:47:19.295+00 | add-nics-7.0.3            | true          | succeeded
...
 2014-04-11 22:44:06.622+00 | provision-7.0.30          |               | succeeded
 2014-04-11 22:44:36.652+00 | provision-7.0.30          |               | succeeded
 2014-04-11 22:45:06.609+00 | provision-7.0.30          |               | succeeded
(995 rows)
```

=========
### 14. Query `wf_r`, report rows joined to `wf_m`, `wf_s`, order by timestamp

Two examples here show that `wf_r` queries that retrieve most of the 
database (995 rows) for the major value `succeeded`, and a 
smaller fraction of the database (49 rows) for the minor value
`failed`, as expected.  

Here -use the "boilerplate" `wf_m` join. 
```
SELECT 
       wf_m._mtime,
       wf_m.name,
       wf_m.params->>'wantResolvers' AS "wantResolvers",
       wf_s.tag,
       wf_r.execution
FROM wf_m
     LEFT JOIN wf_s on wf_m._m_id = wf_s._m_id 
     LEFT JOIN wf_r on wf_m._r_id = wf_r._r_id 
WHERE wf_r.execution='succeeded'
ORDER BY wf_m._mtime;
```

No entries here hit sparse tags in the output:


```
           _mtime           |           name            | wantResolvers | tag | execution 
----------------------------+---------------------------+---------------+-----+-----------
 2014-03-11 19:46:18.28+00  | server-sysinfo-1.1.0      |               |     | succeeded
 2014-03-11 20:16:16.355+00 | add-nics-7.0.3            | true          |     | succeeded
 2014-03-11 20:16:54.028+00 | provision-7.0.29          |               |     | succeeded
 2014-03-11 20:17:18.265+00 | add-nics-7.0.3            | true          |     | succeeded
 2014-03-11 20:34:50.527+00 | server-update-nics-1.0.0  |               |     | succeeded
 2014-03-11 20:35:10.59+00  | server-update-nics-1.0.0  |               |     | succeeded
 2014-03-11 20:37:38.697+00 | import-remote-image-7.0.1 |               |     | succeeded
 2014-03-11 20:37:39.077+00 | import-remote-image-7.0.1 |               |     | succeeded
 2014-03-11 20:37:39.539+00 | import-remote-image-7.0.1 |               |     | succeeded
...
 2014-04-11 22:42:06.544+00 | provision-7.0.30          |               |     | succeeded
 2014-04-11 22:42:36.588+00 | provision-7.0.30          |               |     | succeeded
 2014-04-11 22:43:06.597+00 | provision-7.0.30          |               |     | succeeded
 2014-04-11 22:43:36.67+00  | provision-7.0.30          |               |     | succeeded
 2014-04-11 22:44:06.622+00 | provision-7.0.30          |               |     | succeeded
 2014-04-11 22:44:36.652+00 | provision-7.0.30          |               |     | succeeded
 2014-04-11 22:45:06.609+00 | provision-7.0.30          |               |     | succeeded
(995 rows)
```


Query the `wf_r` minor execution value `failed` - returns a small fraction of the database.

```
SELECT
       wf_m._mtime,
       wf_m.name,
       wf_m.params->>'wantResolvers' AS "wantResolvers",
       wf_s.tag,
       wf_r.execution
FROM wf_m
     LEFT JOIN wf_s on wf_m._m_id = wf_s._m_id 
     LEFT JOIN wf_r on wf_m._r_id = wf_r._r_id 
WHERE wf_r.execution='failed'
ORDER BY wf_m._mtime;
```

These hits do have some rare tag-values in `wf_s`.


```
           _mtime           |           name            | wantResolvers |      tag      | execution 
----------------------------+---------------------------+---------------+---------------+-----------
 2014-03-12 00:34:36.44+00  | add-nics-7.0.3            | true          |               | failed
 2014-03-12 00:41:36.466+00 | add-nics-7.0.3            | true          |               | failed
 2014-03-12 00:42:36.448+00 | add-nics-7.0.3            | true          |               | failed
...
 2014-03-14 16:36:20.517+00 | import-remote-image-7.0.1 |               |               | failed
 2014-03-14 16:36:32.078+00 | import-remote-image-7.0.1 |               |               | failed
 2014-03-25 00:11:37.037+00 | provision-7.0.29          |               | postBackState | failed
 2014-03-25 00:34:16.116+00 | provision-7.0.29          |               | postBackState | failed
 2014-03-25 00:35:06.102+00 | provision-7.0.29          |               | postBackState | failed
...
 2014-04-09 20:53:25.547+00 | destroy-7.0.3             |               |               | failed
 2014-04-09 20:53:25.598+00 | destroy-7.0.3             |               |               | failed
 2014-04-09 20:53:25.635+00 | destroy-7.0.3             |               |               | failed
 2014-04-09 20:53:25.91+00  | destroy-7.0.3             |               |               | failed
 2014-04-09 20:53:26.762+00 | destroy-7.0.3             |               |               | failed
 2014-04-09 20:56:25.963+00 | destroy-7.0.3             |               |               | failed
 2014-04-10 17:57:25.511+00 | destroy-7.0.3             |               |               | failed
(49 rows)
```




