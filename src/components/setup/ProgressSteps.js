import { cn } from '@/lib/utils';

const steps = [
  { id: 1, title: 'GitLab Setup', description: 'Configure GitLab connection' },
  { id: 2, title: 'Sheets Setup', description: 'Configure Google Sheets' },
  { id: 3, title: 'Column Mapping', description: 'Map sheet columns' },
  { id: 4, title: 'Project Mapping', description: 'Map projects to sheets' },
  { id: 5, title: 'Run Sync', description: 'Execute synchronization' },
];

export function ProgressSteps({ currentStep }) {
  return (
    <div className="relative">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        {/* Progress line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 z-0" />
        <div 
          className="absolute top-5 left-0 h-0.5 bg-blue-600 z-0 transition-all duration-500" 
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step, index) => (
          <div key={step.id} className="relative z-10 flex flex-col items-center">
            <div
              className={cn(
                "w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-semibold transition-all duration-300",
                currentStep > step.id
                  ? "bg-green-600 border-green-600 text-white"
                  : currentStep === step.id
                  ? "bg-blue-600 border-blue-600 text-white shadow-lg scale-110"
                  : "bg-white border-gray-300 text-gray-500"
              )}
            >
              {currentStep > step.id ? (
                <span>✓</span>
              ) : (
                <span>{step.id}</span>
              )}
            </div>
            <div className="mt-2 text-center">
              <div
                className={cn(
                  "text-sm font-medium transition-colors",
                  currentStep >= step.id ? "text-blue-900" : "text-gray-500"
                )}
              >
                {step.title}
              </div>
              <div className="text-xs text-gray-500 mt-1 max-w-20">
                {step.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
