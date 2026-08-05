// SPDX-License-Identifier: GPL-2.0-only
/*
 * Copyright (C) 2026 dere3046
 */

#include <linux/kernel.h>
#include <linux/module.h>
#include <linux/proc_fs.h>
#include <linux/seq_file.h>
#include <linux/slab.h>
#include <linux/uaccess.h>
#include <linux/string.h>
#include <linux/cpufreq.h>
#include <linux/utsname.h>
#include <linux/ktime.h>
#include <linux/power_supply.h>
#include <linux/sort.h>

#include "batmon.h"

static struct proc_dir_entry *batmon_proc_dir;

struct batmon_iter {
	unsigned int count;
	unsigned int head;
	const void *array;
	int (*show)(struct seq_file *s, unsigned int i);
};

static void *batmon_iter_start(struct seq_file *s, loff_t *pos)
{
	struct batmon_iter *it = s->private;

	if (*pos >= it->count)
		return NULL;
	return (void *)(unsigned long)(*pos + 1);
}

static void *batmon_iter_next(struct seq_file *s, void *v, loff_t *pos)
{
	struct batmon_iter *it = s->private;
	unsigned long i = (unsigned long)v - 1;

	i++;
	*pos = i;
	if (i >= it->count)
		return NULL;
	return (void *)(i + 1);
}

static void batmon_iter_stop(struct seq_file *s, void *v)
{
	(void)s;
	(void)v;
}

static int batmon_iter_show(struct seq_file *s, void *v)
{
	struct batmon_iter *it = s->private;
	unsigned long i = (unsigned long)v - 1;

	return it->show(s, i);
}

static const struct seq_operations batmon_seq_ops = {
	.start = batmon_iter_start,
	.next = batmon_iter_next,
	.stop = batmon_iter_stop,
	.show = batmon_iter_show,
};

static int batmon_seq_open(struct file *file, struct batmon_iter *it)
{
	int rc;

	rc = seq_open(file, &batmon_seq_ops);
	if (rc) {
		kfree(it);
		return rc;
	}
	((struct seq_file *)file->private_data)->private = it;
	return 0;
}

static int batmon_seq_release(struct inode *inode, struct file *file)
{
	struct seq_file *s = file->private_data;

	kfree(s->private);
	return seq_release(inode, file);
}

static void fmt_wall(s64 sec, char *buf, size_t len)
{
	s64 h, m, s;

	h = sec / 3600;
	m = (sec / 60) % 60;
	s = sec % 60;
	snprintf(buf, len, "%02lld:%02lld:%02lld", h % 24, m, s);
}

static void fmt_hms(s64 ms, char *buf, size_t len)
{
	s64 h, m, s;

	h = ms / 3600000;
	m = (ms / 60000) % 60;
	s = (ms / 1000) % 60;
	snprintf(buf, len, "%02lld:%02lld:%02lld", h, m, s);
}

static const char *const status_names[] = {
	"unknown", "charging", "discharging", "not_charging", "full",
};

static const char *const event_names[] = {
	"DROP", "DRAIN", "POWER", "GAUGE", "PLUG", "SUSPEND", "RESUME",
	"LOAD", "UNLOAD",
};

static const char *status_name(u8 status)
{
	if (status >= ARRAY_SIZE(status_names))
		return "?";
	return status_names[status];
}

static int show_info(struct seq_file *s, void *v)
{
	(void)v;
	seq_printf(s, "version %s\n", BATMON_VERSION);
	seq_printf(s, "kernel %s\n", utsname()->release);
	seq_printf(s, "battery %s\n", batmon_psy_name());
	seq_printf(s, "poll_ms %u\n", batmon_cfg.poll_ms);
	seq_printf(s, "enabled %u\n", batmon_cfg.enabled);
	seq_printf(s, "uptime_s %lld\n",
		   (s64)ktime_get_boottime_ns() / NSEC_PER_SEC);
	return 0;
}

