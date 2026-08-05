// SPDX-License-Identifier: GPL-2.0-only
/*
 * Copyright (C) 2026 dere3046
 */

#include <linux/kernel.h>
#include <linux/sched.h>
#include <linux/sched/signal.h>
#include <linux/sched/task.h>
#include <linux/sched/task_stack.h>
#include <linux/uidgid.h>
#include <linux/err.h>
#include <linux/sort.h>

#include "batmon.h"

static struct batmon_diff batmon_diff_pool[BATMON_MAX_TASKS];

#ifdef CONFIG_SCHEDSTATS
#ifdef BATMON_STATS_IN_TASK
#define batmon_sched_stats(p) (&(p)->stats)
#else
#define batmon_sched_stats(p) (&(p)->se.statistics)
#endif
#endif

void batmon_task_snapshot(struct batmon_task *snap, unsigned int *n)
{
	struct task_struct *p;
	unsigned int i = 0;

	rcu_read_lock();
	for_each_process(p) {
		struct task_io_accounting *io;

		if (i >= BATMON_MAX_TASKS)
			break;

		snap[i].pid = task_tgid_nr(p);
		if (snap[i].pid <= 0)
			continue;
		snap[i].uid = from_kuid(&init_user_ns, task_uid(p));
		get_task_comm(snap[i].comm, p);
		snap[i].cpu = p->se.sum_exec_runtime;
#ifdef CONFIG_SCHEDSTATS
		snap[i].wake = READ_ONCE(batmon_sched_stats(p)->nr_wakeups);
		snap[i].sleep =
			READ_ONCE(batmon_sched_stats(p)->sum_sleep_runtime);
#else
		snap[i].wake = 0;
		snap[i].sleep = 0;
#endif
		snap[i].nvcsw = READ_ONCE(p->nvcsw);
		snap[i].nivcsw = READ_ONCE(p->nivcsw);
		io = &p->ioac;
		snap[i].rbytes = READ_ONCE(io->read_bytes);
		snap[i].wbytes = READ_ONCE(io->write_bytes);
		i++;
	}
	rcu_read_unlock();
	*n = i;
}

static int batmon_find_pid(const struct batmon_task *snap, unsigned int n,
			   pid_t pid)
{
	unsigned int i;

	for (i = 0; i < n; i++)
		if (snap[i].pid == pid)
			return i;
	return -1;
}

int batmon_build_diff(const struct batmon_task *new,
		      const struct batmon_task *old, unsigned int new_n,
		      unsigned int old_n, struct batmon_diff *out,
		      unsigned int *out_n)
{
	unsigned int i, j = 0;

	for (i = 0; i < new_n; i++) {
		int oi;

		if (j >= BATMON_MAX_TASKS)
			break;
		oi = batmon_find_pid(old, old_n, new[i].pid);
		if (oi < 0)
			continue;
		if (new[i].cpu < old[oi].cpu)
			continue;

		out[j].pid = new[i].pid;
		out[j].uid = new[i].uid;
		memcpy(out[j].comm, new[i].comm, TASK_COMM_LEN);
		out[j].cpu_ms = (new[i].cpu - old[oi].cpu) / NSEC_PER_MSEC;
		out[j].wake = new[i].wake - old[oi].wake;
		out[j].sleep_ms = (new[i].sleep - old[oi].sleep) /
				  NSEC_PER_MSEC;
		out[j].nvcsw = new[i].nvcsw - old[oi].nvcsw;
		out[j].nivcsw = new[i].nivcsw - old[oi].nivcsw;
		out[j].rbytes = new[i].rbytes - old[oi].rbytes;
		out[j].wbytes = new[i].wbytes - old[oi].wbytes;
		j++;
	}
	*out_n = j;
	return 0;
}

int batmon_cmp_cpu(const void *a, const void *b)
{
	const struct batmon_diff *da = a;
	const struct batmon_diff *db = b;

	if (db->cpu_ms > da->cpu_ms)
		return 1;
	if (db->cpu_ms < da->cpu_ms)
		return -1;
	return 0;
}

int batmon_cmp_wake(const void *a, const void *b)
{
	const struct batmon_diff *da = a;
	const struct batmon_diff *db = b;

	if (db->wake > da->wake)
		return 1;
	if (db->wake < da->wake)
		return -1;
	return 0;
}

int batmon_diff_top(const struct batmon_task *new, const struct batmon_task *old,
		    unsigned int new_n, unsigned int old_n,
		    struct batmon_top *top, unsigned int *nr)
{
	unsigned int i, n = 0;

	batmon_build_diff(new, old, new_n, old_n, batmon_diff_pool, &n);
	sort(batmon_diff_pool, n, sizeof(*batmon_diff_pool),
	     batmon_cmp_cpu, NULL);

	if (n > BATMON_TOP)
		n = BATMON_TOP;
	*nr = 0;
	for (i = 0; i < n; i++) {
		top[i].pid = batmon_diff_pool[i].pid;
		top[i].uid = batmon_diff_pool[i].uid;
		memcpy(top[i].comm, batmon_diff_pool[i].comm, TASK_COMM_LEN);
		top[i].cpu_ms = batmon_diff_pool[i].cpu_ms;
		top[i].wake = batmon_diff_pool[i].wake;
		(*nr)++;
	}
	return 0;
}
