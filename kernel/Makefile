# SPDX-License-Identifier: GPL-2.0-only

KDIR ?= $(error KDIR must be set, e.g. /opt/ddk/kdir/android16-6.12)

MDIR := $(realpath $(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
ODIR ?= $(MDIR)

obj-m := batmon.o
batmon-objs := src/batmon.o src/battery.o src/tasks.o src/proc.o

ccflags-y += -std=gnu11
ccflags-y += -Wno-declaration-after-statement

BATMON_SCHED_H := $(firstword $(wildcard $(KDIR)/source/include/linux/sched.h \
	$(KDIR)/include/linux/sched.h))
ifeq ($(BATMON_SCHED_H),)
$(error sched.h not found under $(KDIR))
endif
ifeq ($(shell grep -Eq "sched_statistics[[:space:]]+stats;" $(BATMON_SCHED_H) \
	&& echo yes),yes)
ccflags-y += -DBATMON_STATS_IN_TASK
endif

all:
	make -C $(KDIR) M=$(ODIR) modules -j$(shell nproc)

clean:
	make -C $(KDIR) M=$(ODIR) clean
