CREATE TABLE wf_jobs_r (
    _r_id varchar(32),
    nicTags varchar(34),
    timeout smallint,
    serverNicTags varchar(47),
    server_uuid uuid,
    execution varchar(9),
    version varchar(5),
    expects varchar(9),
    requestMethod varchar(4),
    markAsFailedOnError boolean,
    addedToUfds boolean,
    max_attempts smallint,
    num_attempts smallint,
    cleanupOnTimeout varchar(3)
);