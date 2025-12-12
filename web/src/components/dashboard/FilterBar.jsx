import {
  HStack,
  Input,
  IconButton,
  Box,
} from '@chakra-ui/react';
import { useColorModeValue } from '../ui/color-mode';
import { FiSearch, FiX, FiRefreshCw } from 'react-icons/fi';
import { useState, useEffect } from 'react';

const severityOptions = [
  { value: '', label: 'All Severities' },
  { value: 'BLOCKER', label: 'Blocker' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'MAJOR', label: 'Major' },
  { value: 'MINOR', label: 'Minor' },
  { value: 'INFO', label: 'Info' },
];

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'false_positive', label: 'False Positive' },
  { value: 'wontfix', label: "Won't Fix" },
];

const typeOptions = [
  { value: '', label: 'All Types' },
  { value: 'VULNERABILITY', label: 'Vulnerability' },
  { value: 'BUG', label: 'Bug' },
  { value: 'CODE_SMELL', label: 'Code Smell' },
  { value: 'SECURITY_HOTSPOT', label: 'Security Hotspot' },
];

export function FilterBar({ filters, onFilterChange, onRefresh, loading }) {
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.search) {
        onFilterChange({ search: searchValue });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue, filters.search, onFilterChange]);

  const handleClearFilters = () => {
    setSearchValue('');
    onFilterChange({
      severity: null,
      localStatus: null,
      type: null,
      search: '',
    });
  };

  const hasActiveFilters =
    filters.severity || filters.localStatus || filters.type || searchValue;

  return (
    <Box
      bg={bgColor}
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="lg"
      p={4}
    >
      <HStack gap={3} flexWrap="wrap">
        {/* Search Input */}
        <Box position="relative" flex="1" minW="200px">
          <Input
            placeholder="Search findings..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            pl={10}
          />
          <Box
            position="absolute"
            left={3}
            top="50%"
            transform="translateY(-50%)"
            color="gray.400"
          >
            <FiSearch />
          </Box>
        </Box>

        {/* Severity Filter */}
        <Box as="select"
          value={filters.severity || ''}
          onChange={(e) => onFilterChange({ severity: e.target.value || null })}
          bg={bgColor}
          borderWidth="1px"
          borderColor={borderColor}
          borderRadius="md"
          px={3}
          py={2}
          minW="140px"
        >
          {severityOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Box>

        {/* Status Filter */}
        <Box as="select"
          value={filters.localStatus || ''}
          onChange={(e) => onFilterChange({ localStatus: e.target.value || null })}
          bg={bgColor}
          borderWidth="1px"
          borderColor={borderColor}
          borderRadius="md"
          px={3}
          py={2}
          minW="140px"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Box>

        {/* Type Filter */}
        <Box as="select"
          value={filters.type || ''}
          onChange={(e) => onFilterChange({ type: e.target.value || null })}
          bg={bgColor}
          borderWidth="1px"
          borderColor={borderColor}
          borderRadius="md"
          px={3}
          py={2}
          minW="140px"
        >
          {typeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Box>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <IconButton
            aria-label="Clear filters"
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
          >
            <FiX />
          </IconButton>
        )}

        {/* Refresh */}
        <IconButton
          aria-label="Refresh"
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} />
        </IconButton>
      </HStack>
    </Box>
  );
}
