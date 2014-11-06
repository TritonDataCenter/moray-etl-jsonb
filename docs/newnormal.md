# Power Schema for PostgreSQL 9.4 SQL + JSONB: A new normalization approach for JSON data importing.

The concepts for relational database systems arrived in the E. F. Codd
paper of 1970, complete with a description of normalization algorithm for 
conversion of data represented in a hierarchical collection.

	"Starting with the relation at the top of the tree, take its 
	primary key and expand each of the immediately subordinate 
	relations by inserting this primary key domain or domain combination. 
	The primary key of each expanded relation consists of the primary 
	key before expansion augmented by the primary key copied down from 
	the parent relation. Now, strike out from the parent relation all 
	nonsimple domains, remove the top node of the tree, and repeat the 
	same sequence of operations on the remaining subtree."

With Codd's accompanying figure one can immediately see how this simple
procedure would provide guidance in the problem of converting modern JSON 
into an appropriate set of SQL tables.

However SQL itself has changed, and Codd's view of simple vs nonsimple domains
has been reimagined in light of new nonsimple types that can be stored within
SQL columns. In this work we consider approaches for importing and normalizing 
JSON data in light of new PostgreSQL 9.4 JSONB type. This new feature 
embeds Codd's undesired hierarchical relation within the SQL column, and 
expands SQL grammar for index and access of internal key-value information
with the JSONB field. 

At first glance, this new feature would make it seem as though normalization 
is completely unnecessary. In fact - there are now two extremes. One could 
normalize data with Codd's procedure out to the well known pain point of 
too many small tables, or one can elect to not normalize at all and 
store all JSON in one JSONB field.

In this work I argue that JSON importing into this system is best done
with a process of normalization that lies in between these extremes, and
show the implementation of such a system.

For the extreme case of no-normalization, let me begin by discussing the
pain points. Consider a JSONB object with internal values assumed to integer, 
floating point, UIID or timestamp. Imported within JSON, these values are 
not parsed or validated at database load time. They are simply loaded and 
represented as strings within the JSONB field.  At query time each value in
a row must be explicitly `CAST` from string to the valid SQL type to 
facilitate logical operations like `=`, `<`, `>`, `BETWEEN` as well as all
numeric operations and `GROUP BY` - `SUM` aggregations.

It is not difficult to imagine that query time will be more performant with
these structured values in native SQL types where the overhead of parsing and 
range validation was accomplished at load time and casting is not necessary at 
query time.

The larger challenge in the no-normalization case is a late discovery that 
a crucial internal JSONB value is malformed and cannot be properly parsed 
or cast. These errors are easier to root cause and fix at load time, rather 
than wait for an ad-hoc query to emerge that brings them to the surface. For 
example, consider software that emits the JSON `{"last_updated": "default"}` 
when it should be emitting an formatted timestamp string or a null value. 
As is, this would load into a JSONB record without detection of the field 
inconsistency, where it will lie in wait and break ad-hoc queries. 
A `BETWEEN` SQL query to return records within two time point ranges will 
halt on this inconsistency when it attempts to CAST the value.

The argument here is that the optimal point for normalization is a mix
of columns with the appropriate native SQL types and the JSONB type. 
In this new-normalization model, native PostgreSQL singleton or array types 
containing integers, floating point numbers, uuids, timestamps, mac addresses,
and IP addresses are preferred to JSONB array forms because they are all 
validated and cast at load time, and will not result in failures at query time.

Another challenge is tag-value information complexity. No longer do we
need to recursively extract tables as Codd imagined, but there are still
cases where repetitive or sparse JSON tag-value information can lead to 
highly suboptimal table layouts.

In this work, two edge cases of sparse or repetitive JSON data are detected 
with a heuristic based on Shannon Information theory and are classified 
into a set of tables designed to handle these edge cases. As well the design 
maintains the flexibility of JSON and schema-free input by providing for 
storage of any unanticipated JSON key-value pair that may later appear in 
data, the kind of upstream regression that would otherwise break a fixed 
SQL table schema under the old normalization regime.

