#!/bin/bash

if [ $# != 5 ]
then
        echo "Usage:"
	echo " "
	echo "`basename $0` [regexp] [yyyy/mm/dd/mm] [json manifest] [split file prefix] [disk in GB]"
	echo " "
	echo "e.g:	`basename $0` \"^wf_jobs-\" \"2014/08/01/00\" wf_keys.json wf_jobs 64"
	echo "   	`basename $0` \"^cnapi_servers-\" \"2014/08/01/00\" cnapi_keys.json cnapi_servers 8"
	echo "   	`basename $0` \"^vmapi_vms-\" \"2014/08/01/00\" vmapi_keys.json vmapi_vms 16"
        echo "          `basename $0` \"^ufds_o_smartdc-\" \"2014/08/01/00\" ufds_keys.json ufds_o_sdc 8"
        echo "          `basename $0` \"^sdc_packages-\" \"2014/08/01/00\" papi_keys.json sdc_packages 8"
        echo "          `basename $0` \"^imgapi_images-\" \"2014/08/01/00\" imgapi_keys.json imgapi_images 8"
	echo " " 
        exit 1
fi

REGEXP=$1
DATEPATH=$2
MANIFEST=$3
OUTPUTPREFIX=$4
DISK=$5

MPATH="/${MANTA_USER}/stor/etl/${DATEPATH}/${OUTPUTPREFIX}"


NEW_STATE="${MPATH}/state/${OUTPUTPREFIX}-ids.tsv"
OLD_STATE="/${MANTA_USER}/stor/etl/${DATEPATH}/db_state/${OUTPUTPREFIX}_m-ids.tsv"
JSON_ADD="${MPATH}/state/${OUTPUTPREFIX}_add.json"
TSV_ADD="${MPATH}/state/${OUTPUTPREFIX}_add_origin.tsv"

## Move stuff in /split to /split_0

mmkdir ${MPATH}/split_0

mfind ${MPATH}/split/ | \
mjob create \
-w -m "mln \${MANTA_INPUT_OBJECT} ${MPATH}/split_0/\$(basename \${MANTA_INPUT_OBJECT})"

mrm -r ${MPATH}/split

## Move JSON_ADD to /split as single split file for next step in processing
##  

mmkdir ${MPATH}/split

mln ${JSON_ADD} ${MPATH}/split/dc-all-0.${OUTPUTPREFIX}-0000-00-00-00-00-00.aaaa