static int show_battery(struct seq_file *s, void *v)
{
	static const struct {
		enum power_supply_property prop;
		const char *name;
	} props[] = {
		{ POWER_SUPPLY_PROP_CAPACITY, "capacity" },
		{ POWER_SUPPLY_PROP_VOLTAGE_NOW, "voltage_mv" },
		{ POWER_SUPPLY_PROP_CURRENT_NOW, "current_ma" },
		{ POWER_SUPPLY_PROP_CURRENT_AVG, "current_avg_ma" },
		{ POWER_SUPPLY_PROP_TEMP, "temp_cx10" },
		{ POWER_SUPPLY_PROP_STATUS, "status" },
		{ POWER_SUPPLY_PROP_HEALTH, "health" },
		{ POWER_SUPPLY_PROP_CHARGE_FULL, "charge_full_ua" },
		{ POWER_SUPPLY_PROP_CHARGE_COUNTER, "charge_counter_ua" },
		{ POWER_SUPPLY_PROP_TIME_TO_EMPTY_NOW, "time_to_empty_s" },
	};
	struct power_supply *psy;
	union power_supply_propval pval;
	size_t i;
	int rc;

	(void)v;
	psy = batmon_main_psy();
	if (!psy) {
		seq_puts(s, "no battery psy\n");
		return 0;
	}
	for (i = 0; i < ARRAY_SIZE(props); i++) {
		int val = 0;

		if (props[i].prop == POWER_SUPPLY_PROP_VOLTAGE_NOW) {
			rc = batmon_psy_get_mv(psy, props[i].prop, &val);
		} else if (props[i].prop == POWER_SUPPLY_PROP_CURRENT_NOW ||
			   props[i].prop == POWER_SUPPLY_PROP_CURRENT_AVG) {
			rc = batmon_psy_get_ma(psy, props[i].prop, &val);
		} else {
			rc = power_supply_get_property(psy, props[i].prop,
						      &pval);
			val = pval.intval;
		}
		if (!rc)
			seq_printf(s, "%s %d\n", props[i].name, val);
	}
	return 0;
}

static int show_psy(struct seq_file *s, void *v)
{
	static const char *const names[] = PSY_ALLCANDIDATES;
	struct power_supply *psy;
	size_t i;

	(void)v;
	for (i = 0; i < ARRAY_SIZE(names); i++) {
		union power_supply_propval pval;
		int val;

		psy = power_supply_get_by_name(names[i]);
		if (!psy)
			continue;
		seq_printf(s, "[%s]\n", names[i]);
		if (!power_supply_get_property(psy, POWER_SUPPLY_PROP_STATUS,
					       &pval))
			seq_printf(s, "status %s\n", status_name(pval.intval));
		if (!power_supply_get_property(psy, POWER_SUPPLY_PROP_CAPACITY,
					       &pval))
			seq_printf(s, "capacity %d\n", pval.intval);
		if (!batmon_psy_get_mv(psy, POWER_SUPPLY_PROP_VOLTAGE_NOW,
				       &val))
			seq_printf(s, "voltage_mv %d\n", val);
		if (!batmon_psy_get_ma(psy, POWER_SUPPLY_PROP_CURRENT_NOW,
				       &val))
			seq_printf(s, "current_ma %d\n", val);
		if (!power_supply_get_property(psy, POWER_SUPPLY_PROP_TEMP,
					       &pval))
			seq_printf(s, "temp_cx10 %d\n", pval.intval);
		power_supply_put(psy);
	}
	return 0;
}

static void fmt_cap(u32 cap, char *buf, size_t len)
{
	if (cap == U32_MAX)
		snprintf(buf, len, "-");
	else
		snprintf(buf, len, "%u", cap);
}

static int show_history(struct seq_file *s, unsigned int i)
{
	struct batmon_iter *it = s->private;
	const struct batmon_sample *hist = it->array;
	unsigned int idx;
	char wall[16];
	char cap[8];

	idx = (it->head + BATMON_HISTORY - 1 - i) % BATMON_HISTORY;
	fmt_wall(hist[idx].wall, wall, sizeof(wall));
	fmt_cap(hist[idx].cap, cap, sizeof(cap));
	seq_printf(s, "%s %5llu %4s %4u %6d %6d %5d %s\n",
		   wall, (u64)(hist[idx].ts / NSEC_PER_SEC), cap,
		   hist[idx].volt, hist[idx].curr, hist[idx].curravg,
		   hist[idx].temp, status_name(hist[idx].status));
	return 0;
}