So to carry out this new normalization, the following steps are described
and implemented as a freely scalable pipeline of operations.

1. Raw JSON analysis and Power Schema tag classification.
2. Raw JSON reorganized and split into 1-3 Power Schema JSON files.
3. PostgreSQL type and array inference and table declaration from 
   Power Schema JSON files.
4. Conversion of Power Schema JSON file to PostgreSQL compatible 
   tab-separated value load file.
5. PostgreSQL loading of table schema and tab-separated values.


## Worked Example - JSON Conversion to a 3-table SQL System

To illustrate steps 1 and 2, the automatic classification of key-value 
information into a database schema, it is best to start with a worked 
example with simple set of JSON records with visible single characters as 
tags and values. I begin by showing the inputs and outputs of step 2 and 
the results and benefits of the Power Schema reorganization. Then I explain 
the analysis and heuristics used in step 1 and show how it relates to 
Power Law distributions of data. 

First consider some simple JSON input, a one line per JSON entry file
 `vischars.json`

	{"A":"a","B":"z","C":"1","D":"t","E":"~","F":".","G":"$","J":"/","K":"-","N":"!","P":"."}
	{"A":"b","B":"y","C":"2","D":"f","E":"~","F":".","G":"$","K":"=","N":"@","P":"."}
	...
	{"A":"x","B":"c","C":"4","D":"f","E":"~","F":".","G":"$","I":">","K":"=","M":"@","N":"&","O":".","P":"."}
	{"A":"y","B":"b","C":"5","D":"t","E":"~","F":".","G":"$","K":"-","L":"~","N":"^","P":"."}
	{"A":"z","B":"a","C":"6","D":"f","E":"~","F":".","G":"$","K":"+","N":"%","P":"."}

Or for a more human readable view:

`vischars.json` line 1:

	{
	  "A": "a",
	  "B": "z",
	  "C": "1",
	  "D": "t",
	  "E": "~",
	  "F": ".",
	  "G": "$",
	  "J": "/",
	  "K": "-",
	  "N": "!",
	  "P": "."
	}

`vischars.json` line 24:

	{
	  "A": "x",
	  "B": "c",
	  "C": "4",
	  "D": "f",
	  "E": "~",
	  "F": ".",
	  "G": "$",
	  "I": ">",
	  "K": "=",
	  "M": "@",
	  "N": "&",
	  "O": ".",
	  "P": "."
	}


For the JSON data under consideration, stripping away the JSON and rendering
it as a matrix of values, the example input would look like this, where
blanks indicate that a given json tag-value pair is not supplied in the input.

	                       vischars

	         A  B  C  D  E  F  G  H  I  J  K  L  M  N  O  P 
	  _____________________________________________________
	   1 |   a  z  1  t  ~  .  $        /  -        !     .
	   2 |   b  y  2  f  ~  .  $           =        @     .
	   3 |   c  x  3  t  ~  .  $           -        #     .
	   4 |   d  w  4  f  ~  .  $     >     =        $     .
	   5 |   e  v  5  t  ~  .  $           -  ~     %     .
	   6 |   f  u  6  f  ~  .  $           =        ^  .  .
	   7 |   g  t  7  t  ~  .  $  @        +        &     .
	   8 |   h  s  8  f  ~  .  *           +        *     .
	   9 |   i  r  9  t  ~  .  $           -     #  *     .
	  10 |   j  q  0  f  .  ?  $        \  =        &     .
	  11 |   k  p  1  t  ~  .  $           -        ^     .
	  12 |   l  o  2  f  ~  .  $     <     =        %     .
	  13 |   m  n  3  t  ~  .  $           -        $     .
	  14 |   n  m  4  f  ~  !  $           =        #     .
	  15 |   o  l  5  t  ~  .  $           +        @     .
	  16 |   p  k  6  f  ~  .  $           =        !     .
	  17 |   q  j  7  t  ~  .  &           +        @     .
	  18 |   r  i  8  f  ~  .  $           -        #  .  .
	  19 |   s  h  9  t  ~  .  $           -     @  $     .
	  20 |   t  g  0  f  .  %  $           =        %     .
	  21 |   u  f  1  t  ~  .  $           +        ^     .
	  22 |   v  e  2  f  ~  .  $        /  +        &     .
	  23 |   w  d  3  t  ~  .  ^           -        *     .
	  24 |   x  c  4  f  ~  .  $     >     =     @  &  .  .
	  25 |   y  b  5  t  ~  .  $           -  ~     ^     .
	  26 |   z  a  6  f  ~  .  $           +        %     .


