#!/bin/bash

if [ $# != 1 ]
then
        echo "Usage:"
        echo " "
        echo "`basename $0` [yyyy/mm/dd/mm]"
        echo " "
        echo "e.g:      `basename $0` \"2014/08/01/00\" "
        echo " "
        exit 1
fi


REGEXP="^napi_ips_"
DATEPATH=$1
MANIFEST="napi_ips_keys.json"
OUTPUTPREFIX="napi_ips"
DISK="8"
SPLITCOUNT="1000"


MPATH="/${MANTA_USER}/stor/etl/${DATEPATH}/${OUTPUTPREFIX}"
ASSETS="/assets/$MANTA_USER/stor"
mmkdir -p ${MPATH}

DC1="my-dc-1"
#DC2="..."

mfind -t o -n ${REGEXP} /admin/stor/sdc/manatee_backups/${DC1}/${DATEPATH} | \
mjob create \
-s /$MANTA_USER/stor/moray-etl-jsonb.tgz \
--init "cd /var/tmp && tar -xzf ${ASSETS}/moray-etl-jsonb.tgz" \
-w -m "gunzip | /var/tmp/moray-etl-jsonb/lib/napi_merge.js" \
-r "sort -r | uniq | mpipe ${MPATH}/${DC1}.${OUTPUTPREFIX}.json"

mfind -n '.json$' ${MPATH}/ | mput -q ${MPATH}/napi_inputs.txt

GLOBIGNORE="*"
Q_STR="/var/tmp/*.????"
SPLIT_STR="split -a 4 -l ${SPLITCOUNT} - /var/tmp/\$(basename \${MANTA_INPUT_FILE%.*})."
HEAD_STR="head -n 1 /var/tmp/\$(basename \${MANTA_INPUT_FILE%.*}).aaaa > /var/tmp/header.txt"
LIST_STR="ls -w 1 -f "$Q_STR" | xargs -I {} basename {} > /var/tmp/splitfiles.txt"
PATCH_STR="cat /var/tmp/splitfiles.txt | sed \"1,1d\" > /var/tmp/header_patch.txt"
CAT_STR='cat /var/tmp/header_patch.txt | xargs -I {} sh -c "cat /var/tmp/header.txt /var/tmp/{} > /var/tmp/{}_ ; mv -f /var/tmp/{}_ /var/tmp/{}"'
MPUT_STR="cat /var/tmp/splitfiles.txt | xargs -I {} mput -f /var/tmp/{} ${MPATH}/split/{}"

mmkdir -p ${MPATH}/split

mget -q ${MPATH}/napi_inputs.txt| mjob create --disk ${DISK} -w -m  \
"${SPLIT_STR} && ${HEAD_STR} && ${LIST_STR} && ${PATCH_STR} && ${CAT_STR} && ${MPUT_STR}"
