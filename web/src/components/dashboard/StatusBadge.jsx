import { Badge } from '@chakra-ui/react';

const severityColors = {
  BLOCKER: 'red',
  CRITICAL: 'red',
  MAJOR: 'orange',
  MINOR: 'yellow',
  INFO: 'blue',
};

const localStatusColors = {
  new: 'purple',
  acknowledged: 'blue',
  in_progress: 'cyan',
  resolved: 'green',
  false_positive: 'gray',
  wontfix: 'gray',
};

const typeColors = {
  VULNERABILITY: 'red',
  BUG: 'orange',
  CODE_SMELL: 'yellow',
  SECURITY_HOTSPOT: 'pink',
};

const qualityGateColors = {
  OK: 'green',
  WARN: 'yellow',
  ERROR: 'red',
};

export function SeverityBadge({ severity }) {
  return (
    <Badge colorPalette={severityColors[severity] || 'gray'} variant="solid" size="sm">
      {severity}
    </Badge>
  );
}

export function LocalStatusBadge({ status }) {
  const displayText = status?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Badge colorPalette={localStatusColors[status] || 'gray'} variant="subtle" size="sm">
      {displayText}
    </Badge>
  );
}

export function TypeBadge({ type }) {
  const displayText = type?.replace(/_/g, ' ');
  return (
    <Badge colorPalette={typeColors[type] || 'gray'} variant="outline" size="sm">
      {displayText}
    </Badge>
  );
}

export function QualityGateBadge({ status }) {
  return (
    <Badge colorPalette={qualityGateColors[status] || 'gray'} variant="solid" size="sm">
      {status}
    </Badge>
  );
}

export function PriorityBadge({ priority }) {
  const priorities = ['None', 'Low', 'Medium', 'High', 'Critical'];
  const colors = ['gray', 'blue', 'yellow', 'orange', 'red'];
  return (
    <Badge colorPalette={colors[priority] || 'gray'} variant="subtle" size="sm">
      {priorities[priority] || 'None'}
    </Badge>
  );
}