If this was converted into an SQL table, with addition of simple 
small integer row number as primary key, it would correspond to a table 
with 17 columns and 26 rows.

Observe that some of the columns have repeated values, and other columns are 
mostly blank with a few sparse entries.  
  
Imagine we can detect all the columns with repeated values, remove them and 
then compress them into a small number of rows on a separate but linked table. 
This table will have rows corresponding to all the unique combinations of 
column values that appear in the above table.

And imagine we can detect the sparse columns and reduce these all down to 
two columns indicating the original column tag and value, and columns with 
identifiers linking these back to the row from which these arose.

So instead of a simplistic table as visualized above, 
we will split in input JSON into 3 tables:

	vischars_m  a main (_m) table with the edge case columns removed, 
	            and adding primary key _m_id and foreign key _r_id 
	
	vischars_r  a repetitive (_r) table with the case 1 columns, 
	            fewer rows, and primary key _r_id
	
	vischars_s  a sparse (_s) table with the sparse columns fit 
	            into a key-value representation, with primary _s_id 
	            and foreign _m_id keys

Transforming the input JSON data according to this scheme with
some method to detect the underlying SQL types would yield the 
following 3 tables:

`vischars_m`

	CREATE TABLE vischars_m (
	   _m_id smallint,
	   _r_id smallint,
	   A char(1),
	   B char(1),
	   C smallint,
	   N char(1)
	);

	
	_m_id  _r_id A B C N
	___________________
	   1 |    1  a z 1 !
	   2 |    4  b y 2 @
	   3 |    1  c x 3 #
	   4 |    4  d w 4 $
	   5 |    1  e v 5 %
	   6 |    4  f u 6 ^
	   7 |    6  g t 7 &
	   8 |    6  h s 8 *
	   9 |    1  i r 9 *
	  10 |    7  j q 0 &
	  11 |    1  k p 1 ^
	  12 |    4  l o 2 %
	  13 |    1  m n 3 $
	  14 |    8  n m 4 #
	  15 |    6  o l 5 @
	  16 |    5  p k 6 !
	  17 |    9  q j 7 @
	  18 |    3  r i 8 #
	  19 |    1  s h 9 $
	  20 |   10  t g 0 %
	  21 |    2  u f 1 ^
	  22 |    5  v e 2 &
	  23 |   11  w d 3 *
	  24 |    4  x c 4 &
	  25 |    1  y b 5 ^
	  26 |    5  z a 6 %
	      6c x 26r

`vischars_r`

	CREATE TABLE vischars_r (
	   _r_id smallint,
	   D boolean,
	   E char(1),
	   F char(1),
	   G char(1),
           K char(1),
           P char(1)
	);

	
	_r_id   D E F G K P
	___________________
	   1 |  t ~ . $ - .
	   2 |  t ~ . $ + .
	   3 |  f ~ . $ - .
	   4 |  f ~ . $ = .
	   5 |  f ~ . $ + .
	   6 |  f ~ . * + .
	   7 |  f . ? $ = .
	   8 |  f ~ ! $ = .
	   9 |  t ~ . & + .
	  10 |  f . % $ = .
	  11 |  t ~ . ^ - .
	     7c x 11r

