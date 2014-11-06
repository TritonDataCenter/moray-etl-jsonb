<style>
body {
	font-family: Palatino, Times, serif;
	font-size: large;
	margin-top: 40px;
	margin-left: 15%;
	margin-right: 15%;
	line-height: 1.5em;
}
h2 {
	padding-top: 30px;
}
</style>


# Power-Law derived SQL Schema and loader automation for machine-generated JSON system data.


# High-Level Problem Statement:

Automate the naive conversion of arbitrary machine-written JSON data to a functional set of SQL tables. 
Here functional is defined as a balance between database size, query speed, query simplicity and 
employs relaxed normalization rules as typically found in SQL star-shcema. The system of tables 
should accomodate JSON tag-value elements that may be unforseen in schema design so as to avoid
JSON change-induced SQL schema regressions.



## Introduction and Practical Problem Statement

Both Joyent SDC7 and Manta employ a Moray highly-available key/value store storing JSON information 
created by a number of internal tools which use it to store state and relevant log information.
Moray is built on a Manatee system which provides a Zookeeper based highly-available PostgreSQL 9.x
database as a back-end store. Examples of SDC7 services employing Moray include  adminui, cloudapi, 
cnapi, dapi, fwapi, imgapi, keyapi, napi, papi, sapi, ufds, vmapi, and wf-api.
Moray's primary table is a bucket structure which maps each service to its storage tables.
Within each service's key/value store reside fields and the original JSON information used to create
each record in the `_value` field.

While Moray provides a system of record for SDC7 and Manta state, it is not well suited 
for ad-hoc queries, reporting or for the extraction of dashboard data. Part of this is due to the 
lack of JSON indexing in PostgreSQL (version < 9.4).  

Better JSON indexing may be obtained by using MongoDB or ElasticSearch. However both of these solutions
are incompatible with generic SQL connectors and as such require an intermediate layer or specialized
code for ad-hoc queries. This limits their utility as ad-hoc SQL query back-ends or for linkage to 
R or Tableau like systems via ODBC.

A more direct solution is to use a knowledge-based mapping of the JSON to a more queryable and 
scalable SQL table system. Conventionally the "knowledge" in this arises from a human expert carrying 
out an iterative approach in building and improving SQL tables from the JSON data. Guidelines for
generating schema are based on simple use cases. Many natural systems of information do not fit well 
into SQL structures designed with these approaches, e.g. graphs & hierarchies.

## Conventional SQL Table Design Approaches:

Star-schema (Simplified query)
 - centralized fact table
 - radiating dimension tables

Reverse-Star-schema (Simplified security)
 - centralized dimension table (e.g. security based field - like customer/user)
 - radiating fact tables, each with radiating, aliased dimension tables


## Challenges in schema design with JSON-first system data.

In the case of a complex JSON-first system like SDC7, it records complex state information without 
declaring some SQL schema into which all information must fit. It starts in a free form state of
informtion storage, which can lead to suboptimal query characteristics. The JSON is written by 
discrete code elements, each with their own cadence of invocation. A queryable SQL table set can 
only be created after data collection and analysis of the ouput JSON observed from a practical 
runtime instance.

### Incomplete JSON sampling and JSON skew.

Entrenching a set of SQL tables based on some sample of runtime JSON is imperiled by two problems.
First, the JSON output from code may be subject to a myriad of exception handling that can only be 
understood by examining the underlying source code. Sampling of JSON may miss some JSON structures
that are output by uncalled code in the sample set. Rare JSON elements may be missed, and in such a 
system the SQL table loading mechanism must be able to handle a JSON element it has not seen before.

Furthermore the JSON emitting code may experience updates and modifications, typically additions 
or splitting of fields such that the mapping of the underlying JSON to some fixed SQL table set may 
break. This regression problem is very familiar to the author from prior work with ASN.1 biology schema. 
Runtime regressions can be avoided by banning the removal of established JSON fields and only 
allowing the addition of new fields. As above, if the SQL table loading mechanism is able to handle new 
JSON elements, these additions can be incorporated without SQL tables breaking and database schema
regressions.

