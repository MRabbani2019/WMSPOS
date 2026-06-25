import { useState } from 'react';
import { X, ShieldCheck, ShieldAlert, Calendar } from 'lucide-react';

interface AgeVerificationModalProps {
  productName: string;
  minimumAge: number;
  challengeAge: number; // e.g. 25 for Challenge 25
  onConfirm: () => void;
  onReject: () => void;
}

export default function AgeVerificationModal({
  productName,
  minimumAge,
  challengeAge,
  onConfirm,
  onReject,
}: AgeVerificationModalProps) {
  const [mode, setMode] = useState<'prompt' | 'dob'>('prompt');
  const [dob, setDob] = useState('');
  const [idChecked, setIdChecked] = useState(false);
  const [error, setError] = useState('');

  const handleVisualConfirm = () => {
    if (!idChecked) {
      setError('You must confirm ID has been checked');
      return;
    }
    onConfirm();
  };

  const handleDobConfirm = () => {
    if (!dob) {
      setError('Please enter date of birth');
      return;
    }

    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < minimumAge) {
      setError(`Customer is ${age} years old. Minimum age is ${minimumAge}. Sale refused.`);
      return;
    }

    onConfirm();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="bg-warning-600 text-white p-4 rounded-t-lg flex items-center gap-3">
          <ShieldAlert className="w-8 h-8" />
          <div>
            <h2 className="text-lg font-bold">Age Verification Required</h2>
            <p className="text-sm opacity-90">This product is age-restricted</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
            <p className="font-medium text-warning-800">{productName}</p>
            <p className="text-sm text-warning-700 mt-1">
              Minimum age: <span className="font-bold">{minimumAge}</span> |
              Challenge age: <span className="font-bold">{challengeAge}</span>
            </p>
            <p className="text-xs text-warning-600 mt-2">
              Under Challenge {challengeAge} policy, you must ask for ID if the customer appears
              to be under {challengeAge} years old.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {mode === 'prompt' ? (
            <>
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={idChecked}
                    onChange={(e) => { setIdChecked(e.target.checked); setError(''); }}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="font-medium text-sm">I have visually verified the customer's age</p>
                    <p className="text-xs text-gray-500">
                      Customer appears over {challengeAge}, or valid photo ID has been checked
                    </p>
                  </div>
                </label>

                <button
                  onClick={() => setMode('dob')}
                  className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-3"
                >
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-sm">Enter date of birth from ID</p>
                    <p className="text-xs text-gray-500">For accurate verification from photo ID</p>
                  </div>
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleVisualConfirm}
                  disabled={!idChecked}
                  className="flex-1 btn-success flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={onReject}
                  className="flex-1 btn-danger"
                >
                  Refuse Sale
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth (from ID)
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => { setDob(e.target.value); setError(''); }}
                  className="input-field"
                  max={new Date().toISOString().split('T')[0]}
                  autoFocus
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleDobConfirm}
                  disabled={!dob}
                  className="flex-1 btn-success flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Verify & Approve
                </button>
                <button
                  onClick={() => setMode('prompt')}
                  className="flex-1 btn-secondary"
                >
                  Back
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
