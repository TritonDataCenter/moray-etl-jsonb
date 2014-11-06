#!/bin/bash

if [ $# != 6 ]
then
        echo "Usage:"
        echo " "
        echo "`basename $0` [regexp] [yyyy/mm/dd/mm] [json manifest] [split file prefix] [disk in GB] [split lines]"
        echo " "
        echo "e.g:      `basename $0` \"^wf_jobs-\" \"2014/08/01/00\" wf_keys.json wf_jobs 128 3000"
        echo "          `basename $0` \"^cnapi_servers-\" \"2014/08/01/00\" cnapi_keys.json cnapi_servers 8 100"
        echo "          `basename $0` \"^vmapi_vms-\" \"2014/08/01/00\" vmapi_keys.json vmapi_vms 32 3000"
        echo "          `basename $0` \"^ufds_o_smartdc-\" \"2014/08/01/00\" ufds_keys.json ufds_o_sdc 8 3000"
        echo "          `basename $0` \"^sdc_packages-\" \"2014/08/01/00\" papi_keys.json sdc_packages 8 200"
        echo "          `basename $0` \"^imgapi_images-\" \"2014/08/01/00\" imgapi_keys.json imgapi_images 8 200"
        echo "          `basename $0` \"^napi_nic_tags-\" \"2014/08/01/00\" napi_nic_tags_keys.json napi_nic_tags 8 100"
        echo "          `basename $0` \"^napi_network_pools-\" \"2014/08/01/00\" napi_network_pools_keys.json napi_network_pools 8 100"
        echo "          `basename $0` \"^napi_nics-\" \"2014/08/01/00\" napi_nics_keys.json napi_nics 8 1000"
        echo "          `basename $0` \"^napi_networks-\" \"2014/08/01/00\" napi_networks_keys.json napi_networks 8 1000"
        echo " "
        exit 1
fi

REGEXP=$1
DATEPATH=$2
MANIFEST=$3
OUTPUTPREFIX=$4
DISK=$5
SPLITCOUNT=$6

DC1="my_dc_name"
#DC2="..."

MPATH="/${MANTA_USER}/stor/etl/${DATEPATH}/${OUTPUTPREFIX}"

mmkdir -p ${MPATH}
mmkdir -p ${MPATH}/split

MF1="mfind -t o -n ${REGEXP} /admin/stor/sdc/manatee_backups/${DC1}/${DATEPATH}"
MD1=`${MF1}`
mln  ${MD1} ${MPATH}/${DC1}.$(basename ${MD1})

#MF2="mfind -t o -n ${REGEXP} /admin/stor/sdc/manatee_backups/${DC2}/${DATEPATH}" 
#MD2=`${MF2}`
#mln  ${MD2} ${MPATH}/${DC2}.$(basename ${MD2})


mfind -n 'gz$' ${MPATH}/ | mput -q ${MPATH}/dc_inputs.txt

GLOBIGNORE="*"
Q_STR="/var/tmp/*.????"
SPLIT_STR="split -a 4 -l ${SPLITCOUNT} - /var/tmp/\$(basename \${MANTA_INPUT_FILE%.*})."
HEAD_STR="head -n 1 /var/tmp/\$(basename \${MANTA_INPUT_FILE%.*}).aaaa > /var/tmp/header.txt"
LIST_STR="ls -w 1 -f "$Q_STR" | xargs -I {} basename {} > /var/tmp/splitfiles.txt"
PATCH_STR="cat /var/tmp/splitfiles.txt | sed \"1,1d\" > /var/tmp/header_patch.txt"
CAT_STR='cat /var/tmp/header_patch.txt | xargs -I {} sh -c "cat /var/tmp/header.txt /var/tmp/{} > /var/tmp/{}_ ; mv -f /var/tmp/{}_ /var/tmp/{}"'
MPUT_STR="cat /var/tmp/splitfiles.txt | xargs -I {} mput -f /var/tmp/{} ${MPATH}/split/{}"


mget -q ${MPATH}/dc_inputs.txt| mjob create --disk ${DISK} -w -m "gunzip -c \$MANTA_INPUT_FILE | \
${SPLIT_STR} && ${HEAD_STR} && ${LIST_STR} && ${PATCH_STR} && ${CAT_STR} && ${MPUT_STR}"


