# moray-etl-jsonb  

Created by Christopher Hogue.

# Overview

This repo contains methodology to refactor via extract-transform-load
a Moray JSON bucket into a set of PostGreSQL 9.4 SQL tables employing:
   
   JSONB indexing 
   <https://www.postgresql.org/docs/9.4/static/datatype-json.html>

   Power Schema analysis to optimize SQL edge-case behavior.
   


# Repository

    deps/
    docs/           Docs and Power Schema Description
    lib/            Source files.
    test/           Test data 
    measure/        Scripts to evaluate JSON for tag classification
    tools/          Miscellaneous dev/upgrade/deployment tools and data.
    Makefile
    package.json    npm module info (holds the project version)
    README.md


# Overview

Refactoring involves a JSON measurement phase, a table/tag classification phase,
a Postgres dump file split, and reload into Postgres 9.4.


# Usage

Note: Current writeup  here is **incomplete**.

#MEASUREMENT phase:


    # After running JSON power law mappers and reducers
    # Commands will assemble a .csv table  
    mkdir fini
    cp wf_jobs_values.json.* fini
    cd fini
    ls *.n_unique > col1
    cat *.n_unique > col2
    cat *.n_defined > col4
    cat *.n_undefined > col6
    cat *.bz2_bytes > col8
    paste -d "," col1 col2 col4 col6 col8 > table
    echo "name,unique,defined,undefined,bytes" > head
    cat head table | sed -e "s/wf_jobs_values.json.//" -e "s/.n_unique//" > table.csv






# Development

To run tools:

   tbd

To refactor a new Moray JSON bucket:

   tbd
 
To update the guidelines, edit "docs/index.restdown" and run `make docs`
to update "docs/index.html".

Before commiting/pushing run `make prepush` and, if possible, get a code
review.


# Testing

    make test

If you project has setup steps necessary for testing, then describe those
here.


