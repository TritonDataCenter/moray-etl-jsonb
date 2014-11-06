#!/bin/bash


# 1. Extract _values from PostgreSQL Moray dump for analysis.

# 


# 2. Analyze and partition keys 

# 3. Create JSON manifest for splitting
# ./wf_keys_tojson.js


# 4. Split PostgresQL Moray dump
cat wf_jobs.json | ./moraydump_reorg.js -t ./wf_keys.json

# 5. Unique the lct data
cat wf_lct.json | sort -r | uniq > wf_lctU.json

# 6. Extract the PostgreSQL data types for each field and 
# generate SQL table declarations (unpadded)
cat wf_hct.json | ./json2pgtypes.js -o wf_hct_typestate
cat wf_lctU.json | ./json2pgtypes.js -o wf_lctU_typestate
cat wf_rtt.json | ./json2pgtypes.js -o wf_rtt_typestate

# 7. Manually Inspect the SQL tables for sanity, pad varchar where needed.

# 8. Convert streaming JSON into tab-delimited input file for PostgreSQL 
# COPY command
cat wf_hct.json | ./json_tsv.js -i ./wf_hct_typestate.json > wf_hct.tsv
cat wf_lctU.json | ./json_tsv.js -i ./wf_lctU_typestate.json > wf_lctU.tsv
cat wf_rtt.json | ./json_tsv.js -i ./wf_rtt_typestate.json > wf_rtt.tsv

# 9. Move to staging, 
mv *.tsv ./wf_loadtest
mv *.sql ./wf_loadtest

# 10. Load all three tables into PostgreSQL 
# jsontest=# \i /home/cwvhogue/test3/wf_hct_typestate.sql
# CREATE TABLE
# jsontest=# COPY wf_hct from '/home/cwvhogue/test3/wf_hct.tsv';
# COPY 572
