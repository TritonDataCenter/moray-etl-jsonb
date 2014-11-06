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

#################################################
#### Diff extracted db primary key state (in db_state) versus state at specified timepoint

NEW_STATE="${MPATH}/state/${OUTPUTPREFIX}-ids.tsv"
NEW_STATE_D="${MPATH}/state/${OUTPUTPREFIX}-ids_D.tsv"
OLD_STATE="/${MANTA_USER}/stor/etl/${DATEPATH}/db_state/${OUTPUTPREFIX}_m-ids.tsv"
NEW_STATE_ASSET="/assets${NEW_STATE}"

############### If I append origin_file to NEW_STATE_ASSET, I have to awk and remove the last column before diffing.
############### OLD_STATE comes in from DB extract without origin_file.
################ NEW_STATE_D is colum-truncated version of NEW_STATE for diffing

echo ${NEW_STATE} | mjob create -r "awk '{print \$1 \"\t\" \$2}' | mpipe ${NEW_STATE_D}"

NEW_STATE_ASSET_D="/assets${NEW_STATE_D}"


################


DIFF_REMOVE="diff --changed-group-format='%>' --unchanged-group-format='' ${NEW_STATE_ASSET_D} \${MANTA_INPUT_FILE} || true"
## cat sdc_packages_m-ids.tsv | diff --changed-group-format='%>' --unchanged-group-format='' sdc_packages-ids.tsv -
## remove list

DIFF_ADD="diff --changed-group-format='%<' --unchanged-group-format='' ${NEW_STATE_ASSET_D} \${MANTA_INPUT_FILE} || true"
## cat sdc_packages_m-ids.tsv | diff --changed-group-format='%<' --unchanged-group-format='' sdc_packages-ids.tsv -
## add list

DIFF_UNCHANGED="diff --changed-group-format='' --unchanged-group-format='%=' ${NEW_STATE_ASSET_D} \${MANTA_INPUT_FILE} || true"
## cat sdc_packages_m-ids.tsv | diff --changed-group-format='' --unchanged-group-format='%=' sdc_packages-ids.tsv -
## unchanged list

echo ${OLD_STATE} | mjob create -s ${NEW_STATE_D} -w -m "${DIFF_ADD}" -r "awk '{print \$1}' | mpipe ${MPATH}/state/${OUTPUTPREFIX}-ids.add"

echo ${OLD_STATE} | mjob create -s ${NEW_STATE_D} -w -m "${DIFF_REMOVE}" -r "awk '{print \$1}' | mpipe ${MPATH}/state/${OUTPUTPREFIX}-ids.remove"

echo ${OLD_STATE} | mjob create -s ${NEW_STATE_D} -w -m "${DIFF_UNCHANGED}" -r "awk '{print \$1}' | mpipe ${MPATH}/state/${OUTPUTPREFIX}-ids.unchanged"


JSON_HEADER="${MPATH}/state/${OUTPUTPREFIX}-header.json"

mfind ${MPATH}/split/ | head -n 1 | \
mjob create \
-w -m "head -n 1 \${MANTA_INPUT_FILE} > /var/tmp/header.txt && mput -f /var/tmp/header.txt ${JSON_HEADER}"


ADD_LIST="${MPATH}/state/${OUTPUTPREFIX}-ids.add"
ADD_LIST_ASSET="/assets${ADD_LIST}"
JSON_ADD_TMP="${MPATH}/state/${OUTPUTPREFIX}_add_tmp.json"
JSON_ADD="${MPATH}/state/${OUTPUTPREFIX}_add.json"
JSON_ADD_TMP_ASSET="/assets${JSON_ADD_TMP}"

# Find all the json lines in the current split dataset and extract 
# Simple grep for primary keys accumulated in the ADD_LIST by the DIFF_ADD map/reducer

mfind ${MPATH}/split/ | \
mjob create \
-s ${ADD_LIST} \
-w -m "grep -f ${ADD_LIST_ASSET} \${MANTA_INPUT_FILE}" \
-r "cat | mpipe ${JSON_ADD_TMP}"


## use grep -f to extract the tsv NEW_STATE lines corresponding to the add list PKs with origin_datacenter, origin_file

TSV_ADD="${MPATH}/state/${OUTPUTPREFIX}_add_origin.tsv"

echo ${NEW_STATE} | \
mjob create \
-s ${ADD_LIST} \
-r "grep -f ${ADD_LIST_ASSET} \${MANTA_INPUT_FILE} | mpipe ${TSV_ADD}"


# Add the header back on to the accumulated JSON_ADD_TMP - finishing JSON_ADD
echo ${JSON_HEADER} | \
mjob create \
-s ${JSON_ADD_TMP} \
-r "cat - ${JSON_ADD_TMP_ASSET} | mpipe ${JSON_ADD}"

mrm ${JSON_ADD_TMP}
mrm ${JSON_HEADER}

# The ${JSON_ADD} is ready for almost-normal pipeline processing. 
# The ${TSV_ADD} holds all the extra origin_file, origin_datacenter data which 
# has to get merged back at some stage... 


## Move stuff in /split to /split_0

mmkdir ${MPATH}/split_0

mfind ${MPATH}/split/ | \
mjob create \
-w -m "mln \${MANTA_INPUT_FILE} ${MPATH}/split_0/\$(basename \${MANTA_INPUT_FILE})"



