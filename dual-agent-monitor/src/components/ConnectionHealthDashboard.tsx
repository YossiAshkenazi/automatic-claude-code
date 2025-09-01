import React from "react";

export interface ConnectionHealthDashboardProps {
  isConnected: boolean;
  isReconnecting: boolean;
  connectionStatus: string;
  connectionHealth: any;
  connectionReliability: number;
  isUsingFallback: boolean;
  onReconnect: () => void;
}

const ConnectionHealthDashboard: React.FC<ConnectionHealthDashboardProps> = ({
  isConnected,
  isReconnecting,
  connectionStatus,
  connectionHealth,
  connectionReliability,
  isUsingFallback,
  onReconnect
}) => {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-white rounded-lg shadow">
        <h3 className="text-lg font-medium">
          {isConnected ? "Connected" : "Disconnected"}
        </h3>
        <p className="text-sm text-gray-600">
          Reliability: {connectionReliability.toFixed(1)}%
        </p>
        {(!isConnected || isReconnecting) && (
          <button 
            onClick={onReconnect}
            className="mt-2 px-3 py-1 bg-blue-600 text-white rounded"
          >
            {isReconnecting ? "Reconnecting..." : "Reconnect"}
          </button>
        )}
      </div>
    </div>
  );
};

export default ConnectionHealthDashboard;
