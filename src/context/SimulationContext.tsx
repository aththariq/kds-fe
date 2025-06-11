"use client";

import React, { createContext, useContext, ReactNode, useMemo } from "react";
import { useSimulation } from "@/hooks/useSimulation";
import {
  Simulation,
  SimulationParametersInput,
  Bacterium,
} from "@/types/simulation";

// Define the context interface
interface SimulationContextType {
  // State
  simulation: Simulation | null;
  bacteria: Bacterium[];
  isLoading: boolean;
  isSimulationRunning: boolean;
  error: string | null;
  isConnected: boolean;

  // Actions
  createSimulation: (
    name: string,
    parameters: SimulationParametersInput
  ) => Promise<void>;
  loadSimulation: (id: string) => Promise<void>;
  startSimulation: () => Promise<void>;
  stopSimulation: () => Promise<void>;
  stepSimulation: () => Promise<void>;
  resetSimulation: () => Promise<void>;
  updateParameters: (
    parameters: Partial<SimulationParametersInput>
  ) => void;
  clearError: () => void;
  checkConnection: () => Promise<void>;
}

// Create the context
const SimulationContext = createContext<SimulationContextType | undefined>(
  undefined
);

// Provider props interface
interface SimulationProviderProps {
  children: ReactNode;
  autoRefresh?: boolean;
  refreshInterval?: number;
  // New debouncing options
  enableDebouncing?: boolean;
  enableAdaptiveRefresh?: boolean;
  enableBatching?: boolean;
  prioritizeCriticalUpdates?: boolean;
}

// Context provider component
export const SimulationProvider: React.FC<SimulationProviderProps> = ({
  children,
  autoRefresh = true,
  refreshInterval = 1000,
  enableDebouncing = true,
  enableAdaptiveRefresh = true,
  enableBatching = true,
  prioritizeCriticalUpdates = true,
}) => {
  // Use the existing hook to manage simulation state
  const simulationState = useSimulation({
    autoRefresh,
    refreshInterval,
    enableDebouncing,
    enableAdaptiveRefresh,
    enableBatching,
    prioritizeCriticalUpdates,
  });

  return (
    <SimulationContext.Provider value={simulationState}>
      {children}
    </SimulationContext.Provider>
  );
};

// Custom hook to access the simulation context
export const useSimulationContext = (): SimulationContextType => {
  const context = useContext(SimulationContext);

  if (context === undefined) {
    throw new Error(
      "useSimulationContext must be used within a SimulationProvider"
    );
  }

  return context;
};

// Helper hook for simulation status only (for components that only need status)
export const useSimulationStatus = () => {
  const { simulation, isLoading, isSimulationRunning, error, isConnected } = useSimulationContext();

  return {
    simulation,
    isLoading,
    isSimulationRunning,
    error,
    isConnected,
    // Derived states
    hasSimulation: simulation !== null,
    currentGeneration: simulation?.currentState?.generation || 0,
    isHealthy: isConnected && !error,
  };
};

// Helper hook for bacteria data only (for visualization components)
export const useBacteriaData = () => {
  const { bacteria } = useSimulationContext();

  return useMemo(() => {
    const resistantCount = bacteria.filter(b => b.isResistant).length;
    const sensitiveCount = bacteria.length - resistantCount;
    const resistanceRatio = bacteria.length > 0 ? resistantCount / bacteria.length : 0;

    return {
      bacteria,
      totalCount: bacteria.length,
      resistantCount,
      sensitiveCount,
      resistanceRatio,
      resistancePercentage: resistanceRatio * 100,
      averageFitness: bacteria.length > 0
        ? bacteria.reduce((sum, b) => sum + (b.fitness || 0), 0) / bacteria.length
        : 0,
      averageAge: bacteria.length > 0
        ? bacteria.reduce((sum, b) => sum + (b.age || 0), 0) / bacteria.length
        : 0,
    };
  }, [bacteria]);
};

// Helper hook for simulation controls (for control panels)
export const useSimulationControls = () => {
  const {
    createSimulation,
    startSimulation,
    stopSimulation,
    stepSimulation,
    resetSimulation,
    updateParameters,
    clearError,
    isLoading,
    isSimulationRunning,
    simulation,
  } = useSimulationContext();

  return {
    // Actions
    createSimulation,
    startSimulation,
    stopSimulation,
    stepSimulation,
    resetSimulation,
    updateParameters,
    clearError,

    // State for controls
    isLoading,
    isSimulationRunning,
    canStart: !isLoading && simulation && !isSimulationRunning,
    canStop: !isLoading && simulation && isSimulationRunning,
    canStep: !isLoading && simulation && !isSimulationRunning,
    canReset: !isLoading && simulation,
    canCreateNew: !isLoading,
  };
};

// Helper hook for error handling
export const useSimulationErrors = () => {
  const { error, isConnected, clearError, checkConnection } = useSimulationContext();

  return {
    error,
    hasError: !!error,
    isConnected,
    isNetworkError: !isConnected,
    clearError,
    checkConnection,
    // Error categories
    errorType: error
      ? (!isConnected ? 'network' : 'simulation')
      : null,
  };
};

// Export the context for advanced use cases
export { SimulationContext };
