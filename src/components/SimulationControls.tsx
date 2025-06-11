"use client";

import React, { useState, useEffect, useCallback, useRef, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import {
  LuPlay,
  LuPause,
  LuSkipForward,
  LuRefreshCw,
  LuClock,
  LuActivity,
  LuKeyboard,
  LuSave,
} from "react-icons/lu";
import { useSimulationContext } from "@/context/SimulationContext";
import simulationApiSimple, { ApiError, getErrorMessage } from "@/lib/api_new";
import { Simulation } from "@/types/simulation";

// Move colors outside component to prevent recreation on every render
const colors = {
  surface: {
    a0: "#121212",
    a10: "#282828",
    a20: "#3f3f3f",
    a30: "#575757",
    a40: "#717171",
    a50: "#8b8b8b",
  },
  surfaceTonal: {
    a0: "#1a2623",
    a10: "#2f3a38",
    a20: "#46504d",
    a30: "#5e6764",
    a40: "#767e7c",
    a50: "#909795",
  },
  primary: {
    a0: "#01fbd9",
    a10: "#51fcdd",
    a20: "#73fde1",
    a30: "#8dfee5",
    a40: "#a4feea",
    a50: "#b8ffee",
  },
  light: "#ffffff",
};

// Format time helper function - moved outside component to prevent recreation
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
}

interface SimulationControlsProps {
  className?: string;
  showKeyboardShortcuts?: boolean;
  showAdvancedControls?: boolean;
  onStepClick?: () => void | Promise<void>; // New prop for custom step handler
}

