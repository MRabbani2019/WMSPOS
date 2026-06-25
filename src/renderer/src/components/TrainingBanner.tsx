import { GraduationCap } from 'lucide-react';
import { useTrainingStore } from '../stores/trainingStore';

export default function TrainingBanner() {
  const isTrainingMode = useTrainingStore((state) => state.isTrainingMode);

  if (!isTrainingMode) return null;

  return (
    <div className="bg-warning-50 text-warning-700 border-b border-warning-200 px-4 py-2 flex items-center justify-center gap-2 font-bold text-sm tracking-wide">
      <GraduationCap className="w-5 h-5 text-warning-600" />
      TRAINING MODE — Transactions are simulated and will NOT affect live data
      <GraduationCap className="w-5 h-5 text-warning-600" />
    </div>
  );
}