static int show_events(struct seq_file *s, unsigned int i)
{
	struct batmon_iter *it = s->private;
	const struct batmon_event *events = it->array;
	unsigned int idx, t;
	const struct batmon_event *ev;
	char wall[16];
	char cb[8], ca[8], vb[8], va[8];

	idx = (it->head + BATMON_EVENTS - 1 - i) % BATMON_EVENTS;
	ev = &events[idx];
	fmt_wall(ev->wall, wall, sizeof(wall));
	fmt_cap(ev->cap_before, cb, sizeof(cb));
	fmt_cap(ev->cap_after, ca, sizeof(ca));
	fmt_cap(ev->volt_before, vb, sizeof(vb));
	fmt_cap(ev->volt_after, va, sizeof(va));
	seq_printf(s, "%s %5llu %-7s cap %s->%s volt %s->%s curr %d\n",
		   wall, (u64)(ev->ts / NSEC_PER_SEC),
		   event_names[ev->type], cb, ca, vb, va, ev->curr_avg);
	for (t = 0; t < ev->nr_top && t < BATMON_TOP; t++) {
		seq_printf(s, "  %-16s pid %d uid %d cpu %llums wake %llu\n",
			   ev->top[t].comm, ev->top[t].pid, ev->top[t].uid,
			   ev->top[t].cpu_ms, ev->top[t].wake);
	}
	return 0;
}

static int show_tasks(struct seq_file *s, unsigned int i)
{
	struct batmon_iter *it = s->private;
	const struct batmon_task *snap = it->array;
	char sleep[16];

	fmt_hms((s64)(snap[i].sleep / NSEC_PER_MSEC), sleep, sizeof(sleep));
	seq_printf(s, "%7d %5u %-16s cpu_ms %10llu wake %6llu sleep %s "
		   "nvcsw %u nivcsw %u r %llu w %llu\n",
		   snap[i].pid, snap[i].uid, snap[i].comm,
		   (u64)(snap[i].cpu / NSEC_PER_MSEC), snap[i].wake, sleep,
		   snap[i].nvcsw, snap[i].nivcsw, snap[i].rbytes,
		   snap[i].wbytes);
	return 0;
}

static int show_deltas(struct seq_file *s, unsigned int i)
{
	struct batmon_iter *it = s->private;
	const struct batmon_diff *d = it->array;
	char sleep[16];

	fmt_hms((s64)d[i].sleep_ms, sleep, sizeof(sleep));
	seq_printf(s, "%7d %5u %-16s cpu_ms %10llu wake %6llu sleep %s "
		   "nvcsw %u nivcsw %u r %llu w %llu\n",
		   d[i].pid, d[i].uid, d[i].comm, d[i].cpu_ms, d[i].wake,
		   sleep, d[i].nvcsw, d[i].nivcsw, d[i].rbytes, d[i].wbytes);
	return 0;
}

static int show_topwake(struct seq_file *s, unsigned int i)
{
	struct batmon_iter *it = s->private;
	const struct batmon_diff *d = it->array;

	seq_printf(s, "%7d %5u %-16s wake %6llu cpu_ms %10llu\n",
		   d[i].pid, d[i].uid, d[i].comm, d[i].wake, d[i].cpu_ms);
	return 0;
}

static int show_cpu(struct seq_file *s, void *v)
{
	unsigned int cpu;

	(void)v;
	for_each_possible_cpu(cpu) {
		unsigned int freq = cpufreq_quick_get(cpu);
		unsigned int max = cpufreq_quick_get_max(cpu);

		seq_printf(s, "cpu%u %u %u\n", cpu, freq, max);
	}
	return 0;
}

