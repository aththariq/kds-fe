"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { LuCalendar, LuClock, LuPlay, LuTrash2, LuDownload, LuSearch, LuChevronDown, LuCheck, LuFileText, LuPackage, LuX } from "react-icons/lu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { simulationApiSimple, getErrorMessage } from "@/lib/api_new";
import { Simulation } from "@/types/simulation";
import ExportProgressDialog, { ExportProgressController } from "@/components/ExportProgressDialog";
import {
  exportSimulationJSON,
  exportSimulationCSV,
  exportSimulationsBatch,
  ExportFormat
} from "@/lib/exportUtils";

interface SimulationHistoryProps {
  onLoadSimulation?: (simulation: Simulation) => void;
  selectedSimulationIds?: string[];
  allowMultiSelect?: boolean;
  className?: string;
}

export default function SimulationHistory({
  className = "",
  allowMultiSelect = false,
  selectedSimulationIds = [],
  onLoadSimulation,
}: SimulationHistoryProps) {
  // Basic state
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "name">("date");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSimulations, setTotalSimulations] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedSimulationIds);

  // Export state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const exportControllerRef = useRef<ExportProgressController | null>(null);

  // Filtering and sorting state
  const [searchTerm, setSearchTerm] = useState("");

  // Constants
  const ITEMS_PER_PAGE = 12;

  // Fetch simulations from backend
  const fetchSimulations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // For now, using the simple API - we'll enhance it later to support pagination/filtering
      const allSimulations = await simulationApiSimple.getSimulations();

      // Apply client-side filtering and sorting until we enhance the API
      const filteredSimulations = allSimulations.filter(sim => {
        // Search filter
        const matchesSearch = searchTerm === "" ||
          sim.name.toLowerCase().includes(searchTerm.toLowerCase());

        // Status filter
        const matchesStatus = statusFilter === "all" ||
          (statusFilter === "running" && sim.currentState.isRunning) ||
          (statusFilter === "paused" && sim.currentState.isPaused) ||
          (statusFilter === "completed" && !sim.currentState.isRunning && !sim.currentState.isPaused);

        return matchesSearch && matchesStatus;
      });

      // Apply sorting
      filteredSimulations.sort((a, b) => {
        switch (sortBy) {
          case "date":
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case "name":
            return a.name.localeCompare(b.name);
          default:
            return 0;
        }
      });

      // Apply pagination
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      const endIndex = startIndex + ITEMS_PER_PAGE;
      const paginatedSimulations = filteredSimulations.slice(startIndex, endIndex);

      setSimulations(paginatedSimulations);
      setTotalSimulations(filteredSimulations.length);

    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, sortBy, currentPage]);

  // Load simulations on component mount and when filters change
  useEffect(() => {
    fetchSimulations();
  }, [fetchSimulations]);

  // Reset to first page when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [searchTerm, statusFilter, sortBy, currentPage]);

  // Handle simulation selection
  const handleSimulationSelect = useCallback((simulationId: string) => {
    if (!allowMultiSelect) {
      setSelectedIds([simulationId]);
      return;
    }

    setSelectedIds(prev => {
      if (prev.includes(simulationId)) {
        return prev.filter(id => id !== simulationId);
      } else {
        return [...prev, simulationId];
      }
    });
  }, [allowMultiSelect]);

  // Handle actions
  const handleDeleteSimulation = useCallback(async (simulationId: string) => {
    if (!confirm("Are you sure you want to delete this simulation? This action cannot be undone.")) {
      return;
    }

    try {
      await simulationApiSimple.deleteSimulation(simulationId);
      fetchSimulations(); // Refresh the list
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [fetchSimulations]);

  // Export functions
  const handleExportSimulation = useCallback(async (simulation: Simulation, format: ExportFormat = "json") => {
    if (!exportControllerRef.current) return;

    setShowExportDialog(true);

    try {
      if (format === "json") {
        await exportControllerRef.current.startExport(async (onProgress) => {
          await exportSimulationJSON(simulation, {
            includeMetadata: true,
            includeStatistics: true,
            includeBacteriaData: true,
          }, onProgress);
        });
      } else {
        await exportControllerRef.current.startExport(async (onProgress) => {
          await exportSimulationCSV(simulation, {
            includeMetadata: true,
            includeStatistics: true,
            includeBacteriaData: true,
          }, onProgress);
        });
      }
    } catch (error) {
      console.error("Export failed:", error);
    }
  }, []);

  const handleBatchExport = useCallback(async (format: ExportFormat = "json") => {
    if (!exportControllerRef.current || selectedIds.length === 0) return;

    const selectedSimulations = simulations.filter(sim => selectedIds.includes(sim.id));
    if (selectedSimulations.length === 0) return;

    setShowExportDialog(true);

    try {
      await exportControllerRef.current.startExport(async (onProgress) => {
        await exportSimulationsBatch(selectedSimulations, format, {
          includeMetadata: true,
          includeStatistics: true,
        }, onProgress);
      });
    } catch (error) {
      console.error("Batch export failed:", error);
    }
  }, [exportControllerRef, selectedIds, simulations]);

  const handleQuickExport = useCallback(async (simulation: Simulation) => {
    // Quick export without progress dialog for JSON
    try {
      await exportSimulationJSON(simulation, {
        includeMetadata: true,
        includeStatistics: true,
        includeBacteriaData: false, // Faster without bacteria data
      });
    } catch (error) {
      console.error("Quick export failed:", error);
      // Could show a toast notification here
    }
  }, []);

  // Get simulation status info
  const getSimulationStatus = useCallback((simulation: Simulation) => {
    if (simulation.currentState.isRunning) {
      return { label: "Running", color: "bg-green-500" };
    } else if (simulation.currentState.isPaused) {
      return { label: "Paused", color: "bg-yellow-500" };
    } else {
      return { label: "Completed", color: "bg-gray-500" };
    }
  }, []);

  // Format date
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }, []);

  // Get resistance percentage
  const getResistanceInfo = useCallback((simulation: Simulation) => {
    const stats = simulation.statistics;
    if (!stats.resistantCount.length || !stats.totalPopulation.length) {
      return { percentage: 0, trend: "stable" };
    }

    const latest = stats.resistantCount[stats.resistantCount.length - 1];
    const total = stats.totalPopulation[stats.totalPopulation.length - 1];
    const percentage = total > 0 ? (latest / total) * 100 : 0;

    // Determine trend (simplified)
    let trend = "stable";
    if (stats.resistantCount.length > 1) {
      const previous = stats.resistantCount[stats.resistantCount.length - 2];
      const prevTotal = stats.totalPopulation[stats.totalPopulation.length - 2];
      const prevPercentage = prevTotal > 0 ? (previous / prevTotal) * 100 : 0;

      if (percentage > prevPercentage + 1) trend = "increasing";
      else if (percentage < prevPercentage - 1) trend = "decreasing";
    }

    return { percentage, trend };
  }, []);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-bold tracking-tight">
              Simulation History
            </h2>
          </div>
          <p className="text-muted-foreground">
            {`${totalSimulations} simulation${totalSimulations !== 1 ? 's' : ''} found`}
          </p>
        </div>

        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
          {/* Batch Export Actions */}
          {selectedIds.length > 0 && (
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBatchExport("json")}
                className="flex items-center space-x-2"
              >
                <LuFileText className="h-4 w-4" />
                <span>Export JSON ({selectedIds.length})</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBatchExport("csv")}
                className="flex items-center space-x-2"
              >
                <LuPackage className="h-4 w-4" />
                <span>Export CSV ({selectedIds.length})</span>
              </Button>
            </div>
          )}

          {/* Clear Selection */}
          {selectedIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds([])}
              className="flex items-center space-x-2"
            >
              <LuX className="h-4 w-4" />
              <span>Clear ({selectedIds.length})</span>
            </Button>
          )}

          {/* Search and Filters */}
          <div className="flex space-x-2">
            <div className="relative">
              <LuSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search simulations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <option value="all">All Status</option>
              <option value="running">Running</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "date" | "name")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="date">Date</option>
              <option value="name">Name A-Z</option>
            </select>

            {/* Refresh Button */}
            <Button
              variant="outline"
              onClick={fetchSimulations}
              disabled={loading}
            >
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-600">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Simulations Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading simulations...</p>
          </div>
        </div>
      ) : simulations.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground mb-2">No simulations found</p>
              <p className="text-sm text-muted-foreground">
                {searchTerm || statusFilter !== "all"
                  ? "Try adjusting your search criteria"
                  : "Create your first simulation to get started"
                }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {simulations.map((simulation) => {
            const status = getSimulationStatus(simulation);
            const { date, time } = formatDate(simulation.createdAt);
            const resistance = getResistanceInfo(simulation);
            const isSelected = selectedIds.includes(simulation.id);

            return (
              <Card
                key={simulation.id}
                className={`transition-all hover:shadow-md ${
                  isSelected 
                    ? "ring-2 ring-blue-500 shadow-lg bg-blue-50/50" 
                    : "cursor-pointer hover:bg-gray-50/50"
                }`}
                onClick={() => {
                  if (allowMultiSelect) {
                    handleSimulationSelect(simulation.id);
                  }
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        {allowMultiSelect && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleSimulationSelect(simulation.id)}
                            className="mt-1"
                          />
                        )}
                        <CardTitle className="text-lg truncate">{simulation.name}</CardTitle>
                        {isSelected && (
                          <Badge variant="default" className="bg-blue-600 text-white text-xs">
                            <LuCheck className="h-3 w-3 mr-1" />
                            Selected
                          </Badge>
                        )}
                      </div>
                      {simulation.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 ml-6">
                          {simulation.description}
                        </p>
                      )}
                    </div>
                    <div className={`w-2 h-2 rounded-full ${status.color} ml-2 mt-2`} />
                  </div>

                  <div className="flex items-center justify-between ml-6">
                    <Badge variant="outline" className="text-xs">
                      {status.label}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      Gen {simulation.currentState.generation}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Key Stats */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Population</p>
                      <p className="font-medium">{simulation.currentState.bacteria.length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Resistance</p>
                      <p className="font-medium">{resistance.percentage.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Growth Rate</p>
                      <p className="font-medium">{(simulation.parameters.growthRate * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Antibiotic</p>
                      <p className="font-medium">{(simulation.parameters.antibioticConcentration * 100).toFixed(0)}%</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Date/Time Info */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <LuCalendar className="h-3 w-3" />
                      <span>{date}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <LuClock className="h-3 w-3" />
                      <span>{time}</span>
                    </div>
                  </div>

                  {/* Action Buttons - Hidden in compare mode */}
                  {!allowMultiSelect && (
                    <div className="flex items-center space-x-2 pt-2">
                      <div className="flex space-x-2">
                        {/* Export Dropdown */}
                        <div className="relative group">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center space-x-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <LuDownload className="h-3 w-3" />
                            <span>Export</span>
                            <LuChevronDown className="h-3 w-3" />
                          </Button>

                          {/* Dropdown Menu */}
                          <div className="absolute right-0 top-full mt-1 w-36 bg-white border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                            <button
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickExport(simulation);
                              }}
                            >
                              <LuFileText className="h-3 w-3" />
                              <span>Quick JSON</span>
                            </button>
                            <button
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportSimulation(simulation, "json");
                              }}
                            >
                              <LuFileText className="h-3 w-3" />
                              <span>Full JSON</span>
                            </button>
                            <button
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportSimulation(simulation, "csv");
                              }}
                            >
                              <LuPackage className="h-3 w-3" />
                              <span>CSV Export</span>
                            </button>
                          </div>
                        </div>

                        {onLoadSimulation && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onLoadSimulation(simulation);
                            }}
                            className="flex items-center space-x-2"
                          >
                            <LuPlay className="h-3 w-3" />
                            <span>Load</span>
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSimulation(simulation.id);
                          }}
                          className="flex items-center space-x-2 text-red-600 hover:text-red-700"
                        >
                          <LuTrash2 className="h-3 w-3" />
                          <span>Delete</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalSimulations > 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalSimulations)} of {totalSimulations} simulations
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalSimulations) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-8 h-8"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  {totalSimulations > 5 && (
                    <>
                      {totalSimulations > 6 && <span className="text-muted-foreground">...</span>}
                      <Button
                        variant={currentPage === totalSimulations ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setCurrentPage(totalSimulations)}
                        className="w-8 h-8"
                      >
                        {totalSimulations}
                      </Button>
                    </>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalSimulations, prev + 1))}
                  disabled={currentPage === totalSimulations}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Progress Dialog */}
      <ExportProgressDialog
        ref={exportControllerRef}
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        title="Exporting Simulation Data"
        allowCancel={true}
      />
    </div>
  );
}
