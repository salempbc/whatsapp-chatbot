import { getStats } from '@/app/actions/todo.actions';
import { formatEstimate } from '@/lib/dateUtils';
import { CheckCircle2, Clock, AlertCircle, ListTodo } from 'lucide-react';

export default async function StatsCards() {
  const result = await getStats();
  const { total = 0, completed = 0, active = 0, overdue = 0, totalEstimatedMins = 0, completedEstimatedMins = 0 } = result.data ?? {};

  const cards = [
    {
      label: 'Total Tasks',
      value: total,
      icon: ListTodo,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      label: 'Active',
      value: active,
      icon: Clock,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      label: 'Completed',
      value: completed,
      subText: `${completed}/${total}`,
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      label: 'Overdue',
      value: overdue,
      icon: AlertCircle,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`rounded-xl border ${card.border} ${card.bg} p-4 flex flex-col gap-2`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <div>
                <span className={`text-2xl font-bold ${card.color}`}>{card.value}</span>
                {card.subText && (
                  <span className="ml-1.5 text-xs text-muted-foreground">{card.subText}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {totalEstimatedMins > 0 && (
        <p className="text-xs text-muted-foreground px-0.5">
          Total estimated:{' '}
          <span className="font-medium text-foreground">{formatEstimate(totalEstimatedMins)}</span>
          {' · '}
          <span className="text-emerald-500 font-medium">{formatEstimate(completedEstimatedMins)}</span>
          {' done'}
        </p>
      )}
    </div>
  );
}