static int show_drain(struct seq_file *s, void *v)
{
	struct batmon_drain d;

	(void)v;
	batmon_drain_calc(&d);
	seq_printf(s, "capacity %d\n", d.cap);
	seq_printf(s, "voltage_mv %d\n", d.volt);
	seq_printf(s, "current_ma %d\n", d.cur_ma);
	seq_printf(s, "temp_cx10 %d\n", d.temp);
	seq_printf(s, "avg_ma_1m %d\n", d.avg_ma_1m);
	if (d.rate_1m != INT_MIN)
		seq_printf(s, "rate_1m %d.%03d%%/min\n", d.rate_1m / 1000,
			   abs(d.rate_1m % 1000));
	else
		seq_puts(s, "rate_1m n/a\n");
	if (d.rate_5m != INT_MIN)
		seq_printf(s, "rate_5m %d.%03d%%/min\n", d.rate_5m / 1000,
			   abs(d.rate_5m % 1000));
	else
		seq_puts(s, "rate_5m n/a\n");
	if (d.rate_15m != INT_MIN)
		seq_printf(s, "rate_15m %d.%03d%%/min\n", d.rate_15m / 1000,
			   abs(d.rate_15m % 1000));
	else
		seq_puts(s, "rate_15m n/a\n");
	if (d.volt_slope_1m != INT_MIN)
		seq_printf(s, "volt_slope_1m %d.%d mv/min\n",
			   d.volt_slope_1m / 10, abs(d.volt_slope_1m % 10));
	else
		seq_puts(s, "volt_slope_1m n/a\n");
	return 0;
}

static int show_suspend(struct seq_file *s, void *v)
{
	struct batmon_suspend_entry *log;
	unsigned int nr, head, i;

	(void)v;
	batmon_suspend_get(&log, &nr, &head);
	for (i = 0; i < nr; i++) {
		struct batmon_suspend_entry *se;
		char wall[16];
		char dur[16];

		se = &log[(head + BATMON_SUSPEND_LOG - 1 - i) %
			  BATMON_SUSPEND_LOG];
		fmt_wall(se->wall, wall, sizeof(wall));
		if (se->resumed) {
			fmt_hms((s64)se->duration_ms, dur, sizeof(dur));
			seq_printf(s, "%s resume after %s\n", wall, dur);
		} else {
			seq_printf(s, "%s suspend\n", wall);
		}
	}
	return 0;
}

static int show_config(struct seq_file *s, void *v)
{
	(void)v;
	seq_printf(s, "poll_ms %u\n", batmon_cfg.poll_ms);
	seq_printf(s, "jump_pct %u\n", batmon_cfg.jump_pct);
	seq_printf(s, "rate_pct_min %u\n", batmon_cfg.rate_pct_min);
	seq_printf(s, "warn_ma %u\n", batmon_cfg.warn_ma);
	seq_printf(s, "drop_ma %u\n", batmon_cfg.drop_ma);
	seq_printf(s, "drop_pct_min %u\n", batmon_cfg.drop_pct_min);
	seq_printf(s, "enabled %u\n", batmon_cfg.enabled);
	seq_printf(s, "log_dmesg %u\n", batmon_cfg.log_dmesg);
	return 0;
}

static ssize_t config_write(struct file *file, const char __user *buf,
			    size_t len, loff_t *off)
{
	char *kbuf, *p;

	(void)file;
	(void)off;
	if (len > PAGE_SIZE)
		return -EINVAL;
	kbuf = memdup_user_nul(buf, len);
	if (IS_ERR(kbuf))
		return PTR_ERR(kbuf);

	p = kbuf;
	while (p && *p) {
		char *nl = strchr(p, '\n');
		char *eq = strchr(p, '=');
		unsigned long v;

		if (nl)
			*nl = '\0';
		if (eq) {
			*eq = '\0';
			v = simple_strtoul(eq + 1, NULL, 0);
			if (!strcmp(p, "poll_ms"))
				batmon_cfg.poll_ms = clamp_t(unsigned int, v,
							     1000, 60000);
			else if (!strcmp(p, "jump_pct"))
				batmon_cfg.jump_pct = v;
			else if (!strcmp(p, "rate_pct_min"))
				batmon_cfg.rate_pct_min = v;
			else if (!strcmp(p, "warn_ma"))
				batmon_cfg.warn_ma = v;
			else if (!strcmp(p, "drop_ma"))
				batmon_cfg.drop_ma = v;
			else if (!strcmp(p, "drop_pct_min"))
				batmon_cfg.drop_pct_min = v;
			else if (!strcmp(p, "enabled"))
				batmon_cfg.enabled = v != 0;
			else if (!strcmp(p, "log_dmesg"))
				batmon_cfg.log_dmesg = v != 0;
		}
		p = nl ? nl + 1 : NULL;
	}
	kfree(kbuf);
	return len;
}

