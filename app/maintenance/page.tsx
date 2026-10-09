import { Metadata } from "next";

export const metadata: Metadata = {
  title: "System Maintenance | RentTrack",
};

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mb-6">
          <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">System Under Maintenance</h1>
        <p className="text-lg text-gray-600 mb-8">
          We&apos;re currently performing scheduled maintenance to improve our services. We&apos;ll be back online shortly.
        </p>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-2">Expected downtime</p>
          <p className="text-2xl font-semibold text-gray-900 mb-4">A few minutes</p>
          <p className="text-sm text-gray-500">
            Thank you for your patience. We apologize for any inconvenience.
          </p>
        </div>
      </div>
    </div>
  );
}