`vischars_s`

	CREATE TABLE vischars_r (
	   _s_id smallint,
	   _m_id smallint,
	   Tag  char(1),
	   Value char(1),
	);

	_s_id _m_id Tag  Value
	______________________
	   1 |    1    J     /
	   2 |    4    I     >
	   3 |    5    L     ~
	   4 |    6    O     .
	   5 |    7    H     @
	   6 |    9    M     #
	   7 |   10    J     \
	   8 |   12    I     <
	   9 |   18    O     .
	  10 |   19    M     @
	  11 |   22    J     /
	  12 |   24    I     >
	  13 |   24    M     @
	  14 |   24    O     .
	  15 |   25    L     ~
	       4c x 15r



With these two edge cases split out, note that there are only 293 cells in the
3-table representation (including new indexes), making it 34% smaller than the
442 cells of the first matrix representation of the input JSON. 

SQL Queries between these 3 tables are supported by the primary key (PK) and 
foreign keys (FK) as indicated:

	+---------------+
	| varchars_s    |
	+---------------+
	| PK _s_id      |
	|               |        
	| FK _m_id      |\______ 
	| Tag           |/      |
	| Value         |       |
	+---------------+       |
	                        |
	+---------------+       |
	| varchars_m    |-||----+
	+---------------+
	| PK _m_id      |
	|               |     
	| FK _r_id      |\______
	| A             |/      |
	| B             |       |
	| C             |       |
	| N             |       |
	+---------------+       |
	                        |
	+---------------+       |
	| varchars_r    |-||----+
	+---------------+
	| PK _r_id      |
	| D             |
	| E             |
	| F             |
	| G             |
	| K             |
	| P             |
	+---------------+

In this schema design, note that `varchars_s` resembles a key-value store, 
and `varchars_s` resembles a hashed index. In the implementation, indeed 
these are generalized such that the `_s` table is a JSONB based key-value
store and the `_r` table primary key is implemented as a hash of its contents,
facilitating collection of all possible `_r` table row values and simple 
elimination of redundant entries. Another foreign key `_r_id` may be optionally 
added to the `varchars_s` table to link those two directly.

## Heuristic for JSON tag 3-table classification

This three table transformation is step 2 of the process, but I have
shown the transformation first with this simple example in order to 
present the methodology for choosing columns and classifying them into the
three tables, which comprises step 1. 

Rather than observing column redundancy and sparsity by eyeball, I use 
a quantitative heuristic based on Shannon Information and carry out a 
lightweight analysis of the column information in the input JSON. 

In this example above, all columns are single characters, which makes the 
calculation of Shannon Information simple and equivalent for each column.

We define some column quantities:

	U  (Unique)  Number of unique values (characters) in the column.
	D  (Defined) Number of rows with values present.
	M  (Missing) Number of rows with missing values.

Some derived quantities:

	N  = (D + M) Row Count.
	Ib = log2(U) Shannon Information. 
	Cx = (U / D) Complexity - odds that a value is unique.
	Sp = (D / N) Sparseness - odds that a row has a value.

The Shannon Information quantity log2(U) is the number of bits required 
to represent a variable that can take one of U values. 

We also define two thresholds for classification:

	Im = 0    Information threshold value in bits.
	Fs = 0.15 Fraction of database below which is considered sparse.

A heuristic for the `_m` table partition score is based on 
a column's Information, Sparseness and Complexity, and given in Shannon
Information units of bits:

	Q = Ib + log2(Sp) + log2(Cx)  

The Q score adjusts the Information in a column downward by means 
of logarithmic addition whenever Sparseness (Sp) is < 1 and/or when 
Complexity (Cx) is < 1. This can result in fractional or negative 
bit values for Q. The Im threshold is set to 0, indicating that if a 
row value is likely to hold less than a bit of information, it is not 
suited for the `_m` table. 