static int single_open_show(struct inode *inode, struct file *file,
			    int (*show)(struct seq_file *, void *))
{
	(void)inode;
	return single_open(file, show, NULL);
}

static int info_open(struct inode *inode, struct file *file)
{
	return single_open_show(inode, file, show_info);
}

static int battery_open(struct inode *inode, struct file *file)
{
	return single_open_show(inode, file, show_battery);
}

static int psy_open(struct inode *inode, struct file *file)
{
	return single_open_show(inode, file, show_psy);
}

static int cpu_open(struct inode *inode, struct file *file)
{
	return single_open_show(inode, file, show_cpu);
}

static int drain_open(struct inode *inode, struct file *file)
{
	return single_open_show(inode, file, show_drain);
}

static int suspend_open(struct inode *inode, struct file *file)
{
	return single_open_show(inode, file, show_suspend);
}

static int config_open(struct inode *inode, struct file *file)
{
	return single_open_show(inode, file, show_config);
}

static int history_open(struct inode *inode, struct file *file)
{
	struct batmon_sample *hist;
	struct batmon_iter *it;
	unsigned int nr, head;

	(void)inode;
	batmon_history_get(&hist, &nr, &head);
	it = kzalloc(sizeof(*it), GFP_KERNEL);
	if (!it)
		return -ENOMEM;
	it->array = hist;
	it->count = nr;
	it->head = head;
	it->show = show_history;
	return batmon_seq_open(file, it);
}

static int events_open(struct inode *inode, struct file *file)
{
	struct batmon_event *events;
	struct batmon_iter *it;
	unsigned int nr, head;

	(void)inode;
	batmon_events_get(&events, &nr, &head);
	it = kzalloc(sizeof(*it), GFP_KERNEL);
	if (!it)
		return -ENOMEM;
	it->array = events;
	it->count = nr;
	it->head = head;
	it->show = show_events;
	return batmon_seq_open(file, it);
}

static void *tasks_start(struct seq_file *s, loff_t *pos)
{
	struct batmon_iter *it = s->private;

	batmon_snap_acquire();
	it->array = batmon_snap_current(&it->count);
	if (*pos >= it->count)
		return NULL;
	return (void *)(unsigned long)(*pos + 1);
}

static void tasks_stop(struct seq_file *s, void *v)
{
	(void)s;
	(void)v;
	batmon_snap_release();
}

static const struct seq_operations tasks_ops = {
	.start = tasks_start,
	.next = batmon_iter_next,
	.stop = tasks_stop,
	.show = batmon_iter_show,
};

static int tasks_open(struct inode *inode, struct file *file)
{
	struct batmon_iter *it;
	int rc;

	(void)inode;
	it = kzalloc(sizeof(*it), GFP_KERNEL);
	if (!it)
		return -ENOMEM;
	it->show = show_tasks;
	rc = seq_open(file, &tasks_ops);
	if (rc) {
		kfree(it);
		return rc;
	}
	((struct seq_file *)file->private_data)->private = it;
	return 0;
}

static int delta_common_open(struct inode *inode, struct file *file,
			     bool by_wake)
{
	struct batmon_iter *it;
	struct batmon_diff *d;
	struct batmon_task *cur, *user;
	unsigned int cur_n, user_n, n;
	int rc;

	(void)inode;
	d = kmalloc_array(BATMON_MAX_TASKS, sizeof(*d), GFP_KERNEL);
	if (!d)
		return -ENOMEM;
	it = kzalloc(sizeof(*it), GFP_KERNEL);
	if (!it) {
		kfree(d);
		return -ENOMEM;
	}

	batmon_snap_acquire();
	cur = batmon_snap_current(&cur_n);
	user = batmon_snap_user_get(&user_n);
	batmon_build_diff(cur, user, cur_n, user_n, d, &n);
	if (by_wake)
		sort(d, n, sizeof(*d), batmon_cmp_wake, NULL);
	else
		sort(d, n, sizeof(*d), batmon_cmp_cpu, NULL);
	batmon_snap_user_set(cur, cur_n);
	batmon_snap_release();

	it->array = d;
	it->count = n;
	it->show = by_wake ? show_topwake : show_deltas;
	rc = seq_open(file, &batmon_seq_ops);
	if (rc) {
		kfree(d);
		kfree(it);
		return rc;
	}
	((struct seq_file *)file->private_data)->private = it;
	return 0;
}

