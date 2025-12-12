import { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  SimpleGrid,
  Spinner,
} from '@chakra-ui/react';
import { useColorModeValue } from '../ui/color-mode';
import { FiRefreshCw, FiPlus } from 'react-icons/fi';
import { useProjects } from '../../hooks/useProjects';
import { useDashboard, useSyncStatus } from '../../hooks/useDashboard';
import { useFindings } from '../../hooks/useFindings';
import { SummaryCards } from './SummaryCards';
import { TrendChart } from './TrendChart';
import { SeverityPieChart } from './SeverityPieChart';
import { TopRulesChart } from './TopRulesChart';
import { FilterBar } from './FilterBar';
import { FindingsTable } from './FindingsTable';
import { FindingDetails } from './FindingDetails';

export function Dashboard({ onAddProject }) {
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  // Fetch projects
  const { projects, loading: projectsLoading } = useProjects();

  // Auto-select first project
  const activeProjectId = selectedProjectId || projects?.[0]?.id;

  // Dashboard data for selected project
  const {
    summary,
    trends,
    topRules,
    severityBreakdown,
    loading: dashboardLoading,
    refresh: refreshDashboard,
  } = useDashboard(activeProjectId);

  // Sync status
  const { syncStatus, syncing, triggerSync } = useSyncStatus(activeProjectId);

  // Findings for selected project
  const {
    findings,
    total,
    loading: findingsLoading,
    filters,
    updateFilters,
    setPage,
    refresh: refreshFindings,
    currentPage,
    totalPages,
  } = useFindings(activeProjectId);

  const handleSync = async () => {
    try {
      await triggerSync();
      // Refresh data after sync
      setTimeout(() => {
        refreshDashboard();
        refreshFindings();
      }, 2000);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const handleFindingClick = (finding) => {
    setSelectedFinding(finding);
    setDetailsOpen(true);
  };

  const handleFindingUpdate = () => {
    refreshFindings();
    refreshDashboard();
  };

  if (projectsLoading) {
    return (
      <Box p={8} textAlign="center">
        <Spinner size="xl" />
        <Text mt={4}>Loading projects...</Text>
      </Box>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <Box
        p={8}
        textAlign="center"
        bg={bgColor}
        borderWidth="1px"
        borderColor={borderColor}
        borderRadius="lg"
      >
        <Text fontSize="lg" mb={4}>
          No projects configured yet.
        </Text>
        <Text color="gray.500" mb={6}>
          Add a SonarQube project to start tracking findings.
        </Text>
        <Button colorPalette="blue" onClick={onAddProject}>
          <FiPlus />
          Add Project
        </Button>
      </Box>
    );
  }

  const selectedProject = projects.find((p) => p.id === activeProjectId);

  return (
    <VStack gap={6} align="stretch">
      {/* Project Selector & Actions */}
      <HStack justify="space-between" flexWrap="wrap" gap={4}>
        <HStack gap={4}>
          <Box
            as="select"
            value={activeProjectId || ''}
            onChange={(e) => setSelectedProjectId(parseInt(e.target.value))}
            bg={bgColor}
            borderWidth="1px"
            borderColor={borderColor}
            borderRadius="md"
            px={4}
            py={2}
            fontSize="md"
            fontWeight="medium"
            minW="250px"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Box>
          {selectedProject?.last_sync_at && (
            <Text fontSize="sm" color="gray.500">
              Last sync: {new Date(selectedProject.last_sync_at).toLocaleString()}
            </Text>
          )}
        </HStack>
        <HStack gap={2}>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? <Spinner size="sm" /> : <FiRefreshCw />}
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
          <Button colorPalette="blue" size="sm" onClick={onAddProject}>
            <FiPlus />
            Add Project
          </Button>
        </HStack>
      </HStack>

      {/* Summary Cards */}
      <SummaryCards summary={summary} loading={dashboardLoading} />

      {/* Charts */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} gap={6}>
        <TrendChart trends={trends} loading={dashboardLoading} />
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
          <SeverityPieChart breakdown={severityBreakdown} loading={dashboardLoading} />
          <TopRulesChart topRules={topRules} loading={dashboardLoading} />
        </SimpleGrid>
      </SimpleGrid>

      {/* Findings Section */}
      <Box>
        <Text fontSize="lg" fontWeight="semibold" mb={4}>
          Findings
        </Text>
        <VStack gap={4} align="stretch">
          <FilterBar
            filters={filters}
            onFilterChange={updateFilters}
            onRefresh={refreshFindings}
            loading={findingsLoading}
          />
          <FindingsTable
            findings={findings}
            loading={findingsLoading}
            total={total}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            onFindingClick={handleFindingClick}
            filters={filters}
            onSort={updateFilters}
          />
        </VStack>
      </Box>

      {/* Finding Details Drawer */}
      {selectedFinding && (
        <FindingDetails
          findingId={selectedFinding.id}
          isOpen={detailsOpen}
          onClose={() => {
            setDetailsOpen(false);
            setSelectedFinding(null);
          }}
          onUpdate={handleFindingUpdate}
        />
      )}
    </VStack>
  );
}