Given the large numbers of SDC7 and Manta services, declaring a set of candidate SQL tables to 
satisfy a robust ad-hoc query system can be a time-consuming proposition requiring many iterations.

However, because the data exists it should be possible to analyze the tag-value statistics
and arrive at a plausible SQL table schema based on applied information theory.



# Brief Theory:

In a system of organized information such as encapsulated in JSON records with multiple fields, it is 
important to understand the set of fields, the distribution of field use and the information encoded 
in each field. It is possible to descend into overanalysis of this information, thus two simplifications
are used.

## Entropy Estimation by Data Compression.

Shannon Entropy is a mathematical concept applying to the information content in some abstract encoding,
such as written language. Without recapitulating the formalism, it is noted here because it defines a 
lower-limit on the compressibility of information, i.e the smallest number of 'bits' of information that
a message carries.  

While computing Shannon Entropy on regular encodings is mathematically straightforwad, direct 
computation of Shannon Entropy on data with heterogeneous mixture of 
encodings (english text, hashes, timestamps, encrypted data, compressed images, etc) requires
detection of encoding and decomposition by type, which is not practical here.  

We still wish to know the quantity of information in a stream of such messages, and it is more 
straightforward to apply a compression engine and use the output as an estimate of information. 

## Power Laws and Simple Partitioning.

Software failures affecting the system such as hard drive error rates, internet file size 
traffic distribution, length distribution of jobs on supercomputers, and load distriubtions 
are all observed to fit an approximate Pareto principle, implying power law relationships. More 
than one hundred power law distributions are identified in physics, biology and social sciences. 

Without specifying the exact power law distribution, one may assert some relationship of probability 
to random variables exists with three common components, with some arbitrary thresholds separating them:

 
	P(x)   
	|.
	|
	| 
	| .
	|  
	|  .
	|   .
	|     .
	|         .
	|                    .
	+-|--------|-----------  x
	 1     2          3
	   
	1 - Frequently observed - Peak
	2 - Middle
	3 - Rarely observed - Long Tail

	Figure 1. Power Law partitioned into middle and edge cases.

In terms of databases reporting complex system information within conventional row-column table 
structures, The information distribution in columns may (or may not) follow a some kind of power 
law distribution, with some columns having a large number of repeating values (Peak), other columns 
having unique values in most database records (Middle), and other columns having sparse data values
(Tail).

In terms of database query, frequently observed or repetitious column values will find many matching 
records, whereas sparse columns will match few corresponding records, forming the edge cases.
Analysis of the exact power law distribution across columns is avoided as it makes no difference 
in the practical implementation whether the column information distribution is, for example, Pareto 
or Zipfian, and each column may have a different internal distribution.
 
For small numbers of database columns, this may not be sufficiently parameterized to precisely classify 
a 'meta' power law distribution, and furthermore heterogeneous information encoding does not offer an 
exact calculation of Shannon Entropy. We can only deal with generalizations of the edge cases of Peak and
Tail behavior based on the information we can readily measure in each column.

So the goal in this work is to match JSON tags and values to suitable SQL table column and row 
table structures that allow optimized searching of values whose tags/column information properties
fall into each of the three partitions in Figure 1. 


# Quantitative Approach:

Given that we have extensive JSON data from which SQL tables must necessarily be defined,
an outline of the approach is as follows:

- Extract JSON structure and tag-value statistics from the corpus of JSON data.
- Rank tags based on the information in their values.
- Determine a hieuristic score and threshold for tag/column classification. 
- Derive an SQL table design into which classified tags are mapped to tables and columns.
- Ensure the design satisfies the JSON skew problem.


## Information Scoring.

The quantities to be measured are defined in the following steps, which are 
considered at each level of JSON object nesting, recursively.

Identify the set of tags in bulk JSON. Each tag is a candidate SQL column.

Split bulk JSON records into separate column files (filenames denoted by tag), 
containing one value per line.

Enumerate the number of JSON records in which each tag:value pair is defined 
	
	D as 'defined' quantity