These are the logical rules for column classification

        _m whenever (Q > Im)
        _r whenever (Q < Im) && (Sp > Fs)
        _s whenever (Q < Im) && (Sp < Fs)

With the quantities calculated for this JSON input example we can
arrive at the 3 rightmost columns which are the table classifications.

	     U    D    M    Ib	    Sp	    Cx	     Q	    _m  _r  _s
	__|____________________________________________________________
	A | 26   26    0   4.7004  1.0     1.0      4.7004   x
	B | 26   26    0   4.7004  1.0     1.0      4.7004   x	
	C | 10   26    0   3.3219  1.0     0.3846   1.9434   x	
	D | 2    26    0   1.0     1.0     0.0769  -2.7004       x	
	E | 2    26    0   1.0     1.0     0.0769  -2.7004       x	
	F | 4    26    0   2.0     1.0     0.1538  -0.7004       x	
	G | 4    26    0   2.0     1.0     0.1538  -0.7004       x	
	H | 1     1   25   0.0     0.0385  1.0     -4.7004           x
	I | 2     3   23   1.0     0.1154  0.6667  -2.7004           x
	J | 2     3   23   1.0     0.1154  0.6667  -2.7004           x
	K | 3    26    0   1.5850  1.0     0.1154  -1.5305       x	
	L | 1     2   24   0.0	   0.0769  0.5     -4.7004           x
	M | 2     3   23   1.0	   0.1154  0.6667  -2.7004           x
	N | 8    26    0   3.0	   1.0     0.3077   1.2996   x		
	O | 1     3   23   0.0	   0.1154  0.3333  -4.7004           x
	P | 1    26    0   0.0	   1.0     0.0385  -4.7004       x	

The column partitioning heuristic values plotted (as Q vs Sp) with 
threshold values Im and Fs can be visualized in this approximate ascii graph.

	 5.0 - 
	     |                        AB
	     |                        
	     |                    (_m)   
	     |                         C
	     |                         N
	     |                     
	 0.0 --------------------------| Im                         
	     |    |       Sp          1.0
	     |    |                 
	 Q   |    |                   FG
	     |    |Fs = 0.15           K      
	     |(_s)|                    
	     |IJM |              (_r) DE
	     |HLO |                    P
	 -5.0-    
          

Now you can see how the 3-table split shown previously corresponds to this 
quantitative classification based on the input JSON key-value data.

	vischars_m 
	JSON keys: A,B,C,N,K

	vischars_r 
	JSON keys: D,E,F,G,K,P

	vischars_s 
	JSON keys: H,I,J,L,M,O

Note that the 3-table solution calculated is a sub-optimal solution, as
when row K is classified into the _m table, there are only 290 cells in
the resulting 3-table system.  Hence this partitioning is a heuristic and
not guaranteed to provide the optimal solution, and in some cases adjustments
of threshold Im for certain columns may provide other solutions.

## Power Law edge cases and the 3-table Power Schema.

This quantitative heuristic for the 3-table split works in part because
of the tendency for real data to follow one of many power law distributions.

Software failures affecting the system such as hard drive error rates, 
internet file size traffic distribution, length distribution of jobs on 
supercomputers, and load distributions are all observed to fit an approximate 
Pareto principle, implying power law relationships. More than one hundred 
power law distributions are identified in physics, biology and social 
sciences.

Without specifying the exact power law distribution, one may assert 
some relationship exists of probability to random variables that follows 
a power law, with three common components, with some arbitrary threshold
separating these components:


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
        3 - Rarely observed     - Tail

        Power Law partitioned into middle and edge cases.

Analysis of the exact power law distribution in each columns is avoided as
it makes no difference in the practical implementation whether the column 
information distribution is, for example, Pareto or Zipfian, and as 
well, each column may have a different internal distribution. 

