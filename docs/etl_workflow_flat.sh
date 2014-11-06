#!/bin/bash


# 1. Extract _values from PostgreSQL Moray dump for analysis.

# 2. Analyze and partition keys 

# 3. Create JSON manifest for splitting
# ./wf_flat_tojson.js


# 4. Split PostgresQL Moray dump
cat wf_jobs.json | ./moraydump_reorg.js -t ./wf_flat.json

# 5. Skip (No lct to compress with a flat layout)

# 6. Extract the PostgreSQL data types for each field and 
# generate SQL table declarations (unpadded)
cat wf_hct_flat.json | ./json2pgtypes.js -o wf_hct_typestate_flat

# 7. Manually Inspect the SQL tables for sanity, pad varchar where needed.

# 8. Convert streaming JSON into tab-delimited input file for PostgreSQL 
# COPY command
cat wf_hct_flat.json | ./json_tsv.js -i ./wf_hct_typestate_flat.json > wf_hct_flat.tsv

# 9. Move to staging, 
mv *.tsv ./wf_loadtest
mv *.sql ./wf_loadtest

# 10. Load all three tables into PostgreSQL 
# jsontest=# \i /home/cwvhogue/test6/wf_hct_typestate_flat.sql
# jsontest=# COPY wf_hct from '/home/cwvhogue/test6/wf_hct_flat.tsv';