Enumerate the number of JSON records in which each tag:value pair is undefined or missing
	
	M as 'undefined' quantity 

where, for each tag, `D + M = N` where `N` is the number of total JSON records

Determine the number of unique values for each tag (e.g. `cat | sort | uniq`)
	
	U as 'unique' quantity

Determine the compressed size (in bytes) of the defined set of values/columns for each file from 1. 
	
	Ib is the information quantity in bytes, 


Given a Bunyan style (one line per record) JSON input file, shell scripts to extract the above 
quantities (requires json, daggr, split) and recurse through nested objects:

	Mappers 
	https://gist.github.com/cwvhogue/c8ea219486a33c75d3d6
	https://gist.github.com/cwvhogue/d6bd96a897420b22529a
	https://gist.github.com/cwvhogue/430a4bf603c74946eef2

	Reducers
	https://gist.github.com/cwvhogue/4af4d5f8973ecc76fd87
	https://gist.github.com/cwvhogue/6b131b5fb49f94336aae
	https://gist.github.com/cwvhogue/d1b85afe53e556c53fea

	Summary to .csv table
	https://gist.github.com/cwvhogue/c768110d1080f9643ed8



Compute for each tag:
Sparseness quantity as the ratio of number of values defined to total records.
	
   	Sp = (D / (D + M)) 

Complexity quantity as the ratio of unique values to defined values.
	
	Cx = (U / D) 


## Tag Partition Scoring Function - Middle Partition

Partitioning of tags that reside in the Middle, should eliminate those
tags/columns with sparse data or repetivive data.

A scoring function is derived that uses the `log2` ratios of Sparseness `Sp` and Complexity `Cx` to
adjust the Information quantity `Ib`. Recall that `Ib` is compressed byte size
of the values extracted from a given tag, which can range from a few bytes to terabytes. `Log2` is
chosen as the traditional base for information entropy. Given that `Ib > 1` if there is any data
in the tag, then `log2(Ib)` is always a positive value and when the Information quantity `Ib` is 1 byte, 
the quantity `log2(Ib)` is 0.

### The Middle partition scoring hieuristic is:
	
	Q = log2(Ib) + log2(Sp) + log2(Cx)

When every record has a value for the tag, `Sp = 1` and `log2(Sp) = 0`. As data becomes sparse, `Sp` 
approaches 0, so `log2(Sp)` will be negative. Small values of `Sp` are a feature of tags in the Tail.

When every instance of a value is unique for a tag/column `Cx = 1` and `log2(Cx) = 0`.
As a tag's value repeats itself, `Cx` approaches 0, so `log2(C)` will be negative. 

`Q` can never be larger than `log2(Ib)`, and may become significantly `< 0` as `Cx` or `Sp`
factors contribute. 

The sum of terms `log2(Ib) + log2(Sp) + log2(Cx)` becomes negative when combined contributions 
from Sparseness and/or Complexity dominate the scoring function.

For the first pass, JSON tags/columns with `Q>0` are partitioned into the middle region. While
this threshold could be altered up or downward, a score of `Q<0` is approximately interpretable as 
indicating that the tag/column has less than a byte's worth of information.

The remaining tags/columns are either too sparse (thereby wasting table space) 
or too repetitive (many/most rows would hold the exact same value, reducing its query utility,
and wasting table space).

## Patition Scoring - Peak or Long Tail

The `Cx` term can have significant error for small values of `Sp`. While small values of `Cx` and large
values of `Sp` are a feature of tags in the Peak, we avoid using `Cx` in classification.
Of the remaining tags classified by `Q`, `Sp` is sufficient to distinguish tags in the Peak or Tail.


After defining columns in the Middle, `Q>0`, the remaining columns
(if any) are categorized into the Long Tail depending on how sparse they are by `Sp`, and any 
remainder thereafter are asserted to be in the Peak.

Define the database partition fraction sufficient to declare a tag as sparse: 
	
	Fd = 0.15 

E.g. if values found in < 15% of the database records, that tag is classified as sparse by this 
threshold.