In terms of databases reporting complex system information within JSON logs,
the information distribution typically follows a Power Law, with some JSON
keys having a large number of repeating values (e.g. software version number
or process ID) other keys having unique values in most database records (e.g.
UUIDs, timestamps), and other keys having sparse data values (e.g. rare errors).

In terms of database query, frequently observed or repetitious column
values will find many matching records, whereas sparse columns will match 
few corresponding records, corresponding to the two edge cases. 

To scale this up, note that in real data (not columns of single characters)
the Shannon Information Ib is not exactly the same for higher-ordered 
encodings of bulk information. Instead I use bzip2 compression as a proxy 
for Shannon Information, and use the number of bytes B in the 
bzip2 compressed file containing the unique values in the column, hence Ib is 
log2(B) which leaves the score in bit units.  The compression algorithm acts 
to reduce the effective information score for complex fields with internal 
repetition that would otherwise produce a larger value if the simple metric 
Ib = log2(U) was employed.  

# Implementation

While the problem of normalization of JSON to PostgreSQL 9.4 SQL+JSONB
is a generalizable one, the implementation case for tool development is
worth mentioning as its requirements motivated much of the work.

Both Joyent SDC7 and Manta employ Moray, a highly-available key/value store 
for storing JSON information created by a number of internal tools. Moray 
saves system state and relevant log information. Moray is built on a Manatee 
system which provides a Zookeeper based highly-available PostgreSQL 9.3 
database as a back-end key-value store for each service endpoint. 
Examples of SDC7 services employing Moray include the virtual machine 
api (vmapi), the user account api (ufds), the compute node api (cnapi) 
and the workflow api (wf-api). 

Moray's primary table is a bucket structure which maps each service to its 
storage tables. Within each service's key/value store reside fields and 
the original JSON information used to create each record in the `_value` 
JSON typed field.

While Moray provides a system of record for SDC7 and Manta state, it is 
not well suited for ad-hoc queries, reporting or for the extraction of 
dashboard data. Part of this is due to the lack of JSON indexing in 
PostgreSQL (version < 9.4). Another part is due to the difficulty that
arises in that matching items buried in json fields between buckets 
requires a full table scan and JSON parsing by tools external to 
PostgreSQL. 

Certainly better JSON indexing may be obtained by using MongoDB or 
ElasticSearch. However both of these solutions are incompatible with 
generic SQL connectors and as such require an intermediate layer or 
specialized code for ad-hoc queries. This limits their utility as 
reporting databases for SQL-based tools like R or Tableau which can
connect via ODBC.

### Challenges in schema design with JSON-first system data.

Within this system there is no formal data modeling process, the data
model emerges from the apperance of JSON data. The system records complex 
state information without declaring some SQL schema into which all 
information must fit. Field validation has not been performed on the
JSON data, other than for its ability to be parsed as JSON, which
is insufficiently strict for many SQL types.

The JSON records in each Moray bucket arise from discrete software 
parts that comprise each system, each with their own cadence of invocation,
and power-law behavior is generally observed in the data.

### Flexibility and resilience from incomplete JSON sampling and JSON skew.

Entrenching a set of SQL tables based on some sample of runtime JSON is 
imperiled by two problems. First, the JSON output from code may be subject to 
a myriad of exception handling that can only be understood by examining the 
underlying source code. Runtime sampling of JSON emitted may miss JSON 
structures that are output by unexplored code paths. Rare JSON elements may be 
missed in a sample, thus SQL table loading mechanism must be able to 
handle a JSON element it has not seen before.

Furthermore the JSON emitting code may experience updates and modifications, 
typically additions or splitting of fields such that the mapping of the 
underlying JSON to some fixed SQL table set may break. This regression problem 
is very familiar to the author from prior work with ASN.1 biology schema. 
Runtime regressions can be avoided by banning the removal of established JSON 
fields and only allowing the addition of new fields. As above, if the SQL 
table loading mechanism is able to handle new JSON elements, these additions 
can be incorporated without SQL tables breaking and database schema regressions.

