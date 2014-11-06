#!/bin/bash

if [ $# != 1 ]
then
        echo "Usage:"
        echo " "
        echo "`basename $0` [yyyy/mm/dd/mm] "
        echo " "
        echo "e.g:      `basename $0` \"2014/08/01/00\" "
        echo " "
        exit 1
fi


DATEPATH=$1



##################################
#  collect the sql and tsv files

OUTPUTPREFIX="sdc_packages"
MPATH="/${MANTA_USER}/stor/etl/${DATEPATH}/${OUTPUTPREFIX}"

mget ${MPATH}/_m/${OUTPUTPREFIX}_m.tsv.gz > ${OUTPUTPREFIX}_m.tsv.gz
mget ${MPATH}/_m/${OUTPUTPREFIX}_m.sql > ${OUTPUTPREFIX}_m.sql
mget ${MPATH}/_m/${OUTPUTPREFIX}_m.tst_json > ${OUTPUTPREFIX}_m.tst_json

mget ${MPATH}/_s/${OUTPUTPREFIX}_s.tsv.gz > ${OUTPUTPREFIX}_s.tsv.gz
mget ${MPATH}/_s/${OUTPUTPREFIX}_s.sql > ${OUTPUTPREFIX}_s.sql
mget ${MPATH}/_s/${OUTPUTPREFIX}_s.tst_json > ${OUTPUTPREFIX}_s.tst_json

mget ${MPATH}/_r/${OUTPUTPREFIX}_r.tsv.gz > ${OUTPUTPREFIX}_r.tsv.gz
mget ${MPATH}/_r/${OUTPUTPREFIX}_r.sql > ${OUTPUTPREFIX}_r.sql
mget ${MPATH}/_r/${OUTPUTPREFIX}_r.tst_json > ${OUTPUTPREFIX}_r.tst_json


mget ${MPATH}/state/${OUTPUTPREFIX}_add_origin.tsv > ${OUTPUTPREFIX}_add_origin.tsv

exit 0

OUTPUTPREFIX="wf_jobs"
MPATH="/${MANTA_USER}/stor/etl/${DATEPATH}/${OUTPUTPREFIX}"

mget ${MPATH}/_m/${OUTPUTPREFIX}_m.tsv.gz > ${OUTPUTPREFIX}_m.tsv.gz
mget ${MPATH}/_m/${OUTPUTPREFIX}_m.sql > ${OUTPUTPREFIX}_m.sql
mget ${MPATH}/_m/${OUTPUTPREFIX}_m.tst_json > ${OUTPUTPREFIX}_m.tst_json

mget ${MPATH}/_s/${OUTPUTPREFIX}_s.tsv.gz > ${OUTPUTPREFIX}_s.tsv.gz
mget ${MPATH}/_s/${OUTPUTPREFIX}_s.sql > ${OUTPUTPREFIX}_s.sql
mget ${MPATH}/_s/${OUTPUTPREFIX}_s.tst_json > ${OUTPUTPREFIX}_s.tst_json

mget ${MPATH}/_r/${OUTPUTPREFIX}_r.tsv.gz > ${OUTPUTPREFIX}_r.tsv.gz
mget ${MPATH}/_r/${OUTPUTPREFIX}_r.sql > ${OUTPUTPREFIX}_r.sql
mget ${MPATH}/_r/${OUTPUTPREFIX}_r.tst_json > ${OUTPUTPREFIX}_r.tst_json

mget ${MPATH}/state/${OUTPUTPREFIX}_add_origin.tsv > ${OUTPUTPREFIX}_add_origin.tsv


###### ALL ENTRIES GET FLAGGED FOR UPDATING... ???
OUTPUTPREFIX="cnapi_servers"
MPATH="/${MANTA_USER}/stor/etl/${DATEPATH}/${OUTPUTPREFIX}"

mget ${MPATH}/_m/${OUTPUTPREFIX}_m.tsv.gz > ${OUTPUTPREFIX}_m.tsv.gz
mget ${MPATH}/_m/${OUTPUTPREFIX}_m.sql > ${OUTPUTPREFIX}_m.sql
mget ${MPATH}/_m/${OUTPUTPREFIX}_m.tst_json > ${OUTPUTPREFIX}_m.tst_json

mget ${MPATH}/_s/${OUTPUTPREFIX}_s.tsv.gz > ${OUTPUTPREFIX}_s.tsv.gz
mget ${MPATH}/_s/${OUTPUTPREFIX}_s.sql > ${OUTPUTPREFIX}_s.sql
mget ${MPATH}/_s/${OUTPUTPREFIX}_s.tst_json > ${OUTPUTPREFIX}_s.tst_json

mget ${MPATH}/_r/${OUTPUTPREFIX}_r.tsv.gz > ${OUTPUTPREFIX}_r.tsv.gz
mget ${MPATH}/_r/${OUTPUTPREFIX}_r.sql > ${OUTPUTPREFIX}_r.sql
mget ${MPATH}/_r/${OUTPUTPREFIX}_r.tst_json > ${OUTPUTPREFIX}_r.tst_json

mget ${MPATH}/state/${OUTPUTPREFIX}_add_origin.tsv > ${OUTPUTPREFIX}_add_origin.tsv


OUTPUTPREFIX="vmapi_vms"
MPATH="/${MANTA_USER}/stor/etl/${DATEPATH}/${OUTPUTPREFIX}"

mget ${MPATH}/_m/${OUTPUTPREFIX}_m.tsv.gz > ${OUTPUTPREFIX}_m.tsv.gz
mget ${MPATH}/_m/${OUTPUTPREFIX}_m.sql > ${OUTPUTPREFIX}_m.sql
mget ${MPATH}/_m/${OUTPUTPREFIX}_m.tst_json > ${OUTPUTPREFIX}_m.tst_json

mget ${MPATH}/_s/${OUTPUTPREFIX}_s.tsv.gz > ${OUTPUTPREFIX}_s.tsv.gz
mget ${MPATH}/_s/${OUTPUTPREFIX}_s.sql > ${OUTPUTPREFIX}_s.sql
mget ${MPATH}/_s/${OUTPUTPREFIX}_s.tst_json > ${OUTPUTPREFIX}_s.tst_json

mget ${MPATH}/_r/${OUTPUTPREFIX}_r.tsv.gz > ${OUTPUTPREFIX}_r.tsv.gz
mget ${MPATH}/_r/${OUTPUTPREFIX}_r.sql > ${OUTPUTPREFIX}_r.sql
mget ${MPATH}/_r/${OUTPUTPREFIX}_r.tst_json > ${OUTPUTPREFIX}_r.tst_json

mget ${MPATH}/state/${OUTPUTPREFIX}_add_origin.tsv > ${OUTPUTPREFIX}_add_origin.tsv


OUTPUTPREFIX="ufds_o_sdc"
MPATH="/${MANTA_USER}/stor/etl/${DATEPATH}/${OUTPUTPREFIX}"

mget ${MPATH}/_m/${OUTPUTPREFIX}_m.tsv.gz > ${OUTPUTPREFIX}_m.tsv.gz
mget ${MPATH}/_m/${OUTPUTPREFIX}_m.sql > ${OUTPUTPREFIX}_m.sql
mget ${MPATH}/_m/${OUTPUTPREFIX}_m.tst_json > ${OUTPUTPREFIX}_m.tst_json

mget ${MPATH}/_s/${OUTPUTPREFIX}_s.tsv.gz > ${OUTPUTPREFIX}_s.tsv.gz
mget ${MPATH}/_s/${OUTPUTPREFIX}_s.sql > ${OUTPUTPREFIX}_s.sql
mget ${MPATH}/_s/${OUTPUTPREFIX}_s.tst_json > ${OUTPUTPREFIX}_s.tst_json

mget ${MPATH}/_r/${OUTPUTPREFIX}_r.tsv.gz > ${OUTPUTPREFIX}_r.tsv.gz
mget ${MPATH}/_r/${OUTPUTPREFIX}_r.sql > ${OUTPUTPREFIX}_r.sql
mget ${MPATH}/_r/${OUTPUTPREFIX}_r.tst_json > ${OUTPUTPREFIX}_r.tst_json

mget ${MPATH}/state/${OUTPUTPREFIX}_add_origin.tsv > ${OUTPUTPREFIX}_add_origin.tsv


OUTPUTPREFIX="napi_ips"
MPATH="/${MANTA_USER}/stor/etl/${DATEPATH}/${OUTPUTPREFIX}"

mget ${MPATH}/_m/${OUTPUTPREFIX}_m.tsv.gz > ${OUTPUTPREFIX}_m.tsv.gz
mget ${MPATH}/_m/${OUTPUTPREFIX}_m.sql > ${OUTPUTPREFIX}_m.sql
mget ${MPATH}/_m/${OUTPUTPREFIX}_m.tst_json > ${OUTPUTPREFIX}_m.tst_json

mget ${MPATH}/_s/${OUTPUTPREFIX}_s.tsv.gz > ${OUTPUTPREFIX}_s.tsv.gz
mget ${MPATH}/_s/${OUTPUTPREFIX}_s.sql > ${OUTPUTPREFIX}_s.sql
mget ${MPATH}/_s/${OUTPUTPREFIX}_s.tst_json > ${OUTPUTPREFIX}_s.tst_json

mget ${MPATH}/_r/${OUTPUTPREFIX}_r.tsv.gz > ${OUTPUTPREFIX}_r.tsv.gz
mget ${MPATH}/_r/${OUTPUTPREFIX}_r.sql > ${OUTPUTPREFIX}_r.sql
mget ${MPATH}/_r/${OUTPUTPREFIX}_r.tst_json > ${OUTPUTPREFIX}_r.tst_json

mget ${MPATH}/state/${OUTPUTPREFIX}_add_origin.tsv > ${OUTPUTPREFIX}_add_origin.tsv


OUTPUTPREFIX="imgapi_images"
MPATH="/${MANTA_USER}/stor/etl/${DATEPATH}/${OUTPUTPREFIX}"

mget ${MPATH}/_m/${OUTPUTPREFIX}_m.tsv.gz > ${OUTPUTPREFIX}_m.tsv.gz
mget ${MPATH}/_m/${OUTPUTPREFIX}_m.sql > ${OUTPUTPREFIX}_m.sql
mget ${MPATH}/_m/${OUTPUTPREFIX}_m.tst_json > ${OUTPUTPREFIX}_m.tst_json

mget ${MPATH}/_s/${OUTPUTPREFIX}_s.tsv.gz > ${OUTPUTPREFIX}_s.tsv.gz
mget ${MPATH}/_s/${OUTPUTPREFIX}_s.sql > ${OUTPUTPREFIX}_s.sql
mget ${MPATH}/_s/${OUTPUTPREFIX}_s.tst_json > ${OUTPUTPREFIX}_s.tst_json

mget ${MPATH}/_r/${OUTPUTPREFIX}_r.tsv.gz > ${OUTPUTPREFIX}_r.tsv.gz
mget ${MPATH}/_r/${OUTPUTPREFIX}_r.sql > ${OUTPUTPREFIX}_r.sql
mget ${MPATH}/_r/${OUTPUTPREFIX}_r.tst_json > ${OUTPUTPREFIX}_r.tst_json

mget ${MPATH}/state/${OUTPUTPREFIX}_add_origin.tsv > ${OUTPUTPREFIX}_add_origin.tsv



OUTPUTPREFIX="napi_nics"
MPATH="/${MANTA_USER}/stor/etl/${DATEPATH}/${OUTPUTPREFIX}"

mget ${MPATH}/_m/${OUTPUTPREFIX}_m.tsv.gz > ${OUTPUTPREFIX}_m.tsv.gz
mget ${MPATH}/_m/${OUTPUTPREFIX}_m.sql > ${OUTPUTPREFIX}_m.sql

mget ${MPATH}/_s/${OUTPUTPREFIX}_s.tsv.gz > ${OUTPUTPREFIX}_s.tsv.gz
mget ${MPATH}/_s/${OUTPUTPREFIX}_s.sql > ${OUTPUTPREFIX}_s.sql
mget ${MPATH}/_s/${OUTPUTPREFIX}_s.tst_json > ${OUTPUTPREFIX}_s.tst_json

mget ${MPATH}/_r/${OUTPUTPREFIX}_r.tsv.gz > ${OUTPUTPREFIX}_r.tsv.gz
mget ${MPATH}/_r/${OUTPUTPREFIX}_r.sql > ${OUTPUTPREFIX}_r.sql
mget ${MPATH}/_r/${OUTPUTPREFIX}_r.tst_json > ${OUTPUTPREFIX}_r.tst_json

mget ${MPATH}/state/${OUTPUTPREFIX}_add_origin.tsv > ${OUTPUTPREFIX}_add_origin.tsv


OUTPUTPREFIX="napi_networks"
MPATH="/${MANTA_USER}/stor/etl/${DATEPATH}/${OUTPUTPREFIX}"

mget ${MPATH}/_m/${OUTPUTPREFIX}_m.tsv.gz > ${OUTPUTPREFIX}_m.tsv.gz
mget ${MPATH}/_m/${OUTPUTPREFIX}_m.sql > ${OUTPUTPREFIX}_m.sql
mget ${MPATH}/_m/${OUTPUTPREFIX}_m.tst_json > ${OUTPUTPREFIX}_m.tst_json

mget ${MPATH}/_s/${OUTPUTPREFIX}_s.tsv.gz > ${OUTPUTPREFIX}_s.tsv.gz
mget ${MPATH}/_s/${OUTPUTPREFIX}_s.sql > ${OUTPUTPREFIX}_s.sql
mget ${MPATH}/_s/${OUTPUTPREFIX}_s.tst_json > ${OUTPUTPREFIX}_s.tst_json

mget ${MPATH}/_r/${OUTPUTPREFIX}_r.tsv.gz > ${OUTPUTPREFIX}_r.tsv.gz
mget ${MPATH}/_r/${OUTPUTPREFIX}_r.sql > ${OUTPUTPREFIX}_r.sql
mget ${MPATH}/_r/${OUTPUTPREFIX}_r.tst_json > ${OUTPUTPREFIX}_r.tst_json

mget ${MPATH}/state/${OUTPUTPREFIX}_add_origin.tsv > ${OUTPUTPREFIX}_add_origin.tsv