### Long Tail/Rare Tags/Sparse Columns
Defined when `Q` is negative (low information) and tag Sparseness value is less than
the database fraction:  
	
	(Q <= 0) && Sp < Fd    

### Peak/Low Complexity Tags/Repetitive Columns
Defined when Q is negative (low information) and tag Sparseness value is
greater than the partition fraction:
	
	(Q <= 0) && Sp >= Fd


Thus three quantities partitioned the JSON tags according to value quantities measured from the 
JSON corpus. 




# Template Power-Law Table Schema for JSON data bucket X.

To define a set of prototype SQL tables for these 3 partitions:


Long Tail: Rare Tags are not used as database columns. They are stored in 'Tag' and 'Value' fields.

	Rare Tag Table (`RTT`) Classifier:	
	(Q <= 0) && Sp < Fd    

Middle: High Complexity Tags are grouped as database columns in a separate table.
High Complexity Table (`HCT`) contains JSON tags mapped to columns for:

	High Complexity Table (HCT) Classifier:	
	Q = log2(Ib) + log2(Sp) + log2(Cx);  such that Q > 0 

Peak: Low Complexity Tags are grouped as database columns in a separate table..
Low Complexity Table (`LCT`) contains JSON tags mapped to fields for:
	
	Low Complexity Table (LCT) Classifier:
	(Q <= 0) && Sp >= Fd 



Tables appear in order of Query specificity. 
 
	Long Tail:
	Rare Tag Table
	+---------------+
	| X_RTT         |
	+---------------+
	| PK x_rtt_id   |\____________
	| FK x_hct_id   |/            |
	| FK x_lct_id   |             |
	|               |             |
	| Tag           |             |
	| Value         |             |
	|               |             |
	| Nest_Level    |             |
	| Parent_Tag    |             |
	+---------------+             |
	                              |
	Middle:                       |
	High Complexity Table         |
	+---------------+             |
	| X_HCT         |-||----------+
	+---------------+
	| PK x_hct_id   |\______      
	| FK x_lct_id   |/      |
	|               |       |
	|               |       |
	| name          |       |
	| package       |       |
	| uuid          |       |
	| start_time    |       |
	| ...           |       |
	+---------------+       |
	                        |
	Peak:                   |
	Low Complexity Table    |
	+---------------+       |
	| X_LCT         |-||----+
	+---------------+
	| PK x_lct_id   |  
	| hash          |
	|               |
	| timeout       |
	| num_attempts  |
	| expects       |
	| ...           |
	+---------------+

	Figure 2. Power Law Schema Table Template Structure 


# Power Law Schema Query Behavior

## Long Tail Queries on the Rare Tag Table (`RTT`)

The number of `RTT` records in the database will be smaller than the number of records in the JSON
(unless the JSON is peppered with large numbers of obscure and random tags). One JSON input record 
may have multiple `RTT` records.

A JSON tag classified into the `RTT` will not appear in the `HCT` or `LCT` table schema. 
A query against a rare tag will return some small number of records `Ra` from the database in the range 
of `0 < Ra < (N * Fd)` which contain that tag, and then some smaller number of records with the matching
value. Reconstruction of the entire record is facilitated by finding other `RTT` entries with the same
`hct_id`, then foreign key lookup from the `RTT` into both the `HCT` and `LCT`.


## Middle Queries on the High Complexity Table (`HCT`)

The number of `HCT` records in the database will match the number of records in the JSON, (unless
the JSON itself has no observable High Complexity tags - which would make it fairly useless for query). 

A JSON tag classified in the `HCT` can be value-queried directly, and will return some number of records
`Rb` from the database in the range of `(0 < Rb < N)`.  When an exact query is matched, a 
reasonablly small number of records (often, `Rb = 1`) will be returned as fields in this table 
are selected for non-repetitive values (e.g. UIDs, timestamps) by the partitioning mechanism. 
A query hit on the `HCT` will rarely return `N` records unless is is a short substring or wildcard query.

Reconstruction of the entire JSON record is facilitated by foreign keys lookup from `HCT` to `LCT`, 
and by a query to the `RTT` using its foreign key `hct_id`. 