Fortunately the 3-table system offers a convenient solution, that is the `_s`
table itself is structured as a key-value store, such that any unanticipated
or new key-value pair arising in the JSON can be placed in the `_s` table,
without requiring any change to the schema.

Repo:


### 1. Raw JSON analysis and Power Schema tag classification.

One-line per JSON file.  Uniform (e.g. metadata JSON or schema details stripped 
down to column names).

npm tools required (json, daggr)

Tooling in

	moray-etl-jsonb/measure



### 2. Raw JSON reorganized and split into 1-3 Power Schema JSON files.

#### Creating the JSON manifest _tojson.js and JSON manifest for moraydump_reorg.js

Editing _tojson.js
Running it to make the JSON manifest.

Wrapped Streaming JSON Form of Row 1, 24

	{"name":"vischars","keys":["id","_value"]}
	{"entry":["1","{\"A\":\"a\",\"B\":\"z\",\"C\":\"1\",\"D\":\"t\",\"E\":\"~\",\"F\":\".\",\"G\":\"%\",\"K\":\"=\",\"N\":\"@\",\"P\":\".\"}"]}
	...
	{"entry":["24","{\"A\":\"x\",\"B\":\"c\",\"C\":\"4\",\"D\":\"f\",\"E\":\"~\",\"F\":\".\",\"G\":\"%\",\"I\":\">\",\"K\":\"=\",\"M\":\"@\",\"N\":\"&\",\"O\":\".\",\"P\":\".\"}"]}
	...

#### Wrapping tool 

#### Splitting with moraydump_reorg.js


### 3. PostgreSQL type and array inference and table declaration from Power Schema JSON files.

#### Type inference methodology

 json2sqltypes.js as a meta state machine
 type matching vs type validation
 promotion of conflicting types
 aggregation of value sizes, numeric parameters, array sizes, etc.
 detecting arrays with only singleton values.
Types detected list
   arrays - native where possible
   numeric - smallest form to fit largest number
   varchar - no padding.
   
 Map/Reduce tool to consolidate partial results. 
 Final resolution of SQL types based on the type state at end.

Padding and SQL output file modifications.

### 4. Conversion of Power Schema JSON file to PostgreSQL compatible tab-separated value load file.

json_tsv.js 
Why tsv?  Fast load form. Tabs can be easily escaped, less common than commas in input data.
Conversion of JSON to PostgreSQL tsv encoding requires type informtion. Insertion of type
dependent null data. Singleton arrays are unwrapped. 


### 5. PostgreSQL loading of table schema and tab-separated values.

SQL and .tsv files
WHAMMO! 


### Scaling up with Map-Reduce

moray-etl-jsonb/manta directory


Unix split and header copying.
Type reducer

Pipeline diagram.





----------- end.


Tooling to compute these are found in the moray-etl-jsonb/measure subdirectory
in the form of bash scripts. The input JSON must be in one-line-per json record format
and there must be no spaces within top level key names (but they can be in nested key names).


Implementation of _s - links to _r, and JSONB storage of value. 

	vischars_s (Sparse Table)
	_s_id _m_id _r_id Tag    Value
	  1     1    1    J    {"J":"/"}
	  2     4    1    I    {"I":">"}
	  3     5    1    L    {"L":"~"}
	  4     6    1    O    {"O":"."}
	  5     7    1    H    {"H":"@"}
	  6     9    1    M    {"M":"#"}
	  7    10    3    J    {"J":"\"}
	  8    12    1    I    {"I":"<"}
	  9    18    1    O    {"O":"."}
	 10    19    1    M    {"M":"@"}
	 11    22    1    J    {"J":"/"}
	 12    24    1    I    {"I":">"}
	 13    24    1    M    {"M":"@"}
	 14    24    1    O    {"O":"."}
	 15    25    1    L    {"L":"~"}
	* 5c x 15r





