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
import { simulationApiSimple } from "@/lib/api";

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
}

const SimulationControls = memo<SimulationControlsProps>(function SimulationControls({
  className = "",
  showKeyboardShortcuts = true,
  showAdvancedControls = true,
}: SimulationControlsProps) {
  const {
    simulation,
    isLoading,
    isSimulationRunning,
    error,
    isConnected,
    startSimulation,
    stopSimulation,
    stepSimulation,
    resetSimulation,
    clearError,
  } = useSimulationContext();

  // Local state for enhanced features
  const [simulationSpeed, setSimulationSpeed] = useState([1]);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Refs for tracking time
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle simulation speed change
  const handleSpeedChange = useCallback(async (value: number[]) => {
    const newSpeed = value[0];
    setSimulationSpeed(value);

    // Store in localStorage for persistence
    localStorage.setItem("bacteria-simulation-speed", JSON.stringify(newSpeed));

    // Update backend if simulation exists
    if (simulation?.id) {
      try {
        await simulationApiSimple.updateSimulationSpeed(simulation.id, newSpeed);
      } catch (error) {
        console.error("Failed to update simulation speed:", error);
        // Optionally show error to user or revert the slider
      }
    }
  }, [simulation?.id]);

  // Handle auto-save toggle
  const handleAutoSaveToggle = useCallback((enabled: boolean) => {
    setAutoSaveEnabled(enabled);
    localStorage.setItem(
      "bacteria-simulation-autosave",
      JSON.stringify(enabled)
    );
  }, []);

  // Memoized action handlers
  const handlePlayPause = useCallback(async () => {
    if (isSimulationRunning) {
      if (!isLoading) {
        await stopSimulation();
      }
    } else {
      if (simulation && !isLoading) {
        await startSimulation();
      }
    }
  }, [isSimulationRunning, isLoading, simulation, startSimulation, stopSimulation]);

  const handleStep = useCallback(async () => {
    if (simulation && !isLoading && !isSimulationRunning) {
      await stepSimulation();
    }
  }, [simulation, isLoading, isSimulationRunning, stepSimulation]);

  const handleReset = useCallback(async () => {
    if (simulation && !isLoading) {
      await resetSimulation();
    }
  }, [simulation, isLoading, resetSimulation]);

  const handleToggleShortcuts = useCallback(() => {
    setShowShortcuts(prev => !prev);
  }, []);

  // Load preferences from localStorage on mount and sync with simulation
  useEffect(() => {
    const savedSpeed = localStorage.getItem("bacteria-simulation-speed");
    const savedAutoSave = localStorage.getItem("bacteria-simulation-autosave");

    // Use simulation speed if available, otherwise use saved/default
    const currentSpeed = simulation?.currentState?.simulationSpeed;
    if (currentSpeed) {
      setSimulationSpeed(prevSpeed => {
        if (prevSpeed[0] != currentSpeed) {
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
  }, [simulation?.currentState?.simulationSpeed]);

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
      if (!simulation) {
        setElapsedTime(0);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isSimulationRunning, simulation]);

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
        if (isSimulationRunning) {
          stopSimulation();
        } else if (simulation && !isLoading) {
          startSimulation();
        }
        break;
      case "n":
      case "arrowright":
        e.preventDefault();
        if (simulation && !isLoading && !isSimulationRunning) {
          stepSimulation();
        }
        break;
      case "r":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (simulation && !isLoading) {
            resetSimulation();
          }
        }
        break;
      case "?":
        e.preventDefault();
        setShowShortcuts(prev => !prev);
        break;
    }
  }, [isSimulationRunning, simulation, isLoading, startSimulation, stopSimulation, stepSimulation, resetSimulation]);

  // Keyboard shortcuts
  useEffect(() => {
    if (showKeyboardShortcuts) {
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [showKeyboardShortcuts, handleKeyDown]);

  const currentGeneration = simulation?.currentState?.generation || 0;
  const canStart =
    !isLoading && simulation && !isSimulationRunning && isConnected;
  const canStop = !isLoading && simulation && isSimulationRunning;
  const canStep =
    !isLoading && simulation && !isSimulationRunning && isConnected;
  const canReset = !isLoading && simulation && isConnected;

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
                  disabled={!canStart && !canStop}
                  variant={isSimulationRunning ? "destructive" : "default"}
                  size="sm"
                >
                  {isLoading ? (
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
                  disabled={!canStep}
                  variant="outline"
                  size="sm"
                >
                  {isLoading ? (
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
                  disabled={!canReset}
                  variant="outline"
                  size="sm"
                >
                  {isLoading ? (
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
                    disabled={isLoading}
                    className="w-full [&>span]:bg-transparent [&>span>span]:bg-primary [&>span>span]:h-1.5 [&>button]:border-primary [&>button]:bg-primary [&>button]:h-4 [&>button]:w-4"
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
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
              {error}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearError}
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
