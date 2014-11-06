#
# Copyright (c) 2014, Joyent, Inc. All rights reserved.
#
# moray-etl-jsonb Makefile
#
# PLACEHOLDER

#
# Files & Tools
#
JS_FILES	:= $(shell find lib test -name '*.js')
JSL_CONF_NODE	 = tools/jsl.node.conf
JSL_FILES_NODE   = $(JS_FILES)
JSSTYLE_FILES	 = $(JS_FILES)
JSSTYLE_FLAGS    = -o indent=4,doxygen,unparenthesized-return=0
NODEUNIT	:= ./node_modules/.bin/nodeunit
NPM 		:= npm

include ./tools/mk/Makefile.defs


#
# Repo-specific targets
#
.PHONY: all
all:
	$(NPM) install

$(NODEUNIT):
	$(NPM) install

.PHONY: test
test: | $(NODEUNIT)
	$(NODEUNIT) test/*.test.js

.PHONY: check-jsstyle
check-jsstyle: $(JS_FILES)
	jsstyle -o indent=4,doxygen,unparenthesized-return=0,blank-after-start-comment=0,leading-right-paren-ok=1 $(JS_FILES)

.PHONY: check-jslint
check-jslint: $(JS_FILES)
	jsl --nologo --nosummary --conf ./tools/jsl.node.conf $(JS_FILES)

.PHONY: check
check: check-jsstyle 
	@echo "Check ok."

.PHONY: lint
lint: check-jslint
	@echo "Lint ok."



#include ./tools/mk/Makefile.deps
#include ./tools/mk/Makefile.targ
