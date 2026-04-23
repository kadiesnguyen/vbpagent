package cmd

import (
	"context"

	"github.com/kadiesnguyen/vbpclaw/internal/agent"
	"github.com/kadiesnguyen/vbpclaw/internal/scheduler"
)

// makeHeartbeatRunFn creates a function that routes a heartbeat run through the scheduler's cron lane.
func makeHeartbeatRunFn(sched *scheduler.Scheduler) func(ctx context.Context, req agent.RunRequest) <-chan scheduler.RunOutcome {
	return func(ctx context.Context, req agent.RunRequest) <-chan scheduler.RunOutcome {
		return sched.Schedule(ctx, scheduler.LaneCron, req)
	}
}