## Peak Queries on the Low Complexity Table (`LCT`)

Through classification, data in this this table is not very useful for specific queries, and one 
should expect large numbers of hits when making queries of tag-values in this table.

A JSON tag classified in the `LCT` can be queried directly, and will return some number of records
`Rc` from the database in the range from `(0 < Rc <= N)`.  When a single tag:value query is matched, 
a large number of equivalent JSON records may will be returned, in the range 
`((N * (1 - Fd)) < Rc < N)`, owing to the fact that tags in this table are selected based on the 
repetition of values.

The number of `LCT` records in the database will be smaller than the number of JSON records, owing
to the repetitive nature of the data. While combinatorics of the accumulated tag-value pairs in the
`LCT` is conceivably high, in practice `LCT` size is constrained by observed sets of tag-values in the 
input JSON. Sets of repeated values observed in the input JSON are stored in single `LCT` records. Given
the information score `Q<=0` cutoff, for each tag placed in the `LCT`, the entire set of tags has little 
variation and one may expect highly correlated tag-value pairs to accumulate in few `LCT` records. 

A hit to an `LCT` table record is unlikely to match a single `HCT` JSON entry, thus one will, in 
nearly all cases, be retrieving multiple `HCT` records. 

Reconstruction of each JSON record in the set is facilitated by retrieving the `x_lct_id` and 
querying the HCT records with its foreign key `x_lct_id` to retrieve the `HTC` set, then following as above.



# Automating JSON to SQL Table Definitions and Loaders

Steps:

1. For each tag, measure `D`, `M`, `U`, `Ib`, and maximum value length
2. Map value type to SQL data type
3. Data Reduction: Compute `Sp`, `Cx`, `Q` for each tag 
4. Tag/Column Classification: `HCT` Middle, `RTT` Long Tail, `LCT` Peak
5. Instantiate Tags, SQL data type, max value length in Template SQL Tables
6. Loader Tool Input: JSON Data, Template SQL Tables, Tag/Column classifications,  Hash for `LCT` 
7. Run Loader tool.
8. Iterate through any nested JSON and as required
9. Iterate through connectivity of multiple Power-Law Schemas to create a "Star-Power Schema"


# Business Lift and Additional Notes

* Reporting Database to play a dual role for Joyent JPC and Mininal footprint SDC.
* Core reporting database for SDC to share structure with expanded JPC reporting database.
* Reporting db need not be HA, nor persistant, in principle it is instantiated from Moray ETL.
* SQL access into Reporting db offers ecosystem of connectors (Tableau, R, ODBC, ...)
  which are difficult to implement with a Moray connection and key-value store queries.

* Moray is a good HA write optimized database of record, but performs poorly as a query database 
  for retrieving tables of values for numeric reporting and plotting from its store
* Bunyan paradigm 'best practice' means engineers are driving JSON from within code, 
  SQL tables must adapt schema after data is instantiated from upstream.
* Any new APIS (e.g. fwAPI) will produce new unstructured JSON with systems reporting information.
* Refactoring reporting SQL from an upstream JSON regressions must be minimized, the 
  reporting schema must not be brittle and withstand new JSON tags in production.
* Well behaved JSON cases - no long tail, no peak, only one table is necessary.
* Power Law assumptions should be well matched to machine-generated event data.

* Quantitative approach for mapping JSON->SQL lends itself to a DB loader tooling,
  minimizing custom code and rules.
* Quantitative mapping of JSON->SQL with rules minimizes required human specialization in 
  schema design.
* General purpose tooling to load JSON->SQL can be applied to every Moray bucket required in reporting.
* Tables, Field sizes, types, and database query edge cases are anticipated up front, not
  waiting for rounds of iteration to find and fix the problem.
* SQL data mapping intended to allow the mapped JSON entities to be jettisoned, depending on
  complexity, e.g. array values may be maintained as subset JSON stuctures.
* Direct table manipulations (modifications) are discouraged/prohibited, only JSON record load
  and JSON record remove operations will be supported to ensure record integrity. 
* The system should support a mechanism to dump the equivalent input JSON records to check integrity.