static int deltas_open(struct inode *inode, struct file *file)
{
	return delta_common_open(inode, file, false);
}

static int topwake_open(struct inode *inode, struct file *file)
{
	return delta_common_open(inode, file, true);
}

static int delta_release(struct inode *inode, struct file *file)
{
	struct seq_file *s = file->private_data;
	struct batmon_iter *it = s->private;

	kfree(it->array);
	kfree(it);
	return seq_release(inode, file);
}

static const struct proc_ops info_fops = {
	.proc_open = info_open,
	.proc_read = seq_read,
	.proc_lseek = seq_lseek,
	.proc_release = single_release,
};

static const struct proc_ops battery_fops = {
	.proc_open = battery_open,
	.proc_read = seq_read,
	.proc_lseek = seq_lseek,
	.proc_release = single_release,
};

static const struct proc_ops psy_fops = {
	.proc_open = psy_open,
	.proc_read = seq_read,
	.proc_lseek = seq_lseek,
	.proc_release = single_release,
};

static const struct proc_ops history_fops = {
	.proc_open = history_open,
	.proc_read = seq_read,
	.proc_lseek = seq_lseek,
	.proc_release = batmon_seq_release,
};

static const struct proc_ops events_fops = {
	.proc_open = events_open,
	.proc_read = seq_read,
	.proc_lseek = seq_lseek,
	.proc_release = batmon_seq_release,
};

static const struct proc_ops tasks_fops = {
	.proc_open = tasks_open,
	.proc_read = seq_read,
	.proc_lseek = seq_lseek,
	.proc_release = batmon_seq_release,
};

static const struct proc_ops deltas_fops = {
	.proc_open = deltas_open,
	.proc_read = seq_read,
	.proc_lseek = seq_lseek,
	.proc_release = delta_release,
};

static const struct proc_ops topwake_fops = {
	.proc_open = topwake_open,
	.proc_read = seq_read,
	.proc_lseek = seq_lseek,
	.proc_release = delta_release,
};

static const struct proc_ops cpu_fops = {
	.proc_open = cpu_open,
	.proc_read = seq_read,
	.proc_lseek = seq_lseek,
	.proc_release = single_release,
};

static const struct proc_ops drain_fops = {
	.proc_open = drain_open,
	.proc_read = seq_read,
	.proc_lseek = seq_lseek,
	.proc_release = single_release,
};

static const struct proc_ops suspend_fops = {
	.proc_open = suspend_open,
	.proc_read = seq_read,
	.proc_lseek = seq_lseek,
	.proc_release = single_release,
};

static const struct proc_ops config_fops = {
	.proc_open = config_open,
	.proc_read = seq_read,
	.proc_lseek = seq_lseek,
	.proc_write = config_write,
	.proc_release = single_release,
};

int batmon_proc_init(void)
{
	batmon_proc_dir = proc_mkdir("batmon", NULL);
	if (!batmon_proc_dir)
		return -ENOMEM;

	proc_create("info", 0444, batmon_proc_dir, &info_fops);
	proc_create("battery", 0444, batmon_proc_dir, &battery_fops);
	proc_create("psy", 0444, batmon_proc_dir, &psy_fops);
	proc_create("history", 0444, batmon_proc_dir, &history_fops);
	proc_create("events", 0444, batmon_proc_dir, &events_fops);
	proc_create("tasks", 0444, batmon_proc_dir, &tasks_fops);
	proc_create("deltas", 0444, batmon_proc_dir, &deltas_fops);
	proc_create("topwake", 0444, batmon_proc_dir, &topwake_fops);
	proc_create("cpu", 0444, batmon_proc_dir, &cpu_fops);
	proc_create("drain", 0444, batmon_proc_dir, &drain_fops);
	proc_create("suspend", 0444, batmon_proc_dir, &suspend_fops);
	proc_create("config", 0644, batmon_proc_dir, &config_fops);
	return 0;
}

void batmon_proc_exit(void)
{
	proc_remove(batmon_proc_dir);
}
