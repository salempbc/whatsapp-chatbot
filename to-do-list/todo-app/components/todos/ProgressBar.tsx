import { Progress } from '@/components/ui/progress';
import { formatEstimate } from '@/lib/dateUtils';

interface ProgressBarProps {
  total: number;
  completed: number;
  totalEstimatedMins: number;
  completedEstimatedMins: number;
}

export default function ProgressBar({
  total,
  completed,
  totalEstimatedMins,
  completedEstimatedMins,
}: ProgressBarProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const allDone = total > 0 && completed === total;
  const remainingMins = totalEstimatedMins - completedEstimatedMins;

  return (
    <div className="space-y-2">
      <Progress value={pct} className="h-2" />
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        {allDone ? (
          <span className="text-emerald-500 font-medium">
            ✓ All tasks complete!
          </span>
        ) : (
          <span>
            <span className="font-medium text-foreground">{pct}% complete</span>
            {' · '}
            {completed}/{total} tasks done
            {totalEstimatedMins > 0 && remainingMins > 0 && (
              <>
                {' · '}~{formatEstimate(remainingMins)} remaining
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