const SimulationControls = memo<SimulationControlsProps>(function SimulationControls({
   className = "",
   showKeyboardShortcuts = true,
   showAdvancedControls = true,
   onStepClick, // New prop
 }: SimulationControlsProps) {
  const {
    simulation,
    isLoading: contextIsLoading,
    isSimulationRunning,
    error: contextError,
    // isConnected,
    clearError,
  } = useSimulationContext();

  // Local state for API operations
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localSimulation, setLocalSimulation] = useState<Simulation | null>(null);

  // Local state for enhanced features
  const [simulationSpeed, setSimulationSpeed] = useState([1]);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Refs for tracking time
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use local simulation state if available, otherwise fallback to context
  const [currentSimulation, setCurrentSimulation] = useState<Simulation | null>(null);
  const currentError = error || contextError;
  const currentIsLoading = isLoading || contextIsLoading;

  interface ApiResponse {
    simulation: Simulation;
  }
  const fetchSimulationData = async () => {
    try {
      // Get the ID from localStorage
      const id = localStorage.getItem("id");

      // 3. Check if the ID exists before making the API call (Fixes the 'null' error)
      if (id) {
        const simulationData = await simulationApiSimple.getSimulation(id) as unknown as ApiResponse;
        console.log("DAri fetch wak", simulationData)
        setCurrentSimulation(simulationData.simulation);
        return simulationData;
      } else {
        // If there's no ID, we don't need to fetch anything.
        // You could set an error or handle this case as needed.
        console.log("No simulation ID found in localStorage.");
      }
    } catch (err) {
      console.error("Failed to fetch simulation:", err);
      setError("Failed to load simulation data.");
    } finally {
      // 4. Stop the loading indicator regardless of outcome
      setIsLoading(false);
    }
  };

  // Update local simulation when context simulation changes
  useEffect(() => {
    if (simulation && !localSimulation) {
      setLocalSimulation(simulation);
    }
  }, [simulation, localSimulation]);

  // Helper function to update simulation state
  const updateSimulationState = useCallback((updatedSimulation: Simulation) => {
    setLocalSimulation(updatedSimulation);
    // You could also update the context here if needed
    // updateContextSimulation(updatedSimulation);
  }, []);

  // Direct API handlers with strict typing
  const handlePlayPause = useCallback(async (): Promise<void> => {
    const response = await fetchSimulationData() as unknown as ApiResponse;
    setCurrentSimulation(response.simulation);
    const simulation = response.simulation;
    console.log("From handle you know who", response);
    console.log("Button clicked");
    console.log("Is running:", isSimulationRunning);
    console.log("Simulation:", simulation);

    if (!simulation) {
      console.error("No simulation available");
      setError("No simulation available");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let updatedSimulation: Simulation;

      if (isSimulationRunning) {
        console.log("Stopping simulation...");
        updatedSimulation = await simulationApiSimple.stopSimulation(response.simulation.id);
        console.log("Simulation stopped:", updatedSimulation);
      } else {
        console.log("Starting simulation...");
        updatedSimulation = await simulationApiSimple.startSimulation(response.simulation.id);
        console.log("Simulation started:", updatedSimulation);
      }

      updateSimulationState(updatedSimulation);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      console.error("Failed to toggle simulation:", errorMessage);
      setError(errorMessage);

      if (err instanceof ApiError) {
        console.error("API Error details:", {
          status: err.status,
          data: err.data,
          code: err.code
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchSimulationData, isSimulationRunning, updateSimulationState]);

  // Modified handleStep to use custom handler if provided
  const handleStep = useCallback(async (): Promise<void> => {
    // If custom step handler is provided, use it instead
    if (onStepClick) {
      try {
        await onStepClick();
      } catch (err) {
        console.error("Custom step handler failed:", err);
        setError("Step operation failed");
      }
      return;
    }

    // Default step behavior
    const response = await fetchSimulationData() as unknown as ApiResponse;
    const simulation = response.simulation;
    console.log("Step button clicked");

    if (isSimulationRunning) {
      console.warn("Cannot step while simulation is running");
      setError("Cannot step while simulation is running");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("Stepping simulation...");
      const updatedSimulation = await simulationApiSimple.stepSimulation(simulation.id);
      localStorage.setItem("simulation", JSON.stringify(updatedSimulation));
      console.log("Simulation stepped:", updatedSimulation);
      updateSimulationState(updatedSimulation);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      console.error("Failed to step simulation:", errorMessage);
      setError(errorMessage);

      if (err instanceof ApiError) {
        console.error("API Error details:", {
          status: err.status,
          data: err.data,
          code: err.code
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [onStepClick, fetchSimulationData, isSimulationRunning, updateSimulationState]);

  const handleReset = useCallback(async (): Promise<void> => {
    console.log("Reset button clicked");
    console.log("Simulation:", currentSimulation);

    if (!currentSimulation) {
      console.error("No simulation available for reset");
      setError("No simulation available");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("Resetting simulation...");
      const updatedSimulation = await simulationApiSimple.resetSimulation(currentSimulation.id);
      console.log("Simulation reset:", updatedSimulation);
      updateSimulationState(updatedSimulation);
      setElapsedTime(0); // Reset elapsed time
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      console.error("Failed to reset simulation:", errorMessage);
      setError(errorMessage);

      if (err instanceof ApiError) {
        console.error("API Error details:", {
          status: err.status,
          data: err.data,
          code: err.code
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentSimulation, updateSimulationState]);

  // Handle simulation speed change
  const handleSpeedChange = useCallback(async (value: number[]): Promise<void> => {
    const newSpeed = value[0];
    setSimulationSpeed(value);

    // Store in localStorage for persistence
    localStorage.setItem("bacteria-simulation-speed", JSON.stringify(newSpeed));

    // Update backend if simulation exists
    if (currentSimulation?.id) {
      try {
        setError(null);
        const updatedSimulation = await simulationApiSimple.updateSimulationSpeed(
            currentSimulation.id,
            newSpeed
        );
        updateSimulationState(updatedSimulation);
        console.log("Simulation speed updated successfully:", updatedSimulation);
      } catch (err: unknown) {
        const errorMessage = getErrorMessage(err);
        console.error("Failed to update simulation speed:", errorMessage);
        setError(errorMessage);
        // Revert the slider to previous value
        const savedSpeed = localStorage.getItem("bacteria-simulation-speed");
        if (savedSpeed) {
          setSimulationSpeed([JSON.parse(savedSpeed)]);
        }
      }
    }
  }, [currentSimulation?.id, updateSimulationState]);

  // Handle auto-save toggle
  const handleAutoSaveToggle = useCallback((enabled: boolean) => {
    setAutoSaveEnabled(enabled);
    localStorage.setItem(
        "bacteria-simulation-autosave",
        JSON.stringify(enabled)
    );
  }, []);

  const handleToggleShortcuts = useCallback(() => {
    setShowShortcuts(prev => !prev);
  }, []);

  // Clear error handler
  const handleClearError = useCallback(() => {
    setError(null);
    if (clearError) {
      clearError();
    }
  }, [clearError]);

  // Load preferences from localStorage on mount and sync with simulation
  useEffect(() => {
    const savedSpeed = localStorage.getItem("bacteria-simulation-speed");
    const savedAutoSave = localStorage.getItem("bacteria-simulation-autosave");

    // Use simulation speed if available, otherwise use saved/default
    const currentSpeed = currentSimulation?.currentState?.simulationSpeed;
    if (currentSpeed) {
      setSimulationSpeed(prevSpeed => {
        if (prevSpeed[0] !== currentSpeed) {
          return [currentSpeed];
        }
        return prevSpeed;
      });
    } else if (savedSpeed) {
      setSimulationSpeed([JSON.parse(savedSpeed)]);
    }

    if (savedAutoSave) {
      setAutoSaveEnabled(JSON.parse(savedAutoSave));
    }
  }, [currentSimulation?.currentState?.simulationSpeed]);

  // Track elapsed time
  useEffect(() => {
    if (isSimulationRunning) {
      startTimeRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor(
              (Date.now() - startTimeRef.current) / 1000
          );
          setElapsedTime(elapsed);
        }
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (!currentSimulation) {
        setElapsedTime(0);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isSimulationRunning, currentSimulation]);

  // Memoized keyboard event handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts if user is typing in an input
    if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    switch (e.key.toLowerCase()) {
      case " ":
      case "spacebar":
        e.preventDefault();
        handlePlayPause();
        break;
      case "n":
      case "arrowright":
        e.preventDefault();
        if (currentSimulation && !currentIsLoading && !isSimulationRunning) {
          handleStep();
        }
        break;
      case "r":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (currentSimulation && !currentIsLoading) {
            handleReset();
          }
        }
        break;
      case "?":
        e.preventDefault();
        setShowShortcuts(prev => !prev);
        break;
    }
  }, [handlePlayPause, handleStep, handleReset, currentSimulation, currentIsLoading, isSimulationRunning]);

  // Keyboard shortcuts
  useEffect(() => {
    if (showKeyboardShortcuts) {
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [showKeyboardShortcuts, handleKeyDown]);

  const currentGeneration = currentSimulation?.currentState?.generation || 0;
  // const canStart = !currentIsLoading && currentSimulation && !isSimulationRunning && isConnected;
  // const canStop = !currentIsLoading && currentSimulation && isSimulationRunning;
  // const canStep = !currentIsLoading && currentSimulation && !isSimulationRunning && isConnected;
  // const canReset = !currentIsLoading && currentSimulation && isConnected;

  return (
      <TooltipProvider>
        <Card
            className={`w-full border ${className}`}
            style={{
              backgroundColor: `${colors.surface.a10}cc`,
              backdropFilter: "blur(12px)",
              borderColor: colors.surface.a20,
            }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center space-x-2">
                <LuActivity
                    className="h-5 w-5"
                    style={{ color: colors.primary.a0 }}
                />
                <span style={{ color: colors.light }}>Simulation Controls</span>
              </div>
              {showKeyboardShortcuts && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleToggleShortcuts}
                          className="h-6 w-6 p-0"
                      >
                        <LuKeyboard className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Show keyboard shortcuts</p>
                    </TooltipContent>
                  </Tooltip>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Main Control Buttons */}
            <div className="flex space-x-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                      onClick={handlePlayPause}
                      disabled={false}
                      variant={isSimulationRunning ? "destructive" : "default"}
                      size="sm"
                  >
                    {currentIsLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : isSimulationRunning ? (
                        <LuPause className="h-4 w-4 mr-2" />
                    ) : (
                        <LuPlay className="h-4 w-4 mr-2" />
                    )}
                    {isSimulationRunning ? "Pause" : "Start"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {isSimulationRunning
                        ? "Pause simulation (Space)"
                        : "Start simulation (Space)"}
                  </p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                      onClick={handleStep}
                      disabled={false}
                      variant="outline"
                      size="sm"
                  >
                    {currentIsLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <LuSkipForward className="h-4 w-4 mr-2" />
                    )}
                    Step
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Advance one generation (N or →)</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                      onClick={handleReset}
                      disabled={false}
                      variant="outline"
                      size="sm"
                  >
                    {currentIsLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <LuRefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Reset
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reset simulation (Ctrl+R)</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Status Indicators */}
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center space-x-2">
                <LuActivity className="h-4 w-4" />
                <span className="font-medium">Generation:</span>
                <Badge variant="outline">{currentGeneration}</Badge>
              </div>
              <div className="flex items-center space-x-2">
                <LuClock className="h-4 w-4" />
                <span className="font-medium">Time:</span>
                <span className="font-mono">{formatTime(elapsedTime)}</span>
              </div>
            </div>

            {/* Advanced Controls */}
            {showAdvancedControls && (
                <>
                  {/* Speed Control */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="speed-slider" className="text-sm font-medium">
                        Simulation Speed
                      </Label>
                      <span className="text-sm text-muted-foreground">
                    {simulationSpeed[0]}x
                  </span>
                    </div>
                    <div
                        className="relative p-1 rounded-lg border"
                        style={{
                          backgroundColor: `${colors.surface.a20}40`,
                          borderColor: colors.surface.a30,
                        }}
                    >
                      <Slider
                          id="speed-slider"
                          min={1}
                          max={10}
                          step={1}
                          value={simulationSpeed}
                          onValueChange={handleSpeedChange}
                          disabled={currentIsLoading}
                          className="w-full [&>span]:bg-transparent [&>span>span]:bg-primary [&>button]:border-primary [&>button]:bg-primary [&>button]:h-4 [&>button]:w-4"
                      />
                    </div>
                  </div>

                  {/* Auto-save Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <LuSave className="h-4 w-4" />
                      <Label htmlFor="auto-save" className="text-sm font-medium">
                        Auto-save simulation
                      </Label>
                    </div>
                    <Switch
                        id="auto-save"
                        checked={autoSaveEnabled}
                        onCheckedChange={handleAutoSaveToggle}
                        disabled={currentIsLoading}
                    />
                  </div>
                </>
            )}

            {/* Error Display */}
            {currentError && (
                <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                  {currentError}
                  <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearError}
                      className="ml-2 h-auto p-0 text-destructive"
                  >
                    Clear
                  </Button>
                </div>
            )}

            {/* Keyboard Shortcuts Help */}
            {showShortcuts && showKeyboardShortcuts && (
                <div className="mt-4 p-3 bg-muted rounded-lg text-xs space-y-1">
                  <div className="font-medium text-sm mb-2">
                    Keyboard Shortcuts:
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <kbd className="px-1 py-0.5 bg-background rounded text-xs">
                        Space
                      </kbd>{" "}
                      Play/Pause
                    </div>
                    <div>
                      <kbd className="px-1 py-0.5 bg-background rounded text-xs">
                        N
                      </kbd>{" "}
                      Step forward
                    </div>
                    <div>
                      <kbd className="px-1 py-0.5 bg-background rounded text-xs">
                        Ctrl+R
                      </kbd>{" "}
                      Reset
                    </div>
                    <div>
                      <kbd className="px-1 py-0.5 bg-background rounded text-xs">
                        ?
                      </kbd>{" "}
                      Toggle help
                    </div>
                  </div>
                </div>
            )}
          </CardContent>
        </Card>
      </TooltipProvider>
  );
});

export default SimulationControls;
